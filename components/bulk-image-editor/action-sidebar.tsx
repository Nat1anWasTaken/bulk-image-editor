import { Crop, Eraser, Layers3, LoaderCircle, Scissors, Sparkles } from "lucide-react";

import { ACTIONS } from "@/components/bulk-image-editor/actions";
import { formatPercent } from "@/components/bulk-image-editor/editor-helpers";
import {
  IMGLY_REMOVE_BACKGROUND_MODELS,
  REMBG_REMOVE_BACKGROUND_MODELS,
} from "@/components/bulk-image-editor/remove-background-options";
import type {
  ActionProgress,
  EditorActionId,
  EditorActionSettings,
  RemoveBackgroundSettings,
} from "@/components/bulk-image-editor/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type BulkImageEditorActionSidebarProps = {
  actionSettings: EditorActionSettings;
  errorMessage: string | null;
  hasImages: boolean;
  isApplying: boolean;
  progress: ActionProgress | null;
  selectedActionId: EditorActionId;
  hasSelectedImage: boolean;
  onApplyAction: (scope: "selected" | "all") => void;
  onRemoveBackgroundModelChange: (model: RemoveBackgroundSettings["model"]) => void;
  onRemoveBackgroundProviderChange: (provider: RemoveBackgroundSettings["provider"]) => void;
  onRemoveBackgroundThresholdChange: (threshold: number) => void;
  onSelectedActionChange: (actionId: EditorActionId) => void;
  onUpdateCropSetting: (
    key: keyof EditorActionSettings["crop"],
    value: number,
  ) => void;
};

const cropControlConfig = [
  { key: "x", label: "Left", min: 0, max: 0.95, step: 0.01 },
  { key: "y", label: "Top", min: 0, max: 0.95, step: 0.01 },
  { key: "width", label: "Width", min: 0.05, max: 1, step: 0.01 },
  { key: "height", label: "Height", min: 0.05, max: 1, step: 0.01 },
] as const;

const backgroundProviders = [
  [
    "imgly",
    "IMG.LY AI",
    "Higher quality matting in-browser. First run downloads the model.",
  ],
  [
    "rembg",
    "rembg-web",
    "Run rembg-web with ONNX models served locally from /models.",
  ],
  [
    "edge",
    "Edge Flood Fill",
    "Fast fallback for clean, flat backgrounds with no model download.",
  ],
] as const;

const imglyModels: Array<{
  value: (typeof IMGLY_REMOVE_BACKGROUND_MODELS)[number];
  label: string;
  size: string;
}> = [
  { value: "isnet_quint8", label: "Small model", size: "~40MB" },
  { value: "isnet_fp16", label: "Medium model", size: "~80MB" },
];

const rembgModels: Array<{
  value: (typeof REMBG_REMOVE_BACKGROUND_MODELS)[number];
  label: string;
  size: string;
}> = [
  { value: "u2netp", label: "U2NetP", size: "~5MB" },
  { value: "u2net", label: "U2Net", size: "~176MB" },
  { value: "u2net_human_seg", label: "Human Seg", size: "~176MB" },
  { value: "isnet-general-use", label: "ISNet General", size: "~178MB" },
  { value: "isnet-anime", label: "ISNet Anime", size: "~178MB" },
  { value: "silueta", label: "Silueta", size: "~43MB" },
];

export function BulkImageEditorActionSidebar({
  actionSettings,
  errorMessage,
  hasImages,
  hasSelectedImage,
  isApplying,
  progress,
  selectedActionId,
  onApplyAction,
  onRemoveBackgroundModelChange,
  onRemoveBackgroundProviderChange,
  onRemoveBackgroundThresholdChange,
  onSelectedActionChange,
  onUpdateCropSetting,
}: BulkImageEditorActionSidebarProps) {
  const selectedActionIcon = selectedActionId === "crop" ? Scissors : Sparkles;
  const SelectedActionIcon = selectedActionIcon;
  const progressValue = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
  const removeBackgroundSettings = actionSettings["remove-background"];
  const showImglyModels = removeBackgroundSettings.provider === "imgly";
  const showRembgModels = removeBackgroundSettings.provider === "rembg";
  const showEdgeThreshold = removeBackgroundSettings.provider === "edge";
  const modelOptions = showImglyModels ? imglyModels : showRembgModels ? rembgModels : [];
  const selectedModelDetails = modelOptions.find(
    ({ value }) => value === removeBackgroundSettings.model,
  );

  return (
    <aside className="flex min-h-0 flex-col bg-background">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-medium text-foreground">Actions</p>
        <p className="text-muted-foreground mt-1 text-sm">
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
                  onClick={() => onSelectedActionChange(action.id)}
                  className={cn(
                    "rounded-[1.5rem] border p-4 text-left transition-colors",
                    selectedActionId === action.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/50 hover:bg-muted",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "inline-flex size-10 items-center justify-center rounded-2xl",
                        selectedActionId === action.id
                          ? "bg-primary-foreground/12"
                          : "bg-accent text-accent-foreground",
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
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
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
            <Card className="rounded-[1.5rem] border-border bg-card shadow-none">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Scissors className="size-4" />
                  Crop frame
                </CardTitle>
              </CardHeader>
              <CardContent className="mt-4 grid gap-4 p-4">
                {cropControlConfig.map(({ key, label, min, max, step }) => {
                  const value = actionSettings.crop[key];

                  return (
                    <Label key={key} className="grid gap-2">
                      <div className="text-muted-foreground flex items-center justify-between text-sm">
                        <span>{label}</span>
                        <span>{formatPercent(value)}</span>
                      </div>
                      <Slider
                        min={min}
                        max={max}
                        step={step}
                        value={[value]}
                        onValueChange={(nextValue) =>
                          onUpdateCropSetting(key, nextValue[0] ?? value)
                        }
                      />
                    </Label>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[1.5rem] border-border bg-card shadow-none">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="size-4" />
                  Background detection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="mt-4 grid gap-2">
                  {backgroundProviders.map(([provider, label, description]) => {
                    const isActive =
                      actionSettings["remove-background"].provider === provider;

                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => onRemoveBackgroundProviderChange(provider)}
                        className={cn(
                          "rounded-[1.2rem] border p-3 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        <p className="text-sm font-medium">{label}</p>
                        <p
                          className={cn(
                            "mt-1 text-sm leading-6",
                            isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {description}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {showImglyModels || showRembgModels ? (
                  <div className="mt-4 grid gap-2">
                    <div className="text-muted-foreground flex items-center justify-between text-sm">
                      <span>{showImglyModels ? "AI model" : "ONNX model"}</span>
                      <span>{selectedModelDetails?.size ?? "Model file required"}</span>
                    </div>
                    <Select
                      value={removeBackgroundSettings.model}
                      onValueChange={(value) =>
                        onRemoveBackgroundModelChange(
                          value as RemoveBackgroundSettings["model"],
                        )
                      }
                    >
                      <SelectTrigger className="w-full rounded-2xl border-border bg-background">
                        <SelectValue placeholder={showImglyModels ? "AI model" : "ONNX model"} />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {showEdgeThreshold ? (
                  <Label className="mt-4 grid gap-2">
                    <div className="text-muted-foreground flex items-center justify-between text-sm">
                      <span>Edge color tolerance</span>
                      <span>{removeBackgroundSettings.threshold}</span>
                    </div>
                    <Slider
                      min={8}
                      max={180}
                      step={1}
                      value={[removeBackgroundSettings.threshold]}
                      onValueChange={(nextValue) =>
                        onRemoveBackgroundThresholdChange(
                          nextValue[0] ?? removeBackgroundSettings.threshold,
                        )
                      }
                    />
                  </Label>
                ) : null}
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {showImglyModels
                    ? "IMG.LY is the easiest high-quality in-browser option and downloads its model automatically."
                    : showRembgModels
                      ? "rembg-web expects a matching ONNX file under /models, for example /models/u2netp.onnx."
                      : "Edge flood fill is useful for quick, flat-background cleanup when you want to avoid model-based masking."}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[1.5rem] border-border bg-foreground text-background shadow-none">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm font-medium">Process queue</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6 text-background/70">
                Apply the selected action to the active image or to every image using
                each image&apos;s currently active version as input.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-4 pt-4">
              {progress ? (
                <div className="rounded-[1.2rem] border border-border/30 bg-background/10 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm text-background">
                    <span>
                      {progress.scope === "all" ? "Batch progress" : "Selected image"}
                    </span>
                    <span>
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/15">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-background/70">
                    {progress.currentImageName
                      ? `Processing ${progress.currentImageName}`
                      : "Finishing up results."}
                  </p>
                </div>
              ) : null}
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/80"
                onClick={() => onApplyAction("selected")}
                disabled={!hasSelectedImage || isApplying}
              >
                {isApplying ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <SelectedActionIcon className="size-4" />
                )}
                Apply to Selected Image
              </Button>
              <Button
                variant="outline"
                className="w-full border-border/30 bg-background/10 text-background hover:bg-background/15"
                onClick={() => onApplyAction("all")}
                disabled={!hasImages || isApplying}
              >
                {isApplying ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Layers3 className="size-4" />
                )}
                {isApplying && progress?.scope === "all"
                  ? "Applying to All Images..."
                  : "Bulk Apply to All Images"}
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
  );
}
