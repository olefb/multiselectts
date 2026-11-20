import { chromium as playwright, type Browser } from "playwright-core";

/**
 * Launches a headless Chromium.
 *
 * - CHROME_PATH=/path/to/chrome  uses that browser (any OS; E2E_HEADED=1 shows it).
 * - Otherwise the Chromium bundled in the @sparticuz/chromium npm package is
 *   used (Linux x64). It installs through npm alone, so it works where
 *   Playwright's own browser download host is blocked.
 */
export async function launchBrowser(): Promise<Browser> {
  const chromePath = process.env.CHROME_PATH;
  if (chromePath) {
    return playwright.launch({
      executablePath: chromePath,
      headless: process.env.E2E_HEADED !== "1",
    });
  }
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error(
      "The bundled Chromium only runs on Linux x64. Set CHROME_PATH to a local Chrome/Chromium executable.",
    );
  }
  const { default: bundled } = await import("@sparticuz/chromium");
  return playwright.launch({
    executablePath: await bundled.executablePath(),
    // The package targets AWS Lambda and defaults to --single-process, in which
    // closing a browser context kills the whole browser. Tests use one context each.
    args: bundled.args.filter((a) => a !== "--single-process"),
    headless: true,
  });
}
