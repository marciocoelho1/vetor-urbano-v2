import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vu2.theme', 'light');
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    });
  });
});

test('applies proposal 6 across all menus, both themes and responsive consultation layouts', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const tileStatuses: Record<string, number> = {};
  const views: { file: string; width: number; theme: string; view: string }[] = [];
  const output = testInfo.outputPath('interface');
  await mkdir(output, { recursive: true });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('tiles.stadiamaps.com')) {
      const status = String(response.status());
      tileStatuses[status] = (tileStatuses[status] ?? 0) + 1;
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1120 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect
    .poll(() => page.locator('#map-canvas .leaflet-tile-loaded').count())
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.locator('#map-canvas .leaflet-tile:not(.leaflet-tile-loaded)').count())
    .toBe(0);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.primary-nav button')).toHaveCount(6);
  await expect(page.locator('[data-view-title="map"]')).toHaveText('Explore o que está ao redor.');
  const capture = async (width: number, theme: string, view: string) => {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    const file = `${theme}-${view}-${width}.png`;
    await page.screenshot({ path: `${output}/${file}`, fullPage: true });
    views.push({ file, width, theme, view });
  };
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark')
      await page.getByRole('button', { name: 'Modo escuro', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const width of [1920, 1440, 1280, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1120 });
      if (width <= 960) await page.getByRole('button', { name: 'Mapa', exact: true }).click();
      await expect(page.locator('.map-column')).toBeVisible();
      const map = (await page.locator('.map-column').boundingBox())!;
      const query = (await page.locator('.consultation-query').boundingBox())!;
      if (width > 960) {
        expect(query.x).toBeGreaterThan(map.x + map.width);
        expect(Math.abs(map.y - query.y)).toBeLessThan(1);
        expect(map.height).toBeGreaterThan(0);
        expect(map.y + map.height).toBeLessThanOrEqual(1120);
        const sidebar = (await page.locator('.consultation-sidebar').boundingBox())!;
        expect(Math.abs(map.y + map.height - sidebar.y - sidebar.height)).toBeLessThan(1);
        expect(
          await page
            .locator('.result-list')
            .evaluate((node) => node.scrollHeight > node.clientHeight),
        ).toBe(true);
      } else {
        expect(query.y + query.height).toBeLessThan(map.y);
        const canvas = (await page.locator('.map-frame').boundingBox())!;
        expect(canvas.height).toBeGreaterThanOrEqual(180);
        expect(map.y + map.height).toBeLessThanOrEqual(1120);
      }
      expect(
        await page
          .locator('h1')
          .first()
          .evaluate((node) => getComputedStyle(node).fontFamily),
      ).toContain('Manrope');
      expect(
        await page.locator('.hero-aside').evaluate((node) => getComputedStyle(node).fontSize),
      ).toBe('14px');
      expect(
        await page.locator('.map-legend').evaluate((node) => getComputedStyle(node).fontSize),
      ).toBe('12px');
      expect(await page.evaluate(() => getComputedStyle(document.body).fontWeight)).toBe('500');
      await expect(
        page.getByText('Cor e ícone identificam a categoria; pin ampliado indica seleção.'),
      ).toHaveCount(0);
      await capture(width, theme, 'map');
      if (width === 390 || width === 320) {
        await page.getByRole('button', { name: /^Lista \d+/ }).click();
        await expect(page.locator('.map-column')).toBeHidden();
        await expect(page.locator('#map-results')).toBeVisible();
        await capture(width, theme, 'list');
      }
    }
    await page.setViewportSize({ width: 1440, height: 1120 });
  }
  for (const [menu, view] of [
    ['Informes ativos', 'active'],
    ['Histórico', 'history'],
    ['Relatórios', 'insights'],
    ['Fontes', 'sources'],
    ['Registrar ocorrência', 'report'],
  ]) {
    await page.getByRole('button', { name: menu, exact: true }).click();
    await expect(page.locator(`[data-view-title="${view}"]`)).toBeVisible();
    await capture(1440, 'dark', view);
  }
  expect(errors).toEqual([]);
  expect(tileStatuses['200']).toBeGreaterThan(0);
  await writeFile(
    `${output}/review.json`,
    JSON.stringify(
      {
        status: 'passed',
        capturedAt: new Date().toISOString(),
        browser: testInfo.project.name,
        basemap: 'Alidade Bright raster real',
        errors,
        tileStatuses,
        views,
      },
      null,
      2,
    ),
  );
});

test('keeps the same map, query and selection when switching mobile views and opening advanced filters', async ({
  page,
}) => {
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() => {
    const app = (window as any).ng.getComponent(document.querySelector('app-root'));
    (window as any).__v6Map = app.fallbackMap;
  });
  await page.getByRole('button', { name: /^Lista \d+/ }).click();
  await expect(page.locator('#map-results')).toBeVisible();
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await expect(page.locator('.result-list > li')).toHaveCount(50);
  await page.locator('[data-result-detail-toggle]').first().click();
  await expect(page.locator('.result-inline-detail')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await page.getByRole('button', { name: /^Lista \d+/ }).click();
  await expect(page.locator('.result-inline-detail')).toHaveCount(1);
  await page.getByRole('button', { name: 'Filtros avançados e camadas' }).click();
  await expect(page.locator('.map-column')).toBeVisible();
  await expect(page.locator('#map-filter-panel')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Segurança', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Fechar filtros e camadas' }).click();
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await page.getByTestId('map-expand-toggle').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Categorias da consulta' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      return app.fallbackMap === (window as any).__v6Map;
    }),
  ).toBe(true);
});

test('fits the public map and top bar in the first viewport and links to the information below', async ({
  page,
}, testInfo) => {
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const output = testInfo.outputPath('first-screen');
  await mkdir(output, { recursive: true });
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark')
      await page.getByRole('button', { name: 'Modo escuro', exact: true }).click();
    for (const [width, height] of [
      [1920, 1080],
      [1440, 900],
      [1366, 768],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [320, 740],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${theme}-${width}x${height}.png` });
      await expect(page.locator('.demo-ribbon')).toHaveCount(0);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      const topbar = (await page.locator('.topbar').boundingBox())!;
      const map = (await page.locator('.map-column').boundingBox())!;
      const canvas = (await page.locator('.map-frame').boundingBox())!;
      const cue = (await page.locator('.map-scroll-cue').boundingBox())!;
      expect(topbar.y).toBeGreaterThanOrEqual(0);
      expect(map.y).toBeGreaterThanOrEqual(topbar.y + topbar.height);
      expect(canvas.height).toBeGreaterThanOrEqual(180);
      expect(map.y + map.height).toBeLessThanOrEqual(height + 1);
      expect(canvas.y + canvas.height).toBeLessThanOrEqual(cue.y);
      expect(cue.y + cue.height).toBeLessThanOrEqual(height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const overview = (await page.locator('#consultation-overview').boundingBox())!;
      expect(overview.y).toBeGreaterThanOrEqual(cue.y + cue.height);
      const footer = (await page.locator('.site-footer').boundingBox())!;
      expect(footer.y).toBeGreaterThanOrEqual(overview.y + overview.height);
    }
  }
  const cue = page.getByRole('link', { name: 'Mais informações abaixo' });
  await cue.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#consultation-overview$/);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(page.locator('#consultation-overview')).toBeFocused();
  await page.getByRole('button', { name: 'Fontes', exact: true }).click();
  await expect(page.locator('.demo-ribbon')).toBeVisible();
});
