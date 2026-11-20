import { afterAll, afterEach, beforeAll, beforeEach, expect, inject } from "vitest";
import type { Browser } from "playwright-core";
import { launchBrowser } from "./browser";
import { Explorer, type OpenOptions } from "./explorer";

/**
 * Registers per-file browser lifecycle hooks and returns an accessor for a
 * fresh Explorer page per test. Every test also fails on console errors.
 */
export function useExplorer(query = "", options: OpenOptions = {}): () => Explorer {
  let browser: Browser;
  let ex: Explorer;
  beforeAll(async () => {
    browser = await launchBrowser();
  });
  afterAll(async () => {
    await browser?.close();
  });
  beforeEach(async () => {
    ex = await Explorer.open(browser, inject("baseURL"), query, options);
  });
  afterEach(async () => {
    const errors = ex.errors.slice();
    await ex.close();
    expect(errors, "console errors/warnings").toEqual([]);
  });
  return () => ex;
}
