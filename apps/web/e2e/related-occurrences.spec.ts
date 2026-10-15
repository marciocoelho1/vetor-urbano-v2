import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
  await page.goto('/');
});

test('três efeitos de um acontecimento mantêm contagem e referências próprias', async ({
  page,
}) => {
  await page.locator('[data-result-detail-toggle="demo-002"]').click();
  const detail = page.locator('[data-result-detail="demo-002"]');
  await expect(detail).toContainText('3 ocorrências · 1 acontecimento');
  await expect(detail.getByRole('link', { name: /Publicação fictícia/ })).toHaveCount(2);
  await expect(detail).toContainText(/Pessoas afetadas\s*Não informado/);
  await expect(detail).toContainText(/Veículos envolvidos\s*Não se aplica/);
  await expect(detail).toContainText(/Faixas bloqueadas\s*1/);
  await expect(detail.getByRole('button', { name: /Queda de árvore/ })).toBeVisible();
  await expect(detail.getByRole('button', { name: /Interrupção de energia/ })).toBeVisible();
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  await page.locator('[data-quick-category="CONTINGENCIA"]').click();
  await expect(detail).toContainText('1 ocorrência · 1 acontecimento no recorte');
  await expect(detail.getByText('Contexto fora do recorte', { exact: false })).toHaveCount(2);
  await expect(page.locator('.result-list > li')).toHaveCount(7);
  await detail.getByRole('button', { name: /Queda de árvore/ }).click();
  await expect(detail.getByRole('heading', { name: /Queda de árvore/ })).toBeVisible();
  await expect(detail).toContainText('Contexto fora do recorte; não incluído nos totais');
  await expect(detail).toContainText('Encerrada');
  await expect(page.locator('.result-list > li')).toHaveCount(7);
  await detail.getByRole('button', { name: /Interrupção de energia/ }).click();
  await expect(detail).toContainText('Não informado');
  await expect(detail.getByRole('link', { name: /Publicação fictícia/ })).toHaveCount(1);
});

test('pin e lista abrem o mesmo detalhe e característica não duplica acidente', async ({
  page,
}) => {
  const pin = page.locator('#map-canvas .occurrence-pin[title^="Interdição parcial simulada"]');
  await expect(pin).toBeVisible();
  await page.locator('[data-result-point="demo-002"]').click();
  await pin.click();
  await page
    .locator('[data-coincident-select="demo-002"], button:has-text("Abrir detalhes da ocorrência")')
    .first()
    .click();
  const detail = page.locator('[data-result-detail="demo-002"]');
  await expect(detail).toContainText('3 ocorrências · 1 acontecimento');
  await expect(detail.getByRole('link', { name: /Publicação fictícia/ })).toHaveCount(2);
  await detail.getByRole('button', { name: /Fechar detalhes/ }).click();
  await expect(page.locator('[data-result-detail-toggle="demo-002"]')).toBeFocused();
  await page.locator('[data-result-detail-toggle="demo-transito-001"]').click();
  const accident = page.locator('[data-result-detail="demo-transito-001"]');
  await expect(accident).toContainText('Colisão');
  await expect(accident).toContainText('Capotamento');
  await expect(accident).toContainText('1 ocorrência · 1 acontecimento');
  await expect(page.locator('.result-list > li')).toHaveCount(17);
});

test('detalhe compartilhado no histórico e tela móvel mantém referências e teclado', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Buscar no histórico' })
    .fill('Interdição parcial simulada');
  await page.getByRole('button', { name: /detalhes/i }).click();
  const detail = page.locator('.workspace-detail');
  await expect(detail).toContainText('3 ocorrências · 1 acontecimento');
  await expect(detail.getByRole('link', { name: /Publicação fictícia/ })).toHaveCount(2);
  await detail.getByRole('button', { name: /Queda de árvore/ }).focus();
  await page.keyboard.press('Enter');
  await expect(detail.getByRole('heading', { name: /Queda de árvore/ })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('related-mobile.png'), fullPage: true });
});

test('falha do mapa preserva detalhe em lista e vazio não inventa ocorrências', async ({
  page,
}) => {
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.reload();
  await expect(page.getByText('Não foi possível carregar o mapa', { exact: true })).toBeVisible();
  await page.locator('[data-result-detail-toggle="demo-002"]').click();
  await expect(page.locator('[data-result-detail="demo-002"]')).toContainText(
    '3 ocorrências · 1 acontecimento',
  );
  for (const category of ['TRANSITO', 'SEGURANCA', 'CONTINGENCIA'])
    await page.locator(`[data-quick-category="${category}"]`).click();
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.result-list > li')).toHaveCount(0);
});
