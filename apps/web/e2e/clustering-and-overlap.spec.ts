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
    });

    test(`afastar o mapa exibe agrupamentos de ocorrências e clique aproxima sem incluir POIs nem polígonos (${engine})`, async ({
      page,
    }) => {
      // Ativa polígonos de Áreas de Risco diretamente nos controles do mapa
      await page.getByLabel('Exibir Áreas de Risco').check();
      if (engine === 'Leaflet') {
        await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
      }

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

      // Fecha o painel de filtros para desobstruir a visualização cartográfica
      if ((await filterToggle.getAttribute('aria-expanded')) === 'true') {
        await filterToggle.click();
      }

      if (engine === 'Leaflet') {
        const poiMarker = page.locator('#map-canvas .fallback-poi-code');
        await expect(poiMarker).toBeVisible();

        // Afasta o mapa com zoom out para acionar agrupamento (zoom <= 12.5)
        const zoomOut = page.locator('.leaflet-control-zoom-out');
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
      } else {
        // MapLibre: afasta o mapa (zoom inicial 12.2; cluster threshold <= 11)
        const zoomOut = page.locator('#map-canvas button.maplibregl-ctrl-zoom-out');
        await zoomOut.click();
        await page.waitForTimeout(300);
        await zoomOut.click();

        // Aguarda a estabilização do mapa e a renderização das feições de cluster na camada demo-occurrence-clusters
        await expect
          .poll(async () => {
            return page.evaluate(() => {
              const app = (window as any).ng.getComponent(document.querySelector('app-root'));
              const map = app?.map;
              if (!map || map.isMoving()) return 0;
              const features = map.queryRenderedFeatures({ layers: ['demo-occurrence-clusters'] });
              return features.length;
            });
          })
          .toBeGreaterThan(0);

        const clusterInfo = await page.evaluate(() => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          const map = app.map;
          const features = map.queryRenderedFeatures({ layers: ['demo-occurrence-clusters'] });
          const first = features[0];
          const pixel = map.project(first.geometry.coordinates);
          return {
            pointCount: Number(first.properties.point_count),
            pixel,
          };
        });

        // Contagem de agrupamento reflete apenas ocorrências
        expect(clusterInfo.pointCount).toBeGreaterThan(1);

        // POIs não estão na fonte demo-points com agrupamento
        const poiInClusterSource = await page.evaluate(() => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          const source = app.map.getSource('demo-points');
          const data = source?._data;
          if (!data || !data.features) return false;
          return data.features.some((f: any) => f.properties?.kind === 'poi');
        });
        expect(poiInClusterSource).toBe(false);

        // Clica no cluster para aproximar
        const canvas = page.locator('#map-canvas canvas.maplibregl-canvas');
        await canvas.click({
          position: {
            x: Math.round(clusterInfo.pixel.x),
            y: Math.round(clusterInfo.pixel.y),
          },
          force: true,
        });

        // Após expansão, o zoom aumenta e desagrega
        await expect
          .poll(async () => {
            return page.evaluate(() => {
              const app = (window as any).ng.getComponent(document.querySelector('app-root'));
              return app?.map?.getZoom() ?? 0;
            });
          })
          .toBeGreaterThan(11.5);
      }
    });

    test(`pins coincidentes expandem para seleção individual sem deslocar coordenadas dos registros e refletem no modelo real (${engine})`, async ({
      page,
      browserName,
    }) => {
      // Snapshot estrito do modelo ANTES de qualquer interação de mapa ou seleção
      const modelBefore = await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        return {
          totalRecords: app.allPoints().length,
          visibleRecords: app.visiblePoints().length,
          records: app.allPoints().map((p: any) => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
            coordinates: p.coordinates ? [p.coordinates[0], p.coordinates[1]] : null,
            locationPrecision: p.locationPrecision,
          })),
        };
      });

      // Validação prévia da existência e das coordenadas reais do par coincidente
      const demo002Before = modelBefore.records.find((r: any) => r.id === 'demo-002');
      const demoContingenciaBefore = modelBefore.records.find(
        (r: any) => r.id === 'demo-contingencia-004',
      );
      expect(demo002Before).toBeDefined();
      expect(demoContingenciaBefore).toBeDefined();
      expect(demo002Before.coordinates).toEqual(demoContingenciaBefore.coordinates);
      expect(demo002Before.coordinates).toHaveLength(2);

      const coincidentCoords = demo002Before.coordinates;

      // Centraliza a visualização no par coincidente de forma determinística sem animação de câmera.
      // Desativa qualquer raio ativo e posiciona o mapa centralizado no par coincidente.
      await page.evaluate((coords) => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        if (app.useRadius()) {
          app.toggleRadius(false);
        }
        if (app.map) {
          app.map.jumpTo({ center: coords, zoom: 13.5 });
        } else if (app.fallbackMap) {
          app.fallbackMap.setView([coords[1], coords[0]], 13.5, { animate: false });
        }
      }, coincidentCoords);

      const openChooser = async () => {
        // O Leaflet reposiciona a câmera para acomodar o popup; restaura o
        // enquadramento do par antes de cada nova seleção, sem alterar registros.
        await page.evaluate((coords) => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          app.map?.jumpTo({ center: coords, zoom: 13.5 });
          app.fallbackMap?.setView([coords[1], coords[0]], 13.5, { animate: false });
        }, coincidentCoords);
        await page.locator('#map-canvas').scrollIntoViewIfNeeded();
        if (engine === 'Leaflet') {
          // Marcador coincidente no Leaflet exibe badge de 2 ocorrências
          const coincidentPin = page.locator('#map-canvas .occurrence-pin.is-coincident');
          await expect(coincidentPin).toBeVisible();
          const badge = coincidentPin.locator('.coincident-badge');
          await expect(badge).toHaveText('2');

          // Clica no pin coincidente para abrir a expansão de seleção individual
          await coincidentPin.click();
        } else {
          // MapLibre: aguarda a renderização das feições no ponto coincidente
          await expect
            .poll(() =>
              page.evaluate((coords) => {
                const map = (window as any).ng.getComponent(document.querySelector('app-root')).map;
                if (!map || map.isMoving()) return false;
                const pixel = map.project(coords);
                return (
                  map.queryRenderedFeatures(
                    [
                      [pixel.x - 20, pixel.y - 45],
                      [pixel.x + 20, pixel.y + 5],
                    ],
                    { layers: ['demo-occurrence-pins', 'demo-occurrence-coincident-badge'] },
                  ).length > 0
                );
              }, coincidentCoords),
            )
            .toBe(true);

          const clickPoint = await page.evaluate((coords) => {
            const app = (window as any).ng.getComponent(document.querySelector('app-root'));
            const pixel = app.map.project(coords);
            return {
              x: Math.round(pixel.x + 10),
              y: Math.round(pixel.y - 28),
            };
          }, coincidentCoords);

          const canvas = page.locator('#map-canvas canvas.maplibregl-canvas');
          await canvas.click({
            position: clickPoint,
          });
        }
      };
      await openChooser();

      // Painel popup de expansão de coincidentes
      const expansion = page.locator('[data-testid="coincident-pins-expansion"]').first();
      await expect(expansion).toBeVisible();
      await expect(expansion).toContainText('Ocorrências sobrepostas (2)');

      const selectDemo002 = expansion.locator('[data-coincident-select="demo-002"]');
      const selectDemoContingencia = expansion.locator(
        '[data-coincident-select="demo-contingencia-004"]',
      );
      await expect(selectDemo002).toBeVisible();
      await expect(selectDemoContingencia).toBeVisible();

      await selectDemoContingencia.scrollIntoViewIfNeeded();
      if (engine === 'MapLibre') {
        // O scroll deve ficar no seletor, nunca deslocar a superfície do mapa.
        expect(await page.locator('#map-canvas').evaluate((el) => el.scrollTop)).toBe(0);
        const popup = await expansion.locator('..').boundingBox();
        const map = await page.locator('#map-canvas').boundingBox();
        expect(popup!.y).toBeGreaterThanOrEqual(map!.y);
        expect(popup!.y + popup!.height).toBeLessThanOrEqual(map!.y + map!.height);
      }
      // A ação de seleção no popup
      await selectDemoContingencia.click();

      // O painel lateral expande e foca nos detalhes da ocorrência selecionada
      const detailContingencia = page.locator('[data-result-detail="demo-contingencia-004"]');
      await expect(detailContingencia).toBeVisible();
      await expect(detailContingencia).toContainText('Queda de árvore');

      // Reabre o mesmo pin e seleciona também o primeiro item pelo popup real.
      await openChooser();
      await selectDemo002.click();
      const toggle002 = page.locator('[data-result-detail-toggle="demo-002"]');
      const detail002 = page.locator('[data-result-detail="demo-002"]');
      await expect(detail002).toBeVisible();
      await expect(detail002).toContainText('Interdição parcial');
      await expect(page.locator('#map-result-detail-heading-demo-002')).toBeFocused();

      // O mesmo seletor aceita teclado sem substituir a regressão de mouse acima.
      await openChooser();
      await selectDemo002.focus();
      await expect(selectDemo002).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(detail002).toBeVisible();

      // COMPARAÇÃO RIGOROSA DAS COORDENADAS REAIS DO MODELO (antes vs depois)
      const modelAfter = await page.evaluate(() => {
        const app = (window as any).ng.getComponent(document.querySelector('app-root'));
        return {
          totalRecords: app.allPoints().length,
          visibleRecords: app.visiblePoints().length,
          records: app.allPoints().map((p: any) => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
            coordinates: p.coordinates ? [p.coordinates[0], p.coordinates[1]] : null,
            locationPrecision: p.locationPrecision,
          })),
        };
      });

      // 1. Total e visíveis não foram alterados
      expect(modelAfter.totalRecords).toBe(modelBefore.totalRecords);
      expect(modelAfter.visibleRecords).toBe(modelBefore.visibleRecords);

      // 2. Todos os registros mantêm suas coordenadas, precisão e identidade sem dispersão artificial ("spiderfy")
      expect(modelAfter.records).toEqual(modelBefore.records);

      // 3. O par coincidente preserva exatamente as mesmas coordenadas no modelo
      const demo002After = modelAfter.records.find((r: any) => r.id === 'demo-002');
      const demoContingenciaAfter = modelAfter.records.find(
        (r: any) => r.id === 'demo-contingencia-004',
      );
      expect(demo002After.coordinates).toEqual(demo002Before.coordinates);
      expect(demoContingenciaAfter.coordinates).toEqual(demoContingenciaBefore.coordinates);
      expect(demo002After.coordinates).toEqual(demoContingenciaAfter.coordinates);

      // 4. No Leaflet, o próprio marcador cartográfico na camada não sofreu deslocamento
      if (engine === 'Leaflet') {
        const markerCoords = await page.evaluate(() => {
          const app = (window as any).ng.getComponent(document.querySelector('app-root'));
          const marker = app.fallbackPointMarkers.get('demo-contingencia-004');
          const latlng = marker?.getLatLng();
          return latlng ? [latlng.lng, latlng.lat] : null;
        });
        expect(markerCoords).toEqual(demoContingenciaBefore.coordinates);
      }

      // Ambas as ocorrências continuam diretamente acessíveis na lista lateral por clique e teclado
      const toggleContingencia = page.locator(
        '[data-result-detail-toggle="demo-contingencia-004"]',
      );
      await expect(toggle002).toBeVisible();
      await expect(toggleContingencia).toBeVisible();

      // Alternativa em lista com navegação por teclado: fecha e reabre por Enter
      await toggle002.click();
      await expect(detail002).not.toBeVisible();
      await toggle002.focus();
      await expect(toggle002).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(detail002).toBeVisible();

      // Verificação de viewport móvel (390 px)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: /^Lista/ }).click();
      await expect(toggle002).toBeVisible();
      await page
        .locator('.result-list')
        .screenshot({ path: `test-results/clustering-${engine}-mobile-${browserName}.png` });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      // Verificação de estado vazio: quando a busca não coincide, mapa limpa e exibe estado vazio acessível
      const searchInput = page.getByPlaceholder('Buscar por título, via, bairro ou referência');
      if (await searchInput.isVisible()) {
        await searchInput.fill('TERMO_INEXISTENTE_XYZ');
        await expect(page.getByTestId('consultation-empty')).toBeVisible();
        await expect(page.getByTestId('consultation-empty')).toContainText(
          'Não encontramos ocorrências publicadas para estes filtros',
        );
        await page.getByTestId('empty-clear-filters-btn').click();
        await expect(toggle002).toBeVisible();
      }
    });
  });
}
