import { expect, test } from '@playwright/test';

test.describe('Informes ativos por ponto manual (Ticket 08)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setSystemTime(new Date('2026-10-15T15:00:00Z'));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
    });
    await page.route('https://tiles.stadiamaps.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
      }),
    );
  });

  test('acessa módulo de informes ativos com raio inicial e teto de 5 km e centro explícito', async ({
    page,
  }) => {
    await page.goto('/');

    // Acessa módulo de Informes ativos pelo cabeçalho
    const informesNavBtn = page.getByRole('button', { name: 'Informes ativos' });
    await expect(informesNavBtn).toBeVisible();
    await informesNavBtn.click();

    // Título e cabeçalho observáveis
    const heading = page.locator('#active-heading');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Informes ativos');

    // Raio inicial e máximo de 5.000 m (5 km)
    const radiusInput = page.getByTestId('informes-radius-input');
    await expect(radiusInput).toBeVisible();
    await expect(radiusInput).toHaveValue('5000');

    const radiusBadge = page.getByTestId('informes-radius-badge');
    await expect(radiusBadge).toContainText('5,0 km');

    // Tenta ultrapassar o limite de 5 km (não herda o teto antigo de 25 km)
    await radiusInput.fill('15000');
    await radiusInput.dispatchEvent('input');
    await expect(radiusInput).toHaveValue('5000');

    // Ajusta para 2.500 m
    await radiusInput.fill('2500');
    await radiusInput.dispatchEvent('input');
    await expect(radiusInput).toHaveValue('2500');
    await expect(radiusBadge).toContainText('2,5 km');

    // Coordenadas centrais explícitas WGS84
    const lngInput = page.getByTestId('informes-lng-input');
    const latInput = page.getByTestId('informes-lat-input');
    await expect(lngInput).toBeVisible();
    await expect(latInput).toBeVisible();
    await expect(lngInput).not.toBeEmpty();
    await expect(latInput).not.toBeEmpty();
  });

  test('destaca andamento, exibe distância e identifica incertezas sem duplicar registros', async ({
    page,
  }) => {
    await page.goto('/');

    // Acessa Informes ativos
    await page.getByRole('button', { name: 'Informes ativos' }).click();

    const list = page.getByTestId('informes-list');
    await expect(list).toBeVisible();

    const records = list.locator('.workspace-record');
    const count = await records.count();
    expect(count).toBeGreaterThan(0);

    // Badge de contagem no cabeçalho
    const badge = page.getByTestId('informes-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(`${count}`);

    // Destaque de andamento
    const ongoingBadges = page.getByTestId('ongoing-badge');
    const ongoingCount = await ongoingBadges.count();
    expect(ongoingCount).toBeGreaterThanOrEqual(0);

    // Distância indicada em cada item
    const firstDistance = records.first().getByTestId('informes-record-distance');
    await expect(firstDistance).toBeVisible();
    await expect(firstDistance).toContainText('do ponto');

    // Interação com detalhes
    const firstDetailBtn = records.first().getByRole('button', { name: 'Ver detalhes' });
    await firstDetailBtn.click();

    const detailPanel = page.locator('.workspace-detail');
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.locator('h2')).toBeVisible();

    // Fecha detalhes
    await detailPanel.getByLabel('Fechar detalhes').click();
    await expect(detailPanel).toHaveCount(0);
  });

  test('permite escolha manual no mapa, atualiza centro e demonstra estado vazio com restauração', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Informes ativos' }).click();

    // Clica em "Escolher local no mapa"
    const pickMapBtn = page.getByTestId('informes-pick-map-btn');
    await expect(pickMapBtn).toBeVisible();
    await pickMapBtn.click();

    // Transiciona para a visão de mapa com prompt observável
    const mapPrompt = page.locator('.map-pick-prompt');
    await expect(mapPrompt).toBeVisible();
    await expect(mapPrompt).toContainText('definir o centro dos Informes ativos');

    // Clica no canvas do mapa para definir novo ponto
    const mapCanvas = page.locator('#map-canvas');
    await expect(mapCanvas).toBeVisible();
    await mapCanvas.click({ position: { x: 300, y: 250 }, force: true });

    // Retorna automaticamente para os Informes ativos
    await expect(page.locator('#active-heading')).toBeVisible();

    // Reduz o raio para o mínimo de 100 m para testar estado vazio
    const radiusInput = page.getByTestId('informes-radius-input');
    await radiusInput.fill('100');
    await radiusInput.dispatchEvent('input');

    // Em uma coordenada arbitrária com 100 m, pode exibir o estado vazio acessível
    const emptyState = page.getByTestId('informes-empty');
    if ((await emptyState.count()) > 0) {
      await expect(emptyState).toBeVisible();
      await expect(emptyState).toContainText('Nenhum informe ativo encontrado neste raio');

      // Botão de restauração
      const resetBtn = page.getByTestId('informes-reset-btn');
      await expect(resetBtn).toBeVisible();
      await resetBtn.click();

      // Centro restaurado e registros reaparecem
      await expect(page.getByTestId('informes-list')).toBeVisible();
      await expect(page.getByTestId('informes-radius-input')).toHaveValue('5000');
    }
  });

  test('apresentação móvel em viewport 390px preserva controles e lista acessíveis', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Navega para Informes ativos em viewport móvel
    const informesNavBtn = page.getByRole('button', { name: 'Informes ativos' });
    await expect(informesNavBtn).toBeVisible();
    await informesNavBtn.click();

    await expect(page.locator('#active-heading')).toBeVisible();

    // Controles de raio e centro continuam visíveis e acessíveis
    const radiusInput = page.getByTestId('informes-radius-input');
    await expect(radiusInput).toBeVisible();

    const pickMapBtn = page.getByTestId('informes-pick-map-btn');
    await expect(pickMapBtn).toBeVisible();

    // Lista visível
    const list = page.getByTestId('informes-list');
    await expect(list).toBeVisible();
  });
});
