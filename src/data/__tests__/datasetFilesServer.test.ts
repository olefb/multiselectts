/**
 * Dev-server middleware that serves dataset thumbnails from disk
 * (dataset-files-server.ts), so images added while the server runs load.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { datasetFilesMiddleware } from "../../../dataset-files-server";

const root = mkdtempSync(join(tmpdir(), "dataset-files-"));
const publicDir = join(root, "public");
mkdirSync(join(publicDir, "datasets", "d"), { recursive: true });
writeFileSync(join(root, "secret.svg"), "<svg>secret</svg>");
writeFileSync(join(publicDir, "datasets", "d", "notes.json"), "{}");

let server: Server;
let base: string;
beforeAll(async () => {
  const mw = datasetFilesMiddleware(publicDir, "/app/");
  // Like Vite for a public file it does not know about: the SPA page.
  server = createServer((req, res) =>
    mw(req, res, () => {
      res.setHeader("Content-Type", "text/html");
      res.end("<!doctype html>");
    }),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const type = async (path: string) => (await fetch(`${base}${path}`)).headers.get("content-type");

describe("dataset files middleware", () => {
  it("serves an image written after the server started", async () => {
    writeFileSync(join(publicDir, "datasets", "d", "IMG 1.svg"), "<svg/>");
    const res = await fetch(`${base}/app/datasets/d/IMG%201.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(await res.text()).toBe("<svg/>");
  });

  it("passes on missing files, other file types, other paths and escapes from public/datasets", async () => {
    expect(await type("/app/datasets/d/missing.svg")).toBe("text/html");
    expect(await type("/app/datasets/d/notes.json")).toBe("text/html");
    expect(await type("/datasets/d/IMG%201.svg")).toBe("text/html"); // outside the base path
    expect(await type("/app/datasets/..%2F..%2Fsecret.svg")).toBe("text/html");
    expect(await type("/app/datasets/d")).toBe("text/html");
  });
});
