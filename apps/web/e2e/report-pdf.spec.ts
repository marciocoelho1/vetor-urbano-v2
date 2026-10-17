import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { api, loginUser } from './helpers/local-account';

test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige Java e PostGIS sintéticos reais.');
test.use({ actionTimeout: 10_000, trace: 'off', screenshot: 'off' });
const period = 'periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z';
const extraId = 'vu-pdf34-new';
const emojiId = 'vu-pdf34-emoji';
const downloadButton = (page: Page) =>
  page.getByRole('button', { name: 'Baixar PDF', exact: true });

function sql(command: string): string {
  const container = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  if (!container) throw new Error('Informe o banco sintético exclusivo.');
  return execFileSync(
    'podman',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-q',
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'vetor_urbano',
    ],
    { input: command, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
}

/** Último evento REPORT_PDF_EXPORT gravado, como "classe resultado parâmetros". */
function latestPdfAudit(): string {
  return sql(
    `SELECT event_class || ' ' || outcome || ' ' || parameters::text FROM auth_audit_events WHERE action='REPORT_PDF_EXPORT' ORDER BY occurred_at DESC, id DESC LIMIT 1;`,
  ).trim();
}

function pdfText(path: string, page?: number): string {
  const range = page ? ['-f', String(page), '-l', String(page)] : [];
  return execFileSync('pdftotext', [...range, '-layout', path, '-'], { encoding: 'utf8' });
}

function pdfPageCount(path: string): number {
  const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
  const pages = /^Pages:\s+(\d+)$/m.exec(info);
  if (!pages) throw new Error('pdfinfo não informou a paginação do PDF gerado.');
  return Number(pages[1]);
}

async function renderPages(path: string, directory: string, prefix: string): Promise<string[]> {
  execFileSync('pdftoppm', ['-r', '90', '-png', path, join(directory, prefix)]);
  const rendered = await readdir(directory);
  return rendered.filter((name) => name.startsWith(`${prefix}-`) && name.endsWith('.png')).sort();
}

async function generateReportFromMap(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await page.getByTestId('report-generate-from-map').click();
}

test.beforeEach(async ({ page }) => {
  await loginUser(page.request);
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('vetor-consultation-mode', 'advanced');
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
});

test.afterAll(() => {
  sql(`DELETE FROM occurrences WHERE id IN ('${extraId}', '${emojiId}');`);
});

test('PDF A4 do snapshot completo preserva momento após publicação nova, com teclado e móvel', async ({
  page,
}, testInfo) => {
  await generateReportFromMap(page);
  await expect(page.getByTestId('report-snapshot-counts')).toContainText('4 ocorrências');
  await page.setViewportSize({ width: 390, height: 844 });
  const button = downloadButton(page);
  await button.focus();
  await expect(button).toBeFocused();
  const firstDownload = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('report-pdf-status')).toContainText('Preparando PDF');
  const first = await firstDownload;
  const firstPath = testInfo.outputPath('snapshot-before.pdf');
  await first.saveAs(firstPath);
  expect((await readFile(firstPath)).subarray(0, 5).toString()).toBe('%PDF-');
  const originalText = pdfText(firstPath);
  expect(originalText).toContain('4 ocorrências');
  expect(originalText).toContain('2 acontecimentos');
  expect(originalText).toContain('America/Sao_Paulo');
  expect(originalText).toContain('2026-10-14T15:00:00.000Z');
  expect(originalText).toContain('2026-10-15T15:00:00.000Z');
  expect(originalText).toContain('Cobertura não aferida');
  expect(originalText).toContain('Precisão territorial');
  expect(originalText).toContain('Fontes');
  expect(originalText).toContain('Fonte demonstrativa A');
  expect(originalText).toContain('certamente');
  expect(originalText).not.toMatch(/ratingJustification|password|mfa_secret/);
  // Todas as partes do recorte, com cabeçalho próprio e paginação coerente por página.
  const pages = pdfPageCount(firstPath);
  expect(pages).toBeGreaterThan(1);
  for (let index = 1; index <= pages; index += 1) {
    const pageText = pdfText(firstPath, index);
    expect(pageText).toContain('Vetor Urbano');
    expect(pageText).toContain(`Página ${index} de ${pages}`);
  }
  expect(pdfText(firstPath, pages)).toContain('Limitações');
  const rendered = await renderPages(firstPath, testInfo.outputDir, 'pagina');
  expect(rendered).toHaveLength(pages);
  for (const name of rendered)
    expect((await readFile(join(testInfo.outputDir, name))).byteLength).toBeGreaterThan(4_000);
  // A exportação é registrada no servidor como uso, com parâmetros minimizados.
  const audit = latestPdfAudit();
  expect(audit).toContain('USE SUCCEEDED');
  expect(audit).toContain('CLIENT_SNAPSHOT');
  expect(audit).toContain('"format": "PDF"');
  expect(audit).toContain('"occurrences": 4');
  expect(audit).not.toMatch(/textQuery|longitude|latitude|radiusMeters|NAO_GUARDAR/);
  const id = `${extraId}-${testInfo.project.name}`;
  sql(
    `DELETE FROM occurrences WHERE id='${id}'; INSERT INTO occurrences (id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,occurred_from,occurred_until,publication_status) SELECT '${id}',happening_id,'Fato fictício posterior ao PDF',description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,occurred_from,occurred_until,publication_status FROM occurrences WHERE id='vu-demo-occurrence-traffic-001';`,
  );
  try {
    expect(
      (await (await page.request.get(`${api}/reports/occurrences?${period}`)).json()).counts
        .occurrences,
    ).toBe(5);
    const secondDownload = page.waitForEvent('download');
    await button.click();
    const second = await secondDownload;
    const secondPath = testInfo.outputPath('snapshot-after.pdf');
    await second.saveAs(secondPath);
    expect(pdfText(secondPath)).toBe(originalText);
    expect(pdfPageCount(secondPath)).toBe(pages);
    await expect(page.getByTestId('report-pdf-status')).toContainText('registrada no servidor');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    sql(`DELETE FROM occurrences WHERE id='${id}';`);
  }
});

test('recorte vazio gera PDF explícito, válido e auditado com totais zero', async ({
  page,
}, testInfo) => {
  const categories = page.locator('[data-quick-category]');
  const categoryCount = await categories.count();
  for (let index = 0; index < categoryCount; index += 1) {
    const category = categories.nth(index);
    if ((await category.getAttribute('aria-pressed')) === 'true') await category.click();
  }
  await expect(page.locator('.query-counts')).toContainText('0 ocorrências');
  await generateReportFromMap(page);
  await expect(page.getByTestId('report-empty')).toBeVisible();
  await expect(page.getByTestId('report-snapshot-counts')).toContainText('0 ocorrências');
  await page.setViewportSize({ width: 390, height: 844 });
  const download = page.waitForEvent('download');
  await downloadButton(page).click();
  const file = await download;
  const path = testInfo.outputPath('snapshot-empty.pdf');
  await file.saveAs(path);
  expect((await readFile(path)).subarray(0, 5).toString()).toBe('%PDF-');
  const text = pdfText(path);
  expect(text).toContain('0 ocorrências');
  expect(text).toContain('0 acontecimentos');
  expect(text).toContain('Recorte vazio');
  expect(text).toContain('não comprova ausência de fatos');
  expect(text).toContain('Cobertura não aferida');
  expect(text).toContain('Fontes');
  const pages = pdfPageCount(path);
  for (let index = 1; index <= pages; index += 1)
    expect(pdfText(path, index)).toContain(`Página ${index} de ${pages}`);
  await expect(page.getByTestId('report-pdf-status')).toContainText('registrada no servidor');
  const audit = latestPdfAudit();
  expect(audit).toContain('USE SUCCEEDED');
  expect(audit).toContain('"occurrences": 0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('falha de renderização é visível, não baixa arquivo e registra a tentativa', async ({
  page,
}) => {
  await generateReportFromMap(page);
  await expect(page.getByTestId('report-snapshot-counts')).toContainText('4 ocorrências');
  await page.route('**/fonts/manrope-pdf-regular.ttf', (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  let downloaded = false;
  page.on('download', () => {
    downloaded = true;
  });
  const button = downloadButton(page);
  await button.click();
  const status = page.getByTestId('report-pdf-status');
  await expect(status).toContainText('Não foi possível gerar o PDF');
  await expect(status).toContainText('fonte local do PDF está indisponível');
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(button).toBeEnabled();
  await expect(page.locator('.report-snapshot-card')).toHaveAttribute('aria-busy', 'false');
  await page.waitForTimeout(200);
  expect(downloaded).toBe(false);
  expect(latestPdfAudit()).toContain('USE FAILED');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('texto fora da fonte do PDF falha visivelmente sem arquivo parcial', async ({ page }) => {
  sql(
    `DELETE FROM occurrences WHERE id='${emojiId}'; INSERT INTO occurrences (id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,occurred_from,occurred_until,publication_status) SELECT '${emojiId}',happening_id,'Fato com emoji fictício',description,category,occurrence_type,subtype,situation,reliability_score,'Município 🌧 fictício',neighborhood,location_precision,location,occurred_at,occurred_from,occurred_until,publication_status FROM occurrences WHERE id='vu-demo-occurrence-traffic-001';`,
  );
  try {
    await generateReportFromMap(page);
    await expect(page.getByTestId('report-snapshot-counts')).toContainText('5 ocorrências');
    await page.setViewportSize({ width: 390, height: 844 });
    let downloaded = false;
    page.on('download', () => {
      downloaded = true;
    });
    const button = downloadButton(page);
    await button.click();
    const status = page.getByTestId('report-pdf-status');
    await expect(status).toContainText('caracteres que a fonte do PDF não representa');
    await expect(status).toContainText('Nenhum arquivo foi baixado');
    await expect(button).toBeEnabled();
    await page.waitForTimeout(200);
    expect(downloaded).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    sql(`DELETE FROM occurrences WHERE id='${emojiId}';`);
  }
});
