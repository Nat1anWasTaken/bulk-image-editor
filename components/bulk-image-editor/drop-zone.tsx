"use client";

import { useState } from "react";
import { ImagePlus, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  active?: boolean;
  dimmed?: boolean;
  onDrop: (files: File[]) => void;
};

function DropZoneHalf({
  icon: Icon,
  title,
  subtitle,
  disabled,
  active,
  dimmed,
  onDrop,
}: DropZoneHalfProps) {
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const files = extractImageFiles(e.dataTransfer);
    if (files.length && !disabled) onDrop(files);
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl m-4 p-8",
        "border-2 border-dashed transition-all duration-200",
        disabled && "cursor-not-allowed border-muted-foreground/10 bg-muted/5 opacity-30",
        !disabled && active && "scale-[1.02] border-primary bg-primary/10 shadow-lg shadow-primary/10",
        !disabled && dimmed && "scale-[0.98] border-muted-foreground/10 bg-muted/3 opacity-40",
        !disabled && !active && !dimmed && "border-muted-foreground/20 bg-muted/5",
      )}
    >
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-200",
          disabled && "bg-muted",
          !disabled && active && "bg-primary/20",
          !disabled && !active && "bg-primary/10",
        )}
      >
        <Icon
          className={cn(
            "h-8 w-8 transition-colors duration-200",
            disabled && "text-muted-foreground",
            !disabled && active && "text-primary",
            !disabled && !active && "text-primary/70",
          )}
        />
      </div>
      <div className="text-center">
        <p
          className={cn(
            "text-lg font-semibold transition-colors duration-200",
            active && !disabled && "text-primary",
          )}
        >
          {title}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function BulkImageEditorDropZone({
  currentImage,
  onDropAsVersion,
  onDropAsNewImage,
}: DropZoneProps) {
  const [activeZone, setActiveZone] = useState<"version" | "collection" | null>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const zone = e.clientX < window.innerWidth / 2 ? "version" : "collection";
    setActiveZone((prev) => (prev !== zone ? zone : prev));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm"
      onDragOver={handleDragOver}
    >
      <DropZoneHalf
        icon={Layers3}
        title="Add as version"
        subtitle={
          currentImage
            ? `Drop to add to "${currentImage.name}"`
            : "Select an image first"
        }
        disabled={!currentImage}
        active={activeZone === "version"}
        dimmed={activeZone === "collection"}
        onDrop={onDropAsVersion}
      />
      <DropZoneHalf
        icon={ImagePlus}
        title="Add as new image"
        subtitle="Drop to expand your collection"
        active={activeZone === "collection"}
        dimmed={activeZone === "version"}
        onDrop={onDropAsNewImage}
      />
    </div>
  );
}
