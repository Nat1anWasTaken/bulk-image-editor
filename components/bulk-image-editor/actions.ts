"use client";

import type {
  ActionExecutionContext,
  EditorActionId,
  ImageVersion,
} from "@/components/bulk-image-editor/types";
import {
  createDerivedVersion,
  cropVersion,
  removeBackgroundFromVersion,
} from "@/components/bulk-image-editor/image-utils";

type ActionDefinition = {
  id: EditorActionId;
  title: string;
  description: string;
  apply: (
    sourceVersion: ImageVersion,
    context: ActionExecutionContext,
  ) => Promise<ImageVersion>;
};

export const ACTIONS: Record<EditorActionId, ActionDefinition> = {
  crop: {
    id: "crop",
    title: "Crop",
    description: "Apply the active crop frame as a new version.",
    async apply(sourceVersion, context) {
      const result = await cropVersion(sourceVersion, context.crop);
      return createDerivedVersion(sourceVersion, "crop", "Crop", result);
    },
  },
  "remove-background": {
    id: "remove-background",
    title: "Background Removal",
    description: "Strip background colors connected to the image edges.",
    async apply(sourceVersion, context) {
      const result = await removeBackgroundFromVersion(
        sourceVersion,
        context["remove-background"],
      );
      return createDerivedVersion(sourceVersion, "remove-background", "No BG", result);
    },
  },
};
