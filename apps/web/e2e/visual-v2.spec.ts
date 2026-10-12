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
  await expect(page.locator('.overview-metric strong')).toHaveText(['25', '25', '0', '0']);
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await expect(page.locator('.overview-metric strong')).toHaveText(['50', '25', '25', '0']);
  await expect(page.locator('.result-list > li')).toHaveCount(50);
  await page.getByTestId('filter-panel-toggle').click();
  await expect(page.getByRole('checkbox', { name: 'Segurança', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Segurança', exact: true }).uncheck();
  await expect(page.locator('[data-quick-category="SEGURANCA"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.locator('[data-quick-category="TRANSITO"]').click();
  await expect(page.locator('.empty-state')).toContainText('Nenhum resultado');
  await expect(page.locator('.overview-metric strong')).toHaveText(['0', '0', '0', '0']);
  await page.locator('[data-quick-category="TRANSITO"]').click();
  await expect(page.locator('.result-list > li')).toHaveCount(25);
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
  expect(fonts).toEqual(expect.arrayContaining(['Newsreader', 'Manrope']));
  expect(externalFonts).toEqual([]);
  await page.getByTestId('filter-panel-toggle').click();
  await page.getByTestId('filter-panel-toggle').click();
  expect(await page.evaluate(() => localStorage.getItem('vu.filtersCollapsed'))).toBe('false');
  expect(await page.evaluate(() => localStorage.getItem('vu2.filtersCollapsed'))).toBe('true');
  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.overview-row')).toBeVisible();
    const frame = await page.locator('.map-frame').boundingBox();
    const content = await page.locator('#main-content').boundingBox();
    expect(
      Math.abs(
        frame!.width -
          content!.width +
          (width > 1200 ? 96 : width > 560 ? 56 : width > 360 ? 40 : 28),
      ),
    ).toBeLessThan(3);
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
