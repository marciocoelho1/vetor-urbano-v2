import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type Locator } from '@playwright/test';
import { api, loginUser } from './helpers/local-account';
import { fixtureSql, syntheticAdmin } from './helpers/synthetic-admin';

// Opt-in, real API/PostGIS, serialized across Chromium and Firefox. The parent owns service
// readiness and fixture scheduling. Never pause/reset the shared database in this suite.
test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API/PostGIS sintéticos reais.');
test.use({ actionTimeout: 15_000, trace: 'off', screenshot: 'off' });

const occurrenceUrl = `${api}/occurrences`;
const period = 'periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z';
const isProbe = (url: string) => {
  const target = new URL(url);
  return (
    target.pathname === '/api/v1/occurrences' && target.searchParams.get('checkUpdates') === 'true'
  );
};

async function openConsultation(page: Page) {
  await loginUser(page.request);
  await page.clock.install();
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('vetor-consultation-mode', 'advanced');
    localStorage.setItem('vu2.filtersCollapsed', 'true');
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>',
    }),
  );
  const initial = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/occurrences' && !isProbe(response.url()),
  );
  await page.goto('/?consulta=api');
  expect((await initial).status()).toBe(200);
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  await expect(page.getByTestId('query-error-banner')).toBeHidden();
  await expect(page.getByTestId('query-timestamp')).not.toBeEmpty();
}

async function filterText(page: Page, text: string) {
  await page.getByTestId('filter-panel-toggle').click();
  await page.getByTestId('advanced-text-filter').fill(text);
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
}

/** Advance only the consultation's browser timer; no simulated publication or data response. */
async function probe(page: Page) {
  const response = page.waitForResponse((item) => isProbe(item.url()));
  await page.clock.fastForward(61_000);
  return response;
}

async function correctionItem(admin: Page, explanation: string, target: string): Promise<Locator> {
  await admin.locator('#corrections-link').click();
  const channel = admin.locator('app-correction-channel');
  await channel.getByRole('button', { name: 'Fila administrativa de correções' }).click();
  const item = channel.locator('li').filter({ hasText: explanation }).last();
  await item.getByLabel('Motivo visível ao solicitante').fill('Conferência sintética 35 iniciada');
  await item.getByRole('button', { name: 'Iniciar análise' }).click();
  await expect(item.getByText(/Em análise/)).toBeVisible();
  await item.getByRole('button', { name: `Abrir edição da publicação ${target}` }).click();
  await expect(item.getByLabel('Ação sobre o registro')).toBeVisible();
  return item;
}

async function applyPublication(admin: Page, item: Locator, retraction: boolean, title: string) {
  await item
    .getByLabel('Ação sobre o registro')
    .selectOption(retraction ? 'RETRACTION' : 'CORRECTION');
  if (retraction) {
    await item.getByLabel('Razão essencial da retirada').selectOption('FATO_INCORRETO');
  } else {
    await item.getByLabel('Título corrigido').fill(title);
  }
  await item.getByLabel('Motivo da preparação').fill('Conferência de fato sintético 35');
  await item
    .getByLabel('Evidência da conferência')
    .fill('Duas referências sintéticas independentes');
  await item.getByRole('button', { name: 'Preparar alteração sem publicar' }).click();
  await expect(item.getByText(/Preparação: PREPARED/)).toBeVisible();
  await item.getByLabel('Motivo da decisão final').fill('Decisão administrativa sintética 35');
  await item.getByRole('button', { name: 'Aprovar e aplicar nova versão' }).focus();
  await admin.keyboard.press('Enter');
  await expect(item.getByText(/Concluída/)).toBeVisible();
}

async function requestCorrection(page: Page, target: string, explanation: string) {
  const session = await page.request.get(`${api}/auth/session`);
  expect(session.status()).toBe(200);
  const { csrfToken } = await session.json();
  expect(csrfToken).toEqual(expect.any(String));
  const response = await page.request.post(`${api}/corrections`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: {
      targetKind: 'OCCURRENCE',
      problemType: 'LOCAL',
      targetId: target,
      explanation,
      references: 'Referências privadas sintéticas 35',
    },
  });
  expect(response.status()).toBe(201);
}

test('duas sessões: ADMIN corrige/retira; aviso deduplicado, contexto e PDF anterior preservados', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const target = `vu-update35-${testInfo.project.name}-${Date.now()}`;
  const title = `Consulta35-${testInfo.project.name}-${Date.now()}`;
  // Only this test's unique synthetic row is inserted. No existing publication is reset.
  fixtureSql(`INSERT INTO occurrences (id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,occurred_from,occurred_until,publication_status)
    SELECT '${target}',happening_id,'${title}',description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,occurred_from,occurred_until,'PUBLISHED'
    FROM occurrences WHERE id='vu-demo-occurrence-traffic-001'`);
  await openConsultation(page);
  await filterText(page, title);
  await expect(page.locator('.result-list > li')).toHaveCount(1);
  await page.getByTestId('filter-panel-toggle').click();
  await page.getByRole('checkbox', { name: 'Filtrar por raio' }).check();
  await page.getByText('Definir centro por coordenadas', { exact: true }).click();
  const coordinates = page.locator('.map-radius-coordinates');
  await coordinates.getByLabel('Longitude', { exact: true }).fill('-43.1915');
  await coordinates.getByLabel('Latitude', { exact: true }).fill('-22.9033');
  await expect(page.locator('.result-list > li')).toHaveCount(1);
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await page.locator('#map-canvas').focus();
  await page.keyboard.press('ArrowRight');
  await page.clock.fastForward(1000);
  await page.locator('#map-canvas').focus();
  await page.keyboard.press('+');
  await page.clock.fastForward(1000);
  // fastForward advances JS timers, not the browser's CSS transition compositor.
  // Require the final public Leaflet projection before recording the exact oracle.
  await expect(page.locator('#map-canvas')).not.toHaveClass(/leaflet-zoom-anim/);
  await expect(page.locator('#map-canvas .leaflet-overlay-pane canvas')).not.toHaveAttribute(
    'style',
    /scale\(/,
  );
  // Public rendered map projection, not Angular internals, is the camera oracle.
  // The map pane transform is owned by Leaflet's CSS animation; read it only once it stops
  // changing, otherwise a valid end state can be replaced by a later intermediate frame.
  const readPaneTransform = () =>
    page
      .locator('#map-canvas .leaflet-map-pane')
      .evaluate((node: HTMLElement) => node.style.cssText);
  let paneSettled = await readPaneTransform();
  await expect
    .poll(async () => {
      const next = await readPaneTransform();
      const stable = next === paneSettled && next.length > 0;
      paneSettled = next;
      return stable;
    })
    .toBe(true);
  const camera = paneSettled;
  const radiusProjection = await page.locator('#map-canvas .leaflet-overlay-pane').innerHTML();
  const queryTime = await page.getByTestId('query-timestamp').textContent();
  const baseline = await page.request.get(`${occurrenceUrl}?${period}&text=${title}`);
  expect(baseline.status()).toBe(200);
  const originalRevision = (await baseline.json()).revision;
  expect(originalRevision).toEqual(expect.any(String));

  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await page.getByTestId('report-generate-from-map').click();
  await expect(page.getByTestId('report-snapshot-counts')).toContainText('1 ocorrências');
  const generatedAt = await page.getByTestId('report-generated-at').textContent();
  const snapshotText = await page.locator('.report-snapshot-list').innerText();
  const registration = page.waitForRequest(
    (request) =>
      request.url().includes('/reports/exports/pdf') &&
      request.postDataJSON()?.outcome === 'SUCCEEDED',
  );
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
  const registrationBody = (await registration).postDataJSON();
  expect(registrationBody.snapshotOccurrenceIds).toContain(target);
  expect(registrationBody.generatedAt).toEqual(expect.any(String));
  const pdfPath = testInfo.outputPath('before-correction.pdf');
  await (await downloaded).saveAs(pdfPath);
  const originalBytes = await readFile(pdfPath);
  expect(originalBytes.subarray(0, 5).toString()).toBe('%PDF-');
  const originalPdfText = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
  expect(originalPdfText).toContain(title);
  await page.getByRole('button', { name: 'Mapa de ocorrências', exact: true }).click();

  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const admin = await context.newPage();
    await syntheticAdmin(admin, context.request);
    const explanation = `Corrigir ${target}`;
    await requestCorrection(page, target, explanation);
    const item = await correctionItem(admin, explanation, target);
    await applyPublication(admin, item, false, `${title} corrigido`);
    const persisted = await page.request.get(`${occurrenceUrl}?${period}&text=${title}`);
    expect(persisted.status()).toBe(200);
    expect((await persisted.json()).revision).not.toBe(originalRevision);
    const checked = await probe(page);
    expect(checked.status()).toBe(200);
    const checkBody = await checked.json();
    expect(Object.keys(checkBody).sort()).toEqual(['checkedAt', 'revision']);
    expect(checked.headers()['cache-control']).toContain('no-store');
    expect(new URL(checked.url()).searchParams.get('text')).toBe(title);
    expect(new URL(checked.url()).searchParams.get('radiusMeters')).toBeTruthy();
    await expect(page.getByTestId('query-update-notice')).toBeVisible();
    await expect(page.getByTestId('query-update-notice')).toHaveCount(1);
    expect(await page.getByTestId('query-timestamp').textContent()).toBe(queryTime);
    await expect(
      page
        .locator('.result-list > li')
        .filter({ has: page.locator(`[data-result-detail-toggle="${target}"]`) }),
    ).not.toContainText('corrigido');
    const apply = page.getByTestId('apply-query-update-btn');
    await apply.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('query-update-notice')).toBeHidden();
    await expect(
      page
        .locator('.result-list > li')
        .filter({ has: page.locator(`[data-result-detail-toggle="${target}"]`) }),
    ).toContainText('corrigido');
    await expect(coordinates.getByLabel('Longitude', { exact: true })).toHaveValue('-43.1915');
    await expect(coordinates.getByLabel('Latitude', { exact: true })).toHaveValue('-22.9033');
    // A single read could still catch the compositor mid-animation; require the settled pane.
    await expect
      .poll(async () => (await readPaneTransform()) === camera, { timeout: 10_000 })
      .toBe(true);
    expect(await page.locator('#map-canvas .leaflet-overlay-pane').innerHTML()).toBe(
      radiusProjection,
    );
    await page.getByTestId('filter-panel-toggle').click();
    await expect(page.getByTestId('advanced-text-filter')).toHaveValue(title);
    await page.getByTestId('filter-panel-toggle').click();
    expect((await probe(page)).status()).toBe(200);
    await expect(page.getByTestId('query-update-notice')).toBeHidden();

    const retraction = `Retirar ${target}`;
    await requestCorrection(page, target, retraction);
    await admin.getByRole('button', { name: 'Mapa de ocorrências', exact: true }).click();
    await applyPublication(admin, await correctionItem(admin, retraction, target), true, title);
    expect((await probe(page)).status()).toBe(200);
    await expect(page.getByTestId('query-update-notice')).toBeVisible();
    await page.getByRole('button', { name: 'Dispensar aviso de atualização' }).click();
    expect((await probe(page)).status()).toBe(200);
    await expect(page.getByTestId('query-update-notice')).toBeHidden();
    const detail = await page.request.get(`${occurrenceUrl}/${target}`);
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toMatchObject({ status: 'UNAVAILABLE' });
    expect(await detail.text()).not.toContain(title);

    await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
    expect(await page.getByTestId('report-generated-at').textContent()).toBe(generatedAt);
    expect(await page.locator('.report-snapshot-list').innerText()).toBe(snapshotText);
    let downloads = 0;
    page.on('download', () => downloads++);
    // Read the body at the real HTTP boundary: Chromium leaves this unread fetch
    // error stream pending when the application rejects on status alone.
    let captureRefusal!: (body: unknown) => void;
    const refusalBody = new Promise<unknown>((resolve) => (captureRefusal = resolve));
    await page.route('**/api/v1/reports/exports/pdf?*', async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(409);
      captureRefusal(await response.json());
      await route.fulfill({ response });
    });
    const refused = page.waitForResponse(
      (response) => response.url().includes('/reports/exports/pdf') && response.status() === 409,
    );
    await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    expect((await refused).status()).toBe(409);
    expect(await refusalBody).toMatchObject({ code: 'SNAPSHOT_UNAVAILABLE' });
    await page.unroute('**/api/v1/reports/exports/pdf?*');
    await expect(page.getByTestId('report-pdf-status')).toHaveAttribute('role', 'alert');
    expect(downloads).toBe(0);
    expect(await page.getByTestId('report-generated-at').textContent()).toBe(generatedAt);
    expect(await page.locator('.report-snapshot-list').innerText()).toBe(snapshotText);
    expect(await readFile(pdfPath)).toEqual(originalBytes);
    await page.getByRole('button', { name: 'Mapa de ocorrências', exact: true }).click();
    await page.getByTestId('refresh-query-btn').click();
    await expect(
      page
        .locator('.result-list > li')
        .filter({ has: page.locator(`[data-result-detail-toggle="${target}"]`) }),
    ).toHaveCount(0);
    await expect(page.getByTestId('consultation-empty')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /^Lista/ }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});

test('sondagem sem novidade, falha e vazio são distintos; falha preserva consulta e horário em 390px', async ({
  page,
}) => {
  await openConsultation(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/v1/occurrences?*', async (route) => {
    await gate;
    await route.continue();
  });
  const refresh = page.getByTestId('refresh-query-btn');
  await refresh.focus();
  await expect(refresh).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('query-loading-banner')).toBeVisible();
  await expect(page.getByTestId('query-loading-banner')).toHaveAttribute('role', 'status');
  release();
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  await expect(refresh).toBeFocused();
  await page.unroute('**/api/v1/occurrences?*');
  await page.setViewportSize({ width: 390, height: 844 });
  // Mobile collapses the native quick-filter details. Open its public control
  // before targeting the refresh button; focusing a closed details child is a no-op.
  const quickFilters = page.locator('details').filter({ has: refresh });
  await quickFilters.locator('summary').click();
  await expect(quickFilters).toHaveAttribute('open', '');
  let releaseMobile!: () => void;
  const mobileGate = new Promise<void>((resolve) => (releaseMobile = resolve));
  await page.route('**/api/v1/occurrences?*', async (route) => {
    await mobileGate;
    await route.continue();
  });
  await refresh.focus();
  await expect(refresh).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /^Lista/ }).click();
  await expect(page.getByTestId('query-loading-banner')).toBeVisible();
  await expect(page.getByTestId('query-loading-banner')).toHaveAttribute('role', 'status');
  releaseMobile();
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  await page.unroute('**/api/v1/occurrences?*');
  const count = await page.getByTestId('event-count').textContent();
  const timestamp = await page.getByTestId('query-timestamp').textContent();
  expect(Number(count)).toBeGreaterThan(0);
  expect((await probe(page)).status()).toBe(200);
  await expect(page.getByTestId('query-update-notice')).toBeHidden();
  await expect(page.getByTestId('query-update-error')).toBeHidden();
  // Fault injection is transport-only, after a genuine persisted consultation and probe.
  // It does not stand in for the real two-session publication journey above.
  await page.route('**/api/v1/occurrences?*', async (route) => {
    if (isProbe(route.request().url())) return route.abort('failed');
    await route.continue();
  });
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId('query-update-error')).toBeVisible();
  await expect(page.getByTestId('consultation-empty')).toBeHidden();
  await expect(page.getByTestId('event-count')).toHaveText(count!);
  expect(await page.getByTestId('query-timestamp').textContent()).toBe(timestamp);
  await page.unroute('**/api/v1/occurrences?*');
  expect((await probe(page)).status()).toBe(200);
  await expect(page.getByTestId('query-update-error')).toBeHidden();
  await page.getByRole('button', { name: /^Mapa$/ }).click();
  await filterText(page, 'nenhum-resultado-sintetico-ticket35');
  await page.getByRole('button', { name: /^Lista/ }).click();
  await expect(page.getByTestId('consultation-empty')).toBeVisible();
  expect((await probe(page)).status()).toBe(200);
  await expect(page.getByTestId('query-update-error')).toBeHidden();
  await expect(page.getByTestId('query-update-notice')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('servidor exige sessão para sondar e ADMIN para alterar publicação', async ({
  playwright,
  page,
}) => {
  const anonymous = await playwright.request.newContext();
  try {
    expect((await anonymous.get(`${occurrenceUrl}?${period}&checkUpdates=true`)).status()).toBe(
      401,
    );
  } finally {
    await anonymous.dispose();
  }
  await loginUser(page.request);
  expect((await page.request.get(`${occurrenceUrl}?${period}&checkUpdates=true`)).status()).toBe(
    200,
  );
  expect(
    (
      await page.request.get(
        `${api}/admin/corrections/00000000-0000-0000-0000-000000000035/publication`,
      )
    ).status(),
  ).toBe(403);
});
