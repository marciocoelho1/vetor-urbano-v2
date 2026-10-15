import { expect, test } from '@playwright/test';

test('nova consulta abre três pilares e últimas 24 horas com exemplos fictícios', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByLabel('Período da consulta')).toHaveValue('24h');
  for (const category of ['TRANSITO', 'SEGURANCA', 'CONTINGENCIA']) {
    await expect(page.locator(`[data-quick-category="${category}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await expect(page.locator('.overview-metric strong')).toHaveText(['17', '7', '5', '5']);
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  await expect(page.locator('#map-canvas .occurrence-pin')).toHaveCount(17);
  await page.locator('[data-result-detail-toggle]').first().click();
  const detail = page.locator('.result-inline-detail');
  await expect(detail).toContainText('Semáforos desligados');
  await expect(detail).toContainText('Dados fictícios');
  await expect(detail).toContainText('Fonte fictícia');
  await expect(detail).toContainText('Confiabilidade da ocorrência');
  await page.locator('[data-result-detail-toggle]').first().click();
  await page.getByTestId('filter-panel-toggle').click();
  const types = page.getByRole('group', { name: 'Tipos de ocorrência', exact: true });
  await expect(types.getByRole('checkbox')).toHaveCount(16);
  await expect(types.getByRole('checkbox', { name: 'Ameaça', exact: true })).toHaveCount(0);
  await page.getByLabel('Período da consulta').selectOption('1m');
  await expect(page.locator('.result-list > li')).toHaveCount(75);
  await types.getByRole('checkbox', { name: 'Acidente', exact: true }).check();
  await expect(page.locator('.result-list > li')).toHaveCount(5);
  await expect(page.locator('#map-canvas .occurrence-pin')).toHaveCount(5);
  await page.getByRole('button', { name: 'Fechar filtros e camadas' }).click();
  await page.locator('[data-result-detail-toggle]').first().click();
  await expect(detail).toContainText('Colisão');
  await page.locator('[data-result-detail-toggle]').nth(1).click();
  await expect(page.locator('.result-inline-detail').nth(1)).toContainText('Não informado');
});

test('consulta legada incompatível avisa e preserva o recorte e a versão salva', async ({
  page,
}) => {
  const saved = [
    { id: 'old', name: 'Consulta antiga', period: '1m', filters: ['group:CRIMES', 'crime:AMEACA'] },
  ];
  await page.addInitScript(
    (searches) => localStorage.setItem('vu2.savedSearches', JSON.stringify(searches)),
    saved,
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Consulta salva incompatível' }),
  ).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vu2.savedSearches')!))).toEqual(
    saved,
  );
  await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
  await expect(page.getByLabel('Período da consulta')).toHaveValue('24h');
});
