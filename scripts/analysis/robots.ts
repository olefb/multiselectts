// Writes robot-participant logs (synthetic, known behaviour) for testing the analysis.
//
//   npx tsx scripts/analysis/robots.ts <outDir> [--count 32] [--seed 1] [--profile expected|none]
//
// See src/analysis/robots.ts for the profiles.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { datasetFromFile, type Dataset, type DatasetFile } from "../../src/data/dataset";
import { EXPECTED_EFFECTS, NO_EFFECTS, robotSessions } from "../../src/analysis/robots";
import { STUDY } from "../../src/study/config";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    count: { type: "string", default: "32" },
    seed: { type: "string", default: "1" },
    profile: { type: "string", default: "expected" },
  },
});
const outDir = positionals[0];
if (!outDir || !["expected", "none"].includes(values.profile)) {
  console.error("usage: robots.ts <outDir> [--count 32] [--seed 1] [--profile expected|none]");
  process.exit(1);
}

const datasets = new Map<string, Dataset>();
const dir = "src/data/datasets";
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const d = datasetFromFile(JSON.parse(readFileSync(join(dir, f), "utf8")) as DatasetFile);
  datasets.set(d.id, d);
}

const sessions = robotSessions({
  config: STUDY,
  datasets,
  profile: values.profile === "none" ? NO_EFFECTS : EXPECTED_EFFECTS,
  seed: Number(values.seed),
  count: Number(values.count),
});
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const s of sessions) writeFileSync(join(outDir, `${s.log.sessionId}.json`), JSON.stringify(s.log));
console.log(`${sessions.length} robot participants (${values.profile} effects, seed ${values.seed}) → ${outDir}`);
