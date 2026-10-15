import { expect, test } from '@playwright/test';

test('a faixa transparente de ações permite clicar no zoom nativo do mapa', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click({ timeout: 5000 });
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click({ timeout: 5000 });
});
