import { expect, test, type Page } from '@playwright/test';
import { fixtureSql, syntheticAdmin, syntheticDatabaseContainer } from './helpers/synthetic-admin';

test.skip(
  process.env['VETOR_ACCOUNTS_E2E'] !== '1',
  'Exige API em 127.0.0.1:8080, caixa em 8025 e PostGIS sintético isolado.',
);
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 20_000 });

/**
 * Ticket 22 — painel de operação (leitura administrativa do estado da coleta e da fila).
 *
 * Fixtures exclusivas desta spec no contêiner sintético autorizado: fonte `fogo-cruzado`, uma
 * execução `FAILED`, um clipping pendente de revisão e uma confirmação de andamento vencendo
 * dentro da antecedência configurada (`vetor.operations.expiry-window=24h` no repositório).
 * A falha de alimentação precisa aparecer como falha — nunca como zero ocorrências — e a fila
 * vazia precisa aparecer como vazia, não como serviço saudável.
 */
const CONTAINER = 'vu-ticket29-e2e-db';
const SOURCE_ID = 'fogo-cruzado';
const CLIPPING_ID = 'vu22-e2e-clipping';
const OCCURRENCE_ID = 'vu22-e2e-expiring';

const panel = (page: Page) => page.locator('section[aria-labelledby="operations-heading"]');

function resetFixture(): void {
  fixtureSql(
    `
    -- Fixture isolada: somente esta sessão psql roda sem os gatilhos de imutabilidade do histórico.
    SET session_replication_role = replica;
    DELETE FROM collection_items WHERE source_id='${SOURCE_ID}';
    DELETE FROM collection_run_events WHERE source_id='${SOURCE_ID}';
    DELETE FROM collection_runs WHERE source_id='${SOURCE_ID}';
    DELETE FROM collection_sources WHERE source_id='${SOURCE_ID}';
    DELETE FROM clipping_review_decisions WHERE clipping_id='${CLIPPING_ID}';
    DELETE FROM clipping_reviews WHERE clipping_id='${CLIPPING_ID}';
    DELETE FROM occurrence_clippings WHERE clipping_id='${CLIPPING_ID}';
    DELETE FROM clippings WHERE id='${CLIPPING_ID}';
    DELETE FROM occurrence_verifications WHERE occurrence_id='${OCCURRENCE_ID}';
    DELETE FROM occurrence_clippings WHERE occurrence_id='${OCCURRENCE_ID}';
    DELETE FROM publication_versions WHERE occurrence_id='${OCCURRENCE_ID}';
    DELETE FROM occurrences WHERE id='${OCCURRENCE_ID}';
    DELETE FROM sources WHERE id='${SOURCE_ID}';
    SET session_replication_role = origin;
  `,
    CONTAINER,
  );
}

/** Só o necessário para o painel: fonte com falha, item pendente e confirmação vencendo. */
function seedFailingFeed(): void {
  fixtureSql(
    `
    INSERT INTO sources (id, public_name, provenance)
      VALUES ('${SOURCE_ID}', 'Fogo Cruzado (API v2)',
              '{"credit":"Instituto Fogo Cruzado","attribution":"Fonte: Instituto Fogo Cruzado"}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET provenance=EXCLUDED.provenance;
    INSERT INTO collection_sources (source_id, window_start, poll_seconds, page_size, max_pages, paused,
        last_attempt_at, last_error_class, created_at, updated_at)
      VALUES ('${SOURCE_ID}', DATE '2026-06-01', 86400, 100, 20, false,
              now() - interval '5 minutes', 'RATE_LIMITED', now(), now())
      ON CONFLICT (source_id) DO UPDATE SET last_attempt_at=EXCLUDED.last_attempt_at,
        last_error_class=EXCLUDED.last_error_class, last_success_at=NULL, paused=false;
    INSERT INTO collection_runs (id, source_id, kind, window_start, window_end, next_page, take, max_pages,
        pages_done, items_seen, items_created, items_duplicated, state, error_class, started_at, finished_at, updated_at)
      VALUES (gen_random_uuid(), '${SOURCE_ID}', 'RECENT', DATE '2026-06-01', DATE '2026-10-22', 1, 100, 20,
              1, 0, 0, 0, 'FAILED', 'RATE_LIMITED', now() - interval '6 minutes',
              now() - interval '5 minutes', now());
    INSERT INTO clippings (id, source_id, title, reference, source_published_at, collected_at)
      VALUES ('${CLIPPING_ID}', '${SOURCE_ID}', 'Publicação sintética 22', 'vu22:e2e',
              now() - interval '2 hours', now() - interval '2 hours')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO clipping_reviews (clipping_id, original_text, extracted, priority, state, queued_at)
      VALUES ('${CLIPPING_ID}', 'Texto sintético 22', '{}'::jsonb, 'HIGH', 'PENDING',
              now() - interval '2 hours')
      ON CONFLICT (clipping_id) DO NOTHING;
    INSERT INTO happenings (id, title, description)
      VALUES ('vu22-e2e-happening', 'Acontecimento 22', 'Contexto sintético do painel.')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO occurrences (id, happening_id, title, description, category, occurrence_type, subtype,
        situation, reliability_score, municipality, neighborhood, location_precision, location,
        occurred_at, publication_status, revision)
      VALUES ('${OCCURRENCE_ID}', 'vu22-e2e-happening', 'Ocorrência sintética 22',
              'Fato sintético para o painel de operação.', 'SEGURANCA', 'INTERDICAO', 'NAO_INFORMADO',
              'ONGOING', 3, 'Rio de Janeiro', 'Centro', 'POINT',
              ST_SetSRID(ST_MakePoint(-43.19, -22.90), 4326)::GEOGRAPHY,
              now() - interval '1 day', 'PUBLISHED', 1)
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO occurrence_verifications (occurrence_id, verification_version, effect_version,
        previous_situation, situation, evidence, confirmed_at, recorded_at, expires_at, author_id, actor_role)
      SELECT '${OCCURRENCE_ID}', 1, 1, 'ONGOING', 'ONGOING', 'Evidência sintética do teste 22',
             now() - interval '1 hour', now() - interval '1 hour', now() + interval '2 hours',
             id, 'ADMIN'
        FROM local_accounts WHERE role='ADMIN' ORDER BY created_at LIMIT 1
      ON CONFLICT (occurrence_id, verification_version) DO NOTHING;
  `,
    CONTAINER,
  );
}

async function openSourcesView(page: Page): Promise<void> {
  const sources = page.getByRole('button', { name: 'Fontes', exact: true });
  await sources.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Operação', exact: true })).toBeVisible();
}

async function refreshPanel(page: Page): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'GET' &&
        candidate.url().endsWith('/api/v1/admin/operations'),
    ),
    panel(page).getByRole('button', { name: 'Atualizar painel' }).click(),
  ]);
  expect(response.status()).toBe(200);
}

test('ADMIN lê falha de alimentação, espera da fila e confirmação próxima de expirar', async ({
  page,
  request,
}) => {
  syntheticDatabaseContainer(CONTAINER);
  resetFixture();
  await syntheticAdmin(page, request, CONTAINER);
  seedFailingFeed();

  await openSourcesView(page);
  await expect(panel(page).getByTestId('operations-source-pill')).toHaveText(
    /Falha de alimentação: limite de taxa da fonte/,
  );
  await expect(panel(page).getByTestId('operations-source-credit')).toContainText(
    'Fonte: Instituto Fogo Cruzado',
  );
  await expect(panel(page).getByTestId('operations-source-error-class')).toHaveText('RATE_LIMITED');
  await expect(panel(page).getByTestId('operations-queue-label')).toContainText(
    'aguardando revisão humana',
  );
  await expect(panel(page).getByTestId('operations-queue-pending')).toHaveText('1');
  await expect(panel(page).getByTestId('operations-expiring-item')).toContainText(OCCURRENCE_ID);
  // Falha de conector nunca vira contagem de ocorrências: o painel não apresenta totais de ocorrência.
  await expect(panel(page)).not.toContainText('ocorrências encontradas');

  // Teclado: o painel é alcançável e a navegação move o foco para a fila existente.
  await panel(page).getByRole('button', { name: 'Atualizar painel' }).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page).getByRole('button', { name: 'Abrir fila de revisão' })).toBeVisible();
  await panel(page).getByRole('button', { name: 'Abrir fila de revisão' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Revisão humana de clippings' })).toBeFocused();
  await expect(panel(page).getByTestId('operations-notice')).toContainText('Foco movido');

  // 390 px: a leitura continua sem rolagem horizontal.
  await page.setViewportSize({ width: 390, height: 844 });
  await refreshPanel(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(panel(page).getByTestId('operations-source-pill')).toBeVisible();
  await panel(page).getByTestId('operations-nav-collection').scrollIntoViewIfNeeded();
  await expect(panel(page).getByTestId('operations-nav-collection')).toBeVisible();
});

test('fonte não configurada e fila vazia não são lidas como zero nem como saúde', async ({
  page,
  request,
}) => {
  syntheticDatabaseContainer(CONTAINER);
  resetFixture();
  await syntheticAdmin(page, request, CONTAINER);

  await openSourcesView(page);
  await expect(panel(page).getByTestId('operations-sources-not-configured')).toContainText(
    /não é falha/,
  );
  await expect(panel(page).getByTestId('operations-queue-label')).toHaveText(
    /Fila de revisão vazia/,
  );
  await expect(panel(page).getByTestId('operations-queue-pending')).toHaveCount(0);
  await expect(panel(page).getByTestId('operations-expiring-empty')).toContainText(
    /Nenhuma confirmação vence/,
  );
  await expect(panel(page).getByTestId('operations-source-pill')).toHaveCount(0);

  // Recuperação visível: o painel volta a ler o servidor sem perder a explicação de vazio.
  await refreshPanel(page);
  await expect(panel(page).getByTestId('operations-error')).toHaveCount(0);
  await expect(panel(page).getByTestId('operations-sources-not-configured')).toBeVisible();
});
