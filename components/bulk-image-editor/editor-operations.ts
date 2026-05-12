import JSZip from "jszip";

import { mapInBatches, normalizeBatchSize } from "@/components/bulk-image-editor/batch-processing";
import { encodeVersionForDownload, getActiveVersion } from "@/components/bulk-image-editor/image-utils";
import type {
  ActionExecutionContext,
  ActionProgress,
  EditorActionId,
  EditorImage,
  ExportFormat,
  ImageVersion,
} from "@/components/bulk-image-editor/types";

type ActionDefinition = {
  apply: (
    sourceVersion: ImageVersion,
    context: ActionExecutionContext,
  ) => Promise<ImageVersion>;
};

export async function applyActionToImages({
  actionId,
  actionSettings,
  batchSize,
  definition,
  images,
  onProgress,
  scope,
  selectedImageId,
}: {
  actionId: EditorActionId;
  actionSettings: ActionExecutionContext;
  batchSize: number;
  definition: ActionDefinition;
  images: EditorImage[];
  onProgress: (progress: ActionProgress, nextImages?: EditorImage[]) => void;
  scope: "selected" | "all";
  selectedImageId: string | null;
}) {
  const resolvedBatchSize = normalizeBatchSize(batchSize);
  const targetEntries = images
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => scope !== "selected" || image.id === selectedImageId);

  if (!targetEntries.length) {
    return null;
  }

  onProgress({
    kind: "apply",
    actionId,
    scope,
    completed: 0,
    total: targetEntries.length,
    currentImageName: targetEntries[0]?.image.name ?? null,
  });

  let workingImages = images;

  await mapInBatches(
    targetEntries,
    scope === "selected" ? 1 : resolvedBatchSize,
    async ({ image, index }) => {
      const currentImage = workingImages[index] ?? image;
      const sourceVersion = getActiveVersion(currentImage);
      const nextVersion = await definition.apply(sourceVersion, actionSettings);

      return {
        index,
        nextImage: {
          ...currentImage,
          activeVersionId: nextVersion.id,
          versions: [...currentImage.versions, nextVersion],
        },
      };
    },
    (batchResults) => {
      const completed = Math.min(
        targetEntries.length,
        batchResults[batchResults.length - 1]!.index + 1,
      );

      for (const { result } of batchResults) {
        workingImages = [
          ...workingImages.slice(0, result.index),
          result.nextImage,
          ...workingImages.slice(result.index + 1),
        ];
      }

      onProgress(
        {
          kind: "apply",
          actionId,
          scope,
          completed,
          total: targetEntries.length,
          currentImageName:
            completed < targetEntries.length
              ? targetEntries[completed]?.image.name ?? null
              : null,
        },
        workingImages,
      );
    },
  );

  return workingImages;
}

export async function exportImagesArchive({
  batchSize,
  downloadFormat,
  images,
  onProgress,
}: {
  batchSize: number;
  downloadFormat: ExportFormat;
  images: EditorImage[];
  onProgress: (progress: {
    kind: "download";
    completed: number;
    total: number;
    currentImageName: string | null;
  }) => void;
}) {
  const zip = new JSZip();
  const resolvedBatchSize = normalizeBatchSize(batchSize);

  onProgress({
    kind: "download",
    completed: 0,
    total: images.length,
    currentImageName: images[0]?.name ?? null,
  });

  await mapInBatches(
    images,
    resolvedBatchSize,
    async (image) => {
      const active = getActiveVersion(image);
      const encoded = await encodeVersionForDownload(active, downloadFormat);

      return {
        image,
        encoded,
      };
    },
    (batchResults) => {
      const completed = Math.min(images.length, batchResults[batchResults.length - 1]!.index + 1);
      const extension = downloadFormat === "png" ? "png" : "jpg";

      for (const { result } of batchResults) {
        zip.file(`${result.image.fileNameStem}.${extension}`, result.encoded);
      }

      onProgress({
        kind: "download",
        completed,
        total: images.length,
        currentImageName: images[completed]?.name ?? null,
      });
    },
  );

  return zip.generateAsync({ type: "blob" });
}
