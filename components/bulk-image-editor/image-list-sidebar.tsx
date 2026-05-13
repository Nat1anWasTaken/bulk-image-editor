"use client";

import { useEffect, useRef } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDimensions } from "@/components/bulk-image-editor/editor-helpers";
import { getActiveVersion } from "@/components/bulk-image-editor/image-utils";
import type { EditorImage } from "@/components/bulk-image-editor/types";

type BulkImageEditorImageListSidebarProps = {
  images: EditorImage[];
  selectedImageId: string | null;
  onSelectImage: (imageId: string) => void;
  onSelectVersion: (imageId: string, versionId: string) => void;
  onDeleteImage: (imageId: string) => void;
  onReplaceImage: (imageId: string) => void;
};

export function BulkImageEditorImageListSidebar({
  images,
  selectedImageId,
  onSelectImage,
  onSelectVersion,
  onDeleteImage,
  onReplaceImage,
}: BulkImageEditorImageListSidebarProps) {
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedImageId) {
      return;
    }

    const selectedItem = itemRefs.current[selectedImageId];
    const scrollContainer = scrollContainerRef.current;

    if (!selectedItem || !scrollContainer) {
      return;
    }

    const itemRect = selectedItem.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const isAboveViewport = itemRect.top < containerRect.top;
    const isBelowViewport = itemRect.bottom > containerRect.bottom;

    if (isAboveViewport || isBelowViewport) {
      const nextTop = isAboveViewport
        ? scrollContainer.scrollTop + (itemRect.top - containerRect.top)
        : scrollContainer.scrollTop + (itemRect.bottom - containerRect.bottom);

      scrollContainer.scrollTo({
        top: nextTop,
        behavior: "smooth",
      });
    }
  }, [images, selectedImageId]);

  return (
    <aside className="flex min-h-0 min-w-0 flex-col bg-background">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-medium text-foreground">Images and versions</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Newer versions appear to the right for each image.
        </p>
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 scroll-smooth"
      >
        <div className="grid gap-3">
          {images.map((image) => {
            const activeVersion = getActiveVersion(image);

            return (
              <div
                key={image.id}
                ref={(node) => {
                  itemRefs.current[image.id] = node;
                }}
                className="min-w-0"
              >
                <Card
                  onClick={() => onSelectImage(image.id)}
                  className={cn(
                    "group/card relative w-full min-w-0 overflow-hidden rounded-[1.5rem] p-3 text-left shadow-none transition-colors",
                    selectedImageId === image.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/50 hover:bg-muted",
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 z-20 bg-black/30 opacity-0 transition-opacity group-hover/card:opacity-100" />
                  <div className="absolute top-2 right-2 z-30 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        onReplaceImage(image.id);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:bg-destructive/15 hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteImage(image.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "relative aspect-square w-20 shrink-0 overflow-hidden rounded-[1.1rem]",
                      selectedImageId === image.id ? "bg-primary-foreground/12" : "bg-muted",
                    )}>
                      <Image
                        src={activeVersion.objectUrl}
                        alt={image.name}
                        fill
                        unoptimized
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className={cn(
                        "truncate text-sm font-semibold",
                        selectedImageId === image.id ? "text-primary-foreground" : "text-foreground",
                      )}>
                        {image.name}
                      </p>
                      <p className={cn(
                        "mt-1 text-xs",
                        selectedImageId === image.id ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}>
                        Active: {activeVersion.label} •{" "}
                        {formatDimensions(activeVersion.width, activeVersion.height)}
                      </p>
                      <p className={cn(
                        "mt-1 text-xs",
                        selectedImageId === image.id ? "text-primary-foreground/60" : "text-muted-foreground/80",
                      )}>
                        {image.versions.length} versions
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex min-w-0 flex-wrap gap-2">
                      {image.versions.map((version, index) => {
                        const isActive = image.activeVersionId === version.id;

                        return (
                          <div
                            key={version.id}
                            className={cn(
                              "flex items-center gap-2 rounded-full border px-2 py-1.5 text-xs whitespace-nowrap transition-colors",
                              isActive
                                ? selectedImageId === image.id
                                  ? "border-primary-foreground/20 bg-primary-foreground text-primary"
                                  : "border-primary bg-primary text-primary-foreground"
                                : selectedImageId === image.id
                                  ? "border-primary-foreground/15 bg-primary-foreground/12 text-primary-foreground hover:bg-primary-foreground/20"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted",
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectVersion(image.id, version.id);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onSelectVersion(image.id, version.id);
                              }
                            }}
                          >
                            <span className={cn(
                              "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-current",
                              selectedImageId === image.id && isActive
                                ? "bg-primary/12"
                                : "bg-foreground/8",
                            )}>
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
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
