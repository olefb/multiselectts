/**
 * The local save endpoint (telemetry-server.ts), exercised over real HTTP.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { countCompletedGroups, studyGroupsMiddleware, telemetryMiddleware } from "../../../telemetry-server";

let server: Server;
let base: string;
const dir = mkdtempSync(join(tmpdir(), "telemetry-test-"));

beforeAll(async () => {
  const save = telemetryMiddleware(dir);
  const groups = studyGroupsMiddleware(dir);
  server = createServer((req, res) =>
    save(req, res, () =>
      groups(req, res, () => {
        res.statusCode = 404;
        res.end();
      }),
    ),
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const post = (path: string, body: string) => fetch(`${base}${path}`, { method: "POST", body });

describe("telemetry endpoint", () => {
  it("writes the log to <dir>/<session>.json and replaces it on the next save", async () => {
    expect((await post("/__telemetry/S-ABC123", '{"events":[1]}')).status).toBe(204);
    expect(JSON.parse(readFileSync(join(dir, "S-ABC123.json"), "utf8"))).toEqual({ events: [1] });
    expect((await post("/__telemetry/S-ABC123", '{"events":[1,2]}')).status).toBe(204);
    expect(JSON.parse(readFileSync(join(dir, "S-ABC123.json"), "utf8")).events).toHaveLength(2);
    expect(readdirSync(dir).some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("rejects invalid JSON, other methods, and unsafe session IDs", async () => {
    expect((await post("/__telemetry/S-BAD", "{not json")).status).toBe(400);
    expect(existsSync(join(dir, "S-BAD.json"))).toBe(false);
    expect((await fetch(`${base}/__telemetry/S-ABC123`)).status).toBe(405);
    expect((await post("/__telemetry/..%2Fescape", "{}")).status).toBe(404);
    expect((await post("/__telemetry/a/b", "{}")).status).toBe(404);
  });

  it("keeps developer sessions apart in <dir>/dev/", async () => {
    expect((await post("/__telemetry/dev/S-DEV001", '{"events":[]}')).status).toBe(204);
    expect(existsSync(join(dir, "dev", "S-DEV001.json"))).toBe(true);
    expect(existsSync(join(dir, "S-DEV001.json"))).toBe(false);
    expect((await post("/__telemetry/other/S-DEV001", "{}")).status).toBe(404);
  });

  it("passes other requests on", async () => {
    expect((await fetch(`${base}/index.html`)).status).toBe(404);
  });
});

describe("study group counts", () => {
  const log = (study: Record<string, unknown>) => JSON.stringify({ meta: { study }, events: [] });

  it("counts completed, non-pilot study sessions per group", async () => {
    const groupsDir = mkdtempSync(join(tmpdir(), "groups-test-"));
    writeFileSync(join(groupsDir, "P-1.json"), log({ group: "G1", completed: true }));
    writeFileSync(join(groupsDir, "P-2.json"), log({ group: "G1", completed: true }));
    writeFileSync(join(groupsDir, "P-3.json"), log({ group: "G2", completed: false })); // stopped early
    writeFileSync(join(groupsDir, "P-4.json"), log({ group: "G3", completed: true, pilot: true }));
    writeFileSync(join(groupsDir, "S-5.json"), JSON.stringify({ meta: {}, events: [] })); // not a study session
    writeFileSync(join(groupsDir, "P-6.json"), "{broken");
    expect(countCompletedGroups(groupsDir)).toEqual({ completed: { G1: 2 }, sessions: 4 });
    expect(countCompletedGroups(join(groupsDir, "missing"))).toEqual({ completed: {}, sessions: 0 });
  });

  it("answers GET /__study/groups from the log folder", async () => {
    await post("/__telemetry/P-DONE01", log({ group: "G4", completed: true }));
    const res = await fetch(`${base}/__study/groups`);
    expect(res.status).toBe(200);
    expect((await res.json()).completed).toEqual({ G4: 1 });
    expect((await post("/__study/groups", "{}")).status).toBe(405);
  });
});
