import { expect, test } from '@playwright/test';
import { fixtureSql } from './helpers/synthetic-admin';
import { loginUser, routeApplicationApi } from './helpers/local-account';

test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige Java e PostGIS reais.');
test.use({ actionTimeout: 15_000, trace: 'off', screenshot: 'off' });
test.beforeEach(async ({ page }) => routeApplicationApi(page));

test('síntese do snapshot preserva efeitos, certeza, território e filtros em teclado e móvel', async ({
  page,
}) => {
  await loginUser(page.request);
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('vetor-consultation-mode', 'advanced');
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  const generate = page.getByTestId('report-generate-from-map');
  await generate.focus();
  await page.keyboard.press('Enter');
  const summary = page.getByTestId('report-summary');
  await expect(summary).toContainText('3 certamente · 1 possivelmente');
  await expect(summary.getByRole('table', { name: 'Tempo do fato' })).toContainText('10/2026');
  await expect(summary.getByRole('table', { name: 'Precisão territorial' })).toContainText(
    'Somente território',
  );
  await expect(summary.getByRole('table', { name: 'Pilar e tipo' })).toContainText('Trânsito');
  await expect(
    summary
      .getByRole('table', { name: 'Pilar', exact: true })
      .getByRole('row')
      .filter({ hasText: 'Contingência' }),
  ).toContainText('2');
  await expect(page.getByTestId('report-snapshot-counts')).toHaveText(
    '4 ocorrências · 2 acontecimentos',
  );
  await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Município (demonstração)', exact: true })
    .selectOption('Rio de Janeiro');
  await page
    .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
    .selectOption('Centro');
  await expect(page.getByTestId('event-count')).toHaveText('3');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await generate.click();
  await page.getByTestId('report-transfer-replace').click();
  await expect(page.getByTestId('report-snapshot-counts')).toHaveText(
    '3 ocorrências · 1 acontecimentos',
  );
  await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
  await page.locator('[data-quick-category="CONTINGENCIA"]').click();
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await expect(page.getByTestId('event-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await expect(summary).toContainText('2 certamente · 1 possivelmente');
  await generate.click();
  await page.getByTestId('report-transfer-replace').click();
  await expect(page.getByTestId('report-snapshot-counts')).toHaveText(
    '1 ocorrências · 1 acontecimentos',
  );
  await expect(summary).toContainText('1 certamente · 0 possivelmente');
  await expect(summary.getByRole('table', { name: 'Pilar e tipo' })).not.toContainText(
    'Contingência',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/vu30-summary-mobile.png', fullPage: true });
});

test('intervalo entre meses permanece separado sem inventar mês ou dia exato', async ({ page }) => {
  const sql = (text: string) => fixtureSql(text);
  sql(
    "UPDATE occurrences SET occurred_from='2026-09-30T15:00:00Z' WHERE id='vu-demo-occurrence-contingency-001'",
  );
  try {
    await loginUser(page.request);
    await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('vetor-consultation-mode', 'advanced'));
    await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
    await page.goto('/?consulta=api');
    await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
    await page.getByTestId('report-generate-from-map').click();
    const table = page.getByRole('table', { name: 'Tempo do fato', exact: true });
    await expect(table.getByRole('row').filter({ hasText: 'Intervalo entre meses' })).toContainText(
      '1',
    );
    await expect(table.getByRole('row').filter({ hasText: '10/2026' })).toContainText('3');
    await expect(page.getByTestId('report-summary')).toContainText(
      '3 certamente · 1 possivelmente',
    );
  } finally {
    sql(
      "UPDATE occurrences SET occurred_from='2026-10-14T14:00:00Z' WHERE id='vu-demo-occurrence-contingency-001'",
    );
  }
});
