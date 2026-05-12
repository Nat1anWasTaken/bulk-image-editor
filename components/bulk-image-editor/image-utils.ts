"use client";

import type {
  CropSettings,
  EditorActionId,
  EditorImage,
  ExportFormat,
  ImageVersion,
  RemoveBackgroundSettings,
} from "@/components/bulk-image-editor/types";

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFileNameStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").trim() || "image";
  return stem.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
}

export async function loadImageFromBlob(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load image."));
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function fileToEditorImage(file: File): Promise<EditorImage> {
  const blob = file.slice(0, file.size, file.type || "image/png");
  const image = await loadImageFromBlob(blob);
  const objectUrl = URL.createObjectURL(blob);
  const originalVersionId = createId("version");

  return {
    id: createId("image"),
    name: file.name,
    fileNameStem: sanitizeFileNameStem(file.name),
    originalFileName: file.name,
    activeVersionId: originalVersionId,
    versions: [
      {
        id: originalVersionId,
        label: "Original",
        actionId: "original",
        sourceVersionId: null,
        blob,
        objectUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
        mimeType: blob.type || "image/png",
        createdAt: Date.now(),
      },
    ],
  };
}

export function getActiveVersion(image: EditorImage) {
  return (
    image.versions.find((version) => version.id === image.activeVersionId) ??
    image.versions[image.versions.length - 1]
  );
}

export async function cropVersion(
  version: ImageVersion,
  crop: CropSettings,
): Promise<Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">> {
  const image = await loadImageFromBlob(version.blob);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  const sx = Math.round(clamp(crop.x, 0, 1) * sourceWidth);
  const sy = Math.round(clamp(crop.y, 0, 1) * sourceHeight);
  const sw = Math.max(1, Math.round(clamp(crop.width, 0.05, 1) * sourceWidth));
  const sh = Math.max(1, Math.round(clamp(crop.height, 0.05, 1) * sourceHeight));
  const cropWidth = Math.min(sw, sourceWidth - sx);
  const cropHeight = Math.min(sh, sourceHeight - sy);

  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const mimeType = version.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await canvasToBlob(canvas, mimeType, 1);

  return {
    blob,
    width: cropWidth,
    height: cropHeight,
    mimeType,
  };
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

export async function removeBackgroundFromVersion(
  version: ImageVersion,
  settings: RemoveBackgroundSettings,
): Promise<Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">> {
  if (settings.provider === "imgly") {
    return removeBackgroundWithImgly(version, settings);
  }

  return removeBackgroundWithEdgeFlood(version, settings);
}

async function removeBackgroundWithEdgeFlood(
  version: ImageVersion,
  settings: RemoveBackgroundSettings,
): Promise<Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">> {
  const image = await loadImageFromBlob(version.blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
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
  const blob = await canvasToBlob(canvas, "image/png", 1);

  return {
    blob,
    width,
    height,
    mimeType: "image/png",
  };
}

async function removeBackgroundWithImgly(
  version: ImageVersion,
  settings: RemoveBackgroundSettings,
): Promise<Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">> {
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(version.blob, {
    device: "cpu",
    model: settings.model,
    output: {
      format: "image/png",
      quality: 1,
    },
  });
  const image = await loadImageFromBlob(blob);

  return {
    blob,
    width: image.naturalWidth,
    height: image.naturalHeight,
    mimeType: "image/png",
  };
}

export async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

  if (!blob) {
    throw new Error("Failed to encode image.");
  }

  return blob;
}

export function createDerivedVersion(
  sourceVersion: ImageVersion,
  actionId: EditorActionId,
  label: string,
  result: Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">,
): ImageVersion {
  return {
    id: createId("version"),
    label,
    actionId,
    sourceVersionId: sourceVersion.id,
    blob: result.blob,
    objectUrl: URL.createObjectURL(result.blob),
    width: result.width,
    height: result.height,
    mimeType: result.mimeType,
    createdAt: Date.now(),
  };
}

export async function encodeVersionForDownload(version: ImageVersion, format: ExportFormat) {
  if (format === "png") {
    if (version.mimeType === "image/png") {
      return version.blob;
    }

    const image = await loadImageFromBlob(version.blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    context.drawImage(image, 0, 0);
    return canvasToBlob(canvas, "image/png", 1);
  }

  const image = await loadImageFromBlob(version.blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  return canvasToBlob(canvas, "image/jpeg", 1);
}
