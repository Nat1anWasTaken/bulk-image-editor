import type { RefObject } from "react";
import Image from "next/image";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDimensions } from "@/components/bulk-image-editor/editor-helpers";
import type {
  CropSettings,
  EditorActionId,
  ExportFormat,
  ImageVersion,
} from "@/components/bulk-image-editor/types";

type CropHandle = "move" | "nw" | "ne" | "se" | "sw";

type BulkImageEditorImagePreviewProps = {
  crop: CropSettings;
  downloadFormat: ExportFormat;
  previewFrameRef: RefObject<HTMLDivElement | null>;
  selectedActionId: EditorActionId;
  selectedImageName: string | null;
  version: ImageVersion | null;
  onCropInteractionEnd: (event: React.PointerEvent<HTMLElement>) => void;
  onCropInteractionMove: (event: React.PointerEvent<HTMLElement>) => void;
  onCropInteractionStart: (
    event: React.PointerEvent<HTMLElement>,
    handle: CropHandle,
  ) => void;
  onDownloadSingle: () => void;
};

const cropHandles: Array<[Exclude<CropHandle, "move">, string]> = [
  ["nw", "top-0 left-0 cursor-nwse-resize"],
  ["ne", "top-0 right-0 cursor-nesw-resize"],
  ["se", "right-0 bottom-0 cursor-nwse-resize"],
  ["sw", "bottom-0 left-0 cursor-nesw-resize"],
];

export function BulkImageEditorImagePreview({
  crop,
  downloadFormat,
  previewFrameRef,
  selectedActionId,
  selectedImageName,
  version,
  onCropInteractionEnd,
  onCropInteractionMove,
  onCropInteractionStart,
  onDownloadSingle,
}: BulkImageEditorImagePreviewProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {selectedImageName ?? "No image selected"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {version
              ? `${version.label} • ${formatDimensions(version.width, version.height)}`
              : "Choose an image from the left."}
          </p>
        </div>
        {version ? (
          <button
            type="button"
            className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            onClick={onDownloadSingle}
            title={`Download as ${downloadFormat.toUpperCase()}`}
          >
            <Download className="size-3.5" />
            {downloadFormat.toUpperCase()}
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5 lg:p-8">
        {version ? (
          <div className="flex h-full w-full min-h-0 items-center justify-center overflow-hidden rounded-[2rem] border border-border bg-card p-4 sm:p-6">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.75rem] bg-muted p-4">
              <div className="relative flex max-h-full max-w-full items-center justify-center">
                <Image
                  src={version.objectUrl}
                  alt={selectedImageName ?? "Selected image"}
                  width={version.width}
                  height={version.height}
                  unoptimized
                  className="h-auto max-h-full w-auto max-w-full rounded-[1.35rem] object-contain shadow-lg"
                />

                {selectedActionId === "crop" ? (
                  <div ref={previewFrameRef} className="absolute inset-0">
                    <div
                      role="presentation"
                      className="absolute touch-none cursor-move rounded-[1.4rem] border-2 border-primary-foreground shadow-[0_0_0_9999px_color-mix(in_oklab,var(--foreground)_42%,transparent)]"
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.width * 100}%`,
                        height: `${crop.height * 100}%`,
                      }}
                      onPointerDown={(event) => onCropInteractionStart(event, "move")}
                      onPointerMove={onCropInteractionMove}
                      onPointerUp={onCropInteractionEnd}
                      onPointerCancel={onCropInteractionEnd}
                    >
                      <div className="absolute inset-0 rounded-[1.3rem] border border-dashed border-primary-foreground/80" />
                    </div>

                    {cropHandles.map(([handle, className]) => (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize crop ${handle}`}
                        className={cn(
                          "absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background shadow-sm touch-none",
                          className,
                        )}
                        style={{
                          left: `${(crop.x + (handle.includes("e") ? crop.width : 0)) * 100}%`,
                          top: `${(crop.y + (handle.includes("s") ? crop.height : 0)) * 100}%`,
                        }}
                        onPointerDown={(event) => onCropInteractionStart(event, handle)}
                        onPointerMove={onCropInteractionMove}
                        onPointerUp={onCropInteractionEnd}
                        onPointerCancel={onCropInteractionEnd}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">Choose an image to preview it.</div>
        )}
      </div>
    </section>
  );
}
