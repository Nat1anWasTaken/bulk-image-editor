import { Download, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExportFormat } from "@/components/bulk-image-editor/types";

type BulkImageEditorWorkspaceHeaderProps = {
  downloadFormat: ExportFormat;
  imageCount: number;
  isDownloading: boolean;
  onDownloadAll: () => void;
  onDownloadFormatChange: (format: ExportFormat) => void;
  onResetWorkspace: () => void;
};

export function BulkImageEditorWorkspaceHeader({
  downloadFormat,
  imageCount,
  isDownloading,
  onDownloadAll,
  onDownloadFormatChange,
  onResetWorkspace,
}: BulkImageEditorWorkspaceHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-black/10 bg-[#f2e8d8]/90 px-5 py-4 backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-amber-900/70">
          Bulk Image Editor
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
          {imageCount} images loaded, versioned edits enabled
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={downloadFormat}
          onValueChange={(value) => onDownloadFormatChange(value as ExportFormat)}
        >
          <SelectTrigger className="w-[170px] rounded-full border-black/10 bg-white">
            <SelectValue placeholder="Download format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">Download as PNG</SelectItem>
            <SelectItem value="jpg">Download as JPG</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={onResetWorkspace}>
          Replace Images
        </Button>
        <Button onClick={onDownloadAll} disabled={isDownloading}>
          {isDownloading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Download Zip
        </Button>
      </div>
    </header>
  );
}
