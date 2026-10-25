import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { fixtureSql, syntheticDatabaseContainer } from './helpers/synthetic-admin';
import { api, testPassword } from './helpers/local-account';

test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige API Java e PostGIS locais reais.');
test.use({ actionTimeout: 15_000, trace: 'off', screenshot: 'off' });

const prefix = 'vu-export-e2e-';
const apiBase = process.env['VETOR_E2E_API_BASE'] ?? api;
const apiPort = new URL(apiBase).port || '80';
const reportExport = `${apiBase}/reports/occurrences/export`;
const period = 'periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z';

async function loginExportUser(request: APIRequestContext): Promise<void> {
  const email = `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  expect(
    (
      await request.post(`${apiBase}/accounts/registrations`, {
        data: { displayName: 'Pessoa sintética XLSX', email, password: testPassword },
      })
    ).status(),
  ).toBe(202);
  const mailboxPort = process.env['VETOR_E2E_MAILBOX_PORT'] ?? '8025';
  const mailbox = await request.get(`http://127.0.0.1:${mailboxPort}/messages`);
  const messages = (await mailbox.json()) as { recipient: string; token: string }[];
  const message = messages.findLast((item) => item.recipient === email);
  expect(message, 'A caixa local deve receber a confirmação sintética').toBeDefined();
  expect(
    (
      await request.post(`${apiBase}/accounts/confirmations`, {
        data: { token: message!.token },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(`${apiBase}/auth/login`, { data: { email, password: testPassword } })
    ).status(),
  ).toBe(200);
}

function executeDatabaseSql(sql: string): void {
  fixtureSql(sql);
}

function clearFixtures(): void {
  executeDatabaseSql(`
    DELETE FROM occurrence_clippings WHERE occurrence_id LIKE '${prefix}%';
    DELETE FROM clippings WHERE id LIKE '${prefix}%';
    DELETE FROM occurrences WHERE id LIKE '${prefix}%';
    DELETE FROM happenings WHERE id LIKE '${prefix}%';
  `);
}

function createFixtures(): void {
  clearFixtures();
  executeDatabaseSql(`
    INSERT INTO happenings (id, title, description)
    SELECT '${prefix}event-' || CASE WHEN series <= 3 THEN 'shared' ELSE lpad(series::text, 3, '0') END,
           'Acontecimento sintético', 'Acontecimento fictício para teste de XLSX.'
    FROM generate_series(1, 29) AS series
    WHERE series > 3;
    INSERT INTO happenings (id, title, description)
    VALUES ('${prefix}event-shared', 'Acontecimento compartilhado', 'Três efeitos sintéticos relacionados.');

    INSERT INTO occurrences (
      id, happening_id, title, description, category, occurrence_type, subtype,
      situation, reliability_score, municipality, neighborhood, location_precision,
      location, occurred_at, occurred_from, occurred_until, publication_status
    )
    SELECT '${prefix}record-' || lpad(series::text, 3, '0'),
           '${prefix}event-' || CASE WHEN series <= 3 THEN 'shared' ELSE lpad(series::text, 3, '0') END,
           CASE WHEN series = 29 THEN '=HYPERLINK("https://example.test")'
                ELSE 'Ocorrência sintética ' || lpad(series::text, 3, '0') END,
           'Dados fictícios para conferir exportação completa.',
           'TRANSITO', 'ACIDENTE', 'COLISAO', 'UNKNOWN', 3,
           'Rio de Janeiro', 'Centro',
           CASE WHEN series = 29 THEN 'TERRITORY' ELSE 'POINT' END,
           CASE WHEN series = 29 THEN NULL
                ELSE ST_SetSRID(ST_MakePoint(-43.19, -22.90), 4326)::geography END,
           TIMESTAMPTZ '2026-10-15T14:00:00Z' - series * INTERVAL '1 minute',
           NULL, NULL, 'PUBLISHED'
    FROM generate_series(1, 29) AS series;

    INSERT INTO clippings (id, source_id, title, source_published_at, collected_at)
    SELECT '${prefix}ref-' || occurrence.id,
           'vu-demo-source-001',
           'Referência sintética ' || occurrence.id,
           '2026-10-15T13:00:00Z', '2026-10-15T13:01:00Z'
    FROM occurrences AS occurrence
    WHERE occurrence.id LIKE '${prefix}%';
    INSERT INTO occurrence_clippings (occurrence_id, clipping_id)
    SELECT occurrence.id, '${prefix}ref-' || occurrence.id
    FROM occurrences AS occurrence
    WHERE occurrence.id LIKE '${prefix}%';
  `);
}

function readStoredZipEntries(data: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  let offset = 0;
  while (offset + 30 < data.length && data.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = data.readUInt32LE(offset + 18);
    const nameLength = data.readUInt16LE(offset + 26);
    const extraLength = data.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = data.toString('utf8', nameStart, nameStart + nameLength);
    const bodyStart = nameStart + nameLength + extraLength;
    entries.set(name, data.toString('utf8', bodyStart, bodyStart + compressedSize));
    offset = bodyStart + compressedSize;
  }
  return entries;
}

test.beforeAll(() => createFixtures());
test.afterAll(() => clearFixtures());

test.beforeEach(async ({ page }) => {
  await loginExportUser(page.request);
  const response = await page.request.get(`${apiBase}/reports/occurrences?${period}`);
  expect(response.status(), 'A consulta precisa atravessar a API Java e o PostGIS real').toBe(200);
  expect((await response.json()).counts.occurrences).toBe(33);
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('vetor-consultation-mode', 'advanced');
    localStorage.setItem('vu2.filtersCollapsed', 'true');
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  if (apiPort !== '8080') {
    await page.route('http://127.0.0.1:8080/**', async (route) => {
      const target = new URL(route.request().url());
      target.port = apiPort;
      await route.fallback({ url: target.toString() });
    });
  }
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
});

test('Chromium/Firefox exporta todo o recorte autenticado em XLSX acessível no celular', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  const exportButton = page.getByTestId('report-export-xlsx');
  await exportButton.focus();
  await expect(exportButton).toBeFocused();

  // Hold the genuine Java/PostGIS response until the transient state is observed.
  // A fixed delay (or an unheld response) races the local server on fast machines.
  let releaseResponse!: () => void;
  let markResponseReady!: () => void;
  const responseHeld = new Promise<void>((resolve) => (releaseResponse = resolve));
  const responseReady = new Promise<void>((resolve) => (markResponseReady = resolve));
  await page.route('**/api/v1/reports/occurrences/export**', async (route) => {
    const target = new URL(route.request().url());
    target.port = apiPort;
    const actualResponse = await route.fetch({ url: target.toString() });
    markResponseReady();
    await responseHeld;
    await route.fulfill({ response: actualResponse });
  });
  const exportResponse = page.waitForResponse(
    (response) =>
      response.url().startsWith(reportExport) ||
      response.url().startsWith('http://127.0.0.1:8080/api/v1/reports/occurrences/export'),
  );
  const downloadPromise = page.waitForEvent('download');
  try {
    await page.keyboard.press('Enter');
    await responseReady;
    await expect(exportButton).toBeDisabled();
    await expect(page.getByTestId('report-export-status')).toContainText('Preparando a planilha');
  } finally {
    releaseResponse();
  }
  const [response, download] = await Promise.all([exportResponse, downloadPromise]);
  expect(response.status()).toBe(200);
  const query = await response.json();
  expect(query.counts).toMatchObject({ occurrences: 33, happenings: 29 });
  expect(query.items).toHaveLength(33);
  expect(
    query.items.filter(
      (item: { happeningId: string }) => item.happeningId === `${prefix}event-shared`,
    ),
  ).toHaveLength(3);
  await expect(page.getByTestId('report-export-status')).toContainText(
    'exportação registrada no servidor',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const bytes = await readFile((await download.path())!);
  await download.saveAs(testInfo.outputPath(download.suggestedFilename()));
  const files = readStoredZipEntries(bytes);
  const workbook = files.get('xl/workbook.xml')!;
  const occurrences = files.get('xl/worksheets/sheet2.xml')!;
  const references = files.get('xl/worksheets/sheet3.xml')!;
  expect(workbook).toContain('name="Recorte"');
  expect(workbook).toContain('name="Ocorrências"');
  expect(workbook).toContain('name="Referências"');
  expect(occurrences.match(/<row r=/g)).toHaveLength(34);
  expect(references.match(/<row r=/g)?.length).toBeGreaterThanOrEqual(30);
  for (let index = 1; index <= 29; index += 1) {
    expect(occurrences).toContain(`${prefix}record-${String(index).padStart(3, '0')}`);
  }
  const territorialRow = occurrences
    .split(/<row r="\d+"[^>]*>/)
    .find((row) => row.includes(`${prefix}record-029`));
  expect(territorialRow).toBeDefined();
  expect(territorialRow).not.toContain('r="L');
  expect(territorialRow).not.toContain('r="M');
  expect(occurrences).toContain('=HYPERLINK(&quot;https://example.test&quot;)');
  expect(occurrences).not.toMatch(/<f(?:\s|>)/);
  expect(occurrences).toContain('Intervalo aproximado');
  expect(references).toContain(`${prefix}record-029`);
});

test('recorte vazio gera abas completas, cabeçalhos e totais zero', async ({ page }) => {
  const categories = page.locator('[data-quick-category]');
  const categoryCount = await categories.count();
  for (let index = 0; index < categoryCount; index += 1) {
    const category = categories.nth(index);
    if ((await category.getAttribute('aria-pressed')) === 'true') await category.click();
  }
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  await expect(page.locator('.query-counts')).toContainText('0 ocorrências');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await page.getByTestId('report-generate-from-map').click();
  await expect(page.getByTestId('report-empty')).toBeVisible();
  await expect(page.getByTestId('report-snapshot-counts')).toContainText('0 ocorrências');

  const exportResponse = page.waitForResponse(
    (response) =>
      response.url().startsWith(reportExport) ||
      response.url().startsWith('http://127.0.0.1:8080/api/v1/reports/occurrences/export'),
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('report-export-xlsx').click();
  const [response, download] = await Promise.all([exportResponse, downloadPromise]);
  expect(response.status()).toBe(200);
  const query = await response.json();
  expect(query.counts).toMatchObject({ occurrences: 0, happenings: 0 });
  expect(query.items).toHaveLength(0);
  const files = readStoredZipEntries(await readFile((await download.path())!));
  expect(files.get('xl/worksheets/sheet1.xml')).toContain('Total de ocorrências');
  expect(files.get('xl/worksheets/sheet1.xml')).toContain('<v>0</v>');
  expect(files.get('xl/worksheets/sheet2.xml')?.match(/<row r=/g)).toHaveLength(1);
  expect(files.get('xl/worksheets/sheet3.xml')?.match(/<row r=/g)).toHaveLength(1);
});

test('conteúdo que excede o XLSX falha sem iniciar um download', async ({ page }) => {
  executeDatabaseSql(`
    UPDATE occurrences SET description = repeat('x', 32768)
    WHERE id = '${prefix}record-029';
  `);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  let downloadStarted = false;
  page.on('download', () => {
    downloadStarted = true;
  });
  const exportButton = page.getByTestId('report-export-xlsx');
  await exportButton.click();
  await expect(page.getByTestId('report-export-status')).toContainText('32.767 caracteres');
  await expect(exportButton).toBeEnabled();
  await expect(page.locator('.report-snapshot-card')).toHaveAttribute('aria-busy', 'false');
  await page.waitForTimeout(200);
  expect(downloadStarted).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('falha do PostGIS durante a exportação não baixa arquivo vazio ou parcial', async ({
  page,
}) => {
  const database = syntheticDatabaseContainer();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await page.getByTestId('report-generate-from-map').click();
  await expect(page.getByTestId('report-snapshot-counts')).toContainText('33 ocorrências');
  let downloadStarted = false;
  page.on('download', () => {
    downloadStarted = true;
  });
  execFileSync('podman', ['pause', database!]);
  try {
    const response = page.waitForResponse(
      (item) =>
        (item.url().startsWith(reportExport) ||
          item.url().startsWith('http://127.0.0.1:8080/api/v1/reports/occurrences/export')) &&
        item.status() === 503,
      { timeout: 30_000 },
    );
    const exportButton = page.getByTestId('report-export-xlsx');
    await exportButton.click();
    await response;
    await expect(page.getByTestId('report-export-status')).toContainText(
      'indisponível. Tente carregar novamente.',
    );
    await expect(exportButton).toBeEnabled();
    await page.waitForTimeout(200);
    expect(downloadStarted).toBe(false);
  } finally {
    execFileSync('podman', ['unpause', database!]);
  }
});
