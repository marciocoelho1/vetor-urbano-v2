import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    });
  });
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
});

test('keeps quick filters, metrics and the accessible list in sync', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#map-filter-panel')).toBeHidden();
  await expect(page.locator('.overview-metric strong')).toHaveText(['17', '7', '5', '5']);
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await expect(page.locator('.overview-metric strong')).toHaveText(['12', '7', '0', '5']);
  await expect(page.locator('.result-list > li')).toHaveCount(12);
  await page.getByTestId('filter-panel-toggle').click();
  await expect(page.getByRole('checkbox', { name: 'Segurança', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Segurança', exact: true }).uncheck();
  await expect(page.locator('[data-quick-category="SEGURANCA"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.locator('[data-quick-category="TRANSITO"]').click();
  await page.locator('[data-quick-category="CONTINGENCIA"]').click();
  await expect(page.locator('.empty-state')).toContainText('Nenhum resultado');
  await expect(page.locator('.overview-metric strong')).toHaveText(['0', '0', '0', '0']);
  await page.locator('[data-quick-category="TRANSITO"]').click();
  await expect(page.locator('.result-list > li')).toHaveCount(7);
});

test('opens the custom interval and focuses its first field from the quick period control', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Período da consulta').selectOption('custom');
  await expect(page.getByTestId('filter-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
  const start = page.getByLabel('Início (horário de Brasília)', { exact: true });
  await expect(start).toBeFocused();
  await start.fill('2026-10-01T08:00');
  await page.getByLabel('Fim (horário de Brasília; exclusivo)').fill('2026-10-12T20:00');
  await expect(page.locator('.query-error')).toHaveCount(0);
  await page.getByLabel('Período da consulta').selectOption('1m');
  await expect(page.locator('[data-filter="period-1m"]')).toBeChecked();
});

test('loads local typefaces, preserves v1 preferences and fits desktop and mobile', async ({
  page,
}, testInfo) => {
  const externalFonts: string[] = [];
  page.on('request', (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url());
  });
  await page.addInitScript(() => localStorage.setItem('vu.filtersCollapsed', 'false'));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((font) => font.status === 'loaded')
      .map((font) => font.family.replace(/["']/g, '')),
  );
  expect(fonts).toEqual(expect.arrayContaining(['Manrope']));
  expect(externalFonts).toEqual([]);
  await page.getByTestId('filter-panel-toggle').click();
  await page.getByTestId('filter-panel-toggle').click();
  expect(await page.evaluate(() => localStorage.getItem('vu.filtersCollapsed'))).toBe('false');
  expect(await page.evaluate(() => localStorage.getItem('vu2.filtersCollapsed'))).toBe('true');
  for (const width of [2560, 1920, 1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.overview-row')).toBeVisible();
    const frame = await page.locator('.map-frame').boundingBox();
    const content = await page.locator('#main-content').boundingBox();
    const column = (await page.locator('.map-column').boundingBox())!;
    expect(Math.abs(frame!.width - column.width + 2)).toBeLessThan(3);
    expect(column.x).toBeGreaterThanOrEqual(content!.x);
    expect(column.x + column.width).toBeLessThanOrEqual(content!.x + content!.width);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `test-results/${testInfo.project.name}-visual-v2-${width}.png`,
        fullPage: false,
      });
  }
});

test('respects reduced motion during navigation and when the preference changes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  const title = page.locator('[data-view-title="insights"]');
  await expect(title).toBeFocused();
  expect(
    await title.evaluate((node) => ({
      opacity: (node as HTMLElement).style.opacity,
      transform: (node as HTMLElement).style.transform,
    })),
  ).toEqual({ opacity: '', transform: '' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-view-title="history"]')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-view-title="history"]')
        .evaluate((node) => (node as HTMLElement).style.transform),
    )
    .toBe('');
  expect(errors).toEqual([]);
});

test('shows comparison selections that match the calculation when options are created', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Território B', exact: true })).toHaveValue(
    'Zona Sul (exemplo sintético)',
  );
  await expect(page.getByRole('combobox', { name: 'Período B', exact: true })).toHaveValue(
    '2026-08',
  );
  await page
    .getByRole('combobox', { name: 'Território B', exact: true })
    .selectOption('Centro (exemplo sintético)');
  await expect(page.locator('.comparison-result')).toContainText('A: 8');
  await expect(page.locator('.comparison-result')).toContainText('B: 11');
  await expect(page.locator('.comparison-result')).toContainText('diferença B−A: 3');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Território B', exact: true })).toHaveValue(
    'Centro (exemplo sintético)',
  );
  await expect(page.getByRole('combobox', { name: 'Período B', exact: true })).toHaveValue(
    '2026-08',
  );
  await expect(page.locator('.comparison-result')).toContainText('diferença B−A: 3');
});

test('keeps map controls inside the viewport-sized map and aligns the compact radius bar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  for (const width of [1440, 1024, 768, 560, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await page.evaluate(() => {
      const box = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      };
      return {
        frame: box('.map-frame'),
        radius: box('.map-radius-bar'),
        filters: box('.map-filter-toggle'),
        actions: box('.map-top-actions'),
        quick: box('.quick-filters'),
        theme: box('.map-theme-toggle'),
        expand: box('.map-expand-toggle'),
      };
    });
    expect(bounds.frame.height).toBeGreaterThanOrEqual(180);
    expect(
      Math.abs(bounds.radius.x + bounds.radius.width / 2 - bounds.frame.x - bounds.frame.width / 2),
    ).toBeLessThan(1);
    expect(bounds.radius.height).toBe(44);
    expect(bounds.theme.height).toBe(44);
    expect(bounds.expand.height).toBe(44);
    expect(bounds.radius.y).toBe(bounds.actions.y);
    expect(bounds.filters.right).toBeLessThanOrEqual(bounds.radius.x);
    expect(bounds.radius.right).toBeLessThanOrEqual(bounds.actions.x);
    for (const control of [bounds.radius, bounds.filters, bounds.actions]) {
      expect(control.x).toBeGreaterThan(bounds.frame.x);
      expect(control.right).toBeLessThan(bounds.frame.right);
      expect(control.y).toBeGreaterThan(bounds.frame.y);
      expect(control.bottom).toBeLessThan(bounds.frame.bottom);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByTestId('filter-panel-toggle').click();
    await expect(page.locator('#map-filter-panel')).toBeVisible();
    const panel = await page.locator('#map-filter-panel').boundingBox();
    const radiusAfterClick = (await page.locator('.map-radius-bar').boundingBox())!;
    const frameAfterClick = (await page.locator('.map-frame').boundingBox())!;
    expect(panel!.y).toBeGreaterThan(radiusAfterClick.y + radiusAfterClick.height);
    expect(panel!.y + panel!.height).toBeLessThan(frameAfterClick.y + frameAfterClick.height);
    await page.getByRole('button', { name: 'Fechar filtros e camadas' }).click();
    await expect(page.getByTestId('filter-panel-toggle')).toBeFocused();
  }
});

test('uses filters and radius in the expanded map with keyboard and preserves its instance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() => {
    const app = (window as any).ng.getComponent(document.querySelector('app-root'));
    (window as any).__layoutMap = app.fallbackMap;
    (window as any).__layoutCenter = app.fallbackMap.getCenter();
  });
  await page.getByTestId('map-expand-toggle').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('filter-panel-toggle').click();
  await page.getByRole('checkbox', { name: 'Segurança', exact: true }).check();
  await expect(page.locator('.overview-metric strong')).toHaveText(['17', '7', '5', '5']);
  await page.getByLabel('Período da consulta').selectOption('custom');
  const start = page.getByLabel('Início (horário de Brasília)', { exact: true });
  await expect(start).toBeFocused();
  const end = page.getByLabel('Fim (horário de Brasília; exclusivo)');
  // Native datetime inputs have several segments in Chromium; Tab visits those first.
  for (let segment = 0; segment < 12; segment++) {
    await page.keyboard.press('Tab');
    if (await end.evaluate((input) => input === document.activeElement)) break;
  }
  await expect(end).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#map-filter-panel')).toBeHidden();
  await expect(page.getByTestId('filter-panel-toggle')).toBeFocused();
  await page.getByLabel('Período da consulta').selectOption('1m');
  await page.getByLabel('Filtrar por raio').check();
  await expect(page.locator('#map-radius-options')).toBeVisible();
  await page.locator('#map-radius-slider').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#map-radius-slider')).toHaveValue('1100');
  await page.keyboard.press('Escape');
  await expect(page.locator('#map-radius-options')).toBeHidden();
  await expect(page.getByLabel('Filtrar por raio')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      return (
        app.fallbackMap === (window as any).__layoutMap &&
        app.fallbackMap.getCenter().equals((window as any).__layoutCenter)
      );
    }),
  ).toBe(true);
});

test('fits expanded controls in a 320 px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.getByTestId('map-expand-toggle').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const radius = (await page.locator('.map-radius-bar').boundingBox())!;
  const actions = (await page.locator('.map-top-actions').boundingBox())!;
  expect(radius.x + radius.width).toBeLessThanOrEqual(actions.x);
  await page.getByLabel('Filtrar por raio').check();
  await page.locator('.map-radius-coordinates summary').click();
  const options = page.locator('#map-radius-options');
  await expect(options).toBeVisible();
  await page.getByLabel('Latitude', { exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() =>
      document.querySelector('.map-frame.map-expanded')!.contains(document.activeElement),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('uses the available width across views and arranges results in responsive cards', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const selector of [
    'body',
    '.map-search-control input',
    '.record-copy span',
    '.leaflet-container',
  ]) {
    expect(
      await page
        .locator(selector)
        .first()
        .evaluate((node) => getComputedStyle(node).fontFamily),
    ).toContain('Manrope');
  }
  for (const selector of ['h1', '#results-heading', '.record-copy strong']) {
    expect(
      await page
        .locator(selector)
        .first()
        .evaluate((node) => getComputedStyle(node).fontFamily),
    ).toContain('Manrope');
  }
  for (const width of [2560, 1920, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    if (width <= 960) await page.getByRole('button', { name: /^Lista \d+/ }).click();
    const cards = page.locator('.result-list > li');
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    if (width <= 960) {
      await page.getByRole('button', { name: /^Lista \d+/ }).click();
    }
    expect(second.x).toBe(first.x);
    expect(second.y).toBeGreaterThan(first.y + first.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('[data-result-detail-toggle]').first().click();
  await expect(page.locator('.result-inline-detail')).toHaveCount(1);
  const detail = (await page.locator('.result-inline-detail').boundingBox())!;
  const card = (await page.locator('.result-list > li').first().boundingBox())!;
  expect(detail.x).toBeGreaterThan(card.x);
  expect(detail.x + detail.width).toBeLessThan(card.x + card.width);
  for (const name of [
    'Informes ativos',
    'Histórico',
    'Relatórios',
    'Fontes',
    'Registrar ocorrência',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    const view = page
      .locator(name === 'Registrar ocorrência' ? '.report-form' : '.workspace-view')
      .filter({ visible: true });
    expect((await view.boundingBox())!.width).toBeGreaterThan(1800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('resizes the topic panel by edges and corner without moving the map, with keyboard and responsive limits', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.getByTestId('filter-panel-toggle').click();
  const panel = page.locator('#map-filter-panel');
  const original = (await panel.boundingBox())!;
  const mapState = await page.evaluate(() => {
    const app = (window as any).ng.getComponent(document.querySelector('app-root'));
    (window as any).__resizedMap = app.fallbackMap;
    const center = app.fallbackMap.getCenter();
    return { lat: center.lat, lng: center.lng, zoom: app.fallbackMap.getZoom() };
  });
  const drag = async (selector: string, dx: number, dy: number) => {
    await page.locator(selector).scrollIntoViewIfNeeded();
    const handle = (await page.locator(selector).boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    const viewport = page.viewportSize()!;
    await page.mouse.move(
      Math.max(1, Math.min(viewport.width - 1, handle.x + handle.width / 2 + dx)),
      Math.max(1, Math.min(viewport.height - 1, handle.y + handle.height / 2 + dy)),
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(panel).not.toHaveClass(/is-resizing/);
  };
  await drag('.resize-width', 180, 0);
  let box = (await panel.boundingBox())!;
  expect(box.width).toBeCloseTo(original.width + 180, 0);
  expect(box.height).toBeCloseTo(original.height, 0);
  await drag('.resize-height', 0, -100);
  box = (await panel.boundingBox())!;
  expect(box.height).toBeCloseTo(original.height - 100, 0);
  await drag('.resize-corner', 60, 40);
  box = (await panel.boundingBox())!;
  expect(box.width).toBeCloseTo(original.width + 240, 0);
  expect(box.height).toBeCloseTo(original.height - 60, 0);
  await page.locator('.resize-corner').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  box = (await panel.boundingBox())!;
  expect(box.width).toBeCloseTo(original.width + 216, 0);
  expect(box.height).toBeCloseTo(original.height - 84, 0);
  await page.keyboard.press('Home');
  box = (await panel.boundingBox())!;
  expect(box.width).toBe(original.width);
  expect(box.height).toBeCloseTo(original.height, 0);
  await drag('.resize-corner', -1000, -1000);
  box = (await panel.boundingBox())!;
  expect(box.width).toBeCloseTo(260, 2);
  expect(box.height).toBeCloseTo(220, 2);
  await drag('.resize-corner', 2500, 1200);
  box = (await panel.boundingBox())!;
  const frame = (await page.locator('.map-frame').boundingBox())!;
  expect(box.x + box.width).toBeLessThan(frame.x + frame.width);
  expect(box.y + box.height).toBeLessThan(frame.y + frame.height);
  await page.setViewportSize({ width: 768, height: 800 });
  box = (await panel.boundingBox())!;
  const smallerFrame = (await page.locator('.map-frame').boundingBox())!;
  expect(box.x + box.width).toBeLessThan(smallerFrame.x + smallerFrame.width);
  await page.getByRole('button', { name: 'Fechar filtros e camadas' }).click();
  await expect(panel).toBeHidden();
  await page.getByTestId('filter-panel-toggle').click();
  await expect(panel).toBeVisible();
  expect((await panel.boundingBox())!.width).toBe(box.width);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('.resize-corner')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const scroll = page.locator('.filter-panel-content');
    await scroll.evaluate((node) => (node.scrollTop = node.scrollHeight));
    expect(await scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  }
  expect(
    await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      return app.fallbackMap === (window as any).__resizedMap;
    }),
  ).toBe(true);
  expect(
    await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      const center = app.fallbackMap.getCenter();
      return { lat: center.lat, lng: center.lng, zoom: app.fallbackMap.getZoom() };
    }),
  ).toEqual(mapState);
});
