import type { RefObject } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { formatDimensions } from "@/components/bulk-image-editor/editor-helpers";
import type {
  CropSettings,
  EditorActionId,
  ImageVersion,
} from "@/components/bulk-image-editor/types";

type CropHandle = "move" | "nw" | "ne" | "se" | "sw";

type BulkImageEditorImagePreviewProps = {
  crop: CropSettings;
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
};

const cropHandles: Array<[Exclude<CropHandle, "move">, string]> = [
  ["nw", "top-0 left-0 cursor-nwse-resize"],
  ["ne", "top-0 right-0 cursor-nesw-resize"],
  ["se", "right-0 bottom-0 cursor-nwse-resize"],
  ["sw", "bottom-0 left-0 cursor-nesw-resize"],
];

export function BulkImageEditorImagePreview({
  crop,
  previewFrameRef,
  selectedActionId,
  selectedImageName,
  version,
  onCropInteractionEnd,
  onCropInteractionMove,
  onCropInteractionStart,
}: BulkImageEditorImagePreviewProps) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-[#efe5d4]">
      <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-stone-900">
            {selectedImageName ?? "No image selected"}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {version
              ? `${version.label} • ${formatDimensions(version.width, version.height)}`
              : "Choose an image from the left."}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5 lg:p-8">
        {version ? (
          <div className="flex h-full w-full min-h-0 items-center justify-center overflow-hidden rounded-[2rem] border border-black/8 bg-[linear-gradient(135deg,_rgba(255,255,255,0.82),_rgba(249,242,230,0.96))] p-4 sm:p-6">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.75rem] bg-[linear-gradient(45deg,#e7decf_25%,transparent_25%,transparent_75%,#e7decf_75%,#e7decf),linear-gradient(45deg,#e7decf_25%,transparent_25%,transparent_75%,#e7decf_75%,#e7decf)] bg-[length:28px_28px] bg-[position:0_0,14px_14px] p-4">
              <div className="relative flex max-h-full max-w-full items-center justify-center">
                <Image
                  src={version.objectUrl}
                  alt={selectedImageName ?? "Selected image"}
                  width={version.width}
                  height={version.height}
                  unoptimized
                  className="h-auto max-h-full w-auto max-w-full rounded-[1.35rem] object-contain shadow-[0_22px_70px_rgba(70,50,23,0.28)]"
                />

                {selectedActionId === "crop" ? (
                  <div ref={previewFrameRef} className="absolute inset-0">
                    <div
                      role="presentation"
                      className="absolute touch-none cursor-move rounded-[1.4rem] border-2 border-white shadow-[0_0_0_9999px_rgba(32,24,15,0.42)]"
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
                      <div className="absolute inset-0 rounded-[1.3rem] border border-dashed border-white/80" />
                    </div>

                    {cropHandles.map(([handle, className]) => (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize crop ${handle}`}
                        className={cn(
                          "absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-stone-950 bg-white shadow-sm touch-none",
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
          <div className="text-sm text-stone-600">Choose an image to preview it.</div>
        )}
      </div>
    </section>
  );
}
