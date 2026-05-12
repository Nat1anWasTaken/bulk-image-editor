import type {
  ImglyRemoveBackgroundModel,
  RemoveBackgroundSettings,
  RemoveBackgroundProvider,
  RembgRemoveBackgroundModel,
} from "@/components/bulk-image-editor/types";

export const IMGLY_REMOVE_BACKGROUND_MODELS = [
  "isnet_quint8",
  "isnet_fp16",
] as const satisfies ReadonlyArray<ImglyRemoveBackgroundModel>;

export const REMBG_REMOVE_BACKGROUND_MODELS = [
  "u2netp",
  "u2net",
  "u2net_human_seg",
  "isnet-general-use",
  "isnet-anime",
  "silueta",
] as const satisfies ReadonlyArray<RembgRemoveBackgroundModel>;

const IMGLY_REMOVE_BACKGROUND_MODEL_SET = new Set<ImglyRemoveBackgroundModel>(
  IMGLY_REMOVE_BACKGROUND_MODELS,
);

const REMBG_REMOVE_BACKGROUND_MODEL_SET = new Set<RembgRemoveBackgroundModel>(
  REMBG_REMOVE_BACKGROUND_MODELS,
);

export function getDefaultRemoveBackgroundModel(
  provider: RemoveBackgroundProvider,
): RemoveBackgroundSettings["model"] {
  return provider === "rembg" ? "u2netp" : "isnet_quint8";
}

export function isImglyRemoveBackgroundModel(
  model: RemoveBackgroundSettings["model"],
): model is ImglyRemoveBackgroundModel {
  return IMGLY_REMOVE_BACKGROUND_MODEL_SET.has(model as ImglyRemoveBackgroundModel);
}

export function isRembgRemoveBackgroundModel(
  model: RemoveBackgroundSettings["model"],
): model is RembgRemoveBackgroundModel {
  return REMBG_REMOVE_BACKGROUND_MODEL_SET.has(model as RembgRemoveBackgroundModel);
}

export function getCompatibleRemoveBackgroundModel(
  provider: RemoveBackgroundProvider,
  model: RemoveBackgroundSettings["model"],
) {
  if (provider === "imgly") {
    return isImglyRemoveBackgroundModel(model)
      ? model
      : getDefaultRemoveBackgroundModel(provider);
  }

  if (provider === "rembg") {
    return isRembgRemoveBackgroundModel(model)
      ? model
      : getDefaultRemoveBackgroundModel(provider);
  }

  return model;
}
