import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const output = new URL("../../docs/evidence/theme-motion/", import.meta.url);
const baseURL = process.env.VU_PREVIEW_URL ?? "http://127.0.0.1:4201";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const metadata = {
  baseURL,
  capturedAt: new Date().toISOString(),
  browser: browser.version(),
  method:
    "Native browser animations paused and sought at recorded times; not an FPS measurement",
  basemap: "Alidade Bright raster real",
  records: "Fictícios",
  frames: [],
  errors: [],
};

try {
  for (const [layout, width, height] of [
    ["desktop", 1440, 1080],
    ["mobile", 390, 900],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "no-preference",
      deviceScaleFactor: 1,
    });
    page.on("pageerror", (error) => metadata.errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("vu2.theme", "light");
      Object.defineProperty(window, "WebGL2RenderingContext", {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto(baseURL);
    await expect(page.locator(".map-loading, .map-fallback")).toHaveCount(0);
    await expect
      .poll(() => page.locator("#map-canvas .leaflet-tile-loaded").count())
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page
          .locator("#map-canvas .leaflet-tile:not(.leaflet-tile-loaded)")
          .count(),
      )
      .toBe(0);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page
          .locator('[data-view-title="map"]')
          .evaluate((node) => node.style.transform),
      )
      .toBe("");
    for (const theme of ["dark", "light"]) {
      const button = page.getByRole("button", {
        name: "Modo escuro",
        exact: true,
      });
      await button.click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            document
              .getAnimations()
              .some(
                (animation) =>
                  animation.effect?.pseudoElement ===
                  "::view-transition-new(root)",
              ),
          ),
        )
        .toBe(true);
      await page.evaluate(() => {
        window.__motionCapture = document
          .getAnimations()
          .filter((animation) => {
            const effect = animation.effect;
            return (
              effect?.pseudoElement?.startsWith("::view-transition") ||
              effect?.target?.closest?.(".theme-toggle")
            );
          });
        for (const animation of window.__motionCapture) animation.pause();
      });
      for (const ms of [0, 160, 320, 600]) {
        await page.evaluate((ms) => {
          for (const animation of window.__motionCapture)
            animation.currentTime = ms;
        }, ms);
        const file = `${layout}-${theme}-${ms}ms.png`;
        await page.screenshot({ path: fileURLToPath(new URL(file, output)) });
        const buttonFile = `${layout}-${theme}-${ms}ms-button.png`;
        await button.screenshot({
          path: fileURLToPath(new URL(buttonFile, output)),
        });
        metadata.frames.push({
          layout,
          width,
          height,
          theme,
          ms,
          file,
          buttonFile,
        });
      }
      await page.evaluate(() => {
        for (const animation of window.__motionCapture) animation.finish();
        delete window.__motionCapture;
      });
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-theme-motion",
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    }
    await page.close();
  }
  expect(metadata.errors).toEqual([]);
  await writeFile(
    new URL("capture.json", output),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  process.stdout.write(
    `Capturados ${metadata.frames.length} estágios de animação; zero erros JavaScript.\n`,
  );
} finally {
  await browser.close();
}
