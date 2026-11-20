import type { Browser, BrowserContext, Locator, Page } from "playwright-core";

/** Delay of the predicate-search debounce in VirtualizedExplorer, plus margin. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Row height of the tree view (TREE_CONFIG.itemHeight). */
export const TREE_ROW_PX = 32;

type Modifier = "Control" | "Shift" | "Meta" | "Alt";
export interface OpenOptions {
  /** Browser viewport (default 1200×1000). */
  viewport?: { width: number; height: number };
  /** Selector that appears once the page is ready (default: the explorer's selection count). */
  readyWhen?: string;
  /** Device pixel ratio (default 1; the thesis screenshots use 2). */
  scale?: number;
}

type SearchMode = "Filter View (Mask)" | "Exclude View" | "Select Items (Predicate)" | "Deselect Items (Predicate)";

/**
 * Page object for the explorer. Read-only accessors return plain values so
 * they can be used with `expect.poll(...)`, which retries until React has
 * rendered.
 */
export class Explorer {
  readonly page: Page;
  readonly context: BrowserContext;
  /** Console errors/warnings and uncaught exceptions seen on this page. */
  readonly errors: string[] = [];

  private constructor(context: BrowserContext, page: Page) {
    this.context = context;
    this.page = page;
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") this.errors.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => this.errors.push(`pageerror: ${e.message}`));
  }

  static async open(browser: Browser, baseURL: string, query = "", options: OpenOptions = {}): Promise<Explorer> {
    const context = await browser.newContext({
      viewport: options.viewport ?? { width: 1200, height: 1000 },
      deviceScaleFactor: options.scale ?? 1,
    });
    const ex = new Explorer(context, await context.newPage());
    await ex.page.goto(baseURL + query);
    await ex.page.locator(options.readyWhen ?? "text=/Selected: \\d+/").first().waitFor();
    return ex;
  }

  async close() {
    await this.context.close();
  }

  // --- Locators --------------------------------------------------------------

  get viewport(): Locator {
    return this.page.locator("div[tabindex='0']");
  }
  item(name: string): Locator {
    return this.viewport.getByText(name, { exact: true });
  }
  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }
  searchBox(): Locator {
    return this.page.locator("header input[type='text']");
  }

  // --- State -----------------------------------------------------------------

  /** Names shown in the "Selection Storage" panel, sorted. */
  async selection(): Promise<string[]> {
    const t = await this.page.locator("h4:has-text('Selection Storage') + div").innerText();
    return t.startsWith("Empty") ? [] : t.split(",").map((x) => x.trim()).sort();
  }
  async selectedCount(): Promise<number> {
    return Number((await this.header()).match(/Selected: (\d+)/)![1]);
  }
  async hiddenCount(): Promise<number> {
    const m = (await this.header()).match(/\((\d+) not visible\)/);
    return m ? Number(m[1]) : 0;
  }
  async undoDepth(): Promise<number> {
    return this.historyCounter(/undo \((\d+)\)/);
  }
  async redoDepth(): Promise<number> {
    return this.historyCounter(/redo \((\d+)\)/);
  }
  /** Text of the rendered rows (tree) or row strips (grid), top to bottom. */
  async rows(): Promise<string[]> {
    return this.viewport.locator(":scope > div:first-child > div").allInnerTexts();
  }
  /** Telemetry session ID, from the experimenter bar's recording status. */
  async sessionId(): Promise<string> {
    const t = await this.page.getByTestId("recording-status").innerText();
    return t.match(/([SP]-[0-9A-Z]{6})/)![1];
  }
  async breadcrumbs(): Promise<string> {
    return this.page.locator("text=Root").first().locator("..").innerText();
  }

  private async header(): Promise<string> {
    return this.page.locator("text=/Selected: \\d+/").first().innerText();
  }
  private async historyCounter(re: RegExp): Promise<number> {
    const t = await this.page.locator("text=/undo \\(\\d+\\)/").first().locator("..").innerText();
    return Number(t.match(re)![1]);
  }

  // --- Actions ---------------------------------------------------------------

  /** Scrolls the virtualized list until `name` is rendered. */
  async reveal(name: string) {
    await this.viewport.evaluate((e) => (e.scrollTop = 0));
    for (let i = 0; i < 300; i++) {
      if ((await this.item(name).count()) > 0 && (await this.item(name).isVisible())) return;
      await this.viewport.evaluate((e) => (e.scrollTop += 400));
      await this.settle();
    }
    throw new Error(`Item not found in list: ${name}`);
  }
  /** Clicks an item, with one modifier or several (e.g. ["Control", "Shift"]). */
  async click(name: string, modifier?: Modifier | Modifier[]) {
    if ((await this.item(name).count()) === 0) await this.reveal(name);
    const modifiers = modifier === undefined ? [] : Array.isArray(modifier) ? modifier : [modifier];
    await this.item(name).click({ modifiers });
    await this.settle();
  }
  async press(key: string) {
    await this.page.keyboard.press(key);
    await this.settle();
  }
  async undo() {
    await this.press("Control+z");
  }
  async redo() {
    await this.press("Control+Shift+z");
  }
  async scrollToTop() {
    await this.viewport.evaluate((e) => (e.scrollTop = 0));
    await this.settle();
  }
  async view(mode: "List (Tree)" | "Icon (Grid)") {
    await this.button(mode).click();
    await this.settle();
  }
  async searchMode(mode: SearchMode) {
    await this.page.getByLabel(mode, { exact: true }).check();
    await this.settle();
  }
  /** Types into the search box and waits out the debounce. */
  async search(text: string) {
    await this.searchBox().fill(text);
    await this.page.waitForTimeout(SEARCH_DEBOUNCE_MS);
  }
  async clickScope(scope: "global" | "visible") {
    await this.page.locator("header select").selectOption(scope);
    await this.settle();
  }
  async strategy(label: "Auto" | "Box" | "Range" | "Snake") {
    await this.page.getByLabel(label, { exact: true }).check();
    await this.settle();
  }

  /** Drags inside the viewport between offsets (px, relative to its top-left). */
  async drag(from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
    const box = (await this.viewport.boundingBox())!;
    await this.page.mouse.move(box.x + from.x, box.y + from.y);
    await this.page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await this.page.mouse.move(
        box.x + from.x + ((to.x - from.x) * i) / steps,
        box.y + from.y + ((to.y - from.y) * i) / steps,
      );
      await this.settle();
    }
  }
  async release() {
    await this.page.mouse.up();
    await this.settle();
  }

  /** Waits two animation frames: React has rendered and deferred flushes have run. */
  async settle() {
    await this.page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );
  }
}
