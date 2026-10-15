import { expect, test } from '@playwright/test';

async function occurrenceSpatialSnapshot(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const app = (window as any).ng.getComponent(document.querySelector('app-root'));
    const visible = app.visiblePoints().filter((point: any) => point.kind === 'occurrence');
    const mapped = visible
      .filter(
        (point: any) =>
          point.locationPrecision !== 'TERRITORY' &&
          Array.isArray(point.coordinates) &&
          point.coordinates.length === 2 &&
          point.coordinates.every(Number.isFinite),
      )
      .map((point: any) => point.id);
    const listOnly = visible
      .filter(
        (point: any) =>
          point.locationPrecision === 'TERRITORY' ||
          !Array.isArray(point.coordinates) ||
          point.coordinates.length !== 2 ||
          !point.coordinates.every(Number.isFinite),
      )
      .map((point: any) => point.id);
    const geojson = app.toGeoJson('occurrence');
    return {
      mappedIds: mapped,
      listOnlyIds: listOnly,
      mapFeatureIds: geojson.features.map((feature: any) => feature.id),
    };
  });
}

test('território inclui lista sem pin e câmera só filtra mediante ação explícita', async ({
  page,
}, testInfo) => {
  await page.clock.setSystemTime(new Date('2026-10-15T15:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>',
    }),
  );
  await page.goto('/');
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await page.getByLabel('Período da consulta').selectOption('1m');
  await page
    .getByRole('combobox', { name: 'Município (demonstração)', exact: true })
    .selectOption('Rio de Janeiro');
  await page
    .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
    .selectOption('Setor demonstrativo');
  await expect(page.locator('.spatial-result-counts')).toContainText('2 apenas em lista');
  const rows = page.locator('.result-list > li');
  const total = await rows.count();
  const listOnly = rows.filter({ hasText: 'Localização somente territorial' });
  await expect(listOnly).toHaveCount(2);
  const spatialBefore = await occurrenceSpatialSnapshot(page);
  expect(spatialBefore.listOnlyIds).toHaveLength(2);
  expect(spatialBefore.mapFeatureIds).toEqual(spatialBefore.mappedIds);
  expect(spatialBefore.mapFeatureIds).not.toEqual(
    expect.arrayContaining(spatialBefore.listOnlyIds),
  );
  await expect(page.locator('.spatial-result-counts')).toHaveText(
    `${spatialBefore.mappedIds.length} mapeadas · ${spatialBefore.listOnlyIds.length} apenas em lista`,
  );
  await listOnly.first().locator('[data-result-detail-toggle]').click();
  const selectedTitle = await listOnly.first().locator('.record-copy strong').textContent();
  const input = page.getByTestId('map-search');
  await input.fill('Central do Brasil');
  await page.getByRole('button', { name: /Central do Brasil · referência fictícia/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Somente a câmera' })).toBeVisible();
  await expect(rows).toHaveCount(total);
  await expect(page.locator('.result-inline-detail')).toContainText(selectedTitle!);
  await page.locator('#map-canvas').focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('.map-frame').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click({ timeout: 10_000 });
  await expect(rows).toHaveCount(total);
  await page.getByRole('button', { name: 'Usar área visível', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remover área visível aplicada', exact: true }),
  ).toBeVisible();
  await expect(rows.filter({ hasText: 'Localização somente territorial' })).toHaveCount(0);
  expect(await rows.count()).toBeLessThan(total - 2);
  const spatialAfter = await occurrenceSpatialSnapshot(page);
  expect(spatialAfter.listOnlyIds).toHaveLength(0);
  expect(spatialAfter.mapFeatureIds).toEqual(spatialAfter.mappedIds);
  await expect(page.locator('.spatial-result-counts')).toHaveText(
    `${spatialAfter.mappedIds.length} mapeadas · 0 apenas em lista`,
  );
  await page.getByRole('button', { name: 'Remover área visível aplicada', exact: true }).click();
  await expect(rows).toHaveCount(total);
  const spatialRestored = await occurrenceSpatialSnapshot(page);
  expect(spatialRestored.listOnlyIds).toHaveLength(2);
  await expect(page.locator('.spatial-result-counts')).toHaveText(
    `${spatialRestored.mappedIds.length} mapeadas · 2 apenas em lista`,
  );
  await input.fill('Fora do recorte');
  await page.getByRole('button', { name: /Fora do recorte · referência fictícia/ }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Fora da cobertura sintética' }),
  ).toBeVisible();
  await expect(rows).toHaveCount(total);
  await page.getByRole('button', { name: 'Voltar ao recorte demonstrativo', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Fora da cobertura sintética' }),
  ).toHaveCount(0);
  await page.screenshot({ path: `test-results/ticket05-${testInfo.project.name}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: new RegExp(`^Lista ${total}`) }).click();
  await expect(rows).toHaveCount(total);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/ticket05-${testInfo.project.name}-mobile.png` });
});

test('MapLibre real mantém registros territoriais na lista e exclui precisão incompatível do recorte espacial', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const prototype = window.WebGL2RenderingContext?.prototype;
    if (!prototype) return;
    const getParameter = prototype.getParameter;
    prototype.getParameter = function (parameter: number) {
      if (parameter === 0x9246) return 'GPU acelerada simulada para QA';
      return getParameter.call(this, parameter);
    };
  });
  // The renderer and occurrence layers are real; the authored basemap avoids network variability.
  await page.route('**/maps/urban-style.json', (route) =>
    route.fulfill({
      json: {
        version: 8,
        name: 'Vetor Urbano — fundo sintético para QA',
        sources: {},
        sprite: 'maps/occurrence-pins',
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#edf0f2' } },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('#map-canvas canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.getByLabel('Período da consulta').selectOption('1m');
  await page
    .getByRole('combobox', { name: 'Município (demonstração)', exact: true })
    .selectOption('Rio de Janeiro');
  await page
    .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
    .selectOption('Setor demonstrativo');
  await expect(page.locator('.spatial-result-counts')).toContainText('2 apenas em lista');
  const rows = page.locator('.result-list > li');
  const total = await rows.count();
  const spatial = await occurrenceSpatialSnapshot(page);
  expect(spatial.listOnlyIds).toHaveLength(2);
  expect(spatial.mapFeatureIds).toEqual(spatial.mappedIds);
  for (const id of spatial.listOnlyIds) expect(spatial.mapFeatureIds).not.toContain(id);
  await expect(page.locator('.spatial-result-counts')).toHaveText(
    `${spatial.mappedIds.length} mapeadas · 2 apenas em lista`,
  );
  const radiusFilter = page.getByLabel('Filtrar por raio');
  await radiusFilter.check();
  await expect(rows.filter({ hasText: 'Localização somente territorial' })).toHaveCount(0);
  const spatialInRadius = await occurrenceSpatialSnapshot(page);
  expect(spatialInRadius.listOnlyIds).toHaveLength(0);
  expect(spatialInRadius.mapFeatureIds).toEqual(spatialInRadius.mappedIds);
  await expect(page.locator('.spatial-result-counts')).toHaveText(
    `${spatialInRadius.mappedIds.length} mapeadas · 0 apenas em lista`,
  );
  await radiusFilter.uncheck();
  await expect(rows.filter({ hasText: 'Localização somente territorial' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Usar área visível', exact: true }).click();
  await expect(rows).toHaveCount(total - 2);
  await expect(page.locator('.spatial-result-counts')).toContainText('0 apenas em lista');
  const spatialInArea = await occurrenceSpatialSnapshot(page);
  expect(spatialInArea.listOnlyIds).toHaveLength(0);
  expect(spatialInArea.mapFeatureIds).toEqual(spatialInArea.mappedIds);
  await expect(page.locator('.spatial-result-counts')).toHaveText(
    `${spatialInArea.mappedIds.length} mapeadas · 0 apenas em lista`,
  );
  await page.getByRole('button', { name: 'Ver mancha térmica', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ver marcadores', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver marcadores', exact: true }).click();
  await page.getByRole('button', { name: 'Remover área visível aplicada', exact: true }).click();
  await expect(rows).toHaveCount(total);
  expect(errors).toEqual([]);
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
});
