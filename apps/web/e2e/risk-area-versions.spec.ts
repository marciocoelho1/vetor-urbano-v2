import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { loginBrowser, syntheticAdmin } from './helpers/synthetic-admin';
import { confirmedUser } from './helpers/local-account';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API/PostGIS sintéticos isolados.');
test.use({ trace: 'off', screenshot: 'only-on-failure', actionTimeout: 15000 });

test('revisão territorial preserva a aprovada até decisão explícita e aceita correção AREA', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await syntheticAdmin(page, request);
  const api = 'http://127.0.0.1:8080/api/v1';
  const access = await (await page.request.get(`${api}/auth/session`)).json();
  // Fonte de apoio criada por HTTP real, sem depender de outra suíte.
  const createdSource = await page.request.post(`${api}/admin/sources`, {
    headers: { 'X-CSRF-Token': access.csrfToken },
    data: {
      name: `Fonte territorial sintética ${randomUUID().slice(0, 8)}`,
      channel: 'Fixture HTTP local 26',
      url: 'https://example.test/territorio-26',
      territories: ['Rio de Janeiro'],
      pillars: ['SEGURANCA'],
      accessMethod: 'MANUAL',
      rating: 3,
      ratingJustification: 'Somente teste sintético de versões',
    },
  });
  expect(createdSource.ok()).toBe(true);
  const sourceId = (await createdSource.json()).id;
  expect(
    (await page.request.get(`${api}/admin/risk-areas`)).status(),
    'API territorial nova precisa estar ativa',
  ).toBe(200);
  const panel = page.getByRole('region', { name: 'Áreas de Risco disponíveis' });
  const adminButton = panel.getByRole('button', { name: 'Revisar versões territoriais' });
  await adminButton.focus();
  await expect(adminButton).toBeFocused();
  await page.keyboard.press('Enter');
  const editor = page.locator('app-risk-area-management');
  await editor.getByRole('button', { name: 'Nova área sintética' }).click();
  const id = await editor.getByLabel('Identidade territorial').inputValue();
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const suffix = randomUUID().slice(0, 8);
  await editor.getByLabel('Nome da área', { exact: true }).fill(`Área sintética 26 ${suffix}`);
  await editor.getByLabel('Grupo indicado', { exact: true }).fill('Não determinado');
  const source = editor.getByLabel('Fonte original', { exact: true });
  await expect(source).toBeVisible();
  await expect(source.locator('option')).not.toHaveCount(1);
  await source.selectOption(sourceId);
  await editor
    .getByLabel('Referência da evidência')
    .fill('Divergência sintética não prova disputa');
  await editor.getByLabel('Data de referência conhecida').fill('2026-07-01');
  await editor
    .getByLabel('Limitações da versão')
    .fill('Geometria sintética; sem validação operacional');
  const geometry1 = {
    type: 'Polygon',
    coordinates: [
      [
        [-43.2, -22.91],
        [-43.18, -22.91],
        [-43.18, -22.89],
        [-43.2, -22.91],
      ],
    ],
  };
  await editor.getByLabel('Geometria GeoJSON').fill(JSON.stringify(geometry1));
  await editor.getByLabel('Justificativa da revisão').fill('Primeira revisão sintética');
  await editor.getByRole('button', { name: 'Salvar revisão sem publicar' }).click();
  await expect(editor.getByRole('status')).toContainText('Revisão 1 salva sem publicar');
  const history = await (await page.request.get(`${api}/admin/risk-areas/${id}`)).json();
  const recorded = new Date(history.items[0].recordedAt);
  const brazilTime = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(recorded);
  await expect(
    editor.getByRole('region', { name: 'Depois: revisão mais recente' }).locator('.recorded-at'),
  ).toHaveText(`Registro técnico: ${brazilTime} (America/Sao_Paulo)`);
  await expect(
    panel.getByRole('button', { name: `Área sintética 26 ${suffix}`, exact: true }),
  ).toHaveCount(0);
  const unpublished = await (await page.request.get(`${api}/risk-areas`)).json();
  expect(unpublished.items.some((item: { territoryId: string }) => item.territoryId === id)).toBe(
    false,
  );
  await editor.getByLabel('Justificativa da aprovação').fill('Aprovação sintética explícita');
  await editor.getByRole('button', { name: 'Aprovar versão mais recente' }).click();
  await expect(editor.getByRole('status')).toContainText('Versão 1 aprovada');
  await panel.getByRole('button', { name: `Área sintética 26 ${suffix}`, exact: true }).click();
  const detail = page.getByRole('region', { name: 'Detalhes da Área de Risco' });
  await expect(detail.getByRole('heading', { level: 3 })).toBeFocused();
  await expect(detail).toContainText('Geometria sintética; sem validação operacional');
  await expect(detail).toContainText('01/07/2026');
  await expect(detail).toContainText(id);
  await editor.getByLabel('Nome da área', { exact: true }).fill(`Área revisada 26 ${suffix}`);
  await editor.getByLabel('Data de referência conhecida').fill('');
  await editor.getByLabel('Geometria GeoJSON').fill(
    JSON.stringify({
      ...geometry1,
      coordinates: [
        [
          [-43.21, -22.91],
          [-43.18, -22.91],
          [-43.18, -22.88],
          [-43.21, -22.91],
        ],
      ],
    }),
  );
  await editor.getByLabel('Justificativa da revisão').fill('Revisão de detalhes e geometria');
  await editor.getByRole('button', { name: 'Salvar revisão sem publicar' }).click();
  await expect(editor.getByRole('status')).toContainText('Revisão 2 salva sem publicar');
  await expect(editor.getByRole('region', { name: 'Antes: versão aprovada' })).toContainText(
    `Área sintética 26 ${suffix}`,
  );
  await expect(editor.getByRole('region', { name: 'Depois: revisão mais recente' })).toContainText(
    `Área revisada 26 ${suffix}`,
  );
  await expect(detail).toContainText(`Área sintética 26 ${suffix}`);
  // Só a falha de concorrência é simulada; revisão/aprovações e leituras acima/abaixo são reais.
  await page.route('**/api/v1/admin/risk-areas/*/versions', (route) =>
    route.fulfill({ status: 409, json: {} }),
  );
  await editor.getByLabel('Justificativa da revisão').fill('Tentativa concorrente sintética');
  await editor.getByRole('button', { name: 'Salvar revisão sem publicar' }).click();
  await expect(editor.locator('#area-status')).toContainText('Conflito de versão');
  await expect(editor.getByLabel('Nome da área', { exact: true })).toHaveValue(
    `Área revisada 26 ${suffix}`,
  );
  await page.unroute('**/api/v1/admin/risk-areas/*/versions');
  const before = await page.evaluate(async () =>
    (await fetch('http://127.0.0.1:8080/api/v1/risk-areas', { credentials: 'include' })).json(),
  );
  expect(
    before.items.find((item: { territoryId: string }) => item.territoryId === id),
  ).toMatchObject({ version: 1, geometry: geometry1 });
  await editor
    .getByLabel('Justificativa da aprovação')
    .fill('Segunda versão conferida explicitamente');
  await editor.getByRole('button', { name: 'Aprovar versão mais recente' }).click();
  await expect(editor.getByRole('status')).toContainText('Versão 2 aprovada');
  await expect(detail).toContainText(`Área revisada 26 ${suffix}`);
  await expect(detail).toContainText('Referência temporal indisponível');
  await expect(detail).toContainText('Não determinado');
  await page.reload();
  await panel.getByRole('button', { name: `Área revisada 26 ${suffix}`, exact: true }).click();
  await expect(detail).toContainText(/Versão\s*2/);
  await page.locator('#corrections-link').click();
  const channel = page.locator('app-correction-channel');
  await channel.getByLabel('Tipo de alvo').selectOption('AREA');
  await channel.getByLabel('Identificador do alvo').fill(id);
  await channel
    .getByLabel('Explicação', { exact: true })
    .fill('Conferir limites sintéticos da área aprovada');
  await channel.getByLabel('Referências restritas').fill('Referência sintética territorial 26');
  await channel.getByRole('button', { name: 'Enviar pedido de correção' }).click();
  await expect(channel.getByText(/Recebida · versão 1/)).toBeVisible();
  const email = await confirmedUser(request, 'territory26-user');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await loginBrowser(page, email);
  await panel.getByRole('button', { name: `Área revisada 26 ${suffix}`, exact: true }).click();
  await expect(detail).toContainText(`Área revisada 26 ${suffix}`);
  await expect(detail).toContainText(/Versão\s*2/);
  await expect(panel.getByRole('button', { name: 'Revisar versões territoriais' })).toHaveCount(0);
  await expect(editor).toHaveCount(0);
  expect((await page.request.get(`${api}/admin/risk-areas`)).status()).toBe(403);
  expect((await page.request.get(`${api}/admin/risk-areas/${id}`)).status()).toBe(403);
  const userAreas = await (await page.request.get(`${api}/risk-areas`)).json();
  expect(
    userAreas.items.find((item: { territoryId: string }) => item.territoryId === id),
  ).toMatchObject({ version: 2, name: `Área revisada 26 ${suffix}`, referenceDate: null });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('carga, falha e vazio são explícitos sem publicar ou inventar uma área', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let failed = true;
  await page.route('**/api/v1/risk-areas', async (route) => {
    await gate;
    await route.fulfill(failed ? { status: 503, json: {} } : { json: { items: [] } });
  });
  await syntheticAdmin(page, request);
  const panel = page.getByRole('region', { name: 'Áreas de Risco disponíveis' });
  await expect(panel.getByText('Carregando Áreas de Risco…', { exact: true })).toBeVisible();
  release();
  await expect(
    panel.getByText('Não foi possível carregar as Áreas de Risco da fonte.', { exact: true }),
  ).toBeVisible();
  failed = false;
  await panel.getByRole('button', { name: 'Tentar novamente a camada', exact: true }).click();
  await expect(
    panel.getByText('Nenhuma Área de Risco disponível para estes filtros.'),
  ).toBeVisible();
  let releaseAdmin!: () => void;
  const adminGate = new Promise<void>((resolve) => {
    releaseAdmin = resolve;
  });
  let adminFailed = true;
  await page.route('**/api/v1/admin/risk-areas', async (route) => {
    await adminGate;
    await route.fulfill(adminFailed ? { status: 503, json: {} } : { json: { items: [] } });
  });
  await panel.getByRole('button', { name: 'Revisar versões territoriais' }).click();
  const editor = page.locator('app-risk-area-management');
  await expect(editor.getByText('Carregando revisões territoriais…')).toBeVisible();
  expect(await editor.getByLabel('Nome da área', { exact: true }).count()).toBe(0);
  releaseAdmin();
  await expect(editor.locator('#area-status')).toContainText('Não foi possível carregar ou salvar');
  adminFailed = false;
  await editor.getByRole('button', { name: 'Atualizar versões territoriais' }).click();
  await expect(editor.getByText('Nenhuma revisão territorial cadastrada.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
