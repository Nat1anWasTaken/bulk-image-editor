# Bulk Image Editor

Bulk Image Editor is a browser-based workspace for batch-editing image sets without destroying version history. Import multiple files, crop them, remove backgrounds with several providers, and export the active versions as a single zip.

## What It Does

- Load multiple images into a versioned workspace
- Crop the selected image with a draggable frame or numeric controls
- Remove backgrounds with one of three providers:
  - `IMG.LY AI`
  - `rembg-web`
  - `Edge Flood Fill`
- Apply actions to one image or the entire batch
- Tune bulk apply and zip export throughput with a batch size selector
- Keep every edit as a new version instead of overwriting the source
- Export the active version of every image as a `.zip` file

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui and Radix primitives
- `jszip` for bulk exports
- `@imgly/background-removal` and `@bunnio/rembg-web` for background removal

## Requirements

- A modern browser with Web Worker, `OffscreenCanvas`, and `createImageBitmap` support for background removal
- `pnpm` for local scripts

## Getting Started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` in your browser.

## Model Setup

Background removal with `rembg-web` uses ONNX models from `public/models`.

The repository includes a model download script:

```bash
pnpm fetch-rembg-models all
```

This command is also wired into `prebuild`, so `pnpm build` will fetch missing models automatically before building.

You can download specific models if you only need a subset:

```bash
pnpm fetch-rembg-models u2netp
pnpm fetch-rembg-models u2netp u2net_human_seg
pnpm fetch-rembg-models all --force
```

## Usage

1. Select multiple image files from the landing screen.
2. Pick an image from the left sidebar.
3. Choose an action from the right sidebar:
   - `Crop`
   - `Background Removal`
4. Tune the action settings.
5. Set the batch size for bulk apply and export throughput.
6. Apply the action to the selected image or to the full batch.
7. Switch between versions from the image list sidebar.
8. Export the active version of each image as a zip.

### Crop

- Use the crop overlay in the preview pane to drag and resize the crop frame.
- Fine-tune `Left`, `Top`, `Width`, and `Height` with sliders.
- Each crop creates a new version.

### Background Removal

Choose one of the available providers:

- `IMG.LY AI` for higher-quality in-browser matting
- `rembg-web` for ONNX-based local model execution
- `Edge Flood Fill` for a fast heuristic fallback on simple backgrounds

Provider-specific model options are shown in the sidebar. The edge-based fallback uses a tolerance slider instead of a model selector.

## Keyboard Shortcuts

- `j` and `k` move between images
- `h` and `l` move between versions of the selected image

## Scripts

```bash
pnpm dev                 # Start the development server
pnpm build               # Build the app
pnpm start               # Run the production server
pnpm lint                # Run ESLint
pnpm fetch-rembg-models all  # Download all ONNX models for rembg-web
```

## Project Structure

- `app/` - App router entry, layout, and global styles
- `components/bulk-image-editor/` - Editor workspace, action handling, preview, and utilities
- `components/ui/` - Shared UI primitives
- `public/models/` - ONNX models used by `rembg-web`
- `scripts/fetch-rembg-models.mjs` - Model download utility

## Notes

- Edits are versioned in memory during the session; resetting the workspace clears the loaded images and their derived versions.
- The app runs entirely in the browser for editing and export, with no backend required.

## Deployment

This is a standard Next.js application. Build it with `pnpm build` and run it with `pnpm start`, or deploy it to any platform that supports Node.js and Next.js apps.
