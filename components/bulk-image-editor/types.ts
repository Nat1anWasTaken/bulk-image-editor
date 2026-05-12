export type EditorActionId = "crop" | "remove-background";

export type CropSettings = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RemoveBackgroundProvider = "edge" | "imgly" | "rembg";

export type ImglyRemoveBackgroundModel = "isnet_quint8" | "isnet_fp16";

export type RembgRemoveBackgroundModel =
  | "u2netp"
  | "u2net"
  | "u2net_human_seg"
  | "isnet-general-use"
  | "isnet-anime"
  | "silueta";

export type RemoveBackgroundSettings = {
  threshold: number;
  provider: RemoveBackgroundProvider;
  model: ImglyRemoveBackgroundModel | RembgRemoveBackgroundModel;
};

export type EditorActionSettings = {
  crop: CropSettings;
  "remove-background": RemoveBackgroundSettings;
};

export type ImageVersion = {
  id: string;
  label: string;
  actionId: EditorActionId | "original";
  sourceVersionId: string | null;
  blob: Blob;
  objectUrl: string;
  width: number;
  height: number;
  mimeType: string;
  createdAt: number;
};

export type EditorImage = {
  id: string;
  name: string;
  fileNameStem: string;
  originalFileName: string;
  versions: ImageVersion[];
  activeVersionId: string;
};

export type ExportFormat = "png" | "jpg";

export type ActionExecutionContext = {
  crop: CropSettings;
  "remove-background": RemoveBackgroundSettings;
};

export type ActionProgress = {
  actionId: EditorActionId;
  scope: "selected" | "all";
  completed: number;
  total: number;
  currentImageName: string | null;
};
