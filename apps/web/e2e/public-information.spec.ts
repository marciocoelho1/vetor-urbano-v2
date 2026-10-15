import { expect, test } from '@playwright/test';

test.use({ actionTimeout: 10_000 });

test.beforeEach(async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
  await page.goto('/');
});

test('rodapé apresenta G1 como placeholder e separa exemplos sintéticos com e sem URL', async ({
  page,
}, testInfo) => {
  const g1Requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://g1.globo.com')) g1Requests.push(request.url());
  });
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  const sourceLink = page.getByRole('link', { name: 'Conheça nossas fontes', exact: true });
  await expect(sourceLink).toBeVisible({ timeout: 3000 });
  await sourceLink.focus();
  await page.keyboard.press('Enter');
  const title = page.getByRole('heading', { name: 'Conheça nossas fontes', exact: true });
  await expect(title).toBeFocused();
  const content = page.getByRole('region', { name: 'Conheça nossas fontes', exact: true });
  await expect(
    content.getByRole('link', { name: 'G1 — Rio de Janeiro', exact: true }),
  ).toHaveAttribute('href', 'https://g1.globo.com/rj/rio-de-janeiro/');
  await expect(content).toContainText('Placeholder não avaliado');
  await expect(content).toContainText('Coleta desativada');
  await expect(
    content.getByRole('link', { name: 'Fonte fictícia — Demonstração local', exact: true }),
  ).toHaveAttribute('href', 'https://example.invalid/fontes/demo');
  const noUrl = content.getByRole('article').filter({ hasText: 'Canal fictício sem URL pública' });
  await expect(noUrl).toContainText('Sem URL pública');
  await expect(noUrl.getByRole('link')).toHaveCount(0);
  await expect(content).not.toContainText(/ISP-RJ|OTT360|Fogo Cruzado|COR-Rio/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('sources-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(sourceLink).toBeFocused();
  await expect(page.locator('[data-quick-category="SEGURANCA"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.locator('.result-list > li')).toHaveCount(12);
  expect(g1Requests).toEqual([]);
});

test('explicação da nota abre pelo detalhe e devolve foco sem perder ocorrência ou filtros', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Lista/ }).click();
  await page.locator('[data-result-detail-toggle="demo-002"]').click();
  const detail = page.locator('[data-result-detail="demo-002"]');
  const evaluationLink = detail.getByRole('link', {
    name: 'Entenda nossa avaliação de confiabilidade',
    exact: true,
  });
  await expect(evaluationLink).toBeVisible({ timeout: 3000 });
  await evaluationLink.focus();
  await page.keyboard.press('Enter');
  const content = page.getByRole('region', {
    name: 'Entenda nossa avaliação de confiabilidade',
    exact: true,
  });
  await expect(content.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(content).toContainText('qualidade e precisão');
  await expect(content).toContainText('confirmação independente');
  await expect(content).toContainText('divergências');
  await expect(content).toContainText('não é uma probabilidade');
  await expect(content).toContainText('notas são fictícias');
  await expect(content).not.toContainText(
    /40\/40\/20|bônus|penalidade|peso|nota da fonte|equação|amostra mínima/i,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('evaluation-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(evaluationLink).toBeFocused();
  await expect(detail).toContainText('3 ocorrências · 1 acontecimento');
  await expect(detail).toContainText('Canal fictício sem URL pública');
  await expect(detail.getByRole('link', { name: /Publicação fictícia/ })).toHaveCount(2);
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  await expect(
    detail.getByText('Confiabilidade da ocorrência: 3 / 5', { exact: true }),
  ).toBeVisible();
});

test('páginas públicas retornam ao histórico e preservam importação e triagem demonstrativas', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Fontes', exact: true }).click();
  const sources = page.locator('section[aria-labelledby="sources-heading"]');
  await expect(sources).toContainText('G1 — Rio de Janeiro');
  await expect(sources).not.toContainText(/ISP-RJ|OTT360|Fogo Cruzado|COR-Rio/);
  await expect(
    sources.getByRole('heading', { name: 'Receber arquivo local de fonte aberta' }),
  ).toBeVisible();
  await expect(sources.getByRole('heading', { name: 'Triagem de publicações' })).toBeVisible();
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Buscar no histórico' })
    .fill('Interdição parcial simulada');
  await page.getByRole('button', { name: 'Abrir detalhes e proveniência' }).click();
  const evaluationLink = page
    .locator('.workspace-detail')
    .getByRole('link', { name: 'Entenda nossa avaliação de confiabilidade', exact: true });
  await evaluationLink.click();
  const sourceLink = page.getByRole('link', { name: 'Conheça nossas fontes', exact: true });
  await sourceLink.click();
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(
    page.getByRole('heading', { name: 'Entenda nossa avaliação de confiabilidade', exact: true }),
  ).toBeVisible();
  await expect(sourceLink).toBeFocused();
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(evaluationLink).toBeFocused();
  await expect(page.getByRole('searchbox', { name: 'Buscar no histórico' })).toHaveValue(
    'Interdição parcial simulada',
  );
  await expect(page.locator('.history-record')).toHaveCount(1);
  await expect(page.locator('.workspace-detail')).toContainText('Canal fictício sem URL pública');
});
