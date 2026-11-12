import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { confirmedUser, testPassword } from './helpers/local-account';

/**
 * UXH-06 — entrada por território (município/bairro) com centro vindo do servidor.
 *
 * Contrato medido (o mesmo que o @executor publicou):
 *   [data-vu-territory-level="MUNICIPALITY"|"BAIRRO"]  abas de nível
 *   #map-locality-search                               busca (combobox, filtra em memória)
 *   li[role="option"] / [id^="map-locality-option-"]   opções, rótulo "Nome (Município), IBGE …"
 *   map-radius-center                                  centro: nome · código · versão · lon/lat
 *
 * O centro NÃO pode ser calculado pela tela: este arquivo compara o que a tela mostra
 * com o `internal_point` do banco (`catalog_territory_versions`), lido por psql.
 *
 * Mutações por caso:
 *   1 abas/658        → listar só 10 bairros (ou trocar nível sem recarregar)
 *   2 homônimo        → rótulo sem o município
 *   3 centro          → calcular centro na tela (centroide em vez de internal_point)
 *   4 seleção         → limpar a seleção ao trocar de nível
 *   5 RA/AP           → aba vazia em vez de vazio declarado
 */

const API = process.env['VETOR_E2E_API_BASE'] ?? 'http://127.0.0.1:8080/api/v1';
const CONTAINER = process.env['VETOR_E2E_TERRITORIAL_CONTAINER'] ?? 'vetor-spec-postgis';
const BASE = process.env['VETOR_E2E_TERRITORIAL_DB'] ?? 'vetor_spec_test';
// Conta nova por execução: o login tem limite por IP/conta e a conta de demonstração
// estoura 429 ao repetir rodadas (mesma classe do rate limit do feedback).
const USUARIO = process.env['VETOR_DEMO_USER'] ?? 'usuario@vetorurbano.test';
const SENHA = process.env['VETOR_DEMO_PASSWORD'] ?? '123456';

function consultar(sql: string): string {
  const permitidos = ['vetor-spec-postgis', 'vu-uxh01-five-db', 'vu-selected-db', 'vu-ticket30-db'];
  if (!permitidos.includes(CONTAINER)) throw new Error(`Contêiner não permitido: ${CONTAINER}`);
  if (BASE === 'vetor_urbano') throw new Error('Régua não pode medir a base real.');
  const usuario = execFileSync('podman', ['exec', CONTAINER, 'printenv', 'POSTGRES_USER'])
    .toString()
    .trim();
  return execFileSync('podman', [
    'exec',
    CONTAINER,
    'psql',
    '-U',
    usuario,
    '-d',
    BASE,
    '-t',
    '-A',
    '-c',
    sql,
  ]).toString();
}

/** Sessão real contra a API da base de catálogo, injetada como cookie no navegador. */
async function abrirComSessao(page: Page, request: APIRequestContext): Promise<void> {
  page.setDefaultTimeout(8_000);
  const email = await confirmedUser(request, 'territorio').catch(() => USUARIO);
  const senha = email === USUARIO ? SENHA : testPassword;
  const login = await request.post(`${API}/auth/login`, {
    data: { email, password: senha },
    headers: { Origin: 'http://127.0.0.1:4201' },
  });
  expect(login.ok(), `login sintético falhou (${login.status()})`).toBeTruthy();
  const cookies = await request.storageState();
  await page.context().addCookies(cookies.cookies);
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/v1/') && !/auth|admin/.test(url))
      console.log(`HTTP ${r.status()} ${url}`);
  });
  await page.goto('/?consulta=api');
  await expect(page.locator('main')).toBeVisible();
  // O seletor só existe dentro de `@if (radiusOptionsOpen())`: o disclosure do raio
  // monta o painel. Não abrir «Filtros» aqui — ele fecha o painel do raio.
  const disclosure = page.locator('button.map-radius-disclosure');
  await expect(disclosure, 'disclosure «Ajustar raio personalizado» ausente').toHaveCount(1);
  // Alterna: se já estiver aberto, clicar FECHA. Só abre quando `aria-expanded` é false.
  const expandido = await disclosure.first().getAttribute('aria-expanded');
  console.log(`disclosure aria-expanded inicial: ${expandido}`);
  if (expandido !== 'true') {
    await disclosure.first().click();
    await page.waitForTimeout(700);
  }
  console.log(
    `disclosure aria-expanded depois: ${await disclosure.first().getAttribute('aria-expanded')}`,
  );
  const localizar = await page.evaluate(() => ({
    view: document.querySelector('.app-shell')?.getAttribute('data-vu-view'),
    painel: document.querySelectorAll('#map-radius-options').length,
    busca: document.querySelectorAll('#map-locality-search').length,
    abas: Array.from(document.querySelectorAll('[data-vu-territory-level]')).map((n) =>
      n.getAttribute('data-vu-territory-level'),
    ),
  }));
  const detalhe = await page.evaluate(() => {
    const disc = document.querySelector('.territory-disclosure');
    const painel = document.querySelector('#map-radius-options');
    return {
      disc: disc
        ? {
            texto: (disc.textContent ?? '').trim().slice(0, 40),
            expanded: disc.getAttribute('aria-expanded'),
          }
        : null,
      painelTexto: (painel?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 260),
    };
  });
  console.log(`detalhe: ${JSON.stringify(detalhe)}`);
  console.log(`estado da tela: ${JSON.stringify(localizar)}`);
  await expect(page.locator('#map-locality-search'), 'seletor de território ausente').toHaveCount(
    1,
  );
}

async function escolherNivel(page: Page, nivel: 'MUNICIPALITY' | 'BAIRRO'): Promise<void> {
  const aba = page.locator(`[data-vu-territory-level="${nivel}"]`);
  await expect(aba, `sem aba de nível ${nivel}`).toHaveCount(1);
  await aba.first().click();
  await page.waitForTimeout(900);
}

async function buscar(page: Page, termo: string): Promise<void> {
  const campo = page.locator('#map-locality-search');
  await campo.fill(termo);
  await page.waitForTimeout(500);
}

test('UXH-06: abas de nível e 658 bairros disponíveis', async ({ page, request }) => {
  await abrirComSessao(page, request);
  await escolherNivel(page, 'BAIRRO');
  await buscar(page, '');
  const contagem = await page.locator('li[role="option"], [id^="map-locality-option-"]').count();
  const doBanco = Number(
    consultar(
      `SELECT count(*) FROM catalog_territories WHERE level='BAIRRO' AND approved_version IS NOT NULL;`,
    )
      .trim()
      .split('\n')
      .pop(),
  );
  console.log(`opções na lista: ${contagem} · BAIRRO publicados no banco: ${doBanco}`);
  expect(doBanco, 'banco sem os 658 bairros publicados').toBe(658);
  expect(contagem, 'a lista não oferece os bairros publicados').toBeGreaterThan(100);
});

test('UXH-06: homônimo desambiguado pelo município no rótulo', async ({ page, request }) => {
  await abrirComSessao(page, request);
  await escolherNivel(page, 'BAIRRO');
  // Nome de bairro que existe em mais de um município — lido do banco, não escolhido a dedo.
  const nome =
    consultar(`
    SELECT t.name FROM catalog_territories t
    JOIN catalog_territories p ON p.id = t.parent_id
    WHERE t.level='BAIRRO' AND t.approved_version IS NOT NULL
    GROUP BY t.name HAVING count(DISTINCT p.name) > 1
    ORDER BY count(DISTINCT p.name) DESC, t.name LIMIT 1;`)
      .trim()
      .split('\n')
      .pop() ?? '';
  console.log(`homônimo escolhido: "${nome}"`);
  expect(nome, 'nenhum bairro homônimo no catálogo').not.toBe('');
  await buscar(page, nome);
  const rotulos = await page
    .locator('li[role="option"], [id^="map-locality-option-"]')
    .evaluateAll((nos) => nos.map((n) => (n.textContent ?? '').trim().replace(/\s+/g, ' ')));
  console.log(`rótulos: ${JSON.stringify(rotulos.slice(0, 4))}`);
  expect(rotulos.length, 'busca do homônimo não retornou opções').toBeGreaterThan(1);
  const comMunicipio = rotulos.filter((r) => /\(.+\)/.test(r));
  console.log(`rótulos com município entre parênteses: ${comMunicipio.length}`);
  expect(comMunicipio.length, 'homônimo sem município no rótulo').toBe(rotulos.length);
  const municipios = new Set(comMunicipio.map((r) => (r.match(/\(([^)]+)\)/) ?? [])[1]));
  expect(municipios.size, 'as opções homônimas apontam para o mesmo município').toBeGreaterThan(1);
});

test('UXH-06: centro exibido confere com o internal_point do banco', async ({ page, request }) => {
  await abrirComSessao(page, request);
  await escolherNivel(page, 'BAIRRO');
  await buscar(page, 'Icaraí');
  const opcao = page.locator('li[role="option"], [id^="map-locality-option-"]').first();
  await expect(opcao, 'busca por Icaraí sem opção').toHaveCount(1);
  const rotulo = ((await opcao.textContent()) ?? '').trim().replace(/\s+/g, ' ');
  console.log(`opção: "${rotulo.slice(0, 70)}"`);
  await opcao.click();
  await page.waitForTimeout(800);

  const centro = page.locator('.map-radius-center');
  await expect(centro, 'centro não exibido após selecionar').toHaveCount(1);
  const texto = ((await centro.textContent()) ?? '').trim().replace(/\s+/g, ' ');
  console.log(`centro na tela: "${texto.slice(0, 110)}"`);

  const banco =
    consultar(`
    SELECT round(ST_Y(v.internal_point)::numeric, 4) || '|' || round(ST_X(v.internal_point)::numeric, 4)
    FROM catalog_territories t
    JOIN catalog_territory_versions v ON v.territory_id = t.id AND v.version = t.approved_version
    WHERE t.level='BAIRRO' AND t.name='Icaraí'
    ORDER BY t.official_code LIMIT 1;`)
      .trim()
      .split('\n')
      .pop() ?? '';
  const [lat, lon] = banco.split('|');
  console.log(`internal_point no banco: lat ${lat} · lon ${lon}`);
  // A tela pode usar ponto ou vírgula decimal: aceito as duas formas do valor do banco.
  const variantes = (valor: string) => [valor, valor.replace('.', ',')];
  const temLat = variantes(lat ?? '').some((v) => v && texto.includes(v));
  const temLon = variantes(lon ?? '').some((v) => v && texto.includes(v));
  console.log(`tela contém lat=${temLat} · lon=${temLon}`);
  expect(
    temLat && temLon,
    `o centro da tela não é o internal_point do servidor (banco: ${banco})`,
  ).toBe(true);
});

test('UXH-06: trocar de nível preserva a seleção vigente', async ({ page, request }) => {
  await abrirComSessao(page, request);
  await escolherNivel(page, 'BAIRRO');
  await buscar(page, 'Icaraí');
  await page.locator('li[role="option"], [id^="map-locality-option-"]').first().click();
  await page.waitForTimeout(700);
  const antes = ((await page.locator('.map-radius-center').textContent()) ?? '').trim();
  expect(antes, 'seleção não produziu centro').not.toBe('');
  await escolherNivel(page, 'MUNICIPALITY');
  const depois = ((await page.locator('.map-radius-center').textContent()) ?? '').trim();
  console.log(`centro antes="${antes.slice(0, 50)}" · depois="${depois.slice(0, 50)}"`);
  expect(depois, 'trocar de nível limpou a seleção vigente').toBe(antes);
});

test('UXH-06: RA/AP não têm aba e o vazio é declarado', async ({ page, request }) => {
  await abrirComSessao(page, request);
  const ra = await page.locator('[data-vu-territory-level="RA"]').count();
  const ap = await page.locator('[data-vu-territory-level="AP"]').count();
  const publicados = consultar(
    `SELECT count(*) FROM catalog_territories WHERE level IN ('RA','AP') AND approved_version IS NOT NULL;`,
  )
    .trim()
    .split('\n')
    .pop();
  const texto = ((await page.locator('main').textContent()) ?? '').toLowerCase();
  const declara = /área de risco|sem fonte|não cadastrad|lacuna|nenhum territ/i.test(texto);
  console.log(
    `abas RA=${ra} · AP=${ap} · RA/AP publicados=${publicados} · vazio declarado=${declara}`,
  );
  expect(Number(publicados), 'há RA/AP publicados — a lacuna do Rio deixou de existir').toBe(0);
  expect(ra + ap, 'aba RA/AP existe sem território publicado').toBe(0);
  expect(declara, 'o vazio de RA/AP não é declarado na tela').toBe(true);
});
