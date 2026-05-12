import { Crop, Eraser, Layers3, LoaderCircle, Scissors, Sparkles } from "lucide-react";

import { ACTIONS } from "@/components/bulk-image-editor/actions";
import { formatPercent } from "@/components/bulk-image-editor/editor-helpers";
import type {
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
    "edge",
    "Edge Flood Fill",
    "Fast fallback for clean, flat backgrounds with no model download.",
  ],
] as const;

export function BulkImageEditorActionSidebar({
  actionSettings,
  errorMessage,
  hasImages,
  hasSelectedImage,
  isApplying,
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

  return (
    <aside className="flex min-h-0 flex-col bg-[#fffdf8]">
      <div className="border-b border-black/8 px-5 py-4">
        <p className="text-sm font-medium text-stone-900">Actions</p>
        <p className="mt-1 text-sm text-stone-600">
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
                      ? "border-stone-950 bg-stone-950 text-stone-50"
                      : "border-black/8 bg-stone-50 hover:bg-stone-100",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "inline-flex size-10 items-center justify-center rounded-2xl",
                        selectedActionId === action.id
                          ? "bg-white/12"
                          : "bg-[#eadabe] text-stone-950",
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
                            ? "text-stone-200"
                            : "text-stone-600",
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
            <Card className="rounded-[1.5rem] border-black/8 bg-[#faf6ef] shadow-none">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-stone-900">
                  <Scissors className="size-4" />
                  Crop frame
                </CardTitle>
              </CardHeader>
              <CardContent className="mt-4 grid gap-4 p-4">
                {cropControlConfig.map(({ key, label, min, max, step }) => {
                  const value = actionSettings.crop[key];

                  return (
                    <Label key={key} className="grid gap-2">
                      <div className="flex items-center justify-between text-sm text-stone-700">
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
            <Card className="rounded-[1.5rem] border-black/8 bg-[#faf6ef] shadow-none">
              <CardHeader className="p-4 pb-0">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-stone-900">
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
                            ? "border-stone-950 bg-stone-950 text-stone-50"
                            : "border-black/8 bg-white hover:bg-stone-100",
                        )}
                      >
                        <p className="text-sm font-medium">{label}</p>
                        <p
                          className={cn(
                            "mt-1 text-sm leading-6",
                            isActive ? "text-stone-200" : "text-stone-600",
                          )}
                        >
                          {description}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {actionSettings["remove-background"].provider === "imgly" ? (
                  <div className="mt-4 grid gap-2">
                    <div className="flex items-center justify-between text-sm text-stone-700">
                      <span>AI model</span>
                      <span>
                        {actionSettings["remove-background"].model === "isnet_quint8"
                          ? "~40MB"
                          : "~80MB"}
                      </span>
                    </div>
                    <Select
                      value={actionSettings["remove-background"].model}
                      onValueChange={(value) =>
                        onRemoveBackgroundModelChange(
                          value as RemoveBackgroundSettings["model"],
                        )
                      }
                    >
                      <SelectTrigger className="w-full rounded-2xl border-black/10 bg-white">
                        <SelectValue placeholder="AI model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="isnet_quint8">Small model</SelectItem>
                        <SelectItem value="isnet_fp16">Medium model</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <Label className="mt-4 grid gap-2">
                  <div className="flex items-center justify-between text-sm text-stone-700">
                    <span>Edge color tolerance</span>
                    <span>{actionSettings["remove-background"].threshold}</span>
                  </div>
                  <Slider
                    min={8}
                    max={180}
                    step={1}
                    value={[actionSettings["remove-background"].threshold]}
                    onValueChange={(nextValue) =>
                      onRemoveBackgroundThresholdChange(
                        nextValue[0] ?? actionSettings["remove-background"].threshold,
                      )
                    }
                  />
                </Label>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  Use the AI engine for cleaner masks. The edge-based fallback is
                  useful when you need a quick local pass or want to avoid model
                  downloads.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[1.5rem] border-black/8 bg-stone-950 text-stone-50 shadow-none">
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm font-medium">Process queue</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6 text-stone-300">
                Apply the selected action to the active image or to every image using
                each image&apos;s currently active version as input.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 grid gap-3 p-4">
              <Button
                className="w-full bg-[#e7d0a4] text-stone-950 hover:bg-[#dec18a]"
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
                className="w-full border-white/15 bg-white/8 text-white hover:bg-white/12"
                onClick={() => onApplyAction("all")}
                disabled={!hasImages || isApplying}
              >
                {isApplying ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Layers3 className="size-4" />
                )}
                Bulk Apply to All Images
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
