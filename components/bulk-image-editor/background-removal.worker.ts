/// <reference lib="webworker" />

import { removeBackground } from "@imgly/background-removal";

import {
  isImglyRemoveBackgroundModel,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getImglyModel(
  model: RemoveBackgroundSettings["model"],
) {
  return isImglyRemoveBackgroundModel(model) ? model : "isnet_quint8";
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
  const nextBlob = await removeBackground(blob, {
    device: "cpu",
    model: getImglyModel(settings.model),
    output: {
      format: "image/png",
      quality: 1,
    },
  });
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

self.onmessage = async (event: MessageEvent<BackgroundRemovalRequest>) => {
  const { id, blob, settings } = event.data;

  try {
    const result =
      settings.provider === "imgly"
        ? await removeBackgroundWithImgly(blob, settings)
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
