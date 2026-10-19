import { expect, test, type Page } from '@playwright/test';
import { api, confirmedUser } from './helpers/local-account';
import { fixtureSql, loginBrowser } from './helpers/synthetic-admin';

test.describe('Informes integrados — ticket 25', () => {
  test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API e banco sintético permitidos.');
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_ok: unknown, denied: (error: { code: number }) => void) =>
            denied({ code: 1 }),
        },
      });
    });
    await page.route('https://tiles.stadiamaps.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
      }),
    );
    fixtureSql(`INSERT INTO occurrences(id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
      VALUES('vu25-recent-closed','vu-demo-happening-001','Informe encerrado sintético 25','Descrição sintética para integração','TRANSITO','ACIDENTE','COLISAO','CLOSED',3,'Rio de Janeiro','Centro','POINT',ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326),CURRENT_TIMESTAMP - INTERVAL '1 hour','PUBLISHED')
      ON CONFLICT(id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at;
      INSERT INTO occurrences(id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
      VALUES('vu25-recent-ongoing','vu-demo-happening-001','Informe sem confirmação sintético 25','Sem confirmação operacional','TRANSITO','ACIDENTE','COLISAO','ONGOING',3,'Rio de Janeiro','Centro','POINT',ST_SetSRID(ST_MakePoint(-43.1915,-22.9033),4326),CURRENT_TIMESTAMP - INTERVAL '2 hours','PUBLISHED')
      ON CONFLICT(id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at;`);
  });
  test.afterEach(() => {
    fixtureSql("DELETE FROM occurrences WHERE id IN ('vu25-recent-closed','vu25-recent-ongoing')");
  });
  async function manual(page: Page) {
    await page.getByTestId('informes-lng-input').fill('-43.1915');
    await page.getByTestId('informes-lat-input').fill('-22.9033');
    await page.getByRole('button', { name: 'Consultar proximidade', exact: true }).click();
  }
  test('localização permitida consulta no servidor sem herdar filtros do mapa', async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (
            ok: (position: { coords: { longitude: number; latitude: number } }) => void,
          ) => ok({ coords: { longitude: -43.1915, latitude: -22.9033 } }),
        },
      });
    });
    const email = await confirmedUser(request, 'active25-permitted');
    await loginBrowser(page, email);
    await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
    // Deliberately narrow an unrelated map filter; Informes does not inherit it.
    await page.getByRole('button', { name: 'Remover pilar Trânsito', exact: true }).click();
    await page.getByRole('button', { name: 'Informes ativos', exact: true }).click();
    await expect(page.getByTestId('informes-location-status')).toContainText(
      'Localização permitida',
    );
    await expect(page.getByTestId('informes-lng-input')).toHaveValue('-43.1915');
    await expect(page.getByTestId('informes-record-vu25-recent-closed')).toBeVisible();
    await expect(page.getByTestId('informes-consulted-at')).toBeVisible();
    await page.getByTestId('informes-radius-input').fill('15000');
    await expect(page.getByTestId('informes-radius-input')).toHaveValue('5000');
    await page.getByRole('button', { name: 'Consultar proximidade', exact: true }).click();
    await expect(page.getByTestId('informes-record-vu25-recent-closed')).toBeVisible();
  });

  test('erro de localização mantém manual; carga e falha não viram vazio e retry recupera', async ({
    page,
    request,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) =>
            fail({ code: 2 }),
        },
      });
    });
    const email = await confirmedUser(request, 'active25-error');
    await loginBrowser(page, email);
    await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Informes ativos', exact: true }).click();
    await expect(page.getByTestId('informes-location-status')).toContainText(
      'Não foi possível obter localização',
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/v1/active-reports?**', async (route) => {
      await gate;
      await route.fulfill({ status: 503, json: { error: { code: 'QUERY_UNAVAILABLE' } } });
    });
    try {
      await manual(page);
      await expect(page.getByTestId('informes-query-loading')).toBeVisible();
      await expect(page.getByTestId('informes-empty')).toHaveCount(0);
      release();
      await expect(page.getByTestId('informes-query-error')).toContainText('Consulta indisponível');
      await expect(page.getByTestId('informes-empty')).toHaveCount(0);
      await expect(page.getByTestId('informes-badge')).not.toContainText('0 informes');
    } finally {
      release();
    }
    await page.unroute('**/api/v1/active-reports?**');
    await page.getByRole('button', { name: 'Tentar consultar novamente', exact: true }).click();
    await expect(page.getByTestId('informes-record-vu25-recent-closed')).toBeVisible();
    await page.getByTestId('informes-pick-map-btn').click();
    await expect(page.locator('.map-pick-prompt')).toContainText(
      'definir o centro dos Informes ativos',
    );
    await page.locator('#map-canvas').click({ position: { x: 300, y: 250 } });
    await expect(page.locator('#active-heading')).toBeFocused();
    await expect(page.getByTestId('informes-consulted-at')).toBeVisible();
  });

  test('nega sem sessão e consulta como USER após negativa; teclado, lista e 390 px', async ({
    page,
    request,
  }) => {
    expect(
      (
        await request.get(
          `${api}/active-reports?longitude=-43.1915&latitude=-22.9033&radiusMeters=5000`,
        )
      ).status(),
    ).toBe(401);
    const email = await confirmedUser(request, 'active25');
    await loginBrowser(page, email);
    await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Informes ativos', exact: true }).click();
    await expect(page.locator('#active-heading')).toBeFocused();
    await expect(page.getByTestId('informes-location-status')).toContainText('Localização negada');
    await expect(page.getByTestId('informes-radius-input')).toHaveValue('5000');
    await page.setViewportSize({ width: 390, height: 844 });
    await manual(page);
    const closed = page.getByTestId('informes-record-vu25-recent-closed');
    const ongoing = page.getByTestId('informes-record-vu25-recent-ongoing');
    await expect(closed).toContainText('Encerrada');
    await expect(ongoing).toContainText('Desconhecida');
    await expect(ongoing).toContainText('Situação armazenada: Em andamento');
    await expect(ongoing).toContainText('Sem evidência de confirmação');
    await expect(ongoing.getByTestId('ongoing-badge')).toHaveCount(0);
    await expect(page.getByTestId('informes-consulted-at')).toContainText('Consulta em');
    const details = closed.getByRole('button', { name: 'Ver detalhes' });
    await details.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#active-detail-heading')).toHaveText(
      'Informe encerrado sintético 25',
    );
    await expect(page.locator('#active-detail-heading')).toBeFocused();
    await expect(page.locator('.workspace-detail')).toContainText(
      '2 ocorrências · 1 acontecimento no recorte',
    );
    await page.getByLabel('Fechar detalhes', { exact: true }).click();
    await expect(details).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByTestId('informes-lng-input').fill('0');
    await page.getByTestId('informes-lat-input').fill('0');
    await page.getByRole('button', { name: 'Consultar proximidade', exact: true }).click();
    await expect(page.getByTestId('informes-empty')).toContainText(
      'Não encontramos ocorrências publicadas',
    );
    await page.getByTestId('informes-lng-input').fill('');
    await page.getByRole('button', { name: 'Consultar proximidade', exact: true }).click();
    await expect(page.getByTestId('informes-query-error')).toContainText('centro');
    await expect(page.getByTestId('informes-empty')).toHaveCount(0);
  });
});
