"use client";

import { ImagePlus, Layers3 } from "lucide-react";
import type { EditorImage } from "@/components/bulk-image-editor/types";

type DropZoneProps = {
  currentImage: EditorImage | null;
  onDropAsVersion: (files: File[]) => void;
  onDropAsNewImage: (files: File[]) => void;
};

function extractImageFiles(dataTransfer: DataTransfer): File[] {
  return Array.from(dataTransfer.files).filter((f) => f.type.startsWith("image/"));
}

type DropZoneHalfProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onDrop: (files: File[]) => void;
};

function DropZoneHalf({ icon: Icon, title, subtitle, disabled, onDrop }: DropZoneHalfProps) {
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const files = extractImageFiles(e.dataTransfer);
    if (files.length && !disabled) onDrop(files);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={[
        "group relative flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl m-4 p-6",
        "border-2 border-dashed transition-all duration-200",
        disabled
          ? "cursor-not-allowed border-muted-foreground/10 bg-muted/5 opacity-30"
          : "border-muted-foreground/20 bg-muted/5 group-hover:border-primary/50 group-hover:bg-primary/5",
      ].join(" ")}
    >
      {!disabled && (
        <div className="absolute inset-0 rounded-3xl bg-primary/8 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      )}
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-colors duration-200 group-hover:bg-primary/20">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <div className="relative text-center">
        <p className="text-lg font-semibold transition-colors duration-200 group-hover:text-primary">
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function BulkImageEditorDropZone({
  currentImage,
  onDropAsVersion,
  onDropAsNewImage,
}: DropZoneProps) {
  return (
    <div className="group/container fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm">
      <DropZoneHalf
        icon={Layers3}
        title="Add as version"
        subtitle={
          currentImage
            ? `Drop to add to "${currentImage.name}"`
            : "Select an image first"
        }
        disabled={!currentImage}
        onDrop={onDropAsVersion}
      />
      <div className="pointer-events-none w-px self-stretch my-10 bg-border/30" />
      <DropZoneHalf
        icon={ImagePlus}
        title="Add as new image"
        subtitle="Drop to expand your collection"
        onDrop={onDropAsNewImage}
      />
    </div>
  );
}
