// Study logs → tidy CSV tables for the statistics.
//
//   npx tsx scripts/analysis/extract.ts [logDir=study-data] [outDir=analysis-out]
//
// Reads the participant logs (<logDir>/*.json, not dev/), writes
// <outDir>/tables/{sessions,tasks,blocks,answers,comments,issues}.csv.
// Pilot sessions are included with pilot=true; the statistics leave them out.
// Column definitions: src/analysis/measures.ts.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractAll, toCsv, type Issue } from "../../src/analysis/measures";
import type { TelemetryLog } from "../../src/telemetry/schema";

const [logDir = "study-data", outDir = "analysis-out"] = process.argv.slice(2);

const logs: TelemetryLog[] = [];
const unreadable: Issue[] = [];
let names: string[] = [];
try {
  names = readdirSync(logDir).filter((f) => f.endsWith(".json"));
} catch {
  console.error(`No log folder ${logDir}`);
  process.exit(1);
}
for (const name of names) {
  try {
    logs.push(JSON.parse(readFileSync(join(logDir, name), "utf8")) as TelemetryLog);
  } catch (e) {
    unreadable.push({ participant: name, severity: "error", message: `unreadable log: ${(e as Error).message}` });
  }
}

const tables = extractAll(logs);
tables.issues.unshift(...unreadable);
const dir = join(outDir, "tables");
mkdirSync(dir, { recursive: true });
const columns: Record<string, string[]> = {
  comments: ["participant", "comment"],
  issues: ["participant", "severity", "message"],
};
for (const name of ["sessions", "tasks", "blocks", "answers", "comments", "issues"] as const) {
  writeFileSync(join(dir, `${name}.csv`), toCsv(tables[name], columns[name]));
}

const pilots = tables.sessions.filter((s) => s.pilot).length;
const complete = tables.sessions.filter((s) => s.completed && !s.pilot).length;
console.log(
  `${tables.sessions.length} study sessions (${complete} completed, ${pilots} pilot), ` +
    `${tables.tasks.length} task rows, ${tables.issues.length} issues` +
    (tables.skipped.length ? `; skipped ${tables.skipped.length} non-study logs` : "") +
    ` → ${dir}`,
);
