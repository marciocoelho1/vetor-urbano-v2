import { expect, test } from '@playwright/test';

test('consulta preserva precisão temporal e expira confirmação sem encerrar', async ({
  page,
  browserName,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/');
  const period = page.getByLabel('Período da consulta');
  await period.selectOption('ongoing');
  await expect(page.locator('.result-list > li')).toHaveCount(2);
  await expect(page.locator('[data-result-point="demo-transito-007"]')).toBeVisible();
  await page.locator('[data-result-detail-toggle="demo-002"]').click();
  await expect(page.locator('[data-result-detail="demo-002"]')).toContainText('Em andamento');
  await expect(page.locator('[data-result-detail="demo-002"]')).toContainText(
    'Validade sintética local',
  );
  await page.locator('[data-result-detail-toggle="demo-002"]').click();
  await page.clock.setFixedTime(new Date('2026-10-15T19:00:00Z'));
  await page.getByRole('button', { name: 'Atualizar referência da consulta', exact: true }).click();
  await expect(page.locator('.result-list > li')).toHaveCount(0);
  await expect(page.getByText('Nenhum resultado nesta combinação', { exact: true })).toBeVisible();
  await period.selectOption('1w');
  await page.locator('[data-result-detail-toggle="demo-002"]').click();
  await expect(page.locator('[data-result-detail="demo-002"]')).toContainText('Desconhecida');
  await expect(page.locator('[data-result-detail="demo-002"]')).toContainText(
    'não comprova encerramento',
  );
  await page.locator('[data-result-detail-toggle="demo-transito-009"]').click();
  await expect(page.locator('[data-result-detail="demo-transito-009"]')).toContainText(
    'hora não informada',
  );
  await expect(page.locator('[data-result-detail="demo-transito-009"]')).not.toContainText('00:00');
  await period.selectOption('1m');
  await page.locator('[data-result-detail-toggle="demo-transito-021"]').click();
  await expect(page.locator('[data-result-detail="demo-transito-021"]')).toContainText(
    'dia e hora não informados',
  );
  await expect(page.locator('[data-temporal-certainty]')).toContainText('possivelmente');
  await period.focus();
  await expect(period).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Lista/ }).click();
  await expect(period).toBeVisible();
  await page.screenshot({
    path: `test-results/temporal-mobile-${browserName}.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
