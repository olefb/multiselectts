#!/usr/bin/env node
// Turns a folder of photos into an explorer dataset (task folder).
//
//   node scripts/import-photos.mjs <input-dir> <dataset-id> [options]
//
// <input-dir> layout: one subfolder per category; the subfolder name becomes a
// hidden tag used to define task targets. Photos directly in <input-dir> get
// no tag.
//
//   my-photos/
//     cat/  IMG_0001.jpg, whiskers.png, ...
//     dog/  ...
//
// Output:
//   public/datasets/<id>/IMG_####.webp   thumbnails (EXIF orientation applied,
//                                        all metadata such as GPS stripped)
//   src/data/datasets/<id>.json           dataset with one folder of photos,
//                                         shuffled, with camera-style names
//
// Options:
//   --folder <name>   folder name in the explorer (default "Photos")
//   --seed <n>        shuffle seed (default 1)
//   --start <n>       first camera number, IMG_<n> (default 4801)
//   --width <px>      thumbnail width (default 320)
//   --force           overwrite an existing dataset JSON (it may have been hand-edited)
//
// The JSON can be edited afterwards, e.g. to add document folders.

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".avif"]);

function parseArgs(argv) {
  const positional = [];
  const opts = { folder: "Photos", seed: 1, start: 4801, width: 320, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") opts.force = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      if (!(key in opts)) throw new Error(`Unknown option ${a}`);
      const value = argv[++i];
      opts[key] = typeof opts[key] === "number" ? Number(value) : value;
    } else positional.push(a);
  }
  if (positional.length !== 2) throw new Error("Usage: node scripts/import-photos.mjs <input-dir> <dataset-id> [options]");
  const [input, id] = positional;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("dataset-id: lowercase letters, digits and dashes only");
  return { input: resolve(input), id, ...opts };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isImage = (path) => IMAGE_EXT.has(extname(path).toLowerCase()) && statSync(path).isFile();
const formatSize = (bytes) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const imgDir = join(ROOT, "public", "datasets", o.id);
  const jsonPath = join(ROOT, "src", "data", "datasets", `${o.id}.json`);
  if (!existsSync(o.input)) throw new Error(`Input folder not found: ${o.input}`);
  if (existsSync(jsonPath) && !o.force) throw new Error(`${jsonPath} exists (maybe hand-edited). Use --force to overwrite.`);

  // Collect photos: <input>/<tag>/<photo> and untagged <input>/<photo>.
  const sources = [];
  for (const entry of readdirSync(o.input).sort()) {
    const path = join(o.input, entry);
    if (statSync(path).isDirectory()) {
      for (const f of readdirSync(path).sort()) if (isImage(join(path, f))) sources.push({ path: join(path, f), tag: entry });
    } else if (isImage(path)) sources.push({ path, tag: null });
  }
  if (sources.length === 0) throw new Error("No images found");

  // Shuffle so categories are interleaved, as in a real camera roll.
  const rand = mulberry32(o.seed);
  for (let i = sources.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [sources[i], sources[j]] = [sources[j], sources[i]];
  }

  rmSync(imgDir, { recursive: true, force: true });
  mkdirSync(imgDir, { recursive: true });
  mkdirSync(dirname(jsonPath), { recursive: true });

  const children = [];
  for (const [i, src] of sources.entries()) {
    const base = `IMG_${o.start + i}`;
    // rotate() applies EXIF orientation; sharp drops all metadata (EXIF, GPS, ICC) by default.
    await sharp(src.path).rotate().resize({ width: o.width, withoutEnlargement: true }).webp({ quality: 75 }).toFile(join(imgDir, `${base}.webp`));
    const stat = statSync(src.path);
    children.push({
      name: `${base}.jpg`,
      size: formatSize(stat.size),
      modified: stat.mtime.toISOString().slice(0, 10),
      thumbnail: `datasets/${o.id}/${base}.webp`,
      ...(src.tag ? { tags: [src.tag] } : {}),
    });
  }

  const dataset = {
    id: o.id,
    description: `Imported from ${sources.length} photos by scripts/import-photos.mjs (seed ${o.seed}).`,
    tree: [{ name: o.folder, children }],
  };
  writeFileSync(jsonPath, JSON.stringify(dataset, null, 2) + "\n");

  const counts = {};
  for (const s of sources) counts[s.tag ?? "(untagged)"] = (counts[s.tag ?? "(untagged)"] ?? 0) + 1;
  console.log(`Imported ${sources.length} photos into "${o.id}":`, counts);
  console.log(`  thumbnails: ${imgDir}\n  dataset:    ${jsonPath}`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
