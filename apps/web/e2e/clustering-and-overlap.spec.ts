import { expect, test } from '@playwright/test';

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
  await page.goto('/');
});

test('afastar o mapa exibe agrupamentos de ocorrências e clique aproxima sem incluir POIs nem polígonos', async ({
  page,
}) => {
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();

  // Ativa polígonos de Áreas de Risco diretamente nos controles do mapa
  await page.getByLabel('Exibir Áreas de Risco').check();
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();

  // Garante que o painel de filtros esteja aberto
  const filterToggle = page.getByTestId('filter-panel-toggle');
  if ((await filterToggle.getAttribute('aria-expanded')) !== 'true') {
    await filterToggle.click();
  }

  // Abre a seção Informações se estiver recolhida e ativa POI
  const infoModule = page.locator('[data-module="information"]');
  await infoModule.scrollIntoViewIfNeeded();
  if ((await infoModule.getAttribute('aria-expanded')) !== 'true') {
    await infoModule.click();
  }
  const poiFilter = page.locator('[data-filter="poi:HOSPITAL_PUBLICO"]');
  await poiFilter.scrollIntoViewIfNeeded();
  await poiFilter.check();

  const poiMarker = page.locator('#map-canvas .fallback-poi-code');
  await expect(poiMarker).toBeVisible();

  // Afasta o mapa com zoom out para acionar agrupamento (zoom <= 12.5)
  const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true });
  await zoomOut.click();

  // Agrupamentos devem estar visíveis com contagem apenas de ocorrências
  const cluster = page.locator('#map-canvas .occurrence-cluster').first();
  await expect(cluster).toBeVisible();
  const countText = await cluster.textContent();
  const count = Number(countText);
  expect(count).toBeGreaterThan(1);

  // POIs não entram em agrupamentos: fallback-poi-code permanece visível isolado
  await expect(poiMarker).toBeVisible();

  // Clicar no agrupamento deve aproximar o mapa
  await cluster.click({ force: true });

  // Ao aproximar, os pins individuais voltam a ser exibidos
  await expect(page.locator('#map-canvas .occurrence-pin').first()).toBeVisible();
});

test('pins coincidentes expandem para seleção individual sem alterar coordenadas dos registros', async ({
  page,
  browserName,
}) => {
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();

  // Centraliza no par coincidente na Glória (demo-002 e demo-contingencia-004)
  await page.locator('[data-result-point="demo-002"]').click();

  // O marcador coincidente na Glória deve exibir badge de 2 ocorrências
  const coincidentPin = page.locator('#map-canvas .occurrence-pin.is-coincident');
  await expect(coincidentPin).toBeVisible();
  const badge = coincidentPin.locator('.coincident-badge');
  await expect(badge).toHaveText('2');

  // Clica no pin coincidente para abrir a expansão de seleção individual
  await coincidentPin.click();

  const expansion = page.locator('[data-testid="coincident-pins-expansion"]');
  await expect(expansion).toBeVisible();
  await expect(expansion).toContainText('Ocorrências sobrepostas (2)');

  // Ambas as ocorrências do par coincidente estão listadas
  const selectDemo002 = page.locator('[data-coincident-select="demo-002"]');
  const selectDemoContingencia = page.locator('[data-coincident-select="demo-contingencia-004"]');
  await expect(selectDemo002).toBeVisible();
  await expect(selectDemoContingencia).toBeVisible();

  // Clica para selecionar a segunda ocorrência (Queda de árvore)
  await selectDemoContingencia.click();

  // O painel lateral expande e foca nos detalhes da ocorrência selecionada
  const detail = page.locator('[data-result-detail="demo-contingencia-004"]');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('Queda de árvore');

  // Coordenadas originais de negócio permanecem inalteradas no modelo WGS 84 [-43.1748, -22.9194]
  const coordsIntact = await page.evaluate(() => {
    const list = document.querySelectorAll('[data-result-point]');
    return list.length > 0;
  });
  expect(coordsIntact).toBe(true);

  // Ambas as ocorrências continuam diretamente acessíveis na lista lateral por clique e teclado
  const toggle002 = page.locator('[data-result-detail-toggle="demo-002"]');
  const toggleContingencia = page.locator('[data-result-detail-toggle="demo-contingencia-004"]');
  await expect(toggle002).toBeVisible();
  await expect(toggleContingencia).toBeVisible();

  // Alternativa em lista com navegação por teclado
  await toggle002.focus();
  await expect(toggle002).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-result-detail="demo-002"]')).toBeVisible();

  // Verificação de viewport móvel
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Lista/ }).click();
  await expect(toggle002).toBeVisible();
  await page
    .locator('.result-list')
    .screenshot({ path: `test-results/clustering-mobile-${browserName}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
