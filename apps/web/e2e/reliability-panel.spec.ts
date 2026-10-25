import { expect, test, type Page } from '@playwright/test';
import { fixtureSql, syntheticAdmin, syntheticDatabaseContainer } from './helpers/synthetic-admin';

test.skip(
  process.env['VETOR_ACCOUNTS_E2E'] !== '1',
  'Exige API em 127.0.0.1:8080, caixa em 8025 e PostGIS sintético isolado.',
);
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 20_000 });

/**
 * Tickets 23 e 24 — confiabilidade no navegador.
 *
 * Fixtures exclusivas no contêiner sintético autorizado: uma fonte com referência rastreável, uma
 * ocorrência publicada com clipping e uma segunda ocorrência sem detalhe essencial. O painel precisa
 * mostrar a nota registrada, bloquear a publicação quando falta essencial, publicar só depois de
 * liberar, e nunca oferecer aprovação de mudança de nota com amostra insuficiente.
 */
const CONTAINER = 'vu-uxh01-five-db';
const SOURCE_ID = 'vu23-e2e-source';
const OCCURRENCE_OK = 'vu23-e2e-ok';
const OCCURRENCE_BLOCKED = 'vu23-e2e-blocked';
const HAPPENING = 'vu23-e2e-happening';

const panel = (page: Page) => page.locator('section[aria-labelledby="reliability-heading"]');

function resetFixture(): void {
  fixtureSql(
    `
    SET session_replication_role = replica;
    DELETE FROM source_reevaluation_flags WHERE source_id='${SOURCE_ID}';
    DELETE FROM source_rating_decisions WHERE source_id='${SOURCE_ID}';
    DELETE FROM source_statement_verifications WHERE source_id='${SOURCE_ID}';
    DELETE FROM occurrence_reliability_evaluations
      WHERE occurrence_id IN ('${OCCURRENCE_OK}', '${OCCURRENCE_BLOCKED}');
    DELETE FROM clipping_reviews WHERE clipping_id LIKE 'vu23-e2e-%';
    DELETE FROM occurrence_clippings WHERE clipping_id LIKE 'vu23-e2e-%';
    DELETE FROM clippings WHERE id LIKE 'vu23-e2e-%';
    DELETE FROM publication_versions WHERE occurrence_id IN ('${OCCURRENCE_OK}', '${OCCURRENCE_BLOCKED}');
    DELETE FROM occurrences WHERE id IN ('${OCCURRENCE_OK}', '${OCCURRENCE_BLOCKED}');
    DELETE FROM happenings WHERE id='${HAPPENING}';
    DELETE FROM source_audit_events WHERE source_id='${SOURCE_ID}';
    DELETE FROM source_versions WHERE source_id='${SOURCE_ID}';
    DELETE FROM source_access_configurations WHERE source_id='${SOURCE_ID}';
    DELETE FROM sources WHERE id='${SOURCE_ID}';
    SET session_replication_role = origin;
  `,
    CONTAINER,
  );
}

function seedFixture(): void {
  fixtureSql(
    `
    INSERT INTO sources (id, public_name, current_version)
      VALUES ('${SOURCE_ID}', 'Fonte sintética 23', 1);
    INSERT INTO source_access_configurations (id, source_id, version, method, created_at)
      VALUES (gen_random_uuid(), '${SOURCE_ID}', 1, 'MANUAL', now());
    INSERT INTO source_versions (id, source_id, version, name, channel, public_url, territories, pillars,
        rating, rating_justification, access_configuration_id, created_at)
      SELECT gen_random_uuid(), '${SOURCE_ID}', 1, 'Fonte sintética 23', 'Canal sintético 23',
             'https://example.test/vu23', '["Rio de Janeiro"]'::jsonb, '["TRANSITO"]'::jsonb,
             4, 'Avaliação inteiramente sintética da fonte.', a.id, now()
      FROM source_access_configurations a WHERE a.source_id='${SOURCE_ID}' AND a.version=1;
    INSERT INTO happenings (id, title, description)
      VALUES ('${HAPPENING}', 'Acontecimento sintético 23', 'Contexto sintético do teste 23.');
    INSERT INTO occurrences (id, happening_id, title, description, category, occurrence_type, subtype,
        situation, reliability_score, municipality, neighborhood, location_precision, occurred_at,
        publication_status)
      VALUES
        ('${OCCURRENCE_OK}', '${HAPPENING}', 'Ocorrência sintética 23', 'Descrição sintética sustentada',
         'TRANSITO', 'ACIDENTE', 'COLISAO', 'UNKNOWN', 3, 'Rio de Janeiro', 'Centro', 'TERRITORY',
         TIMESTAMPTZ '2026-10-10 12:00:00Z', 'PUBLISHED'),
        ('${OCCURRENCE_BLOCKED}', '${HAPPENING}', 'Ocorrência sintética sem detalhe', '',
         'TRANSITO', 'ACIDENTE', 'COLISAO', 'UNKNOWN', 3, 'Rio de Janeiro', 'Centro', 'TERRITORY',
         TIMESTAMPTZ '2026-10-10 12:00:00Z', 'PUBLISHED');
    INSERT INTO clippings (id, source_id, title, reference, source_published_at, collected_at)
      VALUES ('vu23-e2e-clip-ok', '${SOURCE_ID}', 'Colisão sintética 23', 'vu23:e2e:ok',
              TIMESTAMPTZ '2026-10-10 11:00:00Z', now()),
             ('vu23-e2e-clip-blocked', '${SOURCE_ID}', 'Colisão sintética sem detalhe', 'vu23:e2e:blocked',
              TIMESTAMPTZ '2026-10-10 11:00:00Z', now());
    INSERT INTO occurrence_clippings (occurrence_id, clipping_id)
      VALUES ('${OCCURRENCE_OK}', 'vu23-e2e-clip-ok'),
             ('${OCCURRENCE_BLOCKED}', 'vu23-e2e-clip-blocked');
  `,
    CONTAINER,
  );
}

/** Amostra curta: três afirmações demonstradas incorretas e um erro do sistema. */
function seedShortSample(): void {
  fixtureSql(
    `
    INSERT INTO source_statement_verifications (source_id, statement_key, statement_excerpt, result, note,
        recorded_by, recorded_at)
      SELECT '${SOURCE_ID}', 'afirmacao-' || g, 'Afirmação sintética ' || g, 'DISPROVEN',
             'Verificação sintética.', gen_random_uuid(), now()
      FROM generate_series(1, 3) AS g;
    INSERT INTO source_statement_verifications (source_id, statement_key, statement_excerpt, result, note,
        recorded_by, recorded_at)
      VALUES ('${SOURCE_ID}', 'afirmacao-erro', 'Afirmação com erro de extração', 'SYSTEM_ERROR',
              'Falha de extração do sistema.', gen_random_uuid(), now());
  `,
    CONTAINER,
  );
}

async function openSourcesView(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fontes', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Confiabilidade', exact: true })).toBeVisible();
}

test('ADMIN avalia, vê bloqueio de essencial e publica a nota liberada', async ({
  page,
  request,
}) => {
  syntheticDatabaseContainer(CONTAINER);
  resetFixture();
  await syntheticAdmin(page, request, CONTAINER);
  seedFixture();

  await openSourcesView(page);
  await panel(page).getByTestId('reliability-occurrence').selectOption(OCCURRENCE_OK);
  await panel(page).getByTestId('reliability-evaluate').focus();
  await page.keyboard.press('Enter');

  await expect(panel(page).getByTestId('reliability-note')).toHaveText('4');
  await expect(panel(page).getByTestId('reliability-state')).toContainText('nota não publicada');
  // Teclado: o resultado recebe o foco para leitura por tecnologia assistiva.
  await expect(page.getByTestId('reliability-evaluation-heading')).toBeFocused();
  await expect(panel(page).getByTestId('reliability-factors')).toContainText('Corroboração');

  await panel(page).getByTestId('reliability-reproduce').click();
  await expect(panel(page).getByTestId('reliability-reproduction')).toContainText('Reproduzida');

  await panel(page).getByTestId('reliability-publish').click();
  await expect(panel(page).getByTestId('reliability-published')).toBeVisible();
  await expect(panel(page).getByTestId('reliability-notice')).toContainText('Nota 4 publicada');

  // Ocorrência com essencial vazio: nota alta não publica, e o motivo aparece em texto.
  await panel(page).getByTestId('reliability-occurrence').selectOption(OCCURRENCE_BLOCKED);
  await panel(page).getByTestId('reliability-evaluate').click();
  await expect(panel(page).getByTestId('reliability-blocking')).toContainText(
    'Campo essencial não informado: description',
  );
  await expect(panel(page).getByTestId('reliability-publish')).toBeDisabled();

  // 390 px: leitura sem rolagem horizontal.
  await page.setViewportSize({ width: 390, height: 844 });
  await panel(page).getByTestId('reliability-refresh').click();
  await expect(panel(page).getByTestId('reliability-evaluate')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('amostra insuficiente não oferece aprovação de mudança de nota da fonte', async ({
  page,
  request,
}) => {
  syntheticDatabaseContainer(CONTAINER);
  resetFixture();
  await syntheticAdmin(page, request, CONTAINER);
  seedFixture();
  seedShortSample();

  await openSourcesView(page);
  await panel(page).getByTestId('reliability-source').selectOption(SOURCE_ID);

  await expect(panel(page).getByTestId('reliability-recommendation-state')).toHaveText(
    'Amostra insuficiente',
  );
  await expect(panel(page).getByTestId('reliability-sample')).toContainText('Aplicáveis: 3');
  await expect(panel(page).getByTestId('reliability-sample')).toContainText(
    'Erro do sistema (fora da amostra): 1',
  );
  await expect(panel(page).getByTestId('reliability-approve')).toBeDisabled();
  await expect(panel(page).getByTestId('reliability-no-change')).toContainText(
    'não há mudança de nota a aprovar',
  );

  // Decisão de manter é permitida e registra a justificativa exigida.
  await panel(page)
    .getByTestId('reliability-justification')
    .fill('Amostra curta; mantenho a nota sem mudança neste ciclo.');
  await panel(page).getByTestId('reliability-reject').click();
  await expect(panel(page).getByTestId('reliability-decision')).toContainText('Decisão REJECTED');
  await expect(panel(page).getByTestId('reliability-decision')).toContainText('nota 4 → 4');
});
