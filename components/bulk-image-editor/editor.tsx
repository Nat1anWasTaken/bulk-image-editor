"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIONS } from "@/components/bulk-image-editor/actions";
import { BulkImageEditorActionSidebar } from "@/components/bulk-image-editor/action-sidebar";
import { DEFAULT_BATCH_SIZE, normalizeBatchSize } from "@/components/bulk-image-editor/batch-processing";
import { BulkImageEditorEmptyState } from "@/components/bulk-image-editor/empty-state";
import {
  clamp,
  isEditableTarget,
  MIN_CROP_SIZE,
  normalizeCrop,
} from "@/components/bulk-image-editor/editor-helpers";
import {
  applyActionToImages,
  exportImagesArchive,
} from "@/components/bulk-image-editor/editor-operations";
import { BulkImageEditorDropZone } from "@/components/bulk-image-editor/drop-zone";
import { BulkImageEditorImageListSidebar } from "@/components/bulk-image-editor/image-list-sidebar";
import { BulkImageEditorImagePreview } from "@/components/bulk-image-editor/image-preview";
import { createId, encodeVersionForDownload, fileToEditorImage, fileToImageVersion, getActiveVersion, loadImageFromBlob } from "@/components/bulk-image-editor/image-utils";
import { getCompatibleRemoveBackgroundModel } from "@/components/bulk-image-editor/remove-background-options";
import { BulkImageEditorWorkspaceHeader } from "@/components/bulk-image-editor/workspace-header";
import type {
  ActionProgress,
  DownloadProgress,
  EditorActionId,
  EditorActionSettings,
  EditorImage,
  ExportFormat,
  ImageVersion,
  ProcessingProgress,
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
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState<ActionProgress | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const objectUrlsRef = useRef<string[]>([]);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const cropInteractionRef = useRef<CropInteraction | null>(null);
  const dragCounterRef = useRef(0);

  const selectedImage = selectedImageId
    ? images.find((image) => image.id === selectedImageId) ?? null
    : null;
  const selectedImageIndex = images.findIndex((image) => image.id === selectedImageId);
  const activeVersion = selectedImage ? getActiveVersion(selectedImage) : null;
  const isApplying = applyProgress !== null;
  const isBusy = isApplying || isDownloading;
  const processingProgress: ProcessingProgress | null = applyProgress ?? downloadProgress;

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
      if (key === "h" || key === "l") {
        const currentImage = images[selectedImageIndex] ?? images[0];

        if (!currentImage) {
          return;
        }

        const activeVersion = getActiveVersion(currentImage);
        const currentVersionIndex = currentImage.versions.findIndex(
          (version) => version.id === activeVersion.id,
        );
        const direction = key === "h" ? -1 : 1;
        const nextVersion = currentImage.versions[currentVersionIndex + direction];

        if (!nextVersion) {
          return;
        }

        event.preventDefault();
        setActiveVersion(currentImage.id, nextVersion.id);
        return;
      }

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

  useEffect(() => {
    if (!selectedImageId) return;

    async function onPaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;

      let imageItem: DataTransferItem | null = null;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          imageItem = item;
          break;
        }
      }
      if (!imageItem) return;

      event.preventDefault();

      const blob = imageItem.getAsFile();
      if (!blob) return;

      try {
        const img = await loadImageFromBlob(blob);
        const versionId = createId("version");
        const newVersion: ImageVersion = {
          id: versionId,
          label: "Pasted",
          actionId: "original",
          sourceVersionId: null,
          blob,
          objectUrl: URL.createObjectURL(blob),
          width: img.naturalWidth,
          height: img.naturalHeight,
          mimeType: blob.type || "image/png",
          createdAt: Date.now(),
        };
        setImages((current) =>
          current.map((i) =>
            i.id === selectedImageId
              ? { ...i, activeVersionId: versionId, versions: [...i.versions, newVersion] }
              : i
          )
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load pasted image.");
      }
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selectedImageId]);

  useEffect(() => {
    if (!images.length) return;

    function onDragEnter(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer?.types.includes("Files")) {
        dragCounterRef.current++;
        if (dragCounterRef.current === 1) setIsDragOver(true);
      }
    }

    function onDragLeave() {
      if (dragCounterRef.current > 0) {
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) setIsDragOver(false);
      }
    }

    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }

    function onDrop(e: DragEvent) {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      dragCounterRef.current = 0;
    };
  }, [images.length]);

  function resetDragState() {
    dragCounterRef.current = 0;
    setIsDragOver(false);
  }

  async function handleDropAsVersion(files: File[]) {
    resetDragState();
    if (!selectedImageId || !files.length) return;
    setErrorMessage(null);
    try {
      const newVersions = await Promise.all(files.map(fileToImageVersion));
      setImages((prev) =>
        prev.map((img) =>
          img.id === selectedImageId
            ? { ...img, versions: [...img.versions, ...newVersions], activeVersionId: newVersions.at(-1)!.id }
            : img,
        ),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add version.");
    }
  }

  async function handleDropAsNewImage(files: File[]) {
    resetDragState();
    if (!files.length) return;
    setErrorMessage(null);
    try {
      const newImages = await Promise.all(files.map(fileToEditorImage));
      setImages((prev) => [...prev, ...newImages]);
      setSelectedImageId(newImages[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add images.");
    }
  }

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

  async function applyAction(scope: "selected" | "all") {
    const definition = ACTIONS[selectedActionId];

    if (!definition || isBusy) {
      return;
    }

    setErrorMessage(null);
    try {
      await applyActionToImages({
        actionId: selectedActionId,
        actionSettings,
        batchSize,
        definition,
        images,
        onProgress: (progress, nextImages) => {
          setApplyProgress(progress);

          if (nextImages) {
            setImages(nextImages);
          }
        },
        scope,
        selectedImageId,
      });
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
    setApplyProgress(null);
    setDownloadProgress(null);
  }

  function deleteImage(imageId: string) {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;

    for (const version of image.versions) {
      URL.revokeObjectURL(version.objectUrl);
    }

    const nextImages = images.filter((img) => img.id !== imageId);
    setImages(nextImages);

    if (selectedImageId === imageId) {
      const deletedIndex = images.findIndex((img) => img.id === imageId);
      const nextIndex = deletedIndex < nextImages.length ? deletedIndex : nextImages.length - 1;
      setSelectedImageId(nextImages[nextIndex]?.id ?? null);
    }
  }

  function uploadVersion(imageId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const blob = file.slice(0, file.size, file.type || "image/png");
        const img = await loadImageFromBlob(blob);
        const versionId = createId("version");
        const newVersion: ImageVersion = {
          id: versionId,
          label: "Uploaded",
          actionId: "original" as const,
          sourceVersionId: null,
          blob,
          objectUrl: URL.createObjectURL(blob),
          width: img.naturalWidth,
          height: img.naturalHeight,
          mimeType: blob.type || "image/png",
          createdAt: Date.now(),
        };
        setImages((current) =>
          current.map((i) =>
            i.id === imageId
              ? { ...i, activeVersionId: versionId, versions: [...i.versions, newVersion] }
              : i
          )
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load image.");
      }
    };
    input.click();
  }

  function downloadAll() {
    if (!images.length || isBusy) {
      return;
    }

    setErrorMessage(null);
    setIsDownloading(true);

    void (async () => {
      try {
        const archive = await exportImagesArchive({
          batchSize,
          downloadFormat,
          images,
          onProgress: setDownloadProgress,
        });
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
        setDownloadProgress(null);
        setIsDownloading(false);
      }
    })();
  }

  function downloadSingle() {
    if (!activeVersion || !selectedImage) return;

    void (async () => {
      try {
        const blob = await encodeVersionForDownload(activeVersion, downloadFormat);
        const ext = downloadFormat === "jpg" ? "jpg" : "png";
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `${selectedImage.fileNameStem}-${activeVersion.label}.${ext}`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to download image.",
        );
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
                onDeleteImage={deleteImage}
                onUploadVersion={uploadVersion}
              />
              <BulkImageEditorImagePreview
                crop={actionSettings.crop}
                downloadFormat={downloadFormat}
                previewFrameRef={previewFrameRef}
                selectedActionId={selectedActionId}
                selectedImageName={selectedImage?.name ?? null}
                version={activeVersion}
                onCropInteractionEnd={endCropInteraction}
                onCropInteractionMove={handleCropPointerMove}
                onCropInteractionStart={beginCropInteraction}
                onDownloadSingle={downloadSingle}
              />
              <BulkImageEditorActionSidebar
                actionSettings={actionSettings}
                batchSize={batchSize}
                errorMessage={errorMessage}
                hasImages={images.length > 0}
                hasSelectedImage={selectedImage !== null}
                isDownloading={isDownloading}
                progress={processingProgress}
                isApplying={isApplying}
                selectedActionId={selectedActionId}
                onApplyAction={applyAction}
                onBatchSizeChange={(value) => setBatchSize(normalizeBatchSize(value))}
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
      {isDragOver && images.length > 0 && (
        <BulkImageEditorDropZone
          currentImage={selectedImage}
          onDropAsVersion={handleDropAsVersion}
          onDropAsNewImage={handleDropAsNewImage}
        />
      )}
    </main>
  );
}
