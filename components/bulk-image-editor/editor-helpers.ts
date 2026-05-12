import type { CropSettings } from "@/components/bulk-image-editor/types";

export const MIN_CROP_SIZE = 0.05;

export function formatDimensions(width: number, height: number) {
  return `${width} x ${height}`;
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCrop(crop: CropSettings) {
  const width = clamp(crop.width, MIN_CROP_SIZE, 1);
  const height = clamp(crop.height, MIN_CROP_SIZE, 1);
  const x = clamp(crop.x, 0, 1 - width);
  const y = clamp(crop.y, 0, 1 - height);

  return { x, y, width, height };
}

export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}
