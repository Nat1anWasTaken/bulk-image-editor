import { Check } from "lucide-react";
import Image from "next/image";

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
};

export function BulkImageEditorImageListSidebar({
  images,
  selectedImageId,
  onSelectImage,
  onSelectVersion,
}: BulkImageEditorImageListSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col bg-background">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-medium text-foreground">Images and versions</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Newer versions appear to the right for each image.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-3">
          {images.map((image) => {
            const activeVersion = getActiveVersion(image);

            return (
              <Card
                key={image.id}
                onClick={() => onSelectImage(image.id)}
                className={cn(
                  "rounded-[1.5rem] p-3 text-left shadow-none transition-colors",
                  selectedImageId === image.id
                    ? "border-primary bg-card shadow-sm"
                    : "border-border bg-muted/50 hover:bg-muted",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-[1.1rem] bg-muted">
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
                    <p className="truncate text-sm font-semibold text-foreground">
                      {image.name}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Active: {activeVersion.label} •{" "}
                      {formatDimensions(activeVersion.width, activeVersion.height)}
                    </p>
                    <p className="text-muted-foreground/80 mt-1 text-xs">
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
                              ? "border-primary bg-primary text-primary-foreground"
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
                          <span className="inline-flex size-6 items-center justify-center rounded-full bg-foreground/8 text-[11px] font-semibold text-current">
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
  );
}
