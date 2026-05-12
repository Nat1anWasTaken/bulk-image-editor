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
  isApplying: boolean;
  isDownloading: boolean;
  onDownloadAll: () => void;
  onDownloadFormatChange: (format: ExportFormat) => void;
  onResetWorkspace: () => void;
};

export function BulkImageEditorWorkspaceHeader({
  downloadFormat,
  imageCount,
  isApplying,
  isDownloading,
  onDownloadAll,
  onDownloadFormatChange,
  onResetWorkspace,
}: BulkImageEditorWorkspaceHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-muted/70 px-5 py-4 backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.22em]">
          Bulk Image Editor
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {imageCount} images loaded, versioned edits enabled
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={downloadFormat}
          onValueChange={(value) => onDownloadFormatChange(value as ExportFormat)}
          disabled={isApplying || isDownloading}
        >
          <SelectTrigger className="w-[170px] rounded-full border-border bg-background">
            <SelectValue placeholder="Download format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">Download as PNG</SelectItem>
            <SelectItem value="jpg">Download as JPG</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={onResetWorkspace} disabled={isApplying || isDownloading}>
          Replace Images
        </Button>
        <Button onClick={onDownloadAll} disabled={isApplying || isDownloading}>
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
