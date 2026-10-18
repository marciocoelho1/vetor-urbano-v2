import { expect, test } from '@playwright/test';

for (const engine of ['MapLibre', 'Leaflet'] as const) {
  test.describe(`Motor cartográfico: ${engine}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.setSystemTime(new Date('2026-10-15T15:00:00Z'));
      await page.addInitScript(() => {
        try {
          localStorage.clear();
        } catch {}
      });
      if (engine === 'Leaflet') {
        await page.addInitScript(() => {
          Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
        });
      } else {
        await page.addInitScript(() => {
          const prototype = window.WebGL2RenderingContext?.prototype;
          if (!prototype) return;
          const getParameter = prototype.getParameter;
          prototype.getParameter = function (parameter: number) {
            if (parameter === 0x9246) return 'GPU acelerada simulada para QA';
            return getParameter.call(this, parameter);
          };
        });
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
      }
      await page.route('https://tiles.stadiamaps.com/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
        }),
      );
      // Sessão sintética: este ticket testa o mapa demonstrativo, não a API de acesso.
      await page.route('**/api/v1/auth/session', (route) =>
        route.fulfill({
          json: {
            code: 'SESSION',
            message: 'Sessão sintética de QA',
            authenticated: true,
            role: 'USER',
            csrfToken: 'synthetic-ticket-07',
          },
        }),
      );
      await page.goto('/');

      if (engine === 'MapLibre') {
        await expect(page.locator('#map-canvas canvas.maplibregl-canvas')).toBeVisible();
      } else {
        await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
      }
      await page.waitForFunction(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        return app?.mapReady() && !app.mapInitPromise;
      });
    });
    test('falha cartográfica preserva legenda, recorte e lista após recuperação do motor', async ({
      page,
    }) => {
      await page.locator('.heatmap-button').click();
      const legend = page.getByTestId('heatmap-legend');
      await expect(legend).toBeVisible();
      const count = await page.locator('.result-list > li').count();
      const text = await legend.textContent();
      await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        if (app.map)
          app.map.getCanvas().dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        else {
          // A new URL avoids the browser's decoded-image cache of the successful fixture.
          app.rasterTileProvider = {
            ...app.rasterTileProvider,
            tileUrl: app.rasterTileProvider.tileUrl + '?failure=ticket32',
          };
          app.retryMap();
        }
      });
      await expect(page.getByTestId('retry-map')).toBeVisible();
      await expect(page.locator('#map-canvas.leaflet-container')).toBeVisible();
      await expect(page.getByTestId('occurrence-heatmap')).toHaveCount(1);
      await expect(legend).toHaveText(text!);
      await expect(page.locator('.result-list > li')).toHaveCount(count);
    });

    test('calor compartilhado: pixels, recorte, estados, teclado e móvel', async ({ page }) => {
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        const base = app.visiblePoints().find((p: any) => p.kind === 'occurrence' && p.coordinates);
        const make = (id: string, coordinates: number[], extra = {}) => ({
          ...base,
          id,
          name: 'heat-fixture ' + id,
          description: 'heat-fixture sintética',
          coordinates,
          locationPrecision: 'EXACT',
          publicationStatus: 'PUBLISHED',
          ...extra,
        });
        app.importedRecords.set([
          make('heat-a', [-43.19, -22.9]),
          make('heat-b', [-43.21, -22.9]),
          make('heat-a', [-43.19, -22.9]),
          make('heat-poi', [-43.2, -22.9], { kind: 'poi', poiType: 'HOSPITAL_PUBLICO' }),
          make('heat-territory', [-43.2, -22.9], { locationPrecision: 'TERRITORY' }),
        ]);
        app.advancedTextFilter.set('heat-fixture');
        app.consultationMode.set('advanced');
        app.refreshMapData();
        const map = app.map ?? app.fallbackMap;
        if (app.map) map.jumpTo({ center: [-43.2, -22.9], zoom: 13 });
        else map.setView([-22.9, -43.2], 14, { animate: false });
      });
      const toggle = page.locator('.heatmap-button');
      await toggle.focus();
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Enter');
      const legend = page.getByTestId('heatmap-legend');
      await expect(legend).toContainText('2 ocorrências elegíveis');
      await expect(legend).toContainText('sem pesos');
      const canvas = page.getByTestId('occurrence-heatmap');
      await expect(canvas).toBeVisible();
      const samples = async () =>
        page.evaluate(() => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          const canvas = document.querySelector(
            '[data-testid="occurrence-heatmap"]',
          ) as HTMLCanvasElement;
          const ctx = canvas.getContext('2d')!;
          const sample = (lng: number) => {
            const p = app.map
              ? app.map.project([lng, -22.9])
              : app.fallbackMap.latLngToContainerPoint([-22.9, lng]);
            return Array.from(ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data);
          };
          return [sample(-43.19), sample(-43.21), sample(-43.2)];
        });
      await expect.poll(async () => (await samples())[0][3]).toBeGreaterThan(0);
      const before = await samples();
      expect(before[0]).toEqual(before[1]);
      expect(before[2][3]).toBe(0);
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        if (app.map) app.map.panBy([16, 0], { duration: 0 });
        else app.fallbackMap.panBy([16, 0], { animate: false });
      });
      await expect.poll(samples).toEqual(before);
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        if (app.map) app.map.jumpTo({ zoom: 14 });
        else app.fallbackMap.setZoom(15, { animate: false });
      });
      await expect.poll(samples).toEqual(before);
      await expect(legend).toContainText('zoom altera a área geográfica');
      // Exercise actual canvas failure, without breaking map contexts or the list.
      await page.evaluate(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        (window as any).restoreHeatContext = () => {
          HTMLCanvasElement.prototype.getContext = original;
        };
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          ...args: any[]
        ) {
          if (this.dataset['testid'] === 'occurrence-heatmap') return null;
          return (original as any).apply(this, args);
        } as any;
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.refreshMapData();
      });
      await expect(legend).toContainText('Mancha térmica indisponível');
      await expect(canvas).toBeHidden();
      await expect(page.locator('.result-list > li').first()).toBeAttached();
      await page.evaluate(() => {
        (window as any).restoreHeatContext();
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.retryMap();
      });
      await expect(canvas).toHaveCount(1);
      await expect(canvas).toBeVisible();
      await expect(legend).not.toContainText('Mancha térmica indisponível');
      // Restore the controlled camera after retry, then inspect changed contributions.
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        if (app.map) app.map.jumpTo({ center: [-43.2, -22.9], zoom: 13 });
        else app.fallbackMap.setView([-22.9, -43.2], 14, { animate: false });
      });
      // A repeated reference and POI did not add pixels. Change the filtered set.
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.importedRecords.update((r: any[]) => r.filter((p) => p.id !== 'heat-b'));
        app.refreshMapData();
      });
      await expect(legend).toContainText('1 ocorrências elegíveis');
      await expect.poll(async () => (await samples())[1][3]).toBe(0);
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.queryLoading.set(true);
      });
      await expect(canvas).toBeHidden();
      await expect(legend).toContainText('Atualizando recorte');
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.queryLoading.set(false);
        app.queryError.set(true);
      });
      await expect(legend).toContainText('Consulta indisponível');
      await expect(canvas).toBeHidden();
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.queryError.set(false);
        app.importedRecords.set([]);
        app.refreshMapData();
      });
      await expect(legend).toContainText('Sem ocorrências com precisão suficiente');
      await expect(canvas).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(legend).toContainText('Não é índice de risco');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.locator('[data-mode-toggle]').click();
      await expect(canvas).toBeHidden();
      await expect(legend).toHaveCount(0);
      await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        app.session.clear();
      });
      await expect(canvas).toHaveCount(0);
    });
  });
}
