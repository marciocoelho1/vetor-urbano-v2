import { expect, test } from '@playwright/test';

test.describe('Ticket 10: Atualizar consulta sem perder contexto e estados explícitos', () => {
  test.beforeEach(async ({ page }) => {
    // Regression of the demo boundary; ticket 35 separately proves real server authorization.
    const session = {
      code: 'SESSION',
      message: 'Sessão sintética do 10',
      authenticated: true,
      role: 'USER',
      csrfToken: 'synthetic-10',
    };
    await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: session }));
    await page.route('**/api/v1/auth/access/**', (route) => route.fulfill({ json: session }));
    await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
    });
  });

  test('aviso de atualizacao na sessao aberta permite atualizar mantendo filtros, centro e camera', async ({
    page,
  }) => {
    await page.route('https://tiles.stadiamaps.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
      }),
    );

    await page.goto('/');
    await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
    await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);

    // 1. Conferir horário da consulta inicial
    const timestamp = page.getByTestId('query-timestamp');
    await expect(timestamp).toBeVisible();
    await expect(timestamp).toContainText('12:00:00'); // 15:00 UTC = 12:00 BRT

    // 2. Aplicar um filtro pelo painel de filtros
    await page.getByTestId('filter-panel-toggle').click();
    const furtoFilter = page.locator('[data-filter="type:FURTO"]');
    await furtoFilter.scrollIntoViewIfNeeded();
    await furtoFilter.check();
    await expect(furtoFilter).toBeChecked();

    const cameraBefore = await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      app.fallbackMap.setView([-22.9144, -43.1802], 13, { animate: false });
      const center = app.fallbackMap.getCenter();
      return { latitude: center.lat, longitude: center.lng, zoom: app.fallbackMap.getZoom() };
    });

    // 3. Simular disponibilidade de novas publicações na sessão aberta
    await page.evaluate(() => {
      (
        window as unknown as { vetorUrbano: { simulatePendingUpdate: () => void } }
      ).vetorUrbano.simulatePendingUpdate();
    });

    const updateNotice = page.getByTestId('query-update-notice');
    await expect(updateNotice).toBeVisible();
    await expect(updateNotice).toContainText(
      'Existem novas publicações disponíveis para esta consulta (simulação).',
    );

    // 4. Avançar o relógio e acionar a atualização explícita
    await page.clock.setFixedTime(new Date('2026-10-15T15:45:00Z'));
    const applyBtn = page.getByTestId('apply-query-update-btn');
    await applyBtn.click();

    // 5. O aviso é dispensado e o timestamp é atualizado para o novo horário
    await expect(updateNotice).toHaveCount(0);
    await expect(timestamp).toContainText('12:45:00');

    // 6. Os filtros aplicados foram preservados
    await expect(furtoFilter).toBeChecked();
    const cameraAfter = await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      const center = app.fallbackMap.getCenter();
      return { latitude: center.lat, longitude: center.lng, zoom: app.fallbackMap.getZoom() };
    });
    // Compara a câmera abaixo de um pixel do raster nesta escala (pequenas frações vêm da projeção).
    expect(cameraAfter.latitude).toBeCloseTo(cameraBefore.latitude, 4);
    expect(cameraAfter.longitude).toBeCloseTo(cameraBefore.longitude, 4);
    expect(cameraAfter.zoom).toBe(cameraBefore.zoom);
  });

  test('consulta vazia informa mensagem padrao e oferece acoes de ampliacao e limpeza', async ({
    page,
  }) => {
    await page.route('https://tiles.stadiamaps.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
      }),
    );

    await page.goto('/');

    // Abre painel de filtros e aplica restrição de horário sem registros
    await page.getByTestId('filter-panel-toggle').click();
    const timeStartInput = page.getByLabel('Horário a partir de');
    const timeEndInput = page.getByLabel('Horário até');
    await timeStartInput.fill('03:00');
    await timeEndInput.fill('03:01');

    // Estado vazio é exibido com a mensagem exata requerida
    const emptyState = page.getByTestId('consultation-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(
      'Não encontramos ocorrências publicadas para estes filtros',
    );

    // Botões de ampliação e limpeza estão presentes
    const expandPeriodBtn = page.getByTestId('empty-expand-period-btn');
    const expandTerritoryBtn = page.getByTestId('empty-expand-territory-btn');
    const clearFiltersBtn = page.getByTestId('empty-clear-filters-btn');

    await expect(expandPeriodBtn).toBeVisible();
    await expect(expandTerritoryBtn).toBeVisible();
    await expect(clearFiltersBtn).toBeVisible();

    // Limpar filtros restaura os registros
    await clearFiltersBtn.click();
    await expect(emptyState).toHaveCount(0);
    await expect(page.locator('.result-list')).toBeVisible();
  });

  test('falha na consulta nao vira zero valido nem afirmacao de seguranca e permite tentar novamente', async ({
    page,
  }) => {
    await page.route('https://tiles.stadiamaps.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
      }),
    );

    await page.goto('/');

    // Simula erro na consulta de dados
    await page.evaluate(() => {
      (
        window as unknown as { vetorUrbano: { simulateQueryError: (msg: string) => void } }
      ).vetorUrbano.simulateQueryError('Falha na comunicação com o serviço de dados.');
    });

    // Barra de resultado mostra estado de erro em vez de contagem zero
    const errorState = page.getByTestId('query-error-state');
    await expect(errorState).toBeVisible();
    await expect(errorState).toContainText('Consulta indisponível');
    await expect(page.locator('.query-error-note')).toContainText(
      'A falha na consulta não confirma ausência de ocorrências nem segurança.',
    );

    // Coluna de resultados mostra banner de erro com explicação e retry
    const errorBanner = page.getByTestId('query-error-banner');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(
      'Esta falha não indica ausência de ocorrências nem comprovação de segurança.',
    );

    // Clicar em tentar novamente recupera a consulta
    const retryBtn = page.getByTestId('retry-query-btn');
    await retryBtn.click();
    await expect(errorBanner).toHaveCount(0);
    await expect(page.getByTestId('event-count')).toBeVisible();
  });

  test('carregamento da consulta e anunciado e retorna aos resultados sem erro ou zero valido', async ({
    page,
  }) => {
    await page.route('https://tiles.stadiamaps.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
      }),
    );
    await page.goto('/');
    await page.evaluate(() => {
      (
        window as unknown as { vetorUrbano: { simulateQueryLoading: (durationMs: number) => void } }
      ).vetorUrbano.simulateQueryLoading(1000);
    });

    const loadingState = page.getByTestId('query-loading-banner');
    await expect(loadingState).toBeVisible();
    await expect(loadingState).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('query-error-banner')).toHaveCount(0);
    await expect(loadingState).toContainText('Aguarde enquanto os registros são atualizados.');
    await expect(loadingState).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByTestId('event-count')).toHaveText('17');
  });

  test('carregamento do mapa mantém resultados consultáveis até os tiles responderem', async ({
    page,
  }) => {
    let releaseTiles!: () => void;
    const tilesReleased = new Promise<void>((resolve) => {
      releaseTiles = resolve;
    });
    await page.route('https://tiles.stadiamaps.com/**', async (route) => {
      await tilesReleased;
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
    await expect(page.locator('.map-loading')).toBeVisible();
    await expect(page.locator('.result-list > li')).toHaveCount(17);
    await expect(page.getByTestId('event-count')).toHaveText('17');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    releaseTiles();
    await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
    await expect(page.locator('.result-list > li')).toHaveCount(17);
  });

  test('falha do mapa mantem alternativa em lista acessivel e nao aparece como zero valido', async ({
    page,
  }) => {
    // Simula falha do provedor de tiles do mapa
    let allowTileResponse = false;
    const tile =
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>';
    await page.route('https://tiles.stadiamaps.com/**', (route) =>
      allowTileResponse
        ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: tile })
        : route.abort(),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/');

    // Fallback do mapa deve ser exibido
    const mapFallback = page.locator('.map-fallback');
    await expect(mapFallback).toBeVisible();
    await expect(mapFallback).toContainText('Não foi possível carregar o mapa');
    await expect(mapFallback).toContainText(
      'A falha no mapa não indica ausência de ocorrências nem comprovação de segurança.',
    );

    // Botão de recarga do mapa é acessível via teclado
    const retryMapBtn = page.getByTestId('retry-map');
    await expect(retryMapBtn).toBeVisible();

    // A lista de resultados continua acessível e preserva as ocorrências sem virar zero
    const resultList = page.locator('.result-list');
    await expect(resultList).toBeVisible();
    const eventCount = page.getByTestId('event-count');
    await expect(eventCount).toBeVisible();
    const countText = await eventCount.textContent();
    expect(Number(countText)).toBeGreaterThan(0);

    // Navegação por teclado na lista de resultados continua funcional
    const firstResult = page.locator('.result-item').first();
    await firstResult.focus();
    await expect(firstResult).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(firstResult).toHaveAttribute('aria-pressed', 'true');

    // Recarrega a camada após liberar os tiles e mantém a alternativa em lista.
    allowTileResponse = true;
    await retryMapBtn.click();
    await expect(page.locator('.map-fallback, .map-loading')).toHaveCount(0);
    await expect(resultList.locator('> li')).toHaveCount(17);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
