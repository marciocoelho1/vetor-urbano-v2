import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const theme = process.env.VU_PREVIEW_THEME ?? "light";
if (theme !== "light" && theme !== "dark")
  throw new Error("VU_PREVIEW_THEME precisa ser light ou dark.");
const output = new URL(
  theme === "dark"
    ? "../../docs/evidence/dark-mode/"
    : "../../docs/evidence/visual-v2/",
  import.meta.url,
);
const baseURL = process.env.VU_PREVIEW_URL ?? "http://127.0.0.1:4201";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const metadata = {
  baseURL,
  capturedAt: new Date().toISOString(),
  browser: browser.version(),
  basemap: "Alidade Bright raster real",
  records: "Fictícios",
  theme,
  views: [],
  errors: [],
};

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1300 },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(
    (theme) => localStorage.setItem("vu2.theme", theme),
    theme,
  );
  page.on("pageerror", (error) => metadata.errors.push(error.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, "WebGL2RenderingContext", {
      configurable: true,
      value: undefined,
    }),
  );
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
  await page.screenshot({
    path: fileURLToPath(new URL("v2-desktop.png", output)),
  });
  metadata.views.push({
    view: "map",
    width: 1440,
    height: 1300,
    file: "v2-desktop.png",
  });

  await page.setViewportSize({ width: 390, height: 1600 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: fileURLToPath(new URL("v2-mobile.png", output)),
  });
  metadata.views.push({
    view: "map",
    width: 390,
    height: 1600,
    file: "v2-mobile.png",
  });

  await page.setViewportSize({ width: 1440, height: 1080 });
  for (const [view, label] of [
    ["active", "Informes ativos"],
    ["history", "Histórico"],
    ["insights", "Relatórios"],
    ["sources", "Fontes"],
    ["report", "Registrar ocorrência"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const title = page.locator(`[data-view-title="${view}"]`);
    await expect(title).toBeVisible();
    await expect
      .poll(() => title.evaluate((node) => node.style.transform))
      .toBe("");
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: fileURLToPath(new URL(`v2-${view}.png`, output)),
    });
    metadata.views.push({
      view,
      width: 1440,
      height: 1080,
      file: `v2-${view}.png`,
    });
  }
  expect(metadata.errors).toEqual([]);
  await writeFile(
    new URL("capture.json", output),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  process.stdout.write(
    `Capturas de ${metadata.views.length} vistas/tamanhos em ${fileURLToPath(output)}; zero erros JavaScript.\n`,
  );
} finally {
  await browser.close();
}
