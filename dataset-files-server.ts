// File: dataset-files-server.ts
//
// Vite plugin (dev server only): serves dataset thumbnails under
// public/datasets/ straight from disk.
//
// Why: Vite serves public/ from a list of files it builds at startup and keeps
// up to date with a file watcher. When thumbnails are generated or imported
// while the dev server runs (scripts/make-demo-dataset.mjs,
// scripts/import-photos.mjs), the watcher can miss files written in a burst,
// especially on synced or mounted folders; Vite then answers those URLs with
// index.html and the images break until the server is restarted. Looking the
// file up on every request avoids that. `vite build` / `preview` copy public/
// at build time and are not affected.

import { createReadStream, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

type Next = (err?: unknown) => void;

/** Connect-style middleware for `<base>datasets/**`; exported for tests. */
export function datasetFilesMiddleware(publicDir: string, base = "/") {
  const root = resolve(publicDir, "datasets");
  const prefix = `${base.endsWith("/") ? base : `${base}/`}datasets/`;
  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const path = (req.url ?? "").split("?")[0];
    if (!path.startsWith(prefix)) return next();
    let rel: string;
    try {
      rel = decodeURIComponent(path.slice(prefix.length));
    } catch {
      return next();
    }
    const file = resolve(root, rel);
    const type = TYPES[extname(file).toLowerCase()];
    if (!type || !file.startsWith(root + sep)) return next(); // images only, never outside public/datasets
    let size: number;
    try {
      const stat = statSync(file);
      if (!stat.isFile()) return next();
      size = stat.size;
    } catch {
      return next();
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", size);
    res.setHeader("Cache-Control", "no-cache");
    if (req.method === "HEAD") return res.end();
    createReadStream(file).on("error", () => res.destroy()).pipe(res);
  };
}

export function datasetFilesServer(): Plugin {
  return {
    name: "dataset-files-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(datasetFilesMiddleware(server.config.publicDir, server.config.base));
    },
  };
}
