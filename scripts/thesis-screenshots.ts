/**
 * Screenshots of the study app for the thesis: a scripted pilot session in
 * English (group G1: the unified system first, then the Windows-like one), on
 * the demo datasets, at the study laptop's viewport (STUDY.viewport) and twice
 * the pixel density.
 *
 *   npm run screenshots [-- <outDir>]      (default thesis/figures/screens)
 *
 * Telemetry goes to a temporary folder, never to study-data/. The browser is
 * the one the e2e tests use (bundled Chromium on Linux x64, or CHROME_PATH).
 * Re-run after UI changes; file names stay the same. Folder icons are emoji:
 * the machine needs an emoji font (e.g. Noto Color Emoji, as .ttf) or they show
 * as boxes. With the bundled Chromium, also set FONTCONFIG_PATH=/etc/fonts so it
 * uses the system's fonts.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { launchBrowser } from "../e2e/support/browser";
import { Explorer } from "../e2e/support/explorer";
import { STUDY } from "../src/study/config";

const outDir = process.argv[2] ?? "thesis/figures/screens";
mkdirSync(outDir, { recursive: true });

type TaskJson = { targets?: string[]; keep?: string[]; preselected?: string[] };
const D1 = (JSON.parse(readFileSync("src/data/datasets/pets-demo.json", "utf8")) as { tasks: Record<string, TaskJson> }).tasks;
const base = (id: string) => id.split("/").pop()!;

const studyDataBefore = existsSync("study-data") ? readdirSync("study-data").length : 0;
process.env.TELEMETRY_DIR = mkdtempSync(join(tmpdir(), "screenshots-telemetry-"));
const server = await createServer({
  logLevel: "warn",
  cacheDir: join(tmpdir(), "screenshots-vite-cache"), // leaves the dev server's node_modules/.vite alone
  server: { host: "127.0.0.1", port: 5198, strictPort: false },
});
await server.listen();
const url = server.resolvedUrls!.local[0];
const browser = await launchBrowser();
const ex = await Explorer.open(browser, url, "?study=1&group=G1&pilot=1&skipAfter=1", {
  viewport: STUDY.viewport,
  scale: 2,
  readyWhen: "[data-testid='study-setup']",
});
const page = ex.page;
const id = (testId: string) => page.getByTestId(testId);
const taken: string[] = [];

/**
 * Waits for images and the match note's flash, then saves the screen. Screens
 * with the file manager are cropped to the app column (instructions to the end
 * of the list); the others keep the whole viewport.
 */
async function shot(name: string) {
  await page.waitForLoadState("networkidle");
  await ex.settle();
  await page.waitForTimeout(1200);
  const list = page.locator("div[tabindex='0']");
  const box = (await list.count()) ? await list.first().boundingBox() : null;
  const pad = 12;
  const clip = box
    ? { x: box.x - pad, y: 0, width: box.width + 2 * pad, height: Math.min(STUDY.viewport.height, box.y + box.height + pad) }
    : undefined;
  await page.screenshot({ path: join(outDir, `${name}.png`), clip, fullPage: !clip });
  taken.push(name);
}
async function likert(q: string, v: number) {
  await id(`likert-${q}`).getByRole("button", { name: String(v), exact: true }).click();
}
async function passed() {
  await id("tutorial-correct").waitFor({ timeout: 3000 });
  await id("tutorial-next").click();
}
async function startTask(name?: string) {
  await id("task-start").click();
  await page.locator("div[tabindex='0']").waitFor();
  if (name) await shot(name);
}
async function finishTask(seq: number) {
  await id("task-done").click({ timeout: 5000 });
  await likert("seq", seq);
}

try {
  // --- Consent
  await id("hand-over").click();
  await id("lang-en").click();
  await shot("a1-consent");
  await id("consent-agree").check();
  await id("choice-os").locator("input").nth(0).check();
  await id("choice-knows").locator("input").nth(1).check();
  await id("consent-continue").click();

  // --- Block A: unified system, practice
  await id("block-start").click();
  for (const t of D1["tutorial-warmup"].targets!) await ex.click(base(t), "Control");
  await passed();
  const range = D1["tutorial-range"].targets!;
  await ex.click(base(range[0]));
  await ex.click(base(range[range.length - 1]), "Shift");
  for (const out of ["letter.docx", "notes_week1.txt"]) await ex.click(out, "Control");
  await passed();
  const target = base(D1["tutorial-search"].targets![0]);
  await ex.search(target.split(".")[0]);
  await ex.click(target);
  await passed();
  await ex.search("");
  await ex.item("Archive").dblclick();
  await ex.click(base(D1["tutorial-list-view"].targets![0]));
  await ex.button("List").click();
  await passed();
  await shot("a2-practice-select-matching"); // the step's instructions, its controls outlined
  await page.getByLabel("Select matching", { exact: true }).check();
  await ex.search("report");
  await page.keyboard.press("Enter");
  await page.getByLabel("Deselect matching", { exact: true }).check();
  await ex.search("copy");
  await page.keyboard.press("Enter");
  await passed();
  await page.getByLabel("Show selected only", { exact: true }).check();
  await shot("m3-show-selected-only"); // selected files from a closed folder are listed
  const focus = D1["tutorial-show-selected"];
  await ex.click(base(focus.preselected!.find((p) => !focus.targets!.includes(p))!), "Control");
  await passed();

  // --- Block A: tasks
  await shot("a3-task-intro"); // "Task 1 of 4" and the system's tools
  await startTask("b1-task-a");
  await finishTask(6);

  await startTask("b2-task-b");
  const cats = D1["context-switch"].targets!.filter((t) => !t.endsWith(".xlsx")).map(base);
  await ex.click(cats[0]);
  for (const c of cats.slice(1)) await ex.click(c, "Control");
  await ex.search("budget");
  await shot("m2-hidden-by-search"); // the cats stay selected while the search hides them
  await finishTask(6);

  await startTask("b3-task-c");
  await page.getByLabel("Select matching", { exact: true }).check();
  await ex.search("pdf");
  await shot("m1-select-matching-live"); // live preview: "N selected – press Enter to keep"
  await page.keyboard.press("Enter");
  await shot("m1b-select-matching-kept"); // after Enter: the note names a match that is not visible
  await page.getByLabel("Deselect matching", { exact: true }).check();
  await ex.search("draft");
  await page.keyboard.press("Enter");
  await finishTask(5);

  await startTask("b4-task-d");
  await finishTask(7);

  await shot("a4-block-questions");
  await likert("sufficient", 6);
  await likert("frustrating", 2);
  await id("block-questions-continue").click();

  // --- Block B: the Windows-like baseline (warm-up only, skipped)
  await id("block-start").click();
  await id("skip-practice").click({ timeout: 5000 });
  await startTask();
  await finishTask(6);
  await startTask("b5-traditional-task-b"); // same layout; no matching modes or visibility aids
  await finishTask(3);
  for (let i = 0; i < 2; i++) {
    await startTask();
    await finishTask(5);
  }
  await likert("sufficient", 5);
  await likert("frustrating", 4);
  await id("block-questions-continue").click();

  // --- Final questions and debrief
  await shot("a5-final-questions");
  await id("choice-preference").locator("input").nth(0).check();
  await id("choice-lost").locator("input").nth(0).check();
  await id("final-finish").click();
  await id("debrief").waitFor();
  await shot("a6-debrief");
} finally {
  if (ex.errors.length) console.warn("Console errors/warnings:\n" + ex.errors.join("\n"));
  await ex.close();
  await browser.close();
  await server.close();
  const after = existsSync("study-data") ? readdirSync("study-data").length : 0;
  if (after !== studyDataBefore) console.error("Warning: study-data/ changed during the run; check it.");
  console.log(`${taken.length} screenshots → ${outDir}: ${taken.join(", ")}`);
}
