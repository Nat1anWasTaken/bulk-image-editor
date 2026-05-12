/// <reference lib="webworker" />

import {
  newSession as createRembgSession,
  rembgConfig,
  remove as removeRembgBackground,
  type BaseSession,
} from "@bunnio/rembg-web";
import { removeBackground } from "@imgly/background-removal";

import {
  isImglyRemoveBackgroundModel,
  isRembgRemoveBackgroundModel,
} from "@/components/bulk-image-editor/remove-background-options";
import type { RemoveBackgroundSettings } from "@/components/bulk-image-editor/types";

type BackgroundRemovalRequest = {
  id: string;
  blob: Blob;
  settings: RemoveBackgroundSettings;
};

type BackgroundRemovalSuccess = {
  id: string;
  ok: true;
  result: {
    blob: Blob;
    width: number;
    height: number;
    mimeType: string;
  };
};

type BackgroundRemovalFailure = {
  id: string;
  ok: false;
  error: string;
};

type BackgroundRemovalResponse =
  | BackgroundRemovalSuccess
  | BackgroundRemovalFailure;

let rembgEnvironmentReady = false;
let rembgWebGPUDisabled = false;
let imglyWebGPUDisabled = false;
const rembgSessionCache = new Map<string, Promise<BaseSession>>();

function isWebGPUUnsupportedOpError(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);
  return (
    /not yet supported|not supported|webgpu/i.test(message) &&
    /maxpool|ceil|shape computation|kernel|jsep|webgpu/i.test(message)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getImglyModel(
  model: RemoveBackgroundSettings["model"],
) {
  return isImglyRemoveBackgroundModel(model) ? model : "isnet_quint8";
}

function getRembgModel(
  model: RemoveBackgroundSettings["model"],
) {
  return isRembgRemoveBackgroundModel(model) ? model : "u2netp";
}

function ensureRembgEnvironment() {
  if (rembgEnvironmentReady) {
    return;
  }

  rembgConfig.setBaseUrl("/models");

  const globalScope = globalThis as unknown as {
    HTMLCanvasElement?: typeof OffscreenCanvas;
    document?: {
      createElement: (tagName: string) => OffscreenCanvas;
    };
  };

  if (!globalScope.HTMLCanvasElement) {
    globalScope.HTMLCanvasElement = OffscreenCanvas;
  }

  if (!globalScope.document) {
    globalScope.document = {
      createElement(tagName: string) {
        if (tagName !== "canvas") {
          throw new Error(`Unsupported element requested in worker: ${tagName}`);
        }

        return new OffscreenCanvas(1, 1);
      },
    };
  }

  const offscreenCanvasPrototype = OffscreenCanvas.prototype as OffscreenCanvas & {
    toBlob?: (
      callback: BlobCallback,
      type?: string,
      quality?: number,
    ) => void;
  };

  if (!("toBlob" in offscreenCanvasPrototype)) {
    Object.defineProperty(offscreenCanvasPrototype, "toBlob", {
      configurable: true,
      value(
        this: OffscreenCanvas,
        callback: BlobCallback,
        type?: string,
        quality?: number,
      ) {
        void this.convertToBlob({ type, quality }).then(callback).catch(() => {
          callback(null);
        });
      },
    });
  }

  rembgEnvironmentReady = true;
}

async function getRembgSession(model: RemoveBackgroundSettings["model"]) {
  ensureRembgEnvironment();

  const rembgModel = getRembgModel(model);
  const cacheKey = `${rembgModel}:${rembgWebGPUDisabled ? "wasm" : "webgpu"}`;
  const cachedSession = rembgSessionCache.get(cacheKey);

  if (cachedSession) {
    return cachedSession;
  }

  const sessionPromise = (async () => {
    const modelPath = `/models/${rembgModel}.onnx`;
    const response = await fetch(modelPath, {
      method: "HEAD",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `rembg-web model "${rembgModel}" was not found at ${modelPath}. Download the ONNX file into public/models/${rembgModel}.onnx.`,
      );
    }

    rembgConfig.setCustomModelPath(rembgModel, modelPath);

    const sessionOptions = rembgWebGPUDisabled
      ? { executionProviders: ["wasm"] }
      : {
          preferWebGPU: true,
          webgpuPowerPreference: "high-performance" as const,
        };

    try {
      return await createRembgSession(rembgModel, undefined, sessionOptions);
    } catch (error) {
      throw new Error(
        `Failed to load rembg-web model "${rembgModel}" from ${modelPath}. Verify that public/models/${rembgModel}.onnx exists and is readable.`,
        { cause: error },
      );
    }
  })();

  rembgSessionCache.set(cacheKey, sessionPromise);

  try {
    return await sessionPromise;
  } catch (error) {
    rembgSessionCache.delete(cacheKey);
    throw error;
  }
}

function disableRembgWebGPU() {
  if (rembgWebGPUDisabled) {
    return;
  }
  rembgWebGPUDisabled = true;
  for (const key of Array.from(rembgSessionCache.keys())) {
    if (key.endsWith(":webgpu")) {
      rembgSessionCache.delete(key);
    }
  }
}

async function bitmapFromBlob(blob: Blob) {
  return createImageBitmap(blob);
}

function averageCornerColor(data: Uint8ClampedArray, width: number, height: number) {
  const sampleRadius = Math.max(1, Math.floor(Math.min(width, height) * 0.02));
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let count = 0;

  for (const [cx, cy] of corners) {
    for (let y = Math.max(0, cy - sampleRadius); y <= Math.min(height - 1, cy + sampleRadius); y += 1) {
      for (let x = Math.max(0, cx - sampleRadius); x <= Math.min(width - 1, cx + sampleRadius); x += 1) {
        const index = (y * width + x) * 4;
        red += data[index];
        green += data[index + 1];
        blue += data[index + 2];
        alpha += data[index + 3];
        count += 1;
      }
    }
  }

  return {
    red: red / count,
    green: green / count,
    blue: blue / count,
    alpha: alpha / count,
  };
}

function colorDistance(
  data: Uint8ClampedArray,
  pixelIndex: number,
  reference: { red: number; green: number; blue: number; alpha: number },
) {
  const dr = data[pixelIndex] - reference.red;
  const dg = data[pixelIndex + 1] - reference.green;
  const db = data[pixelIndex + 2] - reference.blue;
  const da = data[pixelIndex + 3] - reference.alpha;

  return Math.sqrt(dr * dr + dg * dg + db * db + da * da * 0.25);
}

async function removeBackgroundWithEdgeFlood(
  blob: Blob,
  settings: RemoveBackgroundSettings,
) {
  const bitmap = await bitmapFromBlob(blob);

  try {
    const width = bitmap.width;
    const height = bitmap.height;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;
    const reference = averageCornerColor(data, width, height);
    const threshold = clamp(settings.threshold, 8, 180);
    const queue = new Uint32Array(width * height);
    const visited = new Uint8Array(width * height);
    let head = 0;
    let tail = 0;

    function enqueue(x: number, y: number) {
      const offset = y * width + x;

      if (visited[offset]) {
        return;
      }

      visited[offset] = 1;
      queue[tail] = offset;
      tail += 1;
    }

    for (let x = 0; x < width; x += 1) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }

    for (let y = 1; y < height - 1; y += 1) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    while (head < tail) {
      const offset = queue[head];
      head += 1;

      const x = offset % width;
      const y = Math.floor(offset / width);
      const pixelIndex = offset * 4;

      if (colorDistance(data, pixelIndex, reference) > threshold) {
        continue;
      }

      data[pixelIndex + 3] = 0;

      if (x > 0) {
        enqueue(x - 1, y);
      }
      if (x < width - 1) {
        enqueue(x + 1, y);
      }
      if (y > 0) {
        enqueue(x, y - 1);
      }
      if (y < height - 1) {
        enqueue(x, y + 1);
      }
    }

    context.putImageData(imageData, 0, 0);
    const nextBlob = await canvas.convertToBlob({ type: "image/png", quality: 1 });

    return {
      blob: nextBlob,
      width,
      height,
      mimeType: "image/png",
    };
  } finally {
    bitmap.close();
  }
}

async function removeBackgroundWithImgly(blob: Blob, settings: RemoveBackgroundSettings) {
  const runImgly = (device: "cpu" | "gpu") =>
    removeBackground(blob, {
      device,
      model: getImglyModel(settings.model),
      output: {
        format: "image/png",
        quality: 1,
      },
    });

  let nextBlob: Blob;
  try {
    nextBlob = await runImgly(imglyWebGPUDisabled ? "cpu" : "gpu");
  } catch (error) {
    if (!imglyWebGPUDisabled && isWebGPUUnsupportedOpError(error)) {
      imglyWebGPUDisabled = true;
      nextBlob = await runImgly("cpu");
    } else {
      throw error;
    }
  }

  const bitmap = await bitmapFromBlob(nextBlob);

  try {
    return {
      blob: nextBlob,
      width: bitmap.width,
      height: bitmap.height,
      mimeType: "image/png",
    };
  } finally {
    bitmap.close();
  }
}

async function removeBackgroundWithRembg(
  blob: Blob,
  settings: RemoveBackgroundSettings,
) {
  const bitmap = await bitmapFromBlob(blob);

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    context.drawImage(bitmap, 0, 0);

    const runWithCurrentBackend = async () => {
      const session = await getRembgSession(settings.model);
      return removeRembgBackground(canvas as unknown as HTMLCanvasElement, {
        session,
      });
    };

    let nextBlob: Blob;
    try {
      nextBlob = await runWithCurrentBackend();
    } catch (error) {
      if (!rembgWebGPUDisabled && isWebGPUUnsupportedOpError(error)) {
        disableRembgWebGPU();
        nextBlob = await runWithCurrentBackend();
      } else {
        throw error;
      }
    }

    const resultBitmap = await bitmapFromBlob(nextBlob);

    try {
      return {
        blob: nextBlob,
        width: resultBitmap.width,
        height: resultBitmap.height,
        mimeType: "image/png",
      };
    } finally {
      resultBitmap.close();
    }
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (event: MessageEvent<BackgroundRemovalRequest>) => {
  const { id, blob, settings } = event.data;

  try {
    const result =
      settings.provider === "imgly"
        ? await removeBackgroundWithImgly(blob, settings)
        : settings.provider === "rembg"
          ? await removeBackgroundWithRembg(blob, settings)
        : await removeBackgroundWithEdgeFlood(blob, settings);

    const response: BackgroundRemovalResponse = {
      id,
      ok: true,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: BackgroundRemovalResponse = {
      id,
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Background removal failed in the worker.",
    };
    self.postMessage(response);
  }
};
