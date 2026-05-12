"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import JSZip from "jszip";
import Image from "next/image";
import {
  Check,
  ChevronRight,
  Crop,
  Download,
  Eraser,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Scissors,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ACTIONS } from "@/components/bulk-image-editor/actions";
import {
  encodeVersionForDownload,
  fileToEditorImage,
  getActiveVersion,
} from "@/components/bulk-image-editor/image-utils";
import type {
  EditorActionId,
  EditorActionSettings,
  EditorImage,
  ExportFormat,
} from "@/components/bulk-image-editor/types";

const MIN_CROP_SIZE = 0.05;

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

function formatDimensions(width: number, height: number) {
  return `${width} x ${height}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCrop(crop: EditorActionSettings["crop"]) {
  const width = clamp(crop.width, MIN_CROP_SIZE, 1);
  const height = clamp(crop.height, MIN_CROP_SIZE, 1);
  const x = clamp(crop.x, 0, 1 - width);
  const y = clamp(crop.y, 0, 1 - height);

  return { x, y, width, height };
}

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
  const [isApplying, startApplyingTransition] = useTransition();
  const [isDownloading, startDownloadTransition] = useTransition();
  const objectUrlsRef = useRef<string[]>([]);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const cropInteractionRef = useRef<CropInteraction | null>(null);

  const selectedImage = useMemo(() => {
    if (!selectedImageId) {
      return null;
    }

    return images.find((image) => image.id === selectedImageId) ?? null;
  }, [images, selectedImageId]);

  const activeVersion = selectedImage ? getActiveVersion(selectedImage) : null;

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

  function applyAction(scope: "selected" | "all") {
    const definition = ACTIONS[selectedActionId];

    if (!definition) {
      return;
    }

    setErrorMessage(null);

    startApplyingTransition(async () => {
      try {
        const executionContext = actionSettings;
        const targetImageIds =
          scope === "selected" && selectedImageId ? new Set([selectedImageId]) : null;

        const nextImages = await Promise.all(
          images.map(async (image) => {
            if (targetImageIds && !targetImageIds.has(image.id)) {
              return image;
            }

            const sourceVersion = getActiveVersion(image);
            const nextVersion = await definition.apply(sourceVersion, executionContext);

            return {
              ...image,
              activeVersionId: nextVersion.id,
              versions: [...image.versions, nextVersion],
            };
          }),
        );

        setImages(nextImages);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "The image action failed to complete.",
        );
      }
    });
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
    if (!images.length) {
      return;
    }

    setErrorMessage(null);

    startDownloadTransition(async () => {
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
      }
    });
  }

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(248,244,236,0.98)_40%,_#e9dfcc_100%)] text-zinc-950">
      <div className="mx-auto flex h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        {!images.length ? (
          <section className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[2rem] border border-black/10 bg-stone-950 text-stone-50 shadow-[0_40px_120px_rgba(32,24,15,0.22)]">
            <div className="flex flex-1 flex-col justify-between gap-12 p-8 sm:p-12 lg:flex-row lg:items-end lg:p-16">
              <div className="max-w-3xl">
                <Badge className="mb-6 inline-flex gap-2 rounded-full border-white/15 bg-white/8 px-4 py-2 text-sm text-stone-200">
                  <Layers3 className="size-4" />
                  Bulk image versions with local browser processing
                </Badge>
                <h1 className="max-w-2xl font-heading text-5xl leading-none tracking-[-0.05em] text-stone-50 sm:text-6xl lg:text-7xl">
                  Edit a full image set without losing version history.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
                  Import multiple images, apply crop or background removal per image or in
                  bulk, then export every active version as a single zip.
                </p>
              </div>

              <Label className="group relative flex min-h-80 w-full max-w-xl cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-8 transition-transform duration-300 hover:-translate-y-1">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(226,201,157,0.38),_transparent_45%)]" />
                <div className="relative">
                  <div className="inline-flex size-14 items-center justify-center rounded-3xl bg-[#e8d5af] text-stone-950">
                    <ImagePlus className="size-7" />
                  </div>
                  <h2 className="mt-8 text-2xl font-semibold tracking-tight text-white">
                    Select images
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-stone-300">
                    Choose multiple PNG, JPG, or WebP files to open the bulk editing
                    workspace.
                  </p>
                </div>

                <div className="relative flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/20 px-5 py-4">
                  <span className="text-sm font-medium text-white">
                    Browse files and open workspace
                  </span>
                  <ChevronRight className="size-5 text-stone-300 transition-transform group-hover:translate-x-1" />
                </div>

                <Input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void handleFilesSelected(event.target.files)}
                />
              </Label>
            </div>
          </section>
        ) : (
          <section className="flex h-[calc(100vh-2rem)] min-h-0 flex-col overflow-hidden rounded-[2rem] border border-black/10 bg-[#f6f0e6] shadow-[0_28px_90px_rgba(83,64,39,0.18)]">
            <header className="flex flex-col gap-4 border-b border-black/10 bg-[#f2e8d8]/90 px-5 py-4 backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-900/70">
                  Bulk Image Editor
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
                  {images.length} images loaded, versioned edits enabled
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={downloadFormat}
                  onValueChange={(value) => setDownloadFormat(value as ExportFormat)}
                >
                  <SelectTrigger className="w-[170px] rounded-full border-black/10 bg-white">
                    <SelectValue placeholder="Download format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">Download as PNG</SelectItem>
                    <SelectItem value="jpg">Download as JPG</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={resetWorkspace}>
                  Replace Images
                </Button>
                <Button onClick={downloadAll} disabled={isDownloading}>
                  {isDownloading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Download Zip
                </Button>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 gap-px overflow-hidden bg-black/8 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)_360px]">
              <aside className="flex min-h-0 flex-col bg-[#fbf8f2]">
                <div className="border-b border-black/8 px-5 py-4">
                  <p className="text-sm font-medium text-stone-900">Images and versions</p>
                  <p className="mt-1 text-sm text-stone-600">
                    Newer versions appear to the right for each image.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="grid gap-3">
                    {images.map((image) => {
                      const active = getActiveVersion(image);

                      return (
                        <Card
                          key={image.id}
                          onClick={() => setSelectedImageId(image.id)}
                          className={cn(
                            "rounded-[1.5rem] p-3 text-left transition-colors shadow-none",
                            selectedImageId === image.id
                              ? "border-stone-950 bg-white shadow-sm"
                              : "border-black/8 bg-[#f3ece0] hover:bg-white",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-[1.1rem] bg-stone-200">
                              <Image
                                src={active.objectUrl}
                                alt={image.name}
                                fill
                                unoptimized
                                sizes="80px"
                                className="object-cover"
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-stone-950">
                                {image.name}
                              </p>
                              <p className="mt-1 text-xs text-stone-600">
                                Active: {active.label} • {formatDimensions(active.width, active.height)}
                              </p>
                              <p className="mt-1 text-xs text-stone-500">
                                {image.versions.length} versions
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 overflow-x-auto pb-1">
                            <div className="flex min-w-max gap-2">
                              {image.versions.map((version, index) => {
                                const isActive = image.activeVersionId === version.id;

                                return (
                                  <div
                                    key={version.id}
                                    className={cn(
                                      "flex items-center gap-2 rounded-full border px-2 py-1.5 text-xs whitespace-nowrap transition-colors",
                                      isActive
                                        ? "border-stone-950 bg-stone-950 text-stone-50"
                                        : "border-black/8 bg-white text-stone-700 hover:bg-stone-100",
                                    )}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setActiveVersion(image.id, version.id);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        setActiveVersion(image.id, version.id);
                                      }
                                    }}
                                  >
                                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-black/6 text-[11px] font-semibold text-current">
                                      {index + 1}
                                    </span>
                                    <span>{version.label}</span>
                                    {isActive ? <Check className="size-3.5" /> : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <section className="flex min-h-0 flex-col overflow-hidden bg-[#efe5d4]">
                <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {selectedImage?.name ?? "No image selected"}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {activeVersion
                        ? `${activeVersion.label} • ${formatDimensions(activeVersion.width, activeVersion.height)}`
                        : "Choose an image from the left."}
                    </p>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5 lg:p-8">
                  {activeVersion ? (
                    <div className="flex h-full w-full min-h-0 items-center justify-center overflow-hidden rounded-[2rem] border border-black/8 bg-[linear-gradient(135deg,_rgba(255,255,255,0.82),_rgba(249,242,230,0.96))] p-4 sm:p-6">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.75rem] bg-[linear-gradient(45deg,#e7decf_25%,transparent_25%,transparent_75%,#e7decf_75%,#e7decf),linear-gradient(45deg,#e7decf_25%,transparent_25%,transparent_75%,#e7decf_75%,#e7decf)] bg-[length:28px_28px] bg-[position:0_0,14px_14px] p-4">
                        <div className="relative flex max-h-full max-w-full items-center justify-center">
                          <Image
                            src={activeVersion.objectUrl}
                            alt={selectedImage?.name ?? "Selected image"}
                            width={activeVersion.width}
                            height={activeVersion.height}
                            unoptimized
                            className="h-auto max-h-full w-auto max-w-full rounded-[1.35rem] object-contain shadow-[0_22px_70px_rgba(70,50,23,0.28)]"
                          />

                          {selectedActionId === "crop" ? (
                            <div ref={previewFrameRef} className="absolute inset-0">
                              <div
                                role="presentation"
                                className="absolute rounded-[1.4rem] border-2 border-white shadow-[0_0_0_9999px_rgba(32,24,15,0.42)] touch-none cursor-move"
                                style={{
                                  left: `${actionSettings.crop.x * 100}%`,
                                  top: `${actionSettings.crop.y * 100}%`,
                                  width: `${actionSettings.crop.width * 100}%`,
                                  height: `${actionSettings.crop.height * 100}%`,
                                }}
                                onPointerDown={(event) => beginCropInteraction(event, "move")}
                                onPointerMove={handleCropPointerMove}
                                onPointerUp={endCropInteraction}
                                onPointerCancel={endCropInteraction}
                              >
                                <div className="absolute inset-0 rounded-[1.3rem] border border-dashed border-white/80" />
                              </div>
                              {(
                                [
                                  ["nw", "top-0 left-0 cursor-nwse-resize"],
                                  ["ne", "top-0 right-0 cursor-nesw-resize"],
                                  ["se", "right-0 bottom-0 cursor-nwse-resize"],
                                  ["sw", "bottom-0 left-0 cursor-nesw-resize"],
                                ] as const
                              ).map(([handle, className]) => (
                                <button
                                  key={handle}
                                  type="button"
                                  aria-label={`Resize crop ${handle}`}
                                  className={cn(
                                    "absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-950 bg-white shadow-sm touch-none",
                                    className,
                                  )}
                                  style={{
                                    left: `${(actionSettings.crop.x + (handle.includes("e") ? actionSettings.crop.width : 0)) * 100}%`,
                                    top: `${(actionSettings.crop.y + (handle.includes("s") ? actionSettings.crop.height : 0)) * 100}%`,
                                  }}
                                  onPointerDown={(event) => beginCropInteraction(event, handle)}
                                  onPointerMove={handleCropPointerMove}
                                  onPointerUp={endCropInteraction}
                                  onPointerCancel={endCropInteraction}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-stone-600">Choose an image to preview it.</div>
                  )}
                </div>
              </section>

              <aside className="flex min-h-0 flex-col bg-[#fffdf8]">
                <div className="border-b border-black/8 px-5 py-4">
                  <p className="text-sm font-medium text-stone-900">Actions</p>
                  <p className="mt-1 text-sm text-stone-600">
                    Each action creates a new version instead of overwriting the current one.
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <div className="grid gap-5">
                    <div className="grid gap-3">
                    {(Object.values(ACTIONS) as Array<(typeof ACTIONS)[EditorActionId]>).map(
                      (action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => setSelectedActionId(action.id)}
                          className={cn(
                            "rounded-[1.5rem] border p-4 text-left transition-colors",
                            selectedActionId === action.id
                              ? "border-stone-950 bg-stone-950 text-stone-50"
                              : "border-black/8 bg-stone-50 hover:bg-stone-100",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "inline-flex size-10 items-center justify-center rounded-2xl",
                                selectedActionId === action.id
                                  ? "bg-white/12"
                                  : "bg-[#eadabe] text-stone-950",
                              )}
                            >
                              {action.id === "crop" ? (
                                <Crop className="size-5" />
                              ) : (
                                <Eraser className="size-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{action.title}</p>
                              <p
                                className={cn(
                                  "mt-1 text-sm",
                                  selectedActionId === action.id
                                    ? "text-stone-200"
                                    : "text-stone-600",
                                )}
                              >
                                {action.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      ),
                    )}
                    </div>

                  {selectedActionId === "crop" ? (
                    <Card className="rounded-[1.5rem] border-black/8 bg-[#faf6ef] shadow-none">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-stone-900">
                          <Scissors className="size-4" />
                          Crop frame
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="mt-4 grid gap-4 p-4">
                        {(
                          [
                            ["x", "Left", actionSettings.crop.x, 0, 0.95, 0.01],
                            ["y", "Top", actionSettings.crop.y, 0, 0.95, 0.01],
                            ["width", "Width", actionSettings.crop.width, 0.05, 1, 0.01],
                            ["height", "Height", actionSettings.crop.height, 0.05, 1, 0.01],
                          ] as const
                        ).map(([key, label, value, min, max, step]) => (
                          <Label key={key} className="grid gap-2">
                            <div className="flex items-center justify-between text-sm text-stone-700">
                              <span>{label}</span>
                              <span>{formatPercent(value)}</span>
                            </div>
                            <Slider
                              min={min}
                              max={max}
                              step={step}
                              value={[value]}
                              onValueChange={(nextValue) =>
                                updateCropSetting(key, nextValue[0] ?? value)
                              }
                            />
                          </Label>
                        ))}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="rounded-[1.5rem] border-black/8 bg-[#faf6ef] shadow-none">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-stone-900">
                          <Sparkles className="size-4" />
                          Background detection
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                      <div className="mt-4 grid gap-2">
                        {(
                          [
                            [
                              "imgly",
                              "IMG.LY AI",
                              "Higher quality matting in-browser. First run downloads the model.",
                            ],
                            [
                              "edge",
                              "Edge Flood Fill",
                              "Fast fallback for clean, flat backgrounds with no model download.",
                            ],
                          ] as const
                        ).map(([provider, label, description]) => {
                          const isActive =
                            actionSettings["remove-background"].provider === provider;

                          return (
                            <button
                              key={provider}
                              type="button"
                              onClick={() =>
                                setActionSettings((current) => ({
                                  ...current,
                                  "remove-background": {
                                    ...current["remove-background"],
                                    provider,
                                  },
                                }))
                              }
                              className={cn(
                                "rounded-[1.2rem] border p-3 text-left transition-colors",
                                isActive
                                  ? "border-stone-950 bg-stone-950 text-stone-50"
                                  : "border-black/8 bg-white hover:bg-stone-100",
                              )}
                            >
                              <p className="text-sm font-medium">{label}</p>
                              <p
                                className={cn(
                                  "mt-1 text-sm leading-6",
                                  isActive ? "text-stone-200" : "text-stone-600",
                                )}
                              >
                                {description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      {actionSettings["remove-background"].provider === "imgly" ? (
                        <div className="mt-4 grid gap-2">
                          <div className="flex items-center justify-between text-sm text-stone-700">
                            <span>AI model</span>
                            <span>
                              {actionSettings["remove-background"].model === "isnet_quint8"
                                ? "~40MB"
                                : "~80MB"}
                            </span>
                          </div>
                          <Select
                            value={actionSettings["remove-background"].model}
                            onValueChange={(value) =>
                              setActionSettings((current) => ({
                                ...current,
                                "remove-background": {
                                  ...current["remove-background"],
                                  model: value as "isnet_quint8" | "isnet_fp16",
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="w-full rounded-2xl border-black/10 bg-white">
                              <SelectValue placeholder="AI model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="isnet_quint8">Small model</SelectItem>
                              <SelectItem value="isnet_fp16">Medium model</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                      <Label className="mt-4 grid gap-2">
                        <div className="flex items-center justify-between text-sm text-stone-700">
                          <span>Edge color tolerance</span>
                          <span>{actionSettings["remove-background"].threshold}</span>
                        </div>
                        <Slider
                          min={8}
                          max={180}
                          step={1}
                          value={[actionSettings["remove-background"].threshold]}
                          onValueChange={(nextValue) =>
                            setActionSettings((current) => ({
                              ...current,
                              "remove-background": {
                                ...current["remove-background"],
                                threshold:
                                  nextValue[0] ?? current["remove-background"].threshold,
                              },
                            }))
                          }
                        />
                      </Label>
                      <p className="mt-3 text-sm leading-6 text-stone-600">
                        Use the AI engine for cleaner masks. The edge-based fallback is
                        useful when you need a quick local pass or want to avoid model
                        downloads.
                      </p>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="rounded-[1.5rem] border-black/8 bg-stone-950 text-stone-50 shadow-none">
                    <CardHeader className="p-4 pb-0">
                      <CardTitle className="text-sm font-medium">Process queue</CardTitle>
                      <CardDescription className="mt-2 text-sm leading-6 text-stone-300">
                      Apply the selected action to the active image or to every image using
                      each image&apos;s currently active version as input.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-4 grid gap-3 p-4">
                      <Button
                        className="w-full bg-[#e7d0a4] text-stone-950 hover:bg-[#dec18a]"
                        onClick={() => applyAction("selected")}
                        disabled={!selectedImage || isApplying}
                      >
                        {isApplying ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Scissors className="size-4" />
                        )}
                        Apply to Selected Image
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-white/15 bg-white/8 text-white hover:bg-white/12"
                        onClick={() => applyAction("all")}
                        disabled={!images.length || isApplying}
                      >
                        {isApplying ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Layers3 className="size-4" />
                        )}
                        Bulk Apply to All Images
                      </Button>
                    </CardContent>
                  </Card>

                  {errorMessage ? (
                    <Alert className="rounded-[1.5rem] border-red-200 bg-red-50 text-red-700">
                      <AlertTitle>Processing error</AlertTitle>
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  ) : null}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
