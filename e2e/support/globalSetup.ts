import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseURL: string;
    /** Where the dev server saves telemetry logs ("" when testing an external server). */
    telemetryDir: string;
  }
}

/** Starts the app once for all e2e files, unless E2E_BASE_URL points at a running server. */
export default async function setup(project: TestProject) {
  const external = process.env.E2E_BASE_URL;
  if (external) {
    project.provide("baseURL", external);
    project.provide("telemetryDir", "");
    return;
  }

  // Telemetry from test runs goes to a fresh temp folder, never to study-data/.
  // Tripwire: the run fails if study-data/ gains participant logs anyway.
  // (Only top-level *.json: a developer's own open browser tab saves to
  // study-data/dev/ while tests run, which is harmless.)
  const listStudyData = () =>
    existsSync("study-data") ? readdirSync("study-data").filter((f) => f.endsWith(".json")) : [];
  const studyDataBefore = new Set(listStudyData());
  const telemetryDir = mkdtempSync(join(tmpdir(), "e2e-telemetry-"));
  process.env.TELEMETRY_DIR = telemetryDir;
  project.provide("telemetryDir", telemetryDir);

  const server: ViteDevServer = await createServer({
    logLevel: "warn",
    server: { host: "127.0.0.1", port: 5199, strictPort: false },
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite did not report a local URL");
  project.provide("baseURL", url);

  return async () => {
    await server.close();
    const leaked = listStudyData().filter((f) => !studyDataBefore.has(f));
    if (leaked.length > 0) {
      process.exitCode = 1; // vitest only logs teardown errors; make the run fail
      throw new Error(`The e2e run wrote to study-data/ (participant data folder): ${leaked.join(", ")}`);
    }
  };
}
