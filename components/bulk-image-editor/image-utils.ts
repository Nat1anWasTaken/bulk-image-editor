"use client";

import type {
  CropSettings,
  EditorActionId,
  EditorImage,
  ExportFormat,
  ImageVersion,
  RemoveBackgroundSettings,
} from "@/components/bulk-image-editor/types";

type BackgroundRemovalWorkerRequest = {
  id: string;
  blob: Blob;
  settings: RemoveBackgroundSettings;
};

type BackgroundRemovalWorkerResponse =
  | {
      id: string;
      ok: true;
      result: Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };

let backgroundRemovalWorker: Worker | null = null;
const backgroundRemovalResolvers = new Map<
  string,
  {
    resolve: (value: Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">) => void;
    reject: (reason?: unknown) => void;
  }
>();

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getBackgroundRemovalWorker() {
  if (backgroundRemovalWorker) {
    return backgroundRemovalWorker;
  }

  backgroundRemovalWorker = new Worker(
    new URL("./background-removal.worker.ts", import.meta.url),
    { type: "module" },
  );
  backgroundRemovalWorker.onmessage = (
    event: MessageEvent<BackgroundRemovalWorkerResponse>,
  ) => {
    const pending = backgroundRemovalResolvers.get(event.data.id);

    if (!pending) {
      return;
    }

    backgroundRemovalResolvers.delete(event.data.id);

    if (event.data.ok) {
      pending.resolve(event.data.result);
      return;
    }

    pending.reject(new Error(event.data.error));
  };
  backgroundRemovalWorker.onerror = (event) => {
    const error = new Error(event.message || "Background removal worker crashed.");

    for (const { reject } of backgroundRemovalResolvers.values()) {
      reject(error);
    }

    backgroundRemovalResolvers.clear();
    backgroundRemovalWorker?.terminate();
    backgroundRemovalWorker = null;
  };

  return backgroundRemovalWorker;
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

export async function removeBackgroundFromVersion(
  version: ImageVersion,
  settings: RemoveBackgroundSettings,
): Promise<Pick<ImageVersion, "blob" | "width" | "height" | "mimeType">> {
  const worker = getBackgroundRemovalWorker();
  const id = createId("bg-remove");

  return new Promise((resolve, reject) => {
    backgroundRemovalResolvers.set(id, { resolve, reject });

    const request: BackgroundRemovalWorkerRequest = {
      id,
      blob: version.blob,
      settings,
    };

    worker.postMessage(request);
  });
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

export async function fileToImageVersion(file: File): Promise<ImageVersion> {
  const blob = file.slice(0, file.size, file.type || "image/png");
  const image = await loadImageFromBlob(blob);
  const objectUrl = URL.createObjectURL(blob);

  return {
    id: createId("version"),
    label: sanitizeFileNameStem(file.name),
    actionId: "original",
    sourceVersionId: null,
    blob,
    objectUrl,
    width: image.naturalWidth,
    height: image.naturalHeight,
    mimeType: blob.type || "image/png",
    createdAt: Date.now(),
  };
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
