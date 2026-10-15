import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

// Explicit opt-in: requires the real local API and the named synthetic PostGIS container.
// Run with --workers=1 because the outage scenario pauses this shared database.
test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige API Java e PostGIS locais reais.');

test.use({ actionTimeout: 15_000 });

const trafficId = 'vu-demo-occurrence-traffic-001';
const territoryId = 'vu-demo-occurrence-territory-001';
const endpoint = 'http://127.0.0.1:8080/api/v1/occurrences';
const windowQuery = 'periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z';

async function count(page: Page, expected: number) {
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  await expect(page.getByTestId('query-error-banner')).toBeHidden();
  await expect(page.locator('.result-list > li')).toHaveCount(expected);
  await expect(page.getByTestId('event-count')).toHaveText(String(expected));
}

async function openFilters(page: Page) {
  if ((await page.getByTestId('filter-panel-toggle').getAttribute('aria-expanded')) !== 'true') {
    await page.getByTestId('filter-panel-toggle').click();
  }
}

async function customWindow(page: Page, start: string, end: string) {
  await page
    .getByRole('combobox', { name: 'Período da consulta', exact: true })
    .selectOption('custom');
  await openFilters(page);
  await page.getByLabel('Início (horário de Brasília)', { exact: true }).fill(start);
  await page.getByLabel('Fim (horário de Brasília; exclusivo)', { exact: true }).fill(end);
}

test.beforeEach(async ({ page, request }) => {
  const response = await request.get(`${endpoint}?${windowQuery}`);
  expect(response.status(), 'API Java com PostGIS real deve estar disponível').toBe(200);
  expect((await response.json()).counts.occurrences).toBe(4);
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('vetor-consultation-mode', 'advanced');
    localStorage.setItem('vu2.filtersCollapsed', 'true');
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  // Only the basemap provider is blocked; occurrence HTTP is never intercepted/mocked.
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await count(page, 4);
});

test('banco real: publicadas, relações, clipping, filtros e alternativa territorial móvel', async ({
  page,
}, testInfo) => {
  await expect(page.getByTestId('persisted-query-notice')).toContainText(
    'dados inteiramente sintéticos',
  );
  await expect(page.locator('.query-counts')).toHaveText('4 ocorrências · 2 acontecimentos');
  await expect(page.locator('.spatial-result-counts')).toContainText(
    '3 mapeadas · 1 apenas em lista',
  );
  await expect(page.locator('[data-temporal-certainty]')).toContainText('1 possivelmente');
  await expect(page.getByText('Controle não publicado', { exact: true })).toHaveCount(0);
  await expect(page.locator('#map-canvas .occurrence-pin')).toHaveCount(3);
  await expect(
    page.locator('#map-canvas .occurrence-pin[title^="Registro territorial"]'),
  ).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Município (demonstração)', exact: true })
    .selectOption('Rio de Janeiro');
  await page
    .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
    .selectOption('Setor demonstrativo');
  await count(page, 1);
  await expect(page.locator('#map-canvas .occurrence-pin')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Bairro (demonstração)', exact: true }).selectOption('');
  await count(page, 4);
  await page.locator(`[data-result-detail-toggle="${territoryId}"]`).click();
  await expect(page.locator(`[data-result-detail="${territoryId}"]`)).toContainText(
    'Somente território conhecido',
  );
  await page.locator(`[data-result-detail-toggle="${territoryId}"]`).click();
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await page.locator('[data-quick-category="CONTINGENCIA"]').click();
  await count(page, 1);
  await expect(page.locator('.query-counts')).toHaveText('1 ocorrências · 1 acontecimentos');
  const toggle = page.locator(`[data-result-detail-toggle="${trafficId}"]`);
  await toggle.focus();
  await page.keyboard.press('Enter');
  const detail = page.locator(`[data-result-detail="${trafficId}"]`);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.occurrence-references > li')).toHaveCount(3);
  await expect(detail).toContainText('3 ocorrências · 1 acontecimento');
  await expect(detail.locator('.related-occurrences > li')).toHaveCount(2);
  await expect(detail).toContainText('Contexto fora do recorte');
  await detail.getByRole('button', { name: /Fechar detalhes/ }).click();
  await expect(toggle).toBeFocused();
  await openFilters(page);
  await page.locator('[data-filter="type:ACIDENTE"]').check();
  await page.locator('[data-filter="subtype:ACIDENTE:Colisão"]').check();
  await page.locator('[data-filter="source:vu-demo-source-002"]').check();
  await page.getByTestId('advanced-min-score').selectOption('3');
  await page.getByTestId('advanced-max-score').selectOption('3');
  await page.getByTestId('advanced-text-filter').fill('COLISAO');
  const combinedResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.href.startsWith(endpoint) &&
      url.searchParams.get('text') === 'COLISAO' &&
      url.searchParams.get('sourceId') === 'vu-demo-source-002' &&
      url.searchParams.get('situation') === 'UNKNOWN'
    );
  });
  await page.locator('[data-filter="situation:UNKNOWN"]').check();
  const combined = await combinedResponse;
  expect(combined.status()).toBe(200);
  expect((await combined.json()).counts.occurrences).toBe(1);
  await count(page, 1);
  await page.getByTestId('advanced-text-filter').fill('nenhum-fato-sintetico');
  await expect(page.getByTestId('consultation-empty')).toBeVisible();
  await expect(page.getByTestId('query-error-banner')).toBeHidden();
  await page.getByTestId('advanced-text-filter').fill('COLISAO');
  await count(page, 1);
  await page.getByTestId('filter-panel-toggle').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Lista/ }).click();
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(detail.locator('.occurrence-references > li')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('persisted-mobile.png'), fullPage: true });
});

test('banco real: fuso, intervalo semiaberto, precisão incerta e raio geodésico', async ({
  page,
}) => {
  await page.locator('[data-quick-category="TRANSITO"]').click();
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await customWindow(page, '2026-10-15T05:00', '2026-10-15T10:00');
  await count(page, 2);
  await expect(page.locator('[data-temporal-certainty]')).toContainText('1 possivelmente');
  await page.getByLabel('Início (horário de Brasília)', { exact: true }).fill('2026-10-15T08:00');
  await count(page, 1);
  await expect(page.locator('[data-temporal-certainty]')).toContainText('1 possivelmente');
  await page.getByLabel('Início (horário de Brasília)', { exact: true }).fill('2026-10-14T12:00');
  await page
    .getByLabel('Fim (horário de Brasília; exclusivo)', { exact: true })
    .fill('2026-10-15T07:00');
  await count(page, 2);
  await page.getByTestId('filter-panel-toggle').click();
  await page.getByRole('checkbox', { name: 'Filtrar por raio' }).check();
  await page.getByText('Definir centro por coordenadas', { exact: true }).click();
  await page
    .locator('.map-radius-coordinates')
    .getByLabel('Longitude', { exact: true })
    .fill('-43.1915');
  await page
    .locator('.map-radius-coordinates')
    .getByLabel('Latitude', { exact: true })
    .fill('-22.9033');
  await count(page, 2);
  // The UI radius advances in 100 m steps; HTTP also checks 999 vs 1000 m exactly.
  await page.locator('#map-radius-slider').fill('900');
  await count(page, 1);
  await page.locator('#map-radius-slider').fill('1000');
  await count(page, 2);
  await page.getByRole('checkbox', { name: 'Filtrar por raio' }).uncheck();
  await page.locator('[data-quick-category="CONTINGENCIA"]').click();
  await page.locator('[data-quick-category="TRANSITO"]').click();
  await customWindow(page, '2026-10-14T11:00', '2026-10-14T12:00');
  await count(page, 0);
  await page
    .getByLabel('Fim (horário de Brasília; exclusivo)', { exact: true })
    .fill('2026-10-14T12:01');
  await page.getByLabel('Início (horário de Brasília)', { exact: true }).fill('2026-10-14T12:00');
  await count(page, 1);
});

test('banco real: carregamento, 503 visível, recuperação e API sem conexão', async ({
  page,
}, testInfo) => {
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  expect(database, 'Informe o contêiner PostGIS sintético autorizado').toBeTruthy();
  execFileSync('podman', ['pause', database!]);
  try {
    await page.getByTestId('refresh-query-btn').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('query-loading-banner')).toBeVisible();
    const failed = await page.waitForResponse(
      (response) => response.url().startsWith(endpoint) && response.status() === 503,
    );
    expect((await failed.json()).error.code).toBe('QUERY_UNAVAILABLE');
    await expect(page.getByTestId('query-error-banner')).toBeVisible();
    await expect(page.getByTestId('consultation-empty')).toBeHidden();
    await expect(page.locator('.query-counts')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('persisted-503.png'), fullPage: true });
  } finally {
    execFileSync('podman', ['unpause', database!]);
  }
  const retry = page.getByTestId('retry-query-btn');
  await retry.focus();
  await page.keyboard.press('Enter');
  await count(page, 4);
  await page.context().setOffline(true);
  try {
    await page.getByTestId('refresh-query-btn').click();
    await expect(page.getByTestId('query-error-banner')).toBeVisible();
    await expect(page.getByTestId('consultation-empty')).toBeHidden();
  } finally {
    await page.context().setOffline(false);
  }
  await page.getByTestId('retry-query-btn').click();
  await count(page, 4);
});
