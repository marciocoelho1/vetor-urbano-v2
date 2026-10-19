import { expect, test } from '@playwright/test';
import { syntheticAdmin } from './helpers/synthetic-admin';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige autorização ADMIN real.');
test.use({ trace: 'off', screenshot: 'off' });
test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await syntheticAdmin(page, page.request);
  // Os dois fluxos legados continuam na demonstração, não na fila persistida ?consulta=api.
  await page.goto('/');
  await page.setViewportSize({ width: 390, height: 844 });
  const sources = page.getByRole('button', { name: 'Fontes', exact: true });
  await sources.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Fontes abertas e triagem' })).toBeFocused();
});

test('Administrador recebe CSV local de fonte aberta com proveniência e descarte explícito', async ({
  page,
}) => {
  const card = page.locator('.import-card');
  await expect(
    card.getByRole('heading', { name: 'Receber arquivo local de fonte aberta' }),
  ).toBeVisible();
  await card.getByLabel('Nome da fonte').fill('Série sintética B2');
  await card.getByLabel('URL de referência').fill('https://example.invalid/b2.csv');
  await card.getByLabel('Licença / autorização').fill('Autorização sintética');
  await card.getByLabel('Data de referência').fill('2026-09');
  await card.getByLabel('Limitações conhecidas').fill('Somente teste, sem dados reais.');
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('example.invalid')) requests.push(request.url());
  });
  await card.getByLabel('Selecionar CSV').setInputFiles({
    name: 'sintetico.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'territorio,periodo,indicador,valor,unidade\nCentro,2026-09,Trânsito,4,registros',
    ),
  });
  await expect(card.getByRole('status')).toContainText('1 estatística(s) agregada(s)');
  const imports = page.locator('.source-import-list');
  await expect(imports).toContainText('Série sintética B2');
  await expect(imports).toContainText('Autorização sintética');
  await expect(imports).toContainText('Somente teste, sem dados reais.');
  expect(requests).toEqual([]);
  const remove = page.getByRole('button', { name: 'Remover dados importados' });
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(imports).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Administrador tria referência local sem buscar ou publicar conteúdo externo', async ({
  page,
}) => {
  const card = page.locator('.triage-card');
  await expect(card.getByRole('heading', { name: 'Triagem de publicações' })).toBeVisible();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('example.invalid')) requests.push(request.url());
  });
  await card.getByLabel('Título da publicação').fill('Referência sintética B2');
  await card.getByLabel('Veículo / canal').fill('Canal sintético');
  await card.getByLabel('URL da referência').fill('https://example.invalid/b2');
  const add = card.getByRole('button', { name: 'Adicionar à triagem' });
  await add.focus();
  await page.keyboard.press('Enter');
  const item = card.getByRole('article').filter({ hasText: 'Referência sintética B2' });
  await expect(item).toContainText('PENDING');
  await expect(item.getByRole('link', { name: 'Abrir publicação' })).toHaveAttribute(
    'href',
    'https://example.invalid/b2',
  );
  const archive = item.getByRole('button', { name: 'Arquivar referência' });
  await archive.focus();
  await page.keyboard.press('Enter');
  await expect(item).toContainText('DISMISSED');
  await expect(item.getByRole('button', { name: 'Associar', exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
