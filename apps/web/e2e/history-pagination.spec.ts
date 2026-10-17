import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { loginUser } from './helpers/local-account';

test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige API Java e PostGIS locais reais.');
test.use({ actionTimeout: 15_000, trace: 'off', screenshot: 'off' });

const endpoint = 'http://127.0.0.1:8080/api/v1/history/occurrences';
const fixturePrefix = 'vu-history-e2e-';

function executeDatabaseSql(sql: string): void {
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  expect(database, 'Informe o contêiner PostGIS sintético autorizado').toBeTruthy();
  execFileSync(
    'podman',
    [
      'exec',
      '-i',
      database!,
      'psql',
      '-X',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'vetor_urbano',
    ],
    { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
}

function removeHistoryFixtures(): void {
  executeDatabaseSql(`
    DELETE FROM occurrence_clippings WHERE occurrence_id LIKE '${fixturePrefix}%';
    DELETE FROM clippings WHERE id LIKE '${fixturePrefix}%';
    DELETE FROM occurrences WHERE id LIKE '${fixturePrefix}%';
    DELETE FROM happenings WHERE id LIKE '${fixturePrefix}%';
  `);
}

function updateHistoryFixtures(): void {
  const sql = `
    DELETE FROM occurrence_clippings WHERE occurrence_id LIKE '${fixturePrefix}%';
    DELETE FROM clippings WHERE id LIKE '${fixturePrefix}%';
    DELETE FROM occurrences WHERE id LIKE '${fixturePrefix}%';
    DELETE FROM happenings WHERE id LIKE '${fixturePrefix}%';

    INSERT INTO happenings (id, title, description)
    SELECT '${fixturePrefix}h-record-' || lpad(series::text, 3, '0'),
           'Histórico sintético', 'Acontecimento fictício para teste local.'
    FROM generate_series(1, 26) AS series;
    INSERT INTO happenings (id, title, description) VALUES
      ('${fixturePrefix}h-tie-exact', 'Empate sintético', 'Acontecimento fictício.'),
      ('${fixturePrefix}h-tie-interval', 'Empate sintético', 'Acontecimento fictício.'),
      ('${fixturePrefix}h-combined', 'Filtro combinado sintético', 'Acontecimento fictício.');

    INSERT INTO occurrences (
      id, happening_id, title, description, category, occurrence_type, subtype,
      situation, reliability_score, municipality, neighborhood, location_precision,
      location, occurred_at, occurred_from, occurred_until, publication_status
    )
    SELECT '${fixturePrefix}record-' || lpad(series::text, 3, '0'),
           '${fixturePrefix}h-record-' || lpad(series::text, 3, '0'),
           'Registro sintético ' || lpad(series::text, 3, '0'),
           'Dados fictícios para validar a paginação do histórico.',
           'TRANSITO', 'ACIDENTE', 'COLISAO', 'CLOSED', 3,
           'Rio de Janeiro', 'Centro', 'TERRITORY', NULL,
           TIMESTAMPTZ '2020-10-16T00:00:00Z' - series * INTERVAL '1 hour',
           NULL, NULL, 'PUBLISHED'
    FROM generate_series(1, 26) AS series;

    INSERT INTO occurrences (
      id, happening_id, title, description, category, occurrence_type, subtype,
      situation, reliability_score, municipality, neighborhood, location_precision,
      location, occurred_at, occurred_from, occurred_until, publication_status
    ) VALUES
      ('${fixturePrefix}tie-z-exact', '${fixturePrefix}h-tie-exact',
       'Instante exato no empate', 'Dados fictícios para ordenar precisão temporal.',
       'TRANSITO', 'ACIDENTE', 'COLISAO', 'CLOSED', 3, 'Rio de Janeiro', 'Centro',
       'TERRITORY', NULL, '2020-10-13T12:00:00Z', NULL, NULL, 'PUBLISHED'),
      ('${fixturePrefix}tie-a-interval', '${fixturePrefix}h-tie-interval',
       'Intervalo no empate', 'Fim exclusivo conhecido; horário não é exato.',
       'TRANSITO', 'ACIDENTE', 'COLISAO', 'CLOSED', 3, 'Rio de Janeiro', 'Centro',
       'TERRITORY', NULL, NULL, '2020-10-13T11:00:00Z', '2020-10-13T12:00:00Z', 'PUBLISHED'),
      ('${fixturePrefix}combined-027', '${fixturePrefix}h-combined',
       'Registro sintético de filtro combinado', 'Dados fictícios para combinar filtros avançados.',
       'SEGURANCA', 'FURTO', 'DE_OBJETOS_PESSOAIS', 'ONGOING', 5, 'Nova Iguaçu', 'Centro',
       'TERRITORY', NULL, '2020-10-12T10:00:00Z', NULL, NULL, 'PUBLISHED');

    INSERT INTO clippings (id, source_id, title, source_published_at, collected_at)
    SELECT '${fixturePrefix}clip-' || occurrence.id,
           CASE WHEN occurrence.id = '${fixturePrefix}combined-027'
                THEN 'vu-demo-source-001' ELSE 'vu-demo-source-002' END,
           'Referência sintética ' || occurrence.id,
           '2026-10-17T00:00:00Z', '2026-10-17T00:01:00Z'
    FROM occurrences AS occurrence
    WHERE occurrence.id LIKE '${fixturePrefix}%';
    INSERT INTO occurrence_clippings (occurrence_id, clipping_id)
    SELECT occurrence.id, '${fixturePrefix}clip-' || occurrence.id
    FROM occurrences AS occurrence
    WHERE occurrence.id LIKE '${fixturePrefix}%';
  `;
  executeDatabaseSql(sql);
}

test.beforeAll(() => updateHistoryFixtures());
test.afterAll(() => removeHistoryFixtures());

test.beforeEach(async ({ page }) => {
  await loginUser(page.request);
  const response = await page.request.get(`${endpoint}?text=${fixturePrefix}`);
  expect(response.status(), 'A consulta de histórico deve atravessar a API real').toBe(200);
  expect((await response.json()).counts.occurrences).toBe(29);
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('vetor-consultation-mode', 'advanced');
    localStorage.setItem('vu2.filtersCollapsed', 'true');
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  await expect(page.locator('.result-list > li')).toHaveCount(4);
});

test('histórico completo: snapshot paginado, critérios combinados, estados e teclado móvel', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Histórico de ocorrências' })).toBeVisible();
  await expect(page.getByTestId('history-loading')).toBeHidden();
  const sourceFilter = page.getByTestId('history-source-filter');
  await expect(sourceFilter.locator('option[value="vu-demo-source-002"]')).toHaveCount(1);
  await page.getByTestId('history-text-filter').fill(fixturePrefix);
  const pageStatus = page.getByTestId('history-page-status');
  const records = page.locator('[data-history-record-id]');
  await expect(pageStatus).toHaveText('Página 1 de 2 · 29 registros');
  await expect(records).toHaveCount(25);

  const firstPageIds = await records.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-history-record-id')!),
  );
  expect(new Set(firstPageIds).size).toBe(25);
  await sourceFilter.selectOption('vu-demo-source-002');
  await expect(pageStatus).toHaveText('Página 1 de 2 · 28 registros');
  await sourceFilter.selectOption('');
  await expect(pageStatus).toHaveText('Página 1 de 2 · 29 registros');
  const nextPage = page.getByTestId('history-next-page');
  await nextPage.focus();
  await page.keyboard.press('Enter');
  await expect(pageStatus).toHaveText('Página 2 de 2 · 29 registros');
  await expect(pageStatus).toBeFocused();
  await expect(records).toHaveCount(4);
  const secondPageIds = await records.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-history-record-id')!),
  );
  expect(new Set([...firstPageIds, ...secondPageIds]).size).toBe(29);

  const previousPage = page.getByTestId('history-previous-page');
  await previousPage.focus();
  await page.keyboard.press('Enter');
  await expect(pageStatus).toHaveText('Página 1 de 2 · 29 registros');
  await expect(pageStatus).toBeFocused();

  await page.getByTestId('history-text-filter').fill(`${fixturePrefix}tie-`);
  await expect(pageStatus).toHaveText('Página 1 de 1 · 2 registros');
  await expect(records).toHaveCount(2);
  await expect(records.nth(0)).toHaveAttribute(
    'data-history-record-id',
    `${fixturePrefix}tie-z-exact`,
  );
  await expect(records.nth(1)).toHaveAttribute(
    'data-history-record-id',
    `${fixturePrefix}tie-a-interval`,
  );
  await expect(records.nth(1)).toContainText('intervalo aproximado; fim exclusivo');
  await records.nth(1).getByRole('button', { name: 'Abrir detalhes e proveniência' }).click();
  await expect(page.locator('#history-detail-heading')).toHaveText('Intervalo no empate');
  await expect(page.locator('.occurrence-references > li')).toHaveCount(1);
  await expect(page.locator('.occurrence-references')).toContainText('Referência sintética');
  await expect(page.locator('.workspace-detail')).toContainText(
    'intervalo aproximado; fim exclusivo',
  );
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();

  await page.getByTestId('history-text-filter').fill(`${fixturePrefix}record-026`);
  await expect(pageStatus).toHaveText('Página 1 de 1 · 1 registros');
  await expect(records).toHaveAttribute('data-history-record-id', `${fixturePrefix}record-026`);

  await page.getByTestId('history-text-filter').fill('');
  await page.getByTestId('history-period-start').fill('2020-10-12T06:00');
  await page.getByTestId('history-period-end').fill('2020-10-12T08:00');
  await page.getByTestId('history-municipality-filter').fill('Nova Iguaçu');
  await page.getByTestId('history-neighborhood-filter').fill('Centro');
  await page.getByTestId('history-type-filter').selectOption('FURTO');
  await page.getByTestId('history-subtype-filter').selectOption('FURTO:DE_OBJETOS_PESSOAIS');
  await page.getByTestId('history-source-filter').selectOption('vu-demo-source-001');
  await page.getByTestId('history-min-score-filter').selectOption('5');
  await page.getByTestId('history-max-score-filter').selectOption('5');
  await page.getByTestId('history-category-TRANSITO').uncheck();
  await page.getByTestId('history-category-CONTINGENCIA').uncheck();
  const combinedResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/v1/history/occurrences' &&
      url.searchParams.get('municipality') === 'Nova Iguaçu' &&
      url.searchParams.get('type') === 'FURTO' &&
      url.searchParams.get('sourceId') === 'vu-demo-source-001' &&
      url.searchParams.get('situation') === 'ONGOING'
    );
  });
  await page.getByTestId('history-situation-filter').selectOption('ONGOING');
  const combined = await combinedResponse;
  expect(combined.status()).toBe(200);
  const combinedBody = await combined.json();
  expect(combinedBody.counts.occurrences).toBe(1);
  const combinedUrl = new URL(combined.url());
  expect(combinedUrl.searchParams.get('category')).toBe('SEGURANCA');
  expect(combinedUrl.searchParams.get('subtype')).toBe('FURTO:DE_OBJETOS_PESSOAIS');
  expect(combinedUrl.searchParams.get('neighborhood')).toBe('Centro');
  expect(combinedUrl.searchParams.get('minReliability')).toBe('5');
  expect(combinedUrl.searchParams.get('maxReliability')).toBe('5');
  expect(combinedUrl.searchParams.get('periodStart')).toBe('2020-10-12T09:00:00.000Z');
  expect(combinedUrl.searchParams.get('periodEnd')).toBe('2020-10-12T11:00:00.000Z');
  await expect(pageStatus).toHaveText('Página 1 de 1 · 1 registros');
  await expect(records).toHaveAttribute('data-history-record-id', `${fixturePrefix}combined-027`);

  await page.getByTestId('history-text-filter').fill('vu-history-e2e-no-results');
  await expect(page.getByTestId('history-empty')).toBeVisible();
  await expect(page.getByTestId('history-error')).toBeHidden();

  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(pageStatus).toHaveText('Página 1 de 2 · 33 registros');
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  expect(database).toBeTruthy();
  execFileSync('podman', ['pause', database!]);
  try {
    await page.getByTestId('history-refresh').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('history-loading')).toBeVisible();
    await expect(page.getByTestId('history-total')).toHaveText('Consultando histórico…');
    const failed = await page.waitForResponse(
      (response) => response.url().startsWith(`${endpoint}?`) && response.status() === 503,
      { timeout: 30_000 },
    );
    expect(failed.status()).toBe(503);
    await expect(page.getByTestId('history-error')).toBeVisible();
    await expect(page.getByTestId('history-total')).toHaveText('Total indisponível');
    await expect(page.getByTestId('history-empty')).toBeHidden();
  } finally {
    execFileSync('podman', ['unpause', database!]);
  }
  const retry = page.getByRole('button', { name: 'Tentar novamente' });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(pageStatus).toHaveText('Página 1 de 2 · 33 registros');
  await expect(page.getByTestId('history-error')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(records.first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
