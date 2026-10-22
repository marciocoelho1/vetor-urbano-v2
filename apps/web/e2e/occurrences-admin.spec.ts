import { expect, test, type Page } from '@playwright/test';
import { testPassword } from './helpers/local-account';
import { fixtureSql, syntheticAdmin, syntheticDatabaseContainer } from './helpers/synthetic-admin';

test.skip(
  process.env['VETOR_ACCOUNTS_E2E'] !== '1',
  'Exige API em 127.0.0.1:8080, caixa em 8025 e PostGIS sintético isolado.',
);
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 20_000 });

/**
 * Administração de ocorrências (pedido do responsável em 22/10/2026).
 *
 * Fixtures exclusivas no contêiner sintético autorizado; as ocorrências fictícias do projeto são
 * preservadas e continuam na lista. Cobre ordenação por última atualização, filtro de estado, ações
 * em lote e exclusão com confirmação + senha pedida uma única vez para o lote.
 */
const CONTAINER = 'vu-ticket29-e2e-db';
const HAPPENING = 'vu26-e2e-happening';
const NEWER = 'vu26-e2e-newer';
const OLDER = 'vu26-e2e-older';
const CONCLUDED = 'vu26-e2e-concluded';

const panel = (page: Page) => page.locator('section[aria-labelledby="occurrences-admin-heading"]');

function resetFixture(): void {
  fixtureSql(
    `
    SET session_replication_role = replica;
    DELETE FROM occurrence_reliability_evaluations
      WHERE occurrence_id IN ('${NEWER}', '${OLDER}', '${CONCLUDED}');
    DELETE FROM occurrence_clippings WHERE occurrence_id IN ('${NEWER}', '${OLDER}', '${CONCLUDED}');
    DELETE FROM publication_versions WHERE occurrence_id IN ('${NEWER}', '${OLDER}', '${CONCLUDED}');
    DELETE FROM occurrences WHERE id IN ('${NEWER}', '${OLDER}', '${CONCLUDED}');
    DELETE FROM happenings WHERE id='${HAPPENING}';
    SET session_replication_role = origin;
  `,
    CONTAINER,
  );
}

function seedFixture(): void {
  fixtureSql(
    `
    INSERT INTO happenings (id, title, description)
      VALUES ('${HAPPENING}', 'Acontecimento sintético 26', 'Contexto sintético da administração.');
    INSERT INTO occurrences (id, happening_id, title, description, category, occurrence_type, subtype,
        situation, reliability_score, municipality, neighborhood, location_precision, occurred_at,
        publication_status, administrative_status, updated_at)
      VALUES
        ('${NEWER}', '${HAPPENING}', 'Alfa administrativa', 'Descrição sintética sustentada', 'TRANSITO',
         'ACIDENTE', 'COLISAO', 'ONGOING', 3, 'Rio de Janeiro', 'Centro', 'TERRITORY',
         TIMESTAMPTZ '2026-10-10 12:00:00Z', 'PUBLISHED', 'ACTIVE', TIMESTAMPTZ '2026-10-22 12:00:00Z'),
        ('${OLDER}', '${HAPPENING}', 'Zulu administrativa', 'Descrição sintética sustentada', 'TRANSITO',
         'ACIDENTE', 'COLISAO', 'ONGOING', 3, 'Rio de Janeiro', 'Centro', 'TERRITORY',
         TIMESTAMPTZ '2026-10-10 12:00:00Z', 'PUBLISHED', 'ACTIVE', TIMESTAMPTZ '2026-10-20 12:00:00Z'),
        ('${CONCLUDED}', '${HAPPENING}', 'Bravo concluída', 'Descrição sintética sustentada', 'TRANSITO',
         'ACIDENTE', 'COLISAO', 'CLOSED', 3, 'Rio de Janeiro', 'Centro', 'TERRITORY',
         TIMESTAMPTZ '2026-10-10 12:00:00Z', 'PUBLISHED', 'CONCLUDED', NULL);
    INSERT INTO publication_versions (occurrence_id, version, action, reason, after_snapshot, occurred_at)
      SELECT id, 1, 'INITIAL', 'Fixture sintética da administração', '{}'::jsonb, now()
      FROM occurrences WHERE id IN ('${NEWER}', '${OLDER}', '${CONCLUDED}');
  `,
    CONTAINER,
  );
}

async function openPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fontes', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ocorrências', exact: true })).toBeVisible();
}

test('ADMIN ordena, filtra, age em lote e exclui com senha única para o lote', async ({
  page,
  request,
}) => {
  syntheticDatabaseContainer(CONTAINER);
  resetFixture();
  await syntheticAdmin(page, request, CONTAINER);
  seedFixture();

  await openPanel(page);
  await expect(panel(page).getByTestId('occurrences-table')).toBeVisible();
  // As fictícias do projeto continuam na lista.
  await expect(panel(page).getByText('Alfa administrativa')).toBeVisible();
  await expect(panel(page).getByText('Zulu administrativa')).toBeVisible();

  // Ordenação por última atualização coloca a mais recente antes da mais antiga.
  const rows = panel(page).locator('tbody tr');
  const titles = await rows.locator('strong').allTextContents();
  expect(titles.indexOf('Alfa administrativa')).toBeLessThan(titles.indexOf('Zulu administrativa'));

  // Ordem alfabética reorganiza a lista.
  await panel(page).getByTestId('occurrences-sort').selectOption('alphabetical');
  await expect
    .poll(async () => (await rows.locator('strong').allTextContents())[0])
    .toContain('Alfa');

  // Filtro de concluído mostra apenas a concluída.
  await panel(page).getByTestId('occurrences-filter').selectOption('CONCLUDED');
  await expect(panel(page).getByTestId(`occurrences-row-${CONCLUDED}`)).toBeVisible();
  await expect(panel(page).getByTestId(`occurrences-row-${NEWER}`)).toHaveCount(0);

  // Lote sem senha: marcar como inativo.
  await panel(page).getByTestId('occurrences-filter').selectOption('ALL');
  await panel(page).getByTestId(`occurrences-select-${NEWER}`).check();
  await panel(page).getByTestId(`occurrences-select-${OLDER}`).check();
  await expect(panel(page).getByTestId('occurrences-selected-count')).toContainText('2');
  await panel(page).getByTestId('occurrences-mark-inactive').click();
  await expect(panel(page).getByTestId(`occurrences-status-${NEWER}`)).toHaveText('Inativo');
  await expect(panel(page).getByTestId('occurrences-notice')).toContainText('2 ocorrência(s)');

  // Exclusão: confirmação + senha uma única vez para o lote inteiro.
  await panel(page).getByTestId(`occurrences-select-${NEWER}`).check();
  await panel(page).getByTestId(`occurrences-select-${OLDER}`).check();
  await panel(page).getByTestId('occurrences-delete').click();
  const dialog = panel(page).getByTestId('occurrences-delete-dialog');
  await expect(dialog).toBeVisible();
  await expect(panel(page).getByTestId('occurrences-delete-summary')).toContainText(
    '2 ocorrência(s)?',
  );
  await expect(panel(page).getByTestId('occurrences-password')).toBeFocused();
  await panel(page).getByTestId('occurrences-password').fill('senha errada');
  await panel(page).getByTestId('occurrences-confirm-delete').click();
  await expect(panel(page).getByTestId('occurrences-error')).toContainText(
    'Senha do administrador incorreta',
  );
  await expect(dialog).toBeVisible();
  await panel(page).getByTestId('occurrences-password').fill(testPassword);
  await panel(page).getByTestId('occurrences-confirm-delete').click();
  await expect(panel(page).getByTestId('occurrences-notice')).toContainText('2 ocorrência(s)');
  await expect(panel(page).getByTestId(`occurrences-row-${NEWER}`)).toHaveCount(0);
  await expect(panel(page).getByTestId(`occurrences-row-${OLDER}`)).toHaveCount(0);

  // 390 px: leitura sem rolagem horizontal.
  await page.setViewportSize({ width: 390, height: 844 });
  await panel(page).getByTestId('occurrences-refresh').click();
  await expect(panel(page).getByTestId('occurrences-filter')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('edição administrativa salva todos os campos e gera nova versão', async ({
  page,
  request,
}) => {
  syntheticDatabaseContainer(CONTAINER);
  resetFixture();
  await syntheticAdmin(page, request, CONTAINER);
  seedFixture();

  await openPanel(page);
  await panel(page).getByTestId(`occurrences-edit-${NEWER}`).click();
  const editor = panel(page).getByTestId('occurrences-editor');
  await expect(editor).toBeVisible();
  await panel(page).getByTestId('occurrence-field-title').fill('Alfa administrativa revisada');
  await panel(page)
    .getByTestId('occurrence-field-description')
    .fill('Descrição revisada pela administração com detalhe sustentado');
  await panel(page).getByTestId('occurrence-field-neighborhood').fill('Copacabana');
  await panel(page).getByTestId('occurrences-save').click();

  await expect(panel(page).getByTestId('occurrences-notice')).toContainText('salva em nova versão');
  await expect(panel(page).getByTestId(`occurrences-row-${NEWER}`)).toContainText(
    'Alfa administrativa revisada',
  );
  const { edited } = JSON.parse(
    fixtureSql(
      `SELECT json_build_object('edited', json_build_object('title', title, 'neighborhood', neighborhood, 'revision', revision))::text
       FROM occurrences WHERE id='${NEWER}'`,
      CONTAINER,
    ),
  ) as { edited: { title: string; neighborhood: string; revision: number } };
  expect(edited.title).toBe('Alfa administrativa revisada');
  expect(edited.neighborhood).toBe('Copacabana');
  expect(edited.revision).toBeGreaterThan(1);
});
