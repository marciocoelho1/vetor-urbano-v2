import { expect, type Page } from '@playwright/test';
import { fixtureSql } from './synthetic-admin';

/**
 * Fixtures do painel de confiabilidade (tickets 23/24), num só lugar.
 *
 * Vivem aqui — e não dentro de um `*.spec.ts` — porque **dois** instrumentos
 * precisam delas: `reliability-panel.spec.ts`, que prova o fluxo de avaliação
 * e publicação, e `contrast-tokens.spec.ts`, que mede o contraste dos
 * elementos de nota/estado (UX-8) com a régua de contraste que já existe.
 * Uma segunda engine de contraste para o mesmo tipo de medida foi o que gerou
 * divergência de método em rodadas anteriores; duplicar fixture teria o mesmo
 * efeito.
 *
 * Tudo é sintético e vive no contêiner autorizado — nunca no banco real.
 */

export const CONTAINER = 'vu-uxh01-five-db';
export const SOURCE_ID = 'vu23-e2e-source';
export const OCCURRENCE_OK = 'vu23-e2e-ok';
export const OCCURRENCE_BLOCKED = 'vu23-e2e-blocked';
export const HAPPENING = 'vu23-e2e-happening';

export function resetFixture(): void {
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

export function seedFixture(): void {
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
export function seedShortSample(): void {
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

/**
 * Decisão vigente com recomendação `UPGRADE` — a única que produz o selo
 * `.reliability-pill.ok` (`recommendationTone` em `data/reliability-api.ts`).
 *
 * O fluxo de aprovação só registra `UPGRADE` quando a avaliação recomenda
 * subir a nota, o que exigiria semear evidência de corroboração suficiente.
 * Aqui a decisão é inserida direto na tabela sintética: `UPGRADE` + `APPROVED`,
 * nota 4 → 5. É fixture, não atalho de produto — a régua mede a cor do selo,
 * o fluxo de aprovação tem o seu próprio teste em `reliability-panel.spec.ts`.
 */
/**
 * Amostra favorável: 24 afirmações confirmadas na janela, nenhuma demonstrada
 * incorreta. É o estado que faz o painel **calcular** recomendação `UPGRADE` —
 * e `recommendationTone('UPGRADE')` devolve `ok`, o selo que a régua do UX-8
 * precisa medir. `SourceRatingService` exige `MIN_SAMPLE = 10` e
 * `UPGRADE_MIN_SAMPLE = 20` — por isso 24, e não 12.
 */
export function seedFavorableSample(): void {
  fixtureSql(
    `
    INSERT INTO source_statement_verifications (source_id, statement_key, statement_excerpt, result, note,
        recorded_by, recorded_at)
      SELECT '${SOURCE_ID}', 'favoravel-' || g, 'Afirmação confirmada ' || g, 'CONFIRMED',
             'Confirmação sintética.', gen_random_uuid(), now()
      FROM generate_series(1, 24) AS g;
  `,
    CONTAINER,
  );
}

export function seedUpgradeDecision(): void {
  fixtureSql(
    `
    INSERT INTO source_rating_decisions (source_id, window_start, window_end, window_days,
        sample_applicable, sample_confirmed, sample_disproven, sample_inconclusive,
        sample_corrected, sample_system_errors, recommendation, justification, decision,
        previous_rating, applied_rating, applied_source_version, author_id, decided_at)
      VALUES ('${SOURCE_ID}', now() - interval '30 days', now(), 30,
              6, 5, 0, 1, 0, 0, 'UPGRADE',
              'Decisão sintética: amostra favorável à subida de nota.', 'APPROVED',
              4, 5, 2, gen_random_uuid(), now());
  `,
    CONTAINER,
  );
}

/** Entra na view de fontes com sessão de admin e espera o cabeçalho. */
export async function openSourcesView(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fontes', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Confiabilidade', exact: true })).toBeVisible();
}
