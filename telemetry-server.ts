// File: telemetry-server.ts
//
// Vite plugin: a local endpoint that saves telemetry logs to disk while the
// study runs on the experimenter's laptop (`npm run dev` or `npm run preview`).
//
//   POST /__telemetry/<sessionId>       body: the session log (JSON)
//   → writes <dir>/<sessionId>.json (default dir "study-data", or $TELEMETRY_DIR)
//   POST /__telemetry/dev/<sessionId>   developer/pilot view (not study mode)
//   → writes <dir>/dev/<sessionId>.json, kept apart from participant logs
//   GET  /__study/groups                completed study sessions per group
//   → {"completed": {"G1": 3, ...}, "sessions": 12}; used to assign the next
//     participant's counterbalancing group. Counts logs whose meta.study has
//     completed: true and no pilot flag.
//
// Each save replaces the whole file atomically (temp file + rename), so a
// crash never leaves a half-written log. study-data/ is gitignored: participant
// data must never be committed.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

const ROUTE = /^\/__telemetry\/(?:(dev)\/)?([A-Za-z0-9-]{1,64})\/?$/;
const GROUPS_ROUTE = /^\/__study\/groups\/?$/;
const MAX_BYTES = 50 * 1024 * 1024;

type Next = (err?: unknown) => void;

/** Connect-style middleware; exported for tests. */
export function telemetryMiddleware(dir: string) {
  const outDir = resolve(dir);
  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const path = (req.url ?? "").split("?")[0];
    const match = path.match(ROUTE);
    if (!match) return next();
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      return res.end();
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        aborted = true;
        res.statusCode = 413;
        res.end();
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      const body = Buffer.concat(chunks).toString("utf8");
      try {
        JSON.parse(body); // reject anything that is not a complete JSON document
      } catch {
        res.statusCode = 400;
        return res.end("invalid JSON");
      }
      try {
        const folder = match[1] ? join(outDir, match[1]) : outDir;
        mkdirSync(folder, { recursive: true });
        const file = join(folder, `${match[2]}.json`);
        writeFileSync(`${file}.tmp`, body);
        renameSync(`${file}.tmp`, file);
        res.statusCode = 204;
        res.end();
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
  };
}

/** Completed, non-pilot study sessions per group in `dir` (top level only, not dev/). */
export function countCompletedGroups(dir: string): { completed: Record<string, number>; sessions: number } {
  const completed: Record<string, number> = {};
  let sessions = 0;
  if (!existsSync(dir)) return { completed, sessions };
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    let study: { group?: unknown; completed?: unknown; pilot?: unknown } | undefined;
    try {
      study = JSON.parse(readFileSync(join(dir, name), "utf8"))?.meta?.study;
    } catch {
      continue; // unreadable file: not counted
    }
    if (!study || typeof study.group !== "string") continue;
    sessions++;
    if (study.completed === true && !study.pilot) completed[study.group] = (completed[study.group] ?? 0) + 1;
  }
  return { completed, sessions };
}

/** Connect-style middleware for GET /__study/groups; exported for tests. */
export function studyGroupsMiddleware(dir: string) {
  const outDir = resolve(dir);
  return (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const path = (req.url ?? "").split("?")[0];
    if (!GROUPS_ROUTE.test(path)) return next();
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET");
      return res.end();
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(countCompletedGroups(outDir)));
  };
}

export function telemetryServer(dir = process.env.TELEMETRY_DIR ?? "study-data"): Plugin {
  // Inside a test runner, only save when a (temporary) folder was configured:
  // test sessions must never end up next to real participant data.
  if (process.env.VITEST && !process.env.TELEMETRY_DIR) return { name: "telemetry-server (disabled in tests)" };
  const save = telemetryMiddleware(dir);
  const groups = studyGroupsMiddleware(dir);
  return {
    name: "telemetry-server",
    configureServer(server) {
      server.middlewares.use(save);
      server.middlewares.use(groups);
    },
    configurePreviewServer(server) {
      server.middlewares.use(save);
      server.middlewares.use(groups);
    },
  };
}
