#!/usr/bin/env node

import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const MODEL_NAMES = [
  "u2netp",
  "u2net",
  "u2net_human_seg",
  "isnet-general-use",
  "isnet-anime",
  "silueta",
];

const REMBG_RELEASE_BASE_URL =
  "https://github.com/bunn-io/rembg-web/releases/download/base-models";

const rootDir = process.cwd();
const modelsDir = path.join(rootDir, "public", "models");

function printUsage() {
  console.log(`Usage:
  pnpm fetch-rembg-models all
  pnpm fetch-rembg-models u2netp
  pnpm fetch-rembg-models u2netp u2net_human_seg
  pnpm fetch-rembg-models all --force

Available models:
  ${MODEL_NAMES.join("\n  ")}`);
}

function parseArgs(argv) {
  const requestedModels = [];
  let force = false;

  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    requestedModels.push(arg);
  }

  if (requestedModels.length === 0) {
    throw new Error("No models specified. Pass one or more model names, or `all`.");
  }

  const models =
    requestedModels.includes("all")
      ? MODEL_NAMES
      : [...new Set(requestedModels)];

  const invalidModels = models.filter((model) => !MODEL_NAMES.includes(model));

  if (invalidModels.length > 0) {
    throw new Error(
      `Unknown model(s): ${invalidModels.join(", ")}. Run with --help to see valid names.`,
    );
  }

  return {
    force,
    models,
  };
}

async function downloadModel(modelName, force) {
  const fileName = `${modelName}.onnx`;
  const destinationPath = path.join(modelsDir, fileName);
  const tempPath = `${destinationPath}.download`;

  if (!force && existsSync(destinationPath)) {
    const fileStats = await stat(destinationPath);
    console.log(`Skipping ${fileName}; already exists (${formatBytes(fileStats.size)}).`);
    return;
  }

  await rm(tempPath, { force: true });

  const sourceUrl = `${REMBG_RELEASE_BASE_URL}/${fileName}`;
  console.log(`Downloading ${fileName}...`);

  const response = await fetch(sourceUrl);

  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch ${sourceUrl} (${response.status} ${response.statusText}).`);
  }

  const totalBytesHeader = response.headers.get("content-length");
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;

  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
  await rename(tempPath, destinationPath);

  const fileStats = await stat(destinationPath);
  const sizeLabel = totalBytes ? formatBytes(totalBytes) : formatBytes(fileStats.size);
  console.log(`Saved ${fileName} to public/models (${sizeLabel}).`);
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  const { force, models } = parseArgs(process.argv.slice(2));

  await mkdir(modelsDir, { recursive: true });

  await Promise.all(models.map((model) => downloadModel(model, force)));
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Failed to fetch rembg models.");
  process.exitCode = 1;
});
