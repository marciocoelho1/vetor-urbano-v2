import { expect, test } from '@playwright/test';
test.use({ actionTimeout: 15000 });

const collection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { n: 'Área neutra de teste', f: 'NEU' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-43.2, -22.91],
            [-43.18, -22.91],
            [-43.18, -22.89],
            [-43.2, -22.89],
            [-43.2, -22.91],
          ],
        ],
      },
    },
  ],
};
test.beforeEach(async ({ page }) => {
  // Regressão demonstrativa do 09: sessão explícita, sem substituir a integração do 26.
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        code: 'SESSION',
        message: 'Sessão sintética de QA',
        authenticated: true,
        role: 'USER',
        csrfToken: 'synthetic-ticket-09',
      },
    }),
  );
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
  await page.route('**/maps/areas-territoriais.geojson', (route) =>
    route.fulfill({ json: collection }),
  );
  await page.goto('/');
});

test('áreas preservam procedência, precisão e contagens com alternativa por teclado', async ({
  page,
}, testInfo) => {
  await page.getByLabel('Exibir Áreas de Risco', { exact: true }).check();
  await expect(page.locator('.overview-metric strong').first()).toHaveText('17');
  const list = page.getByRole('region', { name: 'Áreas de Risco disponíveis' });
  const area = list.getByRole('button', { name: 'Área neutra de teste', exact: true });
  await area.focus();
  await page.keyboard.press('Enter');
  const detail = page.getByRole('region', { name: 'Detalhes da Área de Risco' });
  await expect(detail.getByRole('heading', { level: 3 })).toBeFocused();
  await expect(detail).toContainText('Área classificada como neutra pela fonte');
  await expect(detail).toContainText('Dados de Riscos');
  await expect(detail).toContainText('07/2026 (dia e hora não informados)');
  await expect(detail).toContainText(/Última verificação\s*Indisponível/);
  await expect(detail).toContainText(/Início real da presença\s*Indisponível/);
  const mapBox = (await page.locator('#map-canvas').boundingBox())!;
  await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
  await expect(page.locator('.leaflet-tooltip')).toHaveText('Área neutra de teste');
  await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
  await expect(detail).toBeVisible();
  await page.locator('[data-mode-toggle]').click();
  await page.getByLabel('Período da consulta').selectOption('custom');
  await page.getByLabel('Início (horário de Brasília)', { exact: true }).fill('2026-06-01T00:00');
  await page.getByLabel('Fim (horário de Brasília; exclusivo)').fill('2026-06-30T23:59');
  await page.getByRole('button', { name: 'Fechar filtros e camadas' }).click();
  await expect(detail).toContainText('Não presume domínio histórico');
  await page.getByLabel('Exibir exemplos territoriais fictícios', { exact: true }).check();
  await list
    .getByRole('button', { name: 'Exemplo fictício de área disputada', exact: true })
    .click();
  await expect(detail).toContainText('Disputado');
  await expect(detail).toContainText('DEMO:DISPUTA:02');
  await expect(detail).toContainText('DEMO v1');
  await expect(detail).toContainText('DEMO v2');
  await list
    .getByRole('button', { name: 'Exemplo fictício sem grupo determinado', exact: true })
    .click();
  await expect(detail).toContainText('Não determinado');
  await expect(detail).toContainText('Divergência fictícia');
  await expect(detail).toContainText('Referência temporal indisponível');
  await expect(page.locator('.overview-metric strong').first()).toHaveText('0');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Lista/ }).click();
  await expect(detail).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await detail.screenshot({ path: testInfo.outputPath('risk-area-mobile.png') });
});

test('carregamento, falha e camada vazia preservam ocorrências e exemplos locais', async ({
  page,
}) => {
  let pending: import('@playwright/test').Route | undefined;
  await page.route('**/maps/areas-territoriais.geojson', (route) => {
    pending = route;
  });
  await page.getByLabel('Exibir Áreas de Risco', { exact: true }).check();
  await expect(page.getByText('Carregando Áreas de Risco…', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await pending!.fulfill({ status: 503, body: 'indisponível' });
  await expect(
    page.getByText('Não foi possível carregar as Áreas de Risco da fonte.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.overview-metric strong').first()).toHaveText('17');
  await page.route('**/maps/areas-territoriais.geojson', (route) =>
    route.fulfill({ json: { type: 'FeatureCollection', features: [] } }),
  );
  await page.getByRole('button', { name: 'Tentar novamente a camada', exact: true }).click();
  await expect(
    page.getByText('Nenhuma Área de Risco disponível para estes filtros.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Exibir exemplos territoriais fictícios', { exact: true }).check();
  await expect(
    page.getByRole('button', { name: 'Exemplo fictício de área disputada', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.overview-metric strong').first()).toHaveText('17');
});
