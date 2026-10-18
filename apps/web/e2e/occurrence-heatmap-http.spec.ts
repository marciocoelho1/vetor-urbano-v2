import { expect, test } from '@playwright/test';
import { loginUser } from './helpers/local-account';
test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige API/PostGIS sintéticos locais');
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15000 });

for (const engine of ['MapLibre', 'Leaflet'] as const) {
  test.describe(`Motor cartográfico: ${engine}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
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
      expect((await page.request.get('http://127.0.0.1:8080/api/v1/occurrences')).status()).toBe(
        401,
      );
      await loginUser(page.request);
      await page.addInitScript(() => localStorage.setItem('vetor-consultation-mode', 'advanced'));
      await page.goto('/?consulta=api');
      await expect(page.getByTestId('query-loading-banner')).toBeHidden();
      await expect(page.getByTestId('query-error-banner')).toBeHidden();
    });
    test('calor usa recorte autorizado HTTP/PostGIS e logout revoga consulta', async ({ page }) => {
      await expect(page.locator('.result-list > li')).toHaveCount(4);
      await page.locator('.heatmap-button').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('heatmap-legend')).toContainText('3 ocorrências elegíveis');
      await expect(page.getByTestId('occurrence-heatmap')).toBeVisible();
      expect(
        await page.getByTestId('occurrence-heatmap').evaluate((c: HTMLCanvasElement) =>
          c
            .getContext('2d')!
            .getImageData(0, 0, c.width, c.height)
            .data.some((value, i) => i % 4 === 3 && value > 0),
        ),
      ).toBe(true);
      await page
        .getByRole('combobox', { name: 'Município (demonstração)', exact: true })
        .selectOption('Rio de Janeiro');
      await page
        .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
        .selectOption('Setor demonstrativo');
      await expect(page.getByTestId('heatmap-legend')).toContainText('0 ocorrências elegíveis');
      await expect(page.locator('.result-list > li')).toHaveCount(1);
      await expect(page.getByTestId('heatmap-legend')).toContainText(
        'Sem ocorrências com precisão suficiente',
      );
      // HTTP logout, followed by a real protected read. No auth route is intercepted.
      const session = await (
        await page.request.get('http://127.0.0.1:8080/api/v1/auth/session')
      ).json();
      expect(
        (
          await page.request.post('http://127.0.0.1:8080/api/v1/auth/logout', {
            headers: { 'X-CSRF-Token': session.csrfToken },
            data: {},
          })
        ).status(),
      ).toBe(200);
      expect((await page.request.get('http://127.0.0.1:8080/api/v1/occurrences')).status()).toBe(
        401,
      );
      await page.reload();
      await expect(page.getByTestId('occurrence-heatmap')).toHaveCount(0);
    });
  });
}
