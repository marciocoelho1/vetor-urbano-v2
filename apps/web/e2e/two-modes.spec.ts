import { expect, test } from '@playwright/test';

test.describe('Dois modos de consulta (simples vs Análise e Inteligência)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
    });
    await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
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
});
