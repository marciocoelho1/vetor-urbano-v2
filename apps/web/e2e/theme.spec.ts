import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
});

test('applies the system palette before Angular loads and follows system changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/main.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.topbar')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'dark',
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#10151b');
  await page.unroute('**/main.js');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Modo escuro', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const mapToggle = page.getByTestId('map-theme-toggle');
  await expect(mapToggle).toHaveAttribute('aria-pressed', 'true');
  await mapToggle.click();
  await expect(mapToggle).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(mapToggle).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(mapToggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('vu2.theme'))).toBeNull();
});

test('saves a keyboard choice, restores it on reload and keeps v1 preferences separate', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('theme-fixture-seeded')) {
      localStorage.setItem('vu2.theme', 'light');
      localStorage.setItem('vu.theme', 'light');
      sessionStorage.setItem('theme-fixture-seeded', 'true');
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const button = page.getByRole('button', { name: 'Modo escuro', exact: true });
  await button.focus();
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('vu2.theme'))).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('vu.theme'))).toBe('light');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // A second page receives the existing persisted choice without running the fixture script.
  const other = await page.context().newPage();
  await other.goto('/');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.getByTestId('map-theme-toggle').click();
  await expect(other.getByTestId('map-theme-toggle')).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(other.getByTestId('map-theme-toggle')).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(other.getByTestId('map-theme-toggle')).toHaveAttribute('aria-pressed', 'true');
  await other.close();
});

test('keeps all dark views readable on desktop/mobile without recreating the map', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1300 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() => {
    (window as any).__themeMap = (window as any).ng.getComponent(
      document.querySelector('app-root'),
    ).fallbackMap;
  });
  await page.getByRole('button', { name: 'Modo escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const selectors = ['.topbar', '.overview-metric', '.map-radius-panel', '.search-submit'];
  const checks = await page.evaluate((selectors) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const rgb = (value: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (color: number[]) => {
      const channels = color.slice(0, 3).map((c) => {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    return selectors.map((selector) => {
      const node = document.querySelector(selector)!;
      const style = getComputedStyle(node);
      const a = luminance(rgb(style.color)),
        b = luminance(rgb(style.backgroundColor));
      return { selector, contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  }, selectors);
  for (const check of checks) expect(check.contrast, check.selector).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-dark-desktop.png` });
  for (const label of [
    'Ocorrências',
    'Histórico',
    'Relatórios',
    'Fontes',
    'Registrar ocorrência',
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.page-header h1:visible')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
  const input = page.locator('input[name="longitude"]');
  expect(await input.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    'rgb(24, 31, 40)',
  );
  await page.getByRole('button', { name: 'Mapa de ocorrências', exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (window as any).__themeMap ===
        (window as any).ng.getComponent(document.querySelector('app-root')).fallbackMap,
    ),
  ).toBe(true);
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  for (const width of [1024, 961, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1600 });
    await page.evaluate(() => scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Modo escuro', exact: true })).toBeInViewport();
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-dark-mobile-${width}.png`,
    });
  }
  expect(errors).toEqual([]);
});

test('allows switching when browser storage is blocked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Modo escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Modo escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});
