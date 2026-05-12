import { ChevronRight, ImagePlus, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BulkImageEditorEmptyStateProps = {
  onFilesSelected: (fileList: FileList | null) => void | Promise<void>;
};

export function BulkImageEditorEmptyState({
  onFilesSelected,
}: BulkImageEditorEmptyStateProps) {
  return (
    <section className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[2rem] border border-border bg-foreground text-background shadow-xl">
      <div className="flex flex-1 flex-col justify-between gap-12 p-8 sm:p-12 lg:flex-row lg:items-end lg:p-16">
        <div className="max-w-3xl">
          <Badge className="mb-6 inline-flex gap-2 rounded-full border-border/40 bg-background/10 px-4 py-2 text-sm text-background/80">
            <Layers3 className="size-4" />
            Bulk image versions with local browser processing
          </Badge>
          <h1 className="max-w-2xl font-heading text-5xl leading-none tracking-[-0.05em] text-background sm:text-6xl lg:text-7xl">
            Edit a full image set without losing version history.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-background/70 sm:text-lg">
            Import multiple images, apply crop or background removal per image or in
            bulk, then export every active version as a single zip.
          </p>
        </div>

        <Label className="group relative flex min-h-80 w-full max-w-xl cursor-pointer flex-col justify-between overflow-hidden rounded-[2rem] border border-border/40 bg-background/5 p-8 transition-transform duration-300 hover:-translate-y-1">
          <div className="relative">
            <div className="inline-flex size-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground">
              <ImagePlus className="size-7" />
            </div>
            <h2 className="mt-8 text-2xl font-semibold tracking-tight text-background">
              Select images
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-background/70">
              Choose multiple PNG, JPG, or WebP files to open the bulk editing
              workspace.
            </p>
          </div>

          <div className="relative flex items-center justify-between rounded-[1.5rem] border border-border/30 bg-background/10 px-5 py-4">
            <span className="text-sm font-medium text-background">
              Browse files and open workspace
            </span>
            <ChevronRight className="size-5 text-background/70 transition-transform group-hover:translate-x-1" />
          </div>

          <Input
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => void onFilesSelected(event.target.files)}
          />
        </Label>
      </div>
    </section>
  );
}
