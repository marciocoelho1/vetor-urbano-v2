import { expect, test, type Page } from '@playwright/test';
import { syntheticAdmin, syntheticDatabaseContainer } from './helpers/synthetic-admin';
import {
  CONTAINER,
  OCCURRENCE_BLOCKED,
  OCCURRENCE_OK,
  SOURCE_ID,
  openSourcesView,
  resetFixture,
  seedFixture,
  seedShortSample,
} from './helpers/reliability-fixtures';

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
// Fixtures e abertura da view vivem em `helpers/reliability-fixtures.ts`:
// o mesmo estado é usado pela régua de contraste do UX-8 (contrast-tokens).

const panel = (page: Page) => page.locator('section[aria-labelledby="reliability-heading"]');

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
