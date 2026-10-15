import { expect, test } from '@playwright/test';

test('filtros combinados têm resumo removível e limpeza explícita sem perder sincronismo', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>',
    }),
  );
  await page.goto('/');
  const summary = page.getByRole('region', { name: 'Filtros aplicados', exact: true });
  await expect(summary).toBeVisible();
  await page.getByLabel('Período da consulta').selectOption('1m');
  await page.getByTestId('filter-panel-toggle').click();
  const types = page.getByRole('group', { name: 'Tipos de ocorrência', exact: true });
  await types.getByRole('checkbox', { name: 'Roubo/assalto', exact: true }).check();
  await types.getByRole('checkbox', { name: 'Furto', exact: true }).check();
  await page.getByRole('button', { name: 'Fechar filtros e camadas' }).click();
  await expect(page.locator('.result-list > li')).toHaveCount(11);
  await expect(page.locator('#map-canvas .occurrence-pin')).toHaveCount(11);
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await expect(page.locator('.result-list > li')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toContainText('Nenhum resultado');
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  const remove = summary.getByRole('button', { name: 'Remover tipo Roubo/assalto', exact: true });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.result-list > li')).toHaveCount(6);
  await expect(page.locator('#map-canvas .occurrence-pin')).toHaveCount(6);
  const clear = summary.getByRole('button', { name: 'Limpar filtros', exact: true });
  await expect(clear).toBeFocused();
  await clear.click();
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  await expect(page.getByLabel('Período da consulta')).toHaveValue('24h');
  await expect(page.getByRole('status').filter({ hasText: 'Filtros limpos' })).toBeVisible();
  await page.screenshot({ path: `test-results/ticket03-${testInfo.project.name}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Lista 17/ }).click();
  await expect(summary).toBeVisible();
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/ticket03-${testInfo.project.name}-mobile.png` });
});
