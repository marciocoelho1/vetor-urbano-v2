import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith('prefers the 2D map for software graphics')) return;
  await page.addInitScript(() => {
    // Exercise real WebGL rendering even on CI software GPUs. Only its identity
    // is simulated; shaders, workers, canvas, tiles and interactions stay real.
    const prototype = window.WebGL2RenderingContext?.prototype;
    if (!prototype) return;
    const getParameter = prototype.getParameter;
    prototype.getParameter = function (parameter: number) {
      if (parameter === 0x9246) return 'GPU acelerada simulada para QA';
      return getParameter.call(this, parameter);
    };
  });
});

test('prefers the 2D map for software graphics even when WebGL2 is available', async ({ page }) => {
  await mockRasterTiles(page);
  await page.addInitScript(() => {
    const prototype = WebGL2RenderingContext.prototype;
    const getParameter = prototype.getParameter;
    prototype.getParameter = function (parameter: number) {
      if (parameter === 0x9246) return 'ANGLE (Google, Vulkan, SwiftShader Device)';
      return getParameter.call(this, parameter);
    };
  });
  await page.goto('/');
  expect(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))).toBe(
    true,
  );
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('link[data-maplibre-style]')).toHaveCount(0);
  await expect(page.locator('#map-canvas .occurrence-pin img').first()).toBeVisible();
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.report-map-status')).toHaveCount(0);
});

async function mockRasterTiles(page: import('@playwright/test').Page): Promise<void> {
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dbeafe"/></svg>',
    }),
  );
}

test('recovers both maps when the WebGL probe succeeds but the renderer context fails', async ({
  page,
}) => {
  await mockRasterTiles(page);
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: unknown[]
    ) {
      if (args[0] === 'webgl2' && (args[1] as WebGLContextAttributes | undefined)?.stencil) {
        return null;
      }
      return Reflect.apply(getContext, this, args);
    } as typeof getContext;
  });
  await page.goto('/');
  expect(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))).toBe(
    true,
  );
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('#map-canvas .leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('.map-fallback, .map-loading')).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.report-map-status')).toHaveCount(0);
  const map = page.locator('#report-map-canvas');
  const bounds = await map.boundingBox();
  await map.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect(page.locator('input[name="longitude"]')).not.toHaveValue('');
  await expect(page.locator('input[name="latitude"]')).not.toHaveValue('');
});

async function openMainMap(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#map-canvas canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.map-loading')).toHaveCount(0);
  await expect(page.locator('.map-fallback')).toHaveCount(0);
  await page.getByTestId('filter-panel-toggle').click();
}

test('toggles the basemap theme independently on each MapLibre map', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vu2.theme', 'light'));
  await openMainMap(page);

  const publicToggle = page.getByTestId('map-theme-toggle');
  await expect(publicToggle).toHaveAttribute('aria-pressed', 'false');
  const publicStyle = () =>
    page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      return app.map.getPaintProperty('background', 'background-color');
    });
  expect(await publicStyle()).toBe('#e8eaed');

  const radiusBounds = await page.locator('.map-radius-panel').boundingBox();
  const actionsBounds = await page.locator('.map-top-actions').boundingBox();
  const zoomBounds = await page.locator('#map-canvas .maplibregl-ctrl-group').boundingBox();
  expect(radiusBounds).not.toBeNull();
  expect(actionsBounds).not.toBeNull();
  expect(zoomBounds).not.toBeNull();
  expect(Math.abs(radiusBounds!.y - actionsBounds!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(radiusBounds!.y - zoomBounds!.y)).toBeLessThanOrEqual(5);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const narrowRadius = await page.locator('.map-radius-panel').boundingBox();
    const narrowActions = await page.locator('.map-top-actions').boundingBox();
    const narrowZoom = await page.locator('#map-canvas .maplibregl-ctrl-group').boundingBox();
    expect(narrowRadius).not.toBeNull();
    expect(narrowActions).not.toBeNull();
    expect(narrowZoom).not.toBeNull();
    expect(narrowRadius!.y).toBeCloseTo(narrowActions!.y, 0);
    expect(narrowRadius!.x + narrowRadius!.width).toBeLessThanOrEqual(narrowActions!.x);
    expect(narrowZoom!.y).toBeGreaterThanOrEqual(narrowActions!.y + narrowActions!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  await publicToggle.click();
  await expect(publicToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.map-frame')).toHaveClass(/map-dark/);
  expect(await publicStyle()).toBe('#202832');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('#report-map-canvas canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
  await expect(page.getByTestId('report-map-theme-toggle')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const reportToggle = page.getByTestId('report-map-theme-toggle');
  await reportToggle.click();
  await expect(reportToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.report-map-shell')).toHaveClass(/map-dark/);
  await expect(publicToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      return app.reportMap.getPaintProperty('background', 'background-color');
    }),
  ).toBe('#202832');
});

for (const engine of ['MapLibre', 'Leaflet']) {
  test(`follows the page theme with temporary local choices on both ${engine} maps`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('vu2.theme', 'dark'));
    if (engine === 'Leaflet') {
      await mockRasterTiles(page);
      await page.addInitScript(() =>
        Object.defineProperty(window, 'WebGL2RenderingContext', {
          configurable: true,
          value: undefined,
        }),
      );
    }
    const canvas = engine === 'Leaflet' ? '.leaflet-container' : ' canvas.maplibregl-canvas';
    await page.goto('/');
    await expect(page.locator(`#map-canvas${canvas}`)).toBeVisible();
    await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
    const publicToggle = page.getByTestId('map-theme-toggle');
    await expect(publicToggle).toHaveAttribute('aria-pressed', 'true');
    await publicToggle.click();
    await expect(publicToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('vu2.theme'))).toBe('dark');

    await page.getByRole('button', { name: 'Registrar ocorrência', exact: true }).click();
    await page.locator('.category-option[data-category="TRANSITO"]').click();
    await expect(page.locator(`#report-map-canvas${canvas}`)).toBeVisible();
    await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
    const reportToggle = page.getByTestId('report-map-theme-toggle');
    const renderedThemes = () =>
      page.evaluate((engine) => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        if (engine === 'MapLibre')
          return [app.map, app.reportMap].map(
            (map) => map.getPaintProperty('background', 'background-color') === '#202832',
          );
        return ['#map-canvas', '#report-map-canvas'].map((selector) =>
          getComputedStyle(
            document.querySelector(`${selector} .leaflet-tile-pane`)!,
          ).filter.includes('invert'),
        );
      }, engine);
    await expect(reportToggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(renderedThemes).toEqual([false, true]);
    await page.evaluate((engine) => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      (window as any).__synchronizedMaps = (
        engine === 'MapLibre' ? [app.map, app.reportMap] : [app.fallbackMap, app.reportFallbackMap]
      ).map((map) => ({ map, center: map.getCenter(), zoom: map.getZoom() }));
    }, engine);

    const pageToggle = page.getByRole('button', { name: 'Modo escuro', exact: true });
    await pageToggle.click();
    await expect(publicToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(reportToggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(renderedThemes).toEqual([false, false]);
    await reportToggle.click();
    await expect.poll(renderedThemes).toEqual([false, true]);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await pageToggle.click();
    await expect.poll(renderedThemes).toEqual([true, true]);
    await reportToggle.click();
    await expect.poll(renderedThemes).toEqual([true, false]);
    await pageToggle.click();
    await expect.poll(renderedThemes).toEqual([false, false]);
    await pageToggle.click();
    await expect.poll(renderedThemes).toEqual([true, true]);
    expect(
      await page.evaluate((engine) => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        const maps =
          engine === 'MapLibre'
            ? [app.map, app.reportMap]
            : [app.fallbackMap, app.reportFallbackMap];
        return (window as any).__synchronizedMaps.every(
          (before, index) =>
            before.map === maps[index] &&
            before.zoom === maps[index].getZoom() &&
            before.center.lng === maps[index].getCenter().lng &&
            before.center.lat === maps[index].getCenter().lat,
        );
      }, engine),
    ).toBe(true);
    await reportToggle.click();
    await expect(reportToggle).toHaveAttribute('aria-pressed', 'false');
    await page.reload();
    await expect(publicToggle).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Registrar ocorrência', exact: true }).click();
    await page.locator('.category-option[data-category="TRANSITO"]').click();
    await expect(reportToggle).toHaveAttribute('aria-pressed', 'true');
  });
}

test('recovers both maps when the vector style is unavailable', async ({ page }) => {
  await mockRasterTiles(page);
  await page.route('**/maps/urban-style.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/');
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.map-fallback, .map-loading')).toHaveCount(0);
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.report-map-status')).toHaveCount(0);
});

test('leaves loading for the 2D map when the vector provider never responds', async ({ page }) => {
  await mockRasterTiles(page);
  await page.route('**/maps/urban-style.json', () => {});
  await page.goto('/');
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('.map-fallback, .map-loading')).toHaveCount(0);
});

test('keeps the list and an honest error state when both map providers fail', async ({ page }) => {
  await page.route('**/maps/urban-style.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/');
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('#map-canvas .leaflet-tile-loaded')).toHaveCount(0);
  await expect(page.locator('.map-fallback')).toBeVisible();
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('.report-map-error')).toContainText('indisponível');
  await expect(page.locator('input[name="longitude"]')).toBeEditable();
});

test('recovers from a lost GPU context without losing the radius filter', async ({ page }) => {
  await mockRasterTiles(page);
  await openMainMap(page);
  await page.locator('.result-item').first().click();
  await page.getByLabel('Filtrar por raio').check();
  await page.locator('#map-radius-slider').fill('700');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const angular = (
          window as unknown as {
            ng: { getComponent: (node: Element) => { map: import('maplibre-gl').Map } };
          }
        ).ng;
        return angular.getComponent(document.querySelector('app-root')!).map.isMoving();
      }),
    )
    .toBe(false);
  const vectorBounds = await page.evaluate(() => {
    const angular = (
      window as unknown as {
        ng: { getComponent: (node: Element) => { map: import('maplibre-gl').Map } };
      }
    ).ng;
    const map = angular.getComponent(document.querySelector('app-root')!).map;
    const bounds = map.getBounds().toArray();
    map.getCanvas().getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
    return bounds;
  });
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.map-fallback, .map-loading')).toHaveCount(0);
  await expect(page.locator('#map-radius-slider')).toHaveValue('700');
  await expect(page.locator('.radius-legend-note')).toContainText('700 m');
  const rasterBounds = await page.evaluate(() => {
    const angular = (
      window as unknown as {
        ng: { getComponent: (node: Element) => { fallbackMap: import('leaflet').Map } };
      }
    ).ng;
    const bounds = angular
      .getComponent(document.querySelector('app-root')!)
      .fallbackMap.getBounds();
    return [
      [bounds.getWest(), bounds.getSouth()],
      [bounds.getEast(), bounds.getNorth()],
    ];
  });
  for (let corner = 0; corner < 2; corner++) {
    for (let axis = 0; axis < 2; axis++) {
      expect(rasterBounds[corner][axis]).toBeCloseTo(vectorBounds[corner][axis], 4);
    }
  }
});

test('preserves the report bounds and selected point after losing its GPU context', async ({
  page,
}) => {
  await mockRasterTiles(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('#report-map-canvas canvas.maplibregl-canvas')).toBeVisible();
  await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
  await page.locator('input[name="longitude"]').fill('-43.6');
  await page.locator('input[name="latitude"]').fill('-22.9');
  const vectorBounds = await page.evaluate(() => {
    const angular = (
      window as unknown as {
        ng: { getComponent: (node: Element) => { reportMap: import('maplibre-gl').Map } };
      }
    ).ng;
    const map = angular.getComponent(document.querySelector('app-root')!).reportMap;
    map.jumpTo({ center: [-43.6, -22.9], zoom: 16.2 });
    const bounds = map.getBounds().toArray();
    map.getCanvas().getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
    return bounds;
  });
  await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
  await expect(page.locator('input[name="longitude"]')).toHaveValue('-43.6');
  await expect(page.locator('input[name="latitude"]')).toHaveValue('-22.9');
  const rasterBounds = await page.evaluate(() => {
    const angular = (
      window as unknown as {
        ng: { getComponent: (node: Element) => { reportFallbackMap: import('leaflet').Map } };
      }
    ).ng;
    const bounds = angular
      .getComponent(document.querySelector('app-root')!)
      .reportFallbackMap.getBounds();
    return [
      [bounds.getWest(), bounds.getSouth()],
      [bounds.getEast(), bounds.getNorth()],
    ];
  });
  for (let corner = 0; corner < 2; corner++) {
    for (let axis = 0; axis < 2; axis++) {
      expect(rasterBounds[corner][axis]).toBeCloseTo(vectorBounds[corner][axis], 4);
    }
  }

  await expect
    .poll(() =>
      page.locator('#report-map-canvas').evaluate((host) => {
        const canvas = host.querySelector('.leaflet-overlay-pane canvas') as HTMLCanvasElement;
        if (!canvas) return 0;
        const rect = canvas.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        const x = Math.round(
          ((hostRect.x + hostRect.width / 2 - rect.x) / rect.width) * canvas.width,
        );
        const y = Math.round(
          ((hostRect.y + hostRect.height / 2 - rect.y) / rect.height) * canvas.height,
        );
        const pixels = canvas.getContext('2d')!.getImageData(x - 10, y - 10, 20, 20).data;
        return Array.from(pixels).filter((value, index) => index % 4 === 3 && value > 0).length;
      }),
    )
    .toBeGreaterThan(0);
});

for (const failure of ['GPU', 'style']) {
  test(`recovers a report-only ${failure} failure independently of the main map`, async ({
    page,
  }) => {
    await mockRasterTiles(page);
    await openMainMap(page);
    if (failure === 'style') {
      await page.evaluate(() => {
        // The shared style is cached; fail only the report's loader invocation.
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.loadUrbanStyle = () => Promise.reject(new Error('Estilo do cadastro indisponível.'));
      });
    } else {
      await page.evaluate(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          ...args: unknown[]
        ) {
          if (args[0] === 'webgl2' && this.closest('#report-map-canvas')) return null;
          return Reflect.apply(getContext, this, args);
        } as typeof getContext;
      });
    }
    await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
    await page.locator('.category-option[data-category="TRANSITO"]').click();
    await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
    await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
  });
}

test('starts a real WebGL2 MapLibre map and keeps its worker available', async ({
  page,
  browserName,
}) => {
  const pageErrors: string[] = [];
  const workerResponses: number[] = [];
  const mapStyleResponses: number[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('maplibre-gl-worker.mjs')) {
      workerResponses.push(response.status());
    }
    if (new URL(response.url()).pathname.endsWith('/maplibre.css')) {
      mapStyleResponses.push(response.status());
    }
  });

  await page.setViewportSize({ width: 1280, height: 820 });
  await openMainMap(page);
  const hasWebGL2 = await page.locator('#map-canvas canvas.maplibregl-canvas').evaluate((node) => {
    return (node as HTMLCanvasElement).getContext('webgl2') !== null;
  });
  expect(hasWebGL2, `${browserName} must provide a real WebGL2 canvas`).toBe(true);
  await expect.poll(() => workerResponses).toContain(200);
  await expect(page.locator('link[data-maplibre-style]')).toHaveCount(1);
  expect(mapStyleResponses).toContain(200);
  expect(pageErrors).toEqual([]);
  await expect(page.locator('#map-canvas .maplibregl-ctrl-attrib')).toContainText('Stadia Maps');
  const provider = await page.request.get('/maps/raster-provider.json');
  expect(provider.ok()).toBe(true);
  expect((await provider.json()).tileUrl).toContain('/tiles/alidade_bright/');
  const basemapName = await page.evaluate(() => {
    const angular = (
      window as unknown as {
        ng: { getComponent: (node: Element) => { map: import('maplibre-gl').Map } };
      }
    ).ng;
    return angular.getComponent(document.querySelector('app-root')!).map.getStyle().name;
  });
  expect(basemapName).toMatch(/Vetor Urbano/i);

  await page.screenshot({
    path: `test-results/${browserName}-mapa-desktop.png`,
    fullPage: true,
  });
});

test('keeps the radius prompt readable and supports keyboard, wheel, and radius limits', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await openMainMap(page);

  await page.getByLabel('Filtrar por raio').check();
  const range = page.locator('.map-radius-panel input[type="range"]');
  await expect(range).toHaveValue('1000');
  await page.getByRole('button', { name: 'Escolher centro no mapa' }).click();
  await expect(page.locator('.map-pick-prompt')).toBeVisible();
  await expect(page.locator('.map-radius-panel')).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${browserName}-raio-escolha-centro.png`,
    fullPage: true,
  });

  const canvas = page.locator('#map-canvas canvas.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await expect(page.locator('.map-pick-prompt')).toHaveCount(0);
  await expect(page.locator('.map-radius-panel')).toBeVisible();

  await range.focus();
  await page.keyboard.press('ArrowRight');
  await expect(range).toHaveValue('1100');
  await page.keyboard.press('End');
  await expect(range).toHaveValue('25000');
  await page.keyboard.press('Home');
  await expect(range).toHaveValue('100');

  const panelBounds = await page.locator('.map-radius-panel').boundingBox();
  expect(panelBounds).not.toBeNull();
  await page.mouse.move(
    panelBounds!.x + panelBounds!.width / 2,
    panelBounds!.y + panelBounds!.height / 2,
  );
  await page.mouse.wheel(0, -100);
  await expect(range).toHaveValue('200');
});

test('opens result details inline, toggles closed, and caps simultaneous panels at five', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await openMainMap(page);
  await page.getByRole('checkbox', { name: 'Segurança', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Contingência', exact: true }).check();
  await page.getByRole('button', { name: 'Informações' }).click();
  await page.locator('[data-filter="poi:HOSPITAL_PUBLICO"]').check();
  await page.locator('[data-filter="poi:ESTADIO"]').check();

  const rows = page.locator('.result-list > li');
  await expect(rows).toHaveCount(77);
  for (let index = 0; index < 5; index += 1) {
    const row = rows.nth(index);
    const toggle = row.locator('.record-detail-button');
    await toggle.click();
    await expect(row.locator('.result-inline-detail')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }

  await expect(page.locator('.result-inline-detail')).toHaveCount(5);
  const sixthToggle = rows.nth(5).locator('.record-detail-button');
  await expect(sixthToggle).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Até 5 detalhes' })).toBeVisible();

  const firstToggle = rows.nth(0).locator('.record-detail-button');
  await firstToggle.focus();
  await page.keyboard.press('Enter');
  await expect(rows.nth(0).locator('.result-inline-detail')).toHaveCount(0);
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(sixthToggle).toBeEnabled();
  await sixthToggle.click();
  await expect(rows.nth(5).locator('.result-inline-detail')).toBeVisible();
  await expect(page.locator('.result-inline-detail')).toHaveCount(5);
  await expect(page.locator('.results-panel ~ .workspace-detail')).toHaveCount(0);
  await rows.nth(2).locator('.result-inline-detail').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/${browserName}-resultados-detalhes.png`,
  });
});

test('shows the location map in all report categories and fills editable coordinates', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();

  for (const [categoryId, label] of [
    ['TRANSITO', 'Trânsito'],
    ['SEGURANCA', 'Segurança'],
    ['CONTINGENCIA', 'Contingência'],
  ]) {
    const categoryOption = page.locator(`.category-option[data-category="${categoryId}"]`);
    await categoryOption.click();
    await expect(categoryOption).toContainText(label);
    await expect(page.getByRole('heading', { name: 'Indique o local' })).toBeVisible();
    await expect(page.locator('#report-map-canvas canvas.maplibregl-canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escolher o ponto no mapa' })).toHaveCount(0);
    await expect(page.locator('input[name="longitude"]')).toBeVisible();
    await expect(page.locator('input[name="latitude"]')).toBeVisible();
    await expect(page.locator('.report-map-status')).toHaveCount(0);

    if (categoryId === 'TRANSITO') {
      const canvas = page.locator('#report-map-canvas canvas.maplibregl-canvas');
      await canvas.scrollIntoViewIfNeeded();
      const mapGeometry = await canvas.evaluate((node) => {
        const host = document.getElementById('report-map-canvas');
        const rect = node.getBoundingClientRect();
        const hostRect = host?.getBoundingClientRect();
        return {
          canvas: [rect.width, rect.height],
          container: [hostRect?.width, hostRect?.height],
        };
      });
      expect(mapGeometry.container[0] ?? 0).toBeGreaterThan(0);
      expect(mapGeometry.container[1] ?? 0).toBeGreaterThan(0);
      expect(mapGeometry.canvas[0] ?? 0).toBeGreaterThan((mapGeometry.container[0] ?? 0) * 0.95);
      expect(mapGeometry.canvas[1] ?? 0).toBeGreaterThan((mapGeometry.container[1] ?? 0) * 0.95);
      const bounds = await canvas.boundingBox();
      expect(bounds).not.toBeNull();
      await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      const longitude = page.locator('input[name="longitude"]');
      const latitude = page.locator('input[name="latitude"]');
      await expect(longitude).not.toHaveValue('');
      await expect(latitude).not.toHaveValue('');

      await longitude.fill('-43.191564');
      await latitude.fill('-22.903319');
      await expect(page.locator('#report-map-canvas .maplibregl-marker')).toHaveCount(1);
      await page.screenshot({
        path: `test-results/${categoryId.toLowerCase()}-mapa-localizacao.png`,
        fullPage: true,
      });
    }

    await expect(page.locator(`.category-option[data-category="${categoryId}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
});

test('downloads a readable XLSX report from the browser', async ({ page, browserName }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar XLSX' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^vetor-urbano-relatorio-\d{4}-\d{2}-\d{2}\.xlsx$/);
  await download.saveAs(`test-results/${browserName}-relatorio-exportado.xlsx`);
  await expect(page.getByRole('status').filter({ hasText: 'Planilha XLSX gerada' })).toBeVisible();
});

test('supports the skip link, keyboard focus, and narrow mobile widths', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await openMainMap(page);
  await expect(page.locator('#map-canvas canvas.maplibregl-canvas')).toBeVisible();
  const hasNoHorizontalOverflow390 = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(hasNoHorizontalOverflow390).toBe(true);
  await page.screenshot({
    path: `test-results/${browserName}-mapa-mobile-390.png`,
    fullPage: true,
  });

  await page.setViewportSize({ width: 320, height: 720 });
  await openMainMap(page);
  const hasNoHorizontalOverflow320 = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(hasNoHorizontalOverflow320).toBe(true);
  await page.screenshot({
    path: `test-results/${browserName}-mapa-mobile-320.png`,
    fullPage: true,
  });
});

test('uses the lazy 2D map when the browser has no WebGL2 context', async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => localStorage.setItem('vu2.theme', 'light'));
  const tileRequests: string[] = [];
  const styleResponses: number[] = [];
  const providerResponses: number[] = [];
  await page.route('https://tiles.stadiamaps.com/tiles/alidade_bright/**', async (route) => {
    tileRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dbeafe"/></svg>',
    });
  });
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('/leaflet.css')) {
      styleResponses.push(response.status());
    }
    if (new URL(response.url()).pathname.endsWith('/raster-provider.json')) {
      providerResponses.push(response.status());
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.map-fallback')).toHaveCount(0);
  await expect(page.locator('#map-canvas .leaflet-control-zoom')).toBeVisible();
  await expect(page.locator('#map-canvas .leaflet-control-attribution')).toContainText(
    'OpenStreetMap',
  );
  await expect.poll(() => tileRequests.length).toBeGreaterThan(0);
  expect(styleResponses).toContain(200);
  expect(providerResponses).toContain(200);
  expect(tileRequests.every((url) => url.includes('/tiles/alidade_bright/'))).toBe(true);
  await expect(page.locator('#map-canvas .leaflet-control-attribution')).toContainText(
    'Stadia Maps',
  );
  await expect(page.locator('#map-canvas .leaflet-control-attribution')).toContainText(
    'OpenMapTiles',
  );
  expect(
    await page.locator('#map-canvas .leaflet-marker-pane .occurrence-pin img').count(),
  ).toBeGreaterThan(0);
  const publicThemeToggle = page.getByTestId('map-theme-toggle');
  await publicThemeToggle.click();
  await expect(publicThemeToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.map-frame')).toHaveClass(/map-dark/);
  expect(
    await page
      .locator('#map-canvas .leaflet-tile-pane')
      .evaluate((node) => getComputedStyle(node).filter),
  ).toContain('invert');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await publicThemeToggle.click();
  await page.screenshot({
    path: `test-results/${browserName}-leaflet-fallback.png`,
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/${browserName}-leaflet-mobile-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  const heatmapButton = page.locator('.heatmap-button');
  await heatmapButton.click();
  await expect(heatmapButton).toHaveText(/Ver marcadores/);
  await heatmapButton.click();
  await expect(heatmapButton).toHaveText(/Ver mancha térmica/);

  await expect(page.getByRole('group', { name: 'Raio personalizado' })).toBeVisible();
  await page.getByLabel('Filtrar por raio').check();
  const radius = page.locator('#map-radius-slider');
  await expect(radius).toHaveValue('1000');
  await radius.focus();
  await page.keyboard.press('ArrowRight');
  await expect(radius).toHaveValue('1100');
  await expect(page.locator('.radius-legend-note')).toContainText('1100 m');
  await page.screenshot({ path: `test-results/${browserName}-leaflet-radius.png`, fullPage: true });

  if (await page.locator('#map-filter-panel').isHidden())
    await page.getByTestId('filter-panel-toggle').click();
  await page.locator('[data-module="territory"]').click();
  await page.locator('[data-filter="territory:CV"]').check();
  await expect(page.locator('.territory-legend-note')).toContainText('1.671 áreas carregadas');

  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.report-map-status')).toHaveCount(0);
  const reportThemeToggle = page.getByTestId('report-map-theme-toggle');
  await reportThemeToggle.click();
  await expect(reportThemeToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.report-map-shell')).toHaveClass(/map-dark/);
  expect(
    await page
      .locator('#report-map-canvas .leaflet-tile-pane')
      .evaluate((node) => getComputedStyle(node).filter),
  ).toContain('invert');
  await expect(publicThemeToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const map = page.locator('#report-map-canvas.leaflet-container');
  const bounds = await map.boundingBox();
  expect(bounds).not.toBeNull();
  await map.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect(page.locator('input[name="longitude"]')).not.toHaveValue('');
  await expect(page.locator('input[name="latitude"]')).not.toHaveValue('');
  for (const category of ['SEGURANCA', 'CONTINGENCIA']) {
    await page.locator(`.category-option[data-category="${category}"]`).click();
    await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
    await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('#report-map-canvas.leaflet-container')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('spaces period presets and aligns the detail button with the result icon', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await openMainMap(page);

  const periodGap = await page
    .locator('.period-options')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).columnGap));
  expect(periodGap).toBeGreaterThanOrEqual(6);

  const firstResult = page.locator('.result-list > li').first();
  const icon = await firstResult.locator('.record-symbol').boundingBox();
  const detail = await firstResult.locator('.record-detail-button').boundingBox();
  expect(icon).not.toBeNull();
  expect(detail).not.toBeNull();
  expect(Math.abs(icon!.x - detail!.x)).toBeLessThanOrEqual(1);
});

test('loads the real Alidade Bright raster basemap in both public and report maps', async ({
  page,
  browserName,
}) => {
  const pageErrors: string[] = [];
  const tileStatuses: number[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/tiles/alidade_bright/')) tileStatuses.push(response.status());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    });
  });
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto('/');
  const publicMap = page.locator('#map-canvas.leaflet-container');
  await expect(publicMap).toBeVisible();
  await expect(page.locator('.map-fallback, .map-loading')).toHaveCount(0);
  await expect
    .poll(() => publicMap.locator('.leaflet-tile:not(.leaflet-tile-loaded)').count())
    .toBe(0);
  expect(await publicMap.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      publicMap
        .locator('.leaflet-tile-loaded')
        .evaluateAll((tiles) => tiles.every((tile) => getComputedStyle(tile).opacity === '1')),
    )
    .toBe(true);

  await expect(publicMap.locator('.leaflet-control-attribution')).toContainText('Stadia Maps');
  await page.screenshot({
    path: `test-results/${browserName}-smooth-raster-real.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Registrar ocorrência' }).click();
  await page.locator('.category-option[data-category="TRANSITO"]').click();
  const reportMap = page.locator('#report-map-canvas.leaflet-container');
  await expect(reportMap).toBeVisible();
  await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
  await expect
    .poll(() => reportMap.locator('.leaflet-tile:not(.leaflet-tile-loaded)').count())
    .toBe(0);
  expect(await reportMap.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      reportMap
        .locator('.leaflet-tile-loaded')
        .evaluateAll((tiles) => tiles.every((tile) => getComputedStyle(tile).opacity === '1')),
    )
    .toBe(true);

  await reportMap.click();
  await expect(page.locator('input[name="longitude"]')).not.toHaveValue('');
  await expect(page.locator('input[name="latitude"]')).not.toHaveValue('');
  for (const category of ['SEGURANCA', 'CONTINGENCIA']) {
    await page.locator(`.category-option[data-category="${category}"]`).click();
    await expect(reportMap).toBeVisible();
    await expect(page.locator('.report-map-status, .report-map-error')).toHaveCount(0);
  }
  await page.screenshot({
    path: `test-results/${browserName}-smooth-cadastro-real.png`,
    fullPage: true,
  });
  expect(tileStatuses.length).toBeGreaterThan(0);
  expect(tileStatuses.every((status) => status === 200)).toBe(true);
  expect(pageErrors).toEqual([]);
});

for (const engine of ['vector', 'raster'] as const) {
  test(`selects radius centers by left click, pans by dragging, and reuses the ${engine} map`, async ({
    page,
  }, testInfo) => {
    if (engine === 'raster') {
      await mockRasterTiles(page);
      await page.addInitScript(() => {
        Object.defineProperty(window, 'WebGL2RenderingContext', {
          configurable: true,
          value: undefined,
        });
      });
    }
    await page.setViewportSize({ width: 1280, height: 820 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const started = Date.now();
    await page.goto('/');
    await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
    const initialLoadMs = Date.now() - started;
    const surface = page.locator(
      engine === 'vector' ? '#map-canvas .maplibregl-canvas' : '#map-canvas',
    );
    await expect(surface).toBeVisible();
    await surface.scrollIntoViewIfNeeded();
    const box = (await surface.boundingBox())!;
    const center = page.locator('.map-radius-center');
    await page.getByLabel('Filtrar por raio').check();
    const originalCenter = await center.textContent();
    // Use free cartography to the right of the centered radius options.
    const x = box.x + box.width * 0.75;
    const y = box.y + box.height * 0.4;
    await page.mouse.click(x, y, { button: 'right' });
    await expect(center).toHaveText(originalCenter!);
    await page.mouse.click(x, y);
    await expect(center).not.toHaveText(originalCenter!);
    const picked = await center.textContent();
    await page.mouse.click(x + 45, y + 25);
    await expect(center).not.toHaveText(picked!);
    const beforeDrag = await center.textContent();
    const readCamera = () =>
      page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        const center = (app.map ?? app.fallbackMap).getCenter();
        return [center.lng, center.lat];
      });
    const camera = await readCamera();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 110, y + 55, { steps: 12 });
    await page.mouse.up();
    await expect.poll(readCamera).not.toEqual(camera);
    await expect(center).toHaveText(beforeDrag!);
    await page.locator('#map-radius-slider').fill('25000');
    await expect(page.locator('.radius-legend-note')).toContainText('25000 m');
    await page.getByLabel('Filtrar por raio').uncheck();
    await page.mouse.click(x, y);
    await page.getByLabel('Filtrar por raio').check();
    await expect(center).toHaveText(beforeDrag!);
    await page.getByLabel('Filtrar por raio').uncheck();
    await expect(page.locator('.result-list > li')).toHaveCount(17);
    await page.getByTestId('filter-panel-toggle').click();
    await page.getByRole('checkbox', { name: 'Segurança', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Contingência', exact: true }).check();
    await page.getByLabel('Período da consulta').selectOption('1m');
    await expect(page.locator('.result-list > li')).toHaveCount(75);
    await page.getByRole('button', { name: 'Ver mancha térmica' }).click();
    await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      const map = app.map ?? app.fallbackMap;
      (window as any).__radiusMap = map;
      // Frame all fixtures for the visual density check; this doesn't change the initial camera.
      if (app.map)
        map.fitBounds(
          [
            [-43.47, -22.94],
            [-43.03, -22.74],
          ],
          { duration: 0, padding: 25 },
        );
      else
        map.fitBounds(
          [
            [-22.94, -43.47],
            [-22.74, -43.03],
          ],
          { animate: false, padding: [25, 25] },
        );
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          return app.map
            ? app.map.getLayoutProperty('demo-heatmap-events', 'visibility') === 'visible'
            : app.fallbackMap.hasLayer(app.fallbackEventHeatLayer);
        }),
      )
      .toBe(true);
    if (engine === 'vector') {
      await expect
        .poll(() =>
          page.evaluate(() => {
            const map = (window as any).ng.getComponent(document.querySelector('app-root')).map;
            return map.loaded() && !map.isMoving();
          }),
        )
        .toBe(true);
    }
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-${engine}-metropolitan-heatmap.png`,
    });
    const beforeNavigation = await readCamera();
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    const returning = Date.now();
    await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
    await expect(surface).toBeVisible();
    await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
    const returnMs = Date.now() - returning;
    expect(
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        return (app.map ?? app.fallbackMap) === (window as any).__radiusMap;
      }),
    ).toBe(true);
    expect(await readCamera()).toEqual(beforeNavigation);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          const element = document.getElementById('map-canvas')!;
          const width = app.map ? app.map.getCanvas().clientWidth : app.fallbackMap.getSize().x;
          return Math.abs(width - element.clientWidth);
        }),
      )
      .toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await testInfo.attach('map-performance.json', {
      body: JSON.stringify({
        engine,
        initialLoadMs,
        returnMs,
        network: engine === 'raster' ? 'mock tiles' : 'real provider',
        note: 'Single local observation; not an SLA or a before/after benchmark.',
      }),
      contentType: 'application/json',
    });
  });
}

for (const engine of ['vector', 'raster'] as const) {
  test(`renders category pins and fits custom period fields with ${engine}`, async ({
    page,
  }, testInfo) => {
    if (engine === 'raster') {
      await mockRasterTiles(page);
      await page.addInitScript(() =>
        Object.defineProperty(window, 'WebGL2RenderingContext', {
          configurable: true,
          value: undefined,
        }),
      );
    }
    await page.goto('/');
    await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
    await page.getByTestId('filter-panel-toggle').click();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('[data-filter="period-custom"]').check();
      const inputs = page.locator('.period-custom-options input');
      await expect(inputs).toHaveCount(2);
      await inputs.nth(0).fill('2026-10-01T08:00');
      await inputs.nth(1).fill('2026-10-12T20:00');
      const fits = await inputs.evaluateAll((nodes) =>
        nodes.every((node) => {
          const input = node.getBoundingClientRect();
          const panel = node.closest('fieldset')!.getBoundingClientRect();
          return input.left >= panel.left && input.right <= panel.right && input.width > 180;
        }),
      );
      expect(fits).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/${testInfo.project.name}-${engine}-interval-${width}.png`,
      });
    }
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.locator('[data-filter="period-1m"]').check();
    await page.getByRole('checkbox', { name: 'Segurança', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Contingência', exact: true }).check();
    await page.getByLabel('Filtrar por raio').check();
    await expect(page.locator('#map-radius-slider')).toHaveValue('1000');
    await page.locator('#map-radius-slider').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#map-radius-slider')).toHaveValue('1100');
    await page.getByLabel('Filtrar por raio').uncheck();
    const points = await page.evaluate(() => {
      const app = (window as any).ng.getComponent(document.querySelector('app-root'));
      return ['TRANSITO', 'SEGURANCA', 'CONTINGENCIA'].map((category) =>
        app.allPoints().find((p: any) => p.category === category),
      );
    });
    for (const point of points) {
      await page.evaluate((point) => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        if (app.map) app.map.jumpTo({ center: point.coordinates, zoom: 14 });
        else
          app.fallbackMap.setView([point.coordinates[1], point.coordinates[0]], 15, {
            animate: false,
          });
      }, point);
      if (engine === 'vector') {
        await expect
          .poll(() =>
            page.evaluate((point) => {
              const map = (window as any).ng.getComponent(document.querySelector('app-root')).map;
              const pixel = map.project(point.coordinates);
              return map
                .queryRenderedFeatures(
                  [
                    [pixel.x - 18, pixel.y - 42],
                    [pixel.x + 18, pixel.y + 3],
                  ],
                  { layers: ['demo-occurrence-pins'] },
                )
                .some((feature: any) => feature.properties.recordId === point.id);
            }, point),
          )
          .toBe(true);
        expect(
          await page.evaluate(() => {
            const map = (window as any).ng.getComponent(document.querySelector('app-root')).map;
            return map.getPaintProperty('water', 'fill-color');
          }),
        ).toBe('#b3d5f2');
      } else {
        const pin = page.locator(
          `.occurrence-pin[title="${point.name} · ocorrência fictícia"] img`,
        );
        await expect(pin).toBeVisible();
        await expect(pin).toHaveAttribute('src', `maps/pins/${point.category.toLowerCase()}.svg`);
        await page.evaluate((point) => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          app.searchCenter.set({
            longitude: String(point.coordinates[0]),
            latitude: String(point.coordinates[1]),
          });
        }, point);
        await page.getByLabel('Filtrar por raio').check();
        await expect(pin).toBeVisible();
        await page.evaluate((point) => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          (window as any).__preservedPin = app.fallbackPointMarkers.get(point.id);
        }, point);
        await page.locator('#map-radius-slider').fill('1200');
        await expect
          .poll(() =>
            page.evaluate((point) => {
              const app = (window as any).ng.getComponent(document.querySelector('app-root'));
              return (
                app.fallbackRadiusLayer.getLayers()[0]?.getRadius() === 1200 &&
                app.fallbackPointMarkers.get(point.id) === (window as any).__preservedPin
              );
            }, point),
          )
          .toBe(true);
        await page.getByLabel('Filtrar por raio').uncheck();
      }
      if (engine === 'vector') {
        const pixel = await page.evaluate((point) => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          return app.map.project(point.coordinates);
        }, point);
        await page.locator('#map-canvas').click({ position: { x: pixel.x, y: pixel.y - 22 } });
        await expect(page.locator('.maplibregl-popup-content')).toContainText(point.name);
      } else {
        await page
          .locator(`.occurrence-pin[title="${point.name} · ocorrência fictícia"] img`)
          .click();
        await expect(page.locator('.leaflet-popup-content')).toContainText(point.name);
      }
      await page.locator('.maplibregl-popup-close-button, .leaflet-popup-close-button').click();
      await expect(page.locator('.maplibregl-popup, .leaflet-popup')).toHaveCount(0);
      await page.locator('#map-canvas').screenshot({
        path: `test-results/${testInfo.project.name}-${engine}-pin-${point.category}.png`,
      });
    }
  });
}
