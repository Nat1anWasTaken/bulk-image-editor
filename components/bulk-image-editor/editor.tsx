"use client";

import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { ACTIONS } from "@/components/bulk-image-editor/actions";
import { BulkImageEditorActionSidebar } from "@/components/bulk-image-editor/action-sidebar";
import { BulkImageEditorEmptyState } from "@/components/bulk-image-editor/empty-state";
import {
  clamp,
  isEditableTarget,
  MIN_CROP_SIZE,
  normalizeCrop,
} from "@/components/bulk-image-editor/editor-helpers";
import { BulkImageEditorImageListSidebar } from "@/components/bulk-image-editor/image-list-sidebar";
import { BulkImageEditorImagePreview } from "@/components/bulk-image-editor/image-preview";
import {
  encodeVersionForDownload,
  fileToEditorImage,
  getActiveVersion,
} from "@/components/bulk-image-editor/image-utils";
import { getCompatibleRemoveBackgroundModel } from "@/components/bulk-image-editor/remove-background-options";
import { BulkImageEditorWorkspaceHeader } from "@/components/bulk-image-editor/workspace-header";
import type {
  ActionProgress,
  EditorActionId,
  EditorActionSettings,
  EditorImage,
  ExportFormat,
  RemoveBackgroundSettings,
} from "@/components/bulk-image-editor/types";

const INITIAL_ACTION_SETTINGS: EditorActionSettings = {
  crop: {
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  },
  "remove-background": {
    threshold: 42,
    provider: "imgly",
    model: "isnet_quint8",
  },
};

type CropHandle = "move" | "nw" | "ne" | "se" | "sw";

type CropInteraction = {
  handle: CropHandle;
  pointerId: number;
  originX: number;
  originY: number;
  startCrop: EditorActionSettings["crop"];
};

export function BulkImageEditor() {
  const [images, setImages] = useState<EditorImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<EditorActionId>("crop");
  const [actionSettings, setActionSettings] =
    useState<EditorActionSettings>(INITIAL_ACTION_SETTINGS);
  const [downloadFormat, setDownloadFormat] = useState<ExportFormat>("png");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState<ActionProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const objectUrlsRef = useRef<string[]>([]);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const cropInteractionRef = useRef<CropInteraction | null>(null);

  const selectedImage = selectedImageId
    ? images.find((image) => image.id === selectedImageId) ?? null
    : null;
  const selectedImageIndex = images.findIndex((image) => image.id === selectedImageId);
  const activeVersion = selectedImage ? getActiveVersion(selectedImage) : null;
  const isApplying = applyProgress !== null;

  useEffect(() => {
    objectUrlsRef.current = images.flatMap((image) =>
      image.versions.map((version) => version.objectUrl),
    );
  }, [images]);

  useEffect(() => {
    return () => {
      for (const objectUrl of objectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !images.length ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== "j" && key !== "k") {
        return;
      }

      event.preventDefault();

      const currentIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
      const direction = key === "j" ? 1 : -1;
      const nextIndex = (currentIndex + direction + images.length) % images.length;
      setSelectedImageId(images[nextIndex]?.id ?? null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images, selectedImageIndex]);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    setErrorMessage(null);

    try {
      const nextImages = await Promise.all(
        Array.from(fileList)
          .filter((file) => file.type.startsWith("image/"))
          .map((file) => fileToEditorImage(file)),
      );

      if (!nextImages.length) {
        setErrorMessage("Select image files to start editing.");
        return;
      }

      setImages(nextImages);
      setSelectedImageId(nextImages[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load images.");
    }
  }

  function setActiveVersion(imageId: string, versionId: string) {
    setImages((currentImages) =>
      currentImages.map((image) =>
        image.id === imageId ? { ...image, activeVersionId: versionId } : image,
      ),
    );
    setSelectedImageId(imageId);
  }

  function updateCropSetting(key: "x" | "y" | "width" | "height", value: number) {
    setActionSettings((current) => {
      const nextCrop = normalizeCrop({
        ...current.crop,
        [key]: value,
      });

      return {
        ...current,
        crop: nextCrop,
      };
    });
  }

  function updateCrop(nextCrop: EditorActionSettings["crop"]) {
    setActionSettings((current) => ({
      ...current,
      crop: normalizeCrop(nextCrop),
    }));
  }

  function updateRemoveBackgroundProvider(
    provider: RemoveBackgroundSettings["provider"],
  ) {
    setActionSettings((current) => ({
      ...current,
      "remove-background": {
        ...current["remove-background"],
        provider,
        model: getCompatibleRemoveBackgroundModel(
          provider,
          current["remove-background"].model,
        ),
      },
    }));
  }

  function updateRemoveBackgroundModel(model: RemoveBackgroundSettings["model"]) {
    setActionSettings((current) => ({
      ...current,
      "remove-background": {
        ...current["remove-background"],
        model,
      },
    }));
  }

  function updateRemoveBackgroundThreshold(threshold: number) {
    setActionSettings((current) => ({
      ...current,
      "remove-background": {
        ...current["remove-background"],
        threshold,
      },
    }));
  }

  function beginCropInteraction(
    event: React.PointerEvent<HTMLElement>,
    handle: CropHandle,
  ) {
    if (!previewFrameRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    cropInteractionRef.current = {
      handle,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startCrop: actionSettings.crop,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropPointerMove(event: React.PointerEvent<HTMLElement>) {
    const interaction = cropInteractionRef.current;
    const frame = previewFrameRef.current;

    if (!interaction || interaction.pointerId !== event.pointerId || !frame) {
      return;
    }

    event.preventDefault();

    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const dx = (event.clientX - interaction.originX) / rect.width;
    const dy = (event.clientY - interaction.originY) / rect.height;
    const startCrop = interaction.startCrop;

    if (interaction.handle === "move") {
      updateCrop({
        ...startCrop,
        x: startCrop.x + dx,
        y: startCrop.y + dy,
      });
      return;
    }

    const nextCrop = { ...startCrop };

    if (interaction.handle.includes("w")) {
      const nextX = clamp(startCrop.x + dx, 0, startCrop.x + startCrop.width - MIN_CROP_SIZE);
      nextCrop.x = nextX;
      nextCrop.width = startCrop.width + (startCrop.x - nextX);
    }

    if (interaction.handle.includes("e")) {
      nextCrop.width = clamp(startCrop.width + dx, MIN_CROP_SIZE, 1 - startCrop.x);
    }

    if (interaction.handle.includes("n")) {
      const nextY = clamp(startCrop.y + dy, 0, startCrop.y + startCrop.height - MIN_CROP_SIZE);
      nextCrop.y = nextY;
      nextCrop.height = startCrop.height + (startCrop.y - nextY);
    }

    if (interaction.handle.includes("s")) {
      nextCrop.height = clamp(startCrop.height + dy, MIN_CROP_SIZE, 1 - startCrop.y);
    }

    updateCrop(nextCrop);
  }

  function endCropInteraction(event: React.PointerEvent<HTMLElement>) {
    const interaction = cropInteractionRef.current;

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    cropInteractionRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function yieldToBrowser() {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }

  async function applyAction(scope: "selected" | "all") {
    const definition = ACTIONS[selectedActionId];

    if (!definition || isApplying) {
      return;
    }

    setErrorMessage(null);
    const executionContext = actionSettings;
    const targetEntries = images
      .map((image, index) => ({ image, index }))
      .filter(({ image }) => scope !== "selected" || image.id === selectedImageId);

    if (!targetEntries.length) {
      return;
    }

    setApplyProgress({
      actionId: selectedActionId,
      scope,
      completed: 0,
      total: targetEntries.length,
      currentImageName: targetEntries[0]?.image.name ?? null,
    });

    try {
      const nextImages = [...images];

      for (const [processedCount, { image, index }] of targetEntries.entries()) {
        setApplyProgress((current) =>
          current
            ? {
                ...current,
                currentImageName: image.name,
              }
            : current,
        );

        await yieldToBrowser();

        const sourceVersion = getActiveVersion(nextImages[index] ?? image);
        const nextVersion = await definition.apply(sourceVersion, executionContext);
        nextImages[index] = {
          ...image,
          activeVersionId: nextVersion.id,
          versions: [...image.versions, nextVersion],
        };

        setImages([...nextImages]);
        setApplyProgress((current) =>
          current
            ? {
                ...current,
                completed: processedCount + 1,
                currentImageName:
                  processedCount + 1 < targetEntries.length
                    ? targetEntries[processedCount + 1]?.image.name ?? null
                    : null,
              }
            : current,
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The image action failed to complete.",
      );
    } finally {
      setApplyProgress(null);
    }
  }

  function resetWorkspace() {
    for (const image of images) {
      for (const version of image.versions) {
        URL.revokeObjectURL(version.objectUrl);
      }
    }

    setImages([]);
    setSelectedImageId(null);
    setErrorMessage(null);
  }

  function downloadAll() {
    if (!images.length || isApplying || isDownloading) {
      return;
    }

    setErrorMessage(null);
    setIsDownloading(true);

    void (async () => {
      try {
        const zip = new JSZip();

        for (const image of images) {
          const active = getActiveVersion(image);
          const encoded = await encodeVersionForDownload(active, downloadFormat);
          const extension = downloadFormat === "png" ? "png" : "jpg";
          zip.file(`${image.fileNameStem}.${extension}`, encoded);
        }

        const archive = await zip.generateAsync({ type: "blob" });
        const downloadUrl = URL.createObjectURL(archive);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `bulk-image-export-${Date.now()}.zip`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to export the image archive.",
        );
      } finally {
        setIsDownloading(false);
      }
    })();
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        {!images.length ? (
          <BulkImageEditorEmptyState onFilesSelected={handleFilesSelected} />
        ) : (
          <section className="flex h-[calc(100vh-2rem)] min-h-0 flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
            <BulkImageEditorWorkspaceHeader
              downloadFormat={downloadFormat}
              imageCount={images.length}
              isApplying={isApplying}
              isDownloading={isDownloading}
              onDownloadAll={downloadAll}
              onDownloadFormatChange={setDownloadFormat}
              onResetWorkspace={resetWorkspace}
            />

            <div className="grid min-h-0 flex-1 gap-px overflow-hidden bg-border lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)_360px]">
              <BulkImageEditorImageListSidebar
                images={images}
                selectedImageId={selectedImageId}
                onSelectImage={setSelectedImageId}
                onSelectVersion={setActiveVersion}
              />
              <BulkImageEditorImagePreview
                crop={actionSettings.crop}
                previewFrameRef={previewFrameRef}
                selectedActionId={selectedActionId}
                selectedImageName={selectedImage?.name ?? null}
                version={activeVersion}
                onCropInteractionEnd={endCropInteraction}
                onCropInteractionMove={handleCropPointerMove}
                onCropInteractionStart={beginCropInteraction}
              />
              <BulkImageEditorActionSidebar
                actionSettings={actionSettings}
                errorMessage={errorMessage}
                hasImages={images.length > 0}
                hasSelectedImage={selectedImage !== null}
                progress={applyProgress}
                isApplying={isApplying}
                selectedActionId={selectedActionId}
                onApplyAction={applyAction}
                onRemoveBackgroundModelChange={updateRemoveBackgroundModel}
                onRemoveBackgroundProviderChange={updateRemoveBackgroundProvider}
                onRemoveBackgroundThresholdChange={updateRemoveBackgroundThreshold}
                onSelectedActionChange={setSelectedActionId}
                onUpdateCropSetting={updateCropSetting}
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
