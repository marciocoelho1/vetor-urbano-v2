import { expect, test } from '@playwright/test';

async function prepareSyntheticUserSession(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        code: 'SESSION',
        message: 'Sessão sintética para teste dos modos',
        authenticated: true,
        role: 'USER',
        csrfToken: 'synthetic-two-modes',
      },
    }),
  );
  await page.route('**/api/v1/auth/access/**', (route) =>
    route.fulfill({
      json: {
        code: 'AUTHENTICATED',
        message: 'Acesso sintético ao módulo USER',
        accountId: 'synthetic-two-modes-user',
        role: 'USER',
        authenticated: true,
        mfaEnrolled: false,
        csrfToken: 'synthetic-two-modes',
      },
    }),
  );
}

test.describe('Dois modos de consulta (simples vs Análise e Inteligência)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
    });
    await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
    await prepareSyntheticUserSession(page);
  });

  test('primeira visita inicia simples, oculta subtipos e alterna para Análise e Inteligência', async ({
    page,
  }) => {
    await page.goto('/');

    const modeToggle = page.locator('[data-mode-toggle]');
    await expect(modeToggle).toBeVisible();
    await expect(modeToggle).toContainText('Modo simples');
    await expect(modeToggle).toHaveAttribute('aria-pressed', 'false');

    // Abre o painel de filtros
    await page.getByTestId('filter-panel-toggle').click();

    // No modo simples, subtipos avançados não devem ser exibidos
    await expect(page.locator('[data-testid="advanced-subtypes-group"]')).toHaveCount(0);

    // No modo simples, período personalizado não deve aparecer no select rápido
    const periodSelect = page.getByLabel('Período da consulta');
    await expect(periodSelect.locator('option[value="custom"]')).toHaveCount(0);

    // Alterna para Análise e Inteligência
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');
    await expect(modeToggle).toHaveAttribute('aria-pressed', 'true');

    // No modo avançado, subtipos e período personalizado ficam disponíveis
    await expect(page.locator('[data-testid="advanced-subtypes-group"]')).toBeVisible();
    await expect(periodSelect.locator('option[value="custom"]')).toHaveCount(1);
  });

  test('demonstracao completa: suspensao de filtros, troca de tipo e municipio, descarte incompativel e reaplicacao compativel', async ({
    page,
  }) => {
    await page.goto('/');

    const modeToggle = page.locator('[data-mode-toggle]');

    // 1. Entrar no modo avançado
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');

    // Abre painel de filtros
    await page.getByTestId('filter-panel-toggle').click();

    // Filtra pelo tipo Furto
    const furtoFilter = page.locator('[data-filter="type:FURTO"]');
    await furtoFilter.scrollIntoViewIfNeeded();
    await furtoFilter.check();
    await expect(furtoFilter).toBeChecked();

    // Na seção de subtipos, escolhe "De veículo"
    const subtypesGroup = page.locator('[data-testid="advanced-subtypes-group"]');
    await expect(subtypesGroup).toBeVisible();
    const vehicleSubtype = page.locator('[data-filter="subtype:FURTO:De veículo"]');
    await vehicleSubtype.scrollIntoViewIfNeeded();
    await vehicleSubtype.check();
    await expect(vehicleSubtype).toBeChecked();

    // 2. Voltar ao simples: subtipo é suspenso com aviso
    await modeToggle.click();
    await expect(modeToggle).toContainText('Modo simples');

    const notice = page.locator('[data-mode-notice]');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Filtros avançados suspensos no Modo simples.');

    // 3. No simples, trocar o tipo (desmarcar Furto e marcar Roubo) e trocar o município para Niterói
    await furtoFilter.scrollIntoViewIfNeeded();
    await furtoFilter.uncheck();
    const rouboFilter = page.locator('[data-filter="type:ROUBO"]');
    await rouboFilter.scrollIntoViewIfNeeded();
    await rouboFilter.check();
    await expect(rouboFilter).toBeChecked();
    await expect(furtoFilter).not.toBeChecked();

    const municipalitySelect = page.getByLabel('Município (demonstração)');
    await municipalitySelect.selectOption('Niterói');
    await expect(municipalitySelect).toHaveValue('Niterói');

    // 4. Retornar ao avançado:
    // Subtipo incompatível (De veículo de Furto) é removido com aviso; município novo é conservado
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');

    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Subtipo incompatível com o tipo selecionado foi removido.');
    await expect(municipalitySelect).toHaveValue('Niterói');
    await expect(rouboFilter).toBeChecked();
    await expect(furtoFilter).not.toBeChecked();

    // 5. Repetir com filtro compatível
    // No avançado com Roubo selecionado, escolhe subtipo "A pedestre"
    const pedestrianSubtype = page.locator('[data-filter="subtype:ROUBO:A pedestre"]');
    await pedestrianSubtype.scrollIntoViewIfNeeded();
    await pedestrianSubtype.check();
    await expect(pedestrianSubtype).toBeChecked();

    // Volta ao simples
    await modeToggle.click();
    await expect(modeToggle).toContainText('Modo simples');
    await expect(notice).toContainText('Filtros avançados suspensos no Modo simples.');

    // No simples, mantém o tipo Roubo
    await expect(rouboFilter).toBeChecked();

    // Retorna ao avançado: subtipo compatível é reaplicado
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');
    await expect(notice).toContainText('Filtros avançados reaplicados.');
    await expect(pedestrianSubtype).toBeChecked();

    // 6. Nova visita conserva preferência de modo sem restaurar consulta inteira
    await page.reload();
    await expect(page.locator('[data-mode-toggle]')).toContainText('Análise e Inteligência');
  });

  test('filtros avancados: busca textual, fontes, faixa de nota e situacao no modo avancado com foco e teclado', async ({
    page,
  }) => {
    await page.goto('/');

    const modeToggle = page.locator('[data-mode-toggle]');
    await page.getByTestId('filter-panel-toggle').click();

    // No modo simples, grupos avançados não aparecem
    await expect(page.locator('[data-testid="advanced-text-group"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="advanced-source-group"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="advanced-score-group"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="advanced-situation-group"]')).toHaveCount(0);

    // Alterna para avançado
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');

    // Grupos avançados ficam visíveis
    const textGroup = page.locator('[data-testid="advanced-text-group"]');
    const sourceGroup = page.locator('[data-testid="advanced-source-group"]');
    const scoreGroup = page.locator('[data-testid="advanced-score-group"]');
    const situationGroup = page.locator('[data-testid="advanced-situation-group"]');

    await expect(textGroup).toBeVisible();
    await expect(sourceGroup).toBeVisible();
    await expect(scoreGroup).toBeVisible();
    await expect(situationGroup).toBeVisible();

    // 1. Busca textual e teclado
    const textInput = page.getByTestId('advanced-text-filter');
    await textInput.scrollIntoViewIfNeeded();
    await textInput.focus();
    await page.keyboard.type('Semáforo');
    await expect(textInput).toHaveValue('Semáforo');

    const clearTextBtn = page.getByRole('button', { name: 'Limpar busca textual' });
    await expect(clearTextBtn).toBeVisible();
    await clearTextBtn.click();
    await expect(textInput).toHaveValue('');

    // 2. Filtro por fonte com teclado (espaço para marcar)
    const sourceDemoCheckbox = page.locator('[data-filter="source:demo"]');
    await sourceDemoCheckbox.scrollIntoViewIfNeeded();
    await sourceDemoCheckbox.focus();
    await page.keyboard.press('Space');
    await expect(sourceDemoCheckbox).toBeChecked();

    // 3. Faixa de nota fictícia: erro com min > max
    const minScoreSelect = page.getByTestId('advanced-min-score');
    const maxScoreSelect = page.getByTestId('advanced-max-score');
    await minScoreSelect.scrollIntoViewIfNeeded();
    await minScoreSelect.selectOption('4');
    await maxScoreSelect.selectOption('2');

    const scoreError = scoreGroup.locator('.query-error');
    await expect(scoreError).toBeVisible();
    await expect(scoreError).toContainText('A nota mínima não pode ser superior à nota máxima.');

    // Corrige a faixa
    await maxScoreSelect.selectOption('5');
    await expect(scoreError).toHaveCount(0);

    // 4. Situação: marca 'Em andamento'
    const ongoingCheckbox = page.locator('[data-filter="situation:ONGOING"]');
    await ongoingCheckbox.scrollIntoViewIfNeeded();
    await ongoingCheckbox.check();
    await expect(ongoingCheckbox).toBeChecked();
  });

  test('preserva escolhas explicitas de filtros comuns: personalizado -> simples -> semana -> 24h -> avancado', async ({
    page,
  }) => {
    await page.goto('/');

    const modeToggle = page.locator('[data-mode-toggle]');
    const notice = page.locator('[data-mode-notice]');

    // 1. Entra no modo avançado
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');

    // 2. Define período personalizado via select rápido
    const periodSelect = page.getByLabel('Período da consulta');
    await periodSelect.selectOption('custom');
    await expect(periodSelect).toHaveValue('custom');

    // 3. Alterna para Modo simples: período recai para 24h e filtros avançados são suspensos
    await modeToggle.click();
    await expect(modeToggle).toContainText('Modo simples');
    await expect(notice).toContainText('Filtros avançados suspensos no Modo simples.');
    await expect(periodSelect).toHaveValue('24h');

    // 4. No simples, escolhe explicitamente "Últimos 7 dias" (1w)
    await periodSelect.selectOption('1w');
    await expect(periodSelect).toHaveValue('1w');

    // 5. No simples, escolhe explicitamente "Últimas 24 horas" (24h)
    await periodSelect.selectOption('24h');
    await expect(periodSelect).toHaveValue('24h');

    // 6. Retorna ao modo avançado:
    // A escolha explícita de 24h feita no simples DEVE ser preservada,
    // NÃO deve restaurar o período personalizado antigo silenciosamente.
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');
    await expect(periodSelect).toHaveValue('24h');
  });

  test('apresentação móvel em viewport 390px no modo avançado com controles acessíveis', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const modeToggle = page.locator('[data-mode-toggle]');
    await expect(modeToggle).toBeVisible();

    // Alterna para avançado no mobile
    await modeToggle.click();
    await expect(modeToggle).toContainText('Análise e Inteligência');

    // Abre painel de filtros
    await page.getByTestId('filter-panel-toggle').click();

    // Controles avançados estão no DOM e acessíveis
    const textGroup = page.locator('[data-testid="advanced-text-group"]');
    const sourceGroup = page.locator('[data-testid="advanced-source-group"]');
    const scoreGroup = page.locator('[data-testid="advanced-score-group"]');
    const situationGroup = page.locator('[data-testid="advanced-situation-group"]');

    await expect(textGroup).toBeVisible();
    await expect(sourceGroup).toBeVisible();
    await expect(scoreGroup).toBeVisible();
    await expect(situationGroup).toBeVisible();

    // Input textual e selects operáveis no mobile
    const textInput = page.getByTestId('advanced-text-filter');
    await textInput.scrollIntoViewIfNeeded();
    await textInput.fill('Avenida');
    await expect(textInput).toHaveValue('Avenida');

    const minScoreSelect = page.getByTestId('advanced-min-score');
    await minScoreSelect.scrollIntoViewIfNeeded();
    await minScoreSelect.selectOption('3');
    await expect(minScoreSelect).toHaveValue('3');
  });
});
