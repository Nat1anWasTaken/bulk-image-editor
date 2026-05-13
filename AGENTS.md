# Bulk Image Editor — Agent Notes

## Stack & Versions

- Next.js **16** (breaking changes from 15 — read `node_modules/next/dist/docs/` before writing code)
- React 19, TypeScript 5, Tailwind CSS **4**, shadcn/ui (`radix-maia` style)
- Package manager: **pnpm**
- Path alias: `@/*` → repo root

## Commands

```bash
pnpm dev                          # dev server on :3000
pnpm build                        # production build (prebuild auto-fetches ONNX models)
pnpm lint                         # ESLint (flat config, next core-web-vitals + typescript)
pnpm fetch-rembg-models all       # download ONNX models to public/models/
```

No test runner or typecheck script is configured. `pnpm build` is the only way to verify types.

## Architecture

Single-page browser app with **no backend**. All editing and export happens client-side.

- `app/` — minimal app router shell: layout, page renders `<BulkImageEditor />`
- `components/bulk-image-editor/` — all editor logic (14 files). Entry: `editor.tsx`
  - `actions.ts` — action registry (crop, remove-background)
  - `editor-operations.ts` — batch apply and zip export
  - `image-utils.ts` — image manipulation, version derivation
  - `batch-processing.ts` — concurrency control for bulk operations
  - `background-removal.worker.ts` — Web Worker for background removal
  - `types.ts` — all shared types
- `components/ui/` — shadcn/ui primitives (managed by `shadcn` CLI)
- `public/models/` — ONNX models used by rembg-web (gitignored, fetched by script)

## Constraints

- Component files must not exceed **500 lines**. Refactor if they do.
- `editor.tsx` is currently at ~470 lines — avoid adding logic directly; extract to helpers.
- Background removal runs in a Web Worker — never move that work to the main thread.
- ONNX models in `public/models/` are large binary files; they are fetched by `pnpm fetch-rembg-models` or the prebuild hook, not committed.

## Conventions

- All editor components use `"use client"` — this is a client-side app with no server components beyond the layout shell.
- shadcn/ui components live in `components/ui/` and use the `radix-maia` style. Add new ones via `pnpm dlx shadcn add <name>`.
- **Always prefer shadcn/ui components over raw HTML elements.** Use `Button` instead of `<button>`, `Input` instead of `<input>`, `Select` instead of `<select>`, etc. Check `components/ui/` for available primitives before writing any UI element. If a needed component is missing, install it with `pnpm dlx shadcn add <name>` before falling back to raw HTML.
- Tailwind CSS 4: uses `@tailwindcss/postcss` (no `tailwind.config` file). Utility classes work as usual but config is CSS-first.
- ESLint flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals and typescript presets.
