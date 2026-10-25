import { expect, test } from '@playwright/test';
import { api, confirmedUser } from './helpers/local-account';
import { fixtureSql, syntheticAdmin, loginBrowser } from './helpers/synthetic-admin';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige HTTP e PostGIS reais.');
test('expiração e renovação humanas repetem aviso persistente com teclado em 390 px', async ({
  page,
}) => {
  const run = Date.now();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  fixtureSql(`INSERT INTO happenings(id,title,description) VALUES('vu25-renewal-happening','Acontecimento sintético da renovação','Fixture isolada do ciclo de confirmação') ON CONFLICT(id) DO NOTHING;
    INSERT INTO occurrences(id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
    VALUES('vu25-renewal','vu25-renewal-happening','Renovação humana sintética 25','Efeito específico','TRANSITO','ACIDENTE','COLISAO','ONGOING',3,'Rio de Janeiro','Centro','POINT',ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326),CURRENT_TIMESTAMP - INTERVAL '1 hour','PUBLISHED') ON CONFLICT(id) DO UPDATE SET happening_id=EXCLUDED.happening_id`);
  await syntheticAdmin(page, page.request);
  const session = await page.request.get(`${api}/auth/session`);
  const { csrfToken } = await session.json();
  const read = await page.request.get(`${api}/active-reports/vu25-renewal/verification`);
  expect(read.status()).toBe(200);
  const current = await read.json();
  const confirmation = await page.request.post(`${api}/active-reports/vu25-renewal/verification`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      effectVersion: current.revision,
      verificationVersion: current.verificationVersion,
      situation: 'ONGOING',
      confirmedAt: new Date(Date.now() - 7201000).toISOString(),
      evidence: `Referência humana sintética inicial por efeito ${run}`,
    },
  });
  expect(confirmation.status()).toBe(200);
  await page.reload();
  const notice = page.getByRole('button', { name: /ocorrências? com confirmação expirada/ });
  await expect(notice).toBeVisible();
  await notice.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Ocorrências', exact: true, level: 1 }),
  ).toBeFocused();
  const container = page.getByTestId('expired-occurrences');
  await expect(container).toContainText('Renovação humana sintética 25');
  const treat = container.getByRole('button', { name: 'Tratar Renovação humana sintética 25' });
  await treat.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Verificar situação da ocorrência' }),
  ).toBeFocused();
  const evidence = page.getByLabel('Nova evidência humana rastreável');
  await expect(evidence).toHaveValue('');
  await evidence.fill(`Segunda verificação humana sintética, referência específica 25 ${run}`);
  await page
    .getByLabel('Instante da confirmação (UTC)')
    .fill(new Date(Date.now() - 7194000).toISOString());
  await page.getByRole('button', { name: 'Salvar nova confirmação' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Nova confirmação salva' }),
  ).toBeVisible();
  await expect(page.getByTestId('verification-editor')).toHaveCount(0);
  await expect(treat).toBeVisible({ timeout: 25000 });
  // A new expiration requires another human decision; the old reference is never prefilled.
  await treat.click();
  await expect(evidence).toHaveValue('');
  await evidence.fill(`Terceira verificação humana sintética independente ${run}`);
  await page.getByRole('button', { name: 'Salvar nova confirmação' }).click();
  await expect(container).not.toContainText('Renovação humana sintética 25');
  const history = await page.request.get(`${api}/active-reports/vu25-renewal/verification`);
  expect(history.status()).toBe(200);
  expect((await history.json()).history).toHaveLength(current.verificationVersion + 3);
  await page.getByRole('button', { name: 'Mapa de ocorrências', exact: true }).click();
  await page.getByRole('button', { name: /^Lista/ }).click();
  await expect(page.locator('[data-result-point="vu25-renewal"]')).toContainText('Em andamento');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Repetição real do ciclo: uma nova confirmação humana já vencida recoloca o efeito na fila,
  // reexibe o aviso persistente e reabre o editor sem reutilizar a evidência anterior.
  const later = await page.request.get(`${api}/active-reports/vu25-renewal/verification`);
  const currentLater = await later.json();
  const expiredAgain = await page.request.post(`${api}/active-reports/vu25-renewal/verification`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      effectVersion: currentLater.revision,
      verificationVersion: currentLater.verificationVersion,
      situation: 'ONGOING',
      confirmedAt: new Date(Date.now() - 10800000).toISOString(),
      evidence: `Quarta revisão humana sintética com expiração repetida ${run}`,
    },
  });
  expect(expiredAgain.status()).toBe(200);
  await expect(notice).toBeVisible();
  await notice.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Ocorrências', exact: true, level: 1 }),
  ).toBeFocused();
  await expect(container).toContainText('Renovação humana sintética 25');
  await treat.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Verificar situação da ocorrência' }),
  ).toBeFocused();
  await expect(evidence).toHaveValue('');
  await page.getByRole('button', { name: 'Cancelar verificação' }).click();
  await expect(page.getByTestId('verification-editor')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fila distingue carregamento, falha e vazio com recuperação por teclado', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/active-reports/expired', async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
  });
  try {
    const email = await confirmedUser(request, 'verification-empty');
    await loginBrowser(page, email);
    await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ocorrências', exact: true }).click();
    await expect(
      page.getByText('Consultando confirmações expiradas…', { exact: true }),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Verificação indisponível' }),
    ).toBeVisible();
    await expect(
      page.getByText('Nenhuma confirmação expirada para tratar nesta consulta.', { exact: true }),
    ).toHaveCount(0);
    await page.unroute('**/api/v1/active-reports/expired');
    const refresh = page.getByRole('button', {
      name: 'Atualizar confirmações expiradas',
      exact: true,
    });
    await refresh.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('Nenhuma confirmação expirada para tratar nesta consulta.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Verificação indisponível' }),
    ).toHaveCount(0);
    await expect(refresh).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    release();
  }
});
