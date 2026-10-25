import { expect, test } from '@playwright/test';
import { api } from './helpers/local-account';
import { fixtureSql, syntheticAdmin } from './helpers/synthetic-admin';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige HTTP/PostGIS sintéticos isolados.');
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15000 });
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;
function clipping(id: string, conflict = false): void {
  const draft = {
    title: `Efeito ${id}`,
    description: 'Interrupção sintética sustentada no original',
    category: 'CONTINGENCIA',
    type: 'ENERGIA',
    subtype: 'NAO_INFORMADO',
    situation: 'UNKNOWN',
    reliability: 3,
    municipality: 'Rio de Janeiro',
    neighborhood: 'Centro',
    locationPrecision: 'TERRITORY',
    occurredAt: '2026-10-15T12:00:00Z',
  };
  fixtureSql(
    `INSERT INTO clippings(id,source_id,title,reference,source_published_at,collected_at) VALUES(${quote(id)},'vu-demo-source-001',${quote(id)},${quote(`fixture:${id}`)},now(),now()); INSERT INTO clipping_reviews(clipping_id,original_text,extracted,priority,essential_conflict,queued_at) VALUES(${quote(id)},'Original sintético: interrupção no Centro',${quote(JSON.stringify(draft))}::jsonb,'HIGH',${conflict},now()-interval '2 hours');`,
  );
}
test('ADMIN revisa original, bloqueia núcleo/conflito, publica efeito relacionado, associa e mantém pendente', async ({
  page,
  request,
}) => {
  const id = `e2e-review17-${Date.now()}`;
  clipping(id, true);
  clipping(`${id}-associate`);
  clipping(`${id}-pending`);
  await syntheticAdmin(page, request);
  const sessionResponse = await page.request.get(`${api}/auth/session`);
  expect(sessionResponse.status()).toBe(200);
  const adminSession = await sessionResponse.json();
  expect(adminSession).toMatchObject({ role: 'ADMIN', authenticated: true });
  expect(adminSession.accountId).toMatch(/^[0-9a-f-]{36}$/);
  const adminId = quote(adminSession.accountId);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fontes', exact: true }).click();
  const queue = page.locator('app-review-queue');
  await expect(queue.getByRole('heading', { name: 'Revisão humana de clippings' })).toBeVisible();
  await expect(queue.getByText(/HIGH · espera/).first()).toBeVisible();
  await queue.getByRole('button', { name: `Revisar ${id}`, exact: true }).click();
  const editor = queue.getByRole('region', { name: 'Revisar clipping selecionado' });
  await expect(editor.getByText('Original sintético: interrupção no Centro')).toBeVisible();
  await editor
    .getByLabel('Justificativa da decisão')
    .fill('Original conferido com referência independente');
  await editor
    .getByLabel('Acontecimento existente para novo efeito')
    .selectOption('vu-demo-happening-001');
  await editor.getByRole('button', { name: 'Publicar novo efeito' }).click();
  await expect(queue.getByText(/Publicação recusada/)).toBeVisible();
  await editor
    .getByLabel('Resolução do conflito com evidência')
    .fill('Local e data conferidos na referência sintética');
  await editor.getByLabel('Data/hora UTC sustentada').fill('');
  await editor.getByRole('button', { name: 'Publicar novo efeito' }).click();
  await expect(queue.getByText(/Publicação recusada/)).toBeVisible();
  await editor.getByLabel('Data/hora UTC sustentada').fill('2026-10-15T12:00:00Z');
  await editor.getByRole('button', { name: 'Preparar outro efeito relacionado' }).click();
  await editor.getByLabel('Título factual').fill(`Árvore relacionada ${id}`);
  await editor
    .getByLabel('Descrição factual sustentada')
    .fill('Queda de árvore sintética no mesmo acontecimento');
  await editor.getByLabel('Tipo do catálogo').selectOption('ARVORE');
  await editor.getByLabel('Bairro (opcional, somente se sustentado)').fill('');
  await editor.getByRole('button', { name: 'Publicar novo efeito' }).focus();
  await page.keyboard.press('Enter');
  await expect(queue.getByText(/Decisão registrada com autoria/)).toBeVisible();
  const read = await page.request.get(
    'http://127.0.0.1:8080/api/v1/occurrences?periodStart=2026-10-14T00:00:00Z&periodEnd=2026-10-16T00:00:00Z',
  );
  expect(read.status()).toBe(200);
  const publicData = JSON.stringify(await read.json());
  expect(publicData).toContain(`Efeito ${id}`);
  expect(publicData).toContain(`Árvore relacionada ${id}`);
  await queue.getByRole('button', { name: `Revisar ${id}-associate`, exact: true }).click();
  await editor.getByLabel('Ocorrência existente').selectOption('vu-demo-occurrence-traffic-001');
  await editor
    .getByLabel('Justificativa da decisão')
    .fill('Mesmo fato, somente referência adicional');
  await editor.getByRole('button', { name: 'Associar referência à ocorrência' }).click();
  await expect(queue.getByText(/Decisão registrada com autoria/)).toBeVisible();
  expect(
    fixtureSql(
      `SELECT count(*) FROM clipping_review_decisions d JOIN occurrence_clippings c ON c.clipping_id=d.clipping_id WHERE d.clipping_id=${quote(`${id}-associate`)} AND d.action='ASSOCIATE' AND d.author_id=${adminId} AND c.occurrence_id='vu-demo-occurrence-traffic-001'`,
    ),
  ).toBe('1');
  await queue.getByRole('button', { name: `Revisar ${id}-pending`, exact: true }).click();
  await editor
    .getByLabel('Justificativa da decisão')
    .fill('Falta confirmação factual; não publicar');
  await editor.getByRole('button', { name: 'Manter pendente com motivo' }).click();
  await expect(queue.getByText('Pendente: Falta confirmação factual; não publicar')).toBeVisible();
  await queue.getByRole('button', { name: `Revisar ${id}-pending`, exact: true }).click();
  await editor.getByLabel('Justificativa da decisão').fill('Original demonstrado incompatível');
  await editor.getByRole('button', { name: 'Descartar com motivo' }).click();
  await expect(
    queue.getByRole('button', { name: `Revisar ${id}-pending`, exact: true }),
  ).toHaveCount(0);
  await page.route('**/api/v1/admin/review-clippings?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.abort();
  });
  await queue.getByRole('button', { name: 'Atualizar fila de revisão' }).click();
  await expect(queue.getByText('Carregando clippings…')).toBeVisible();
  await expect(queue.getByText(/Failed to fetch|NetworkError|Fila indisponível/)).toBeVisible();
  await page.unroute('**/api/v1/admin/review-clippings?**');
  await page.route('**/api/v1/admin/review-clippings?**', (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await queue.getByRole('button', { name: 'Atualizar fila de revisão' }).click();
  await expect(queue.getByText('Nenhum clipping pendente nesta fila.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
