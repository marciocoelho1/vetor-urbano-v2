import { expect, test, type Page } from '@playwright/test';
import { syntheticAdmin } from './helpers/synthetic-admin';

/**
 * UXH-09 — passada 2: câmera alterada e prova espacial em HTTP.
 *
 * Dois critérios do ticket que o DOM da tela não prova sozinho:
 *
 *  1. **Pan/zoom não refaz a seleção** e a tela distingue a câmera atual da
 *     área aplicada. A ação tem de ser do usuário — o ruling proíbe gancho de
 *     teste no código de produção; se o renderizador alternativo não tiver
 *     zoom, isso vira dívida datada com o número, não hook.
 *  2. **Recorte espacial provado por requisição**: a consulta leva
 *     `west/south/east/north` e **todo** registro devolvido com coordenada cai
 *     dentro da caixa (borda incluída). Registro somente territorial conta sem
 *     pin artificial.
 */

const FAMILIA = 'vetor_final_operations_panel';
const API = process.env['VETOR_ACCOUNTS_E2E'] === '1';

async function abrirDemo(page: Page, largura: number): Promise<void> {
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de área',
    authenticated: true,
    role: 'USER',
    csrfToken: 'synthetic-area-2',
  };
  await page.route('**/api/v1/auth/session', (rota) => rota.fulfill({ json: sessao }));
  await page.route('**/api/v1/auth/access/**', (rota) => rota.fulfill({ json: sessao }));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (rota) =>
    rota.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
}

test('UXH-09: mover a câmera pelo zoom avisa que a área aplicada foi preservada', async ({
  page,
}) => {
  await abrirDemo(page, 1440);
  await page.getByRole('button', { name: 'Buscar nesta área' }).click({ timeout: 5000 });
  await page.waitForTimeout(400);

  const zoom = page.locator(
    'button[aria-label*="zoom" i], [data-testid*="zoom"], .leaflet-control-zoom a, .maplibregl-ctrl-zoom-in',
  );
  const controles = await zoom.count();
  console.log(`controles de zoom encontrados: ${controles}`);
  expect(
    controles,
    'nenhum controle de zoom no renderizador em uso: o aviso de câmera alterada não é medível por ação de usuário',
  ).toBeGreaterThan(0);

  await zoom.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  const avisos = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="status"], .query-note'))
      .filter((elemento) => elemento.getBoundingClientRect().height > 0)
      .map((elemento) => (elemento.textContent ?? '').trim().replace(/\s+/g, ' ')),
  );
  const avisoCamera = avisos.find((texto) =>
    /área do mapa alterada|câmera.*alter|mover a câmera|área aplicada/i.test(texto),
  );
  console.log(`aviso após zoom: "${avisoCamera ?? '(nenhum)'}"`);
  expect(avisoCamera, 'zoom sem aviso distinguindo câmera da área aplicada').toBeTruthy();
});

test('UXH-09: consulta por área leva a caixa e não devolve registro fora dela', async ({
  page,
  request,
}) => {
  test.skip(!API, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
  await syntheticAdmin(page, request, 'vu-uxh01-five-db');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?consulta=api');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(1200);

  const captura = page.waitForRequest(
    (requisicao) =>
      requisicao.url().includes('/api/v1/') &&
      requisicao.url().includes('west=') &&
      requisicao.url().includes('north='),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Buscar nesta área' }).click({ timeout: 5000 });
  const pedido = await captura;
  const url = new URL(pedido.url());
  const caixa = {
    west: Number(url.searchParams.get('west')),
    south: Number(url.searchParams.get('south')),
    east: Number(url.searchParams.get('east')),
    north: Number(url.searchParams.get('north')),
  };
  console.log(`requisição com área: ${url.pathname}${url.search.slice(0, 120)}`);
  console.log(`caixa: ${JSON.stringify(caixa)}`);
  for (const [chave, valor] of Object.entries(caixa)) {
    expect(Number.isFinite(valor), `parâmetro ${chave} ausente ou inválido`).toBe(true);
  }
  expect(caixa.west).toBeLessThan(caixa.east);
  expect(caixa.south).toBeLessThan(caixa.north);

  const resposta = await pedido.response();
  expect(resposta, 'requisição de área sem resposta').toBeTruthy();
  const corpo = (await resposta!.json()) as unknown;
  const itens: Array<Record<string, unknown>> = Array.isArray(corpo)
    ? (corpo as Array<Record<string, unknown>>)
    : ((
        corpo as {
          items?: Array<Record<string, unknown>>;
          content?: Array<Record<string, unknown>>;
        }
      ).items ??
      (corpo as { content?: Array<Record<string, unknown>> }).content ??
      []);
  console.log(`registros devolvidos: ${itens.length}`);
  const comCoordenada = itens.filter(
    (item) => typeof item['longitude'] === 'number' && typeof item['latitude'] === 'number',
  );
  console.log(
    `com coordenada: ${comCoordenada.length} · somente territoriais: ${itens.length - comCoordenada.length}`,
  );
  const fora = comCoordenada.filter((item) => {
    const lon = item['longitude'] as number;
    const lat = item['latitude'] as number;
    return lon < caixa.west || lon > caixa.east || lat < caixa.south || lat > caixa.north;
  });
  console.log(`fora da caixa: ${fora.length}`);
  expect(fora.length, `registros fora da área aplicada: ${JSON.stringify(fora.slice(0, 3))}`).toBe(
    0,
  );
});

/**
 * UXH-09 / ruling: aplicar área **substitui** o raio. Círculo e caixa na mesma
 * requisição dariam interseção silenciosa — o recorte seria mais estreito do
 * que a área desenhada. O teste exige as três coisas juntas: requisição sem
 * `radiusMeters`, com `west/south/east/north`, e o chip de raio fora da tela.
 */
test('UXH-09: aplicar área substitui o raio ativo', async ({ page, request }) => {
  test.skip(!API, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
  await syntheticAdmin(page, request, 'vu-uxh01-five-db');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?consulta=api');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(1200);

  // No caminho API não há raio por padrão: é preciso ativá-lo pelo controle real
  // (disclosure + range), senão o caso mediria a substituição de nada.
  await page.getByRole('button', { name: 'Ajustar raio personalizado' }).click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const alcance = document.querySelector('main input[type="range"]') as HTMLInputElement | null;
    if (!alcance) return;
    alcance.value = alcance.max || '2000';
    alcance.dispatchEvent(new Event('input', { bubbles: true }));
    alcance.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(700);
  const chipRaio = page.getByRole('button', { name: 'Remover filtro por raio' });
  const raioAntes = await chipRaio.count();
  console.log(`chip de raio antes de aplicar: ${raioAntes}`);
  expect(raioAntes, 'o caso exige raio ativo para provar a substituição').toBeGreaterThan(0);

  const captura = page.waitForRequest(
    (requisicao) =>
      requisicao.url().includes('/api/v1/occurrences') &&
      requisicao.url().includes('west=') &&
      requisicao.url().includes('north='),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Buscar nesta área' }).click({ timeout: 5000 });
  const pedido = await captura;
  const url = new URL(pedido.url());
  console.log(`requisição após aplicar: ${url.search}`);
  expect(url.searchParams.get('radiusMeters'), 'raio sobreviveu à aplicação da área').toBeNull();
  for (const chave of ['west', 'south', 'east', 'north']) {
    expect(url.searchParams.get(chave), `${chave} ausente na requisição de área`).not.toBeNull();
  }
  await page.waitForTimeout(600);
  expect(await chipRaio.count(), 'chip de raio continua visível após aplicar a área').toBe(0);
});
