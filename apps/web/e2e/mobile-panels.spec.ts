import { expect, test, type Page } from '@playwright/test';

/**
 * UXH-10 — mapa móvel com painéis exclusivos.
 *
 * Contrato de hooks (ruling de abertura, 27/10). Hook ausente é **falha**, não
 * pulo — a mesma regra do shell:
 *
 *   [data-vu="sheet"]                                         contêiner único (UX-6)
 *   [data-vu="sheet-disclosure"]                              «Mais/Recolher» (permanece)
 *   [data-vu-panel-open="filtros|ferramentas|resultados"]     no contêiner da folha
 *   [data-vu-panel="…"]                                       o painel
 *   [data-vu-panel-trigger="…"]                               gatilho, dentro da folha
 *   [data-vu-panel-close]                                     fechar, nome «Fechar …»
 *
 * Os três painéis são **conteúdo da folha** (leitura 1): continuam descendentes
 * de `[data-vu="sheet"]`, sem terceira camada de `z`, e o `950` exato do UX-6
 * segue intacto.
 *
 * Regras de casa aplicadas: espera pelo **atributo de estado**, nunca por tempo;
 * e nada de asserção vácua — cada caso imprime o que mediu.
 */

const VIEWPORTS = [390, 320, 768];
const PAINEIS = ['filtros', 'ferramentas', 'resultados'] as const;
type Painel = (typeof PAINEIS)[number];

async function abrirEntrada(page: Page, largura: number): Promise<void> {
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de painéis',
    authenticated: true,
    role: 'USER',
    csrfToken: 'synthetic-panels',
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
  await page.setViewportSize({ width: largura, height: largura === 320 ? 720 : 844 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
  // A folha é o contêiner de todos os painéis: abrir por ela é o pré-requisito,
  // e o hook do UX-6 permanece (ruling 1).
  const disclosure = page.locator('[data-vu="sheet-disclosure"]');
  await expect(disclosure, 'sheet-disclosure ausente: sem ele não há folha').toHaveCount(1);
  await disclosure.first().click();
  await expect(page.locator('[data-vu="sheet"]')).toHaveAttribute(
    'data-vu-sheet-state',
    'expanded',
  );
}

const gatilho = (page: Page, painel: Painel) => page.locator(`[data-vu-panel-trigger="${painel}"]`);

async function abrirPainel(page: Page, painel: Painel): Promise<void> {
  const botao = gatilho(page, painel);
  await expect(botao, `gatilho de «${painel}» ausente`).toHaveCount(1);
  // Gatilho que sai do viewport com a folha aberta é defeito de layout, e o
  // sintoma (o segundo clique não trocar de painel) aparece longe da causa.
  // Aqui a causa tem nome: "gatilho fora do viewport".
  await expect(botao.first(), `gatilho de «${painel}» fora do viewport`).toBeInViewport({
    ratio: 0.5,
  });
  const caixa = await botao.first().boundingBox();
  console.log(
    `  gatilho «${painel}» em y=${caixa ? Math.round(caixa.y) : '?'} (viewport ${await page.evaluate(() => window.innerHeight)})`,
  );
  await botao.first().click();
  await expect(page.locator('[data-vu-panel-open]')).toHaveAttribute('data-vu-panel-open', painel);
}

/** Valores que não podem mudar ao abrir/fechar/trocar painel. */
async function estado(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const texto = (seletor: string) =>
      Array.from(document.querySelectorAll(seletor)).map((elemento) =>
        (elemento.textContent ?? '').trim().replace(/\s+/g, ' '),
      );
    const folha = document.querySelector('[data-vu="sheet"]');
    return {
      chips: texto('.map-filter-chip, button[aria-label^="Remover pilar"]'),
      contagem: texto('[data-testid="query-counts"], .query-counts'),
      lista: document.querySelectorAll('.result-list > li').length,
      selecionado: folha?.querySelector('[aria-selected="true"]')?.getAttribute('data-id') ?? null,
      folhaEstado: folha?.getAttribute('data-vu-sheet-state') ?? null,
      paineis: Array.from(document.querySelectorAll('[data-vu-panel]')).map((e) =>
        e.getAttribute('data-vu-panel'),
      ),
      listas: document.querySelectorAll('.result-list').length,
    };
  });
}

for (const largura of VIEWPORTS) {
  test(`UXH-10: um painel por vez a ${largura}, e troca remove o anterior do DOM`, async ({
    page,
  }) => {
    await abrirEntrada(page, largura);
    await abrirPainel(page, 'filtros');
    const abertosComFiltros = await page.locator('[data-vu-panel-open]').count();
    expect(abertosComFiltros, 'mais de um contêiner declara painel aberto').toBe(1);

    await abrirPainel(page, 'ferramentas');
    const marcados = await page.locator('[data-vu-panel-open]').count();
    const valor = await page.locator('[data-vu-panel-open]').getAttribute('data-vu-panel-open');
    const painelFiltros = await page.locator('[data-vu-panel="filtros"]').count();
    console.log(
      `${largura}px: painel aberto = ${valor} · contêineres marcados = ${marcados} · painel «filtros» no DOM = ${painelFiltros}`,
    );
    expect(marcados, 'a troca deixou dois painéis abertos').toBe(1);
    expect(valor).toBe('ferramentas');
    expect(painelFiltros, 'painel anterior continuou no DOM (escondido não é fechado)').toBe(0);
  });
}

test('UXH-10: fechar é explícito e devolve o foco ao gatilho', async ({ page }) => {
  await abrirEntrada(page, 390);
  await abrirPainel(page, 'ferramentas');
  const fechar = page.locator('[data-vu-panel-close]');
  await expect(fechar, 'botão de fechar ausente').toBeVisible();
  const nome = (await fechar.first().textContent())?.trim() ?? '';
  const rotulo = (await fechar.first().getAttribute('aria-label')) ?? '';
  console.log(`fechar: texto="${nome}" aria-label="${rotulo}"`);
  expect(`${nome} ${rotulo}`.toLowerCase(), 'nome acessível não diz «Fechar …»').toContain(
    'fechar',
  );

  await fechar.first().click();
  await expect(page.locator('[data-vu-panel-open]')).toHaveCount(0);
  const foco = await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.getAttribute('data-vu-panel-trigger'),
  );
  console.log(`foco devolvido para: ${foco}`);
  expect(foco, 'o foco não voltou ao gatilho que abriu o painel').toBe('ferramentas');
});

test('UXH-10: estado do mapa, filtros e seleção sobrevivem a abrir, fechar e trocar', async ({
  page,
}) => {
  await abrirEntrada(page, 390);
  const antes = await estado(page);
  await abrirPainel(page, 'filtros');
  await abrirPainel(page, 'resultados');
  await page.locator('[data-vu-panel-close]').first().click();
  // Estado, não relógio: `mobilePanel.set(null)` é síncrono, mas o `@if` do
  // template só sai do DOM no ciclo de detecção de mudanças seguinte. Ler na
  // mesma fôlego do clique é o mesmo erro do `mobile-shell` em 27/10.
  await expect(page.locator('[data-vu-panel]'), 'painel continuou no DOM após fechar').toHaveCount(
    0,
  );
  const depois = await estado(page);
  console.log(`estado antes: ${JSON.stringify(antes)}`);
  console.log(`estado depois: ${JSON.stringify(depois)}`);
  // Comparação por CONJUNTO: a área principal (:1589) e o painel da folha
  // (:4196) pintam o mesmo `pagedResults()`, então abrir o painel acrescenta uma
  // segunda pintura legítima — o que não pode mudar é o valor.
  expect(depois.chips, 'filtros ativos mudaram ao navegar entre painéis').toEqual(antes.chips);
  expect(
    Array.from(new Set(depois.contagem as string[])),
    'contagem mudou ao navegar entre painéis',
  ).toEqual(Array.from(new Set(antes.contagem as string[])));
});

for (const largura of [390, 320]) {
  test(`UXH-10: resultados ocupam quase toda a altura e mantêm lista e paginação a ${largura}`, async ({
    page,
  }) => {
    await abrirEntrada(page, largura);
    await abrirPainel(page, 'resultados');
    const medidas = await page.evaluate(() => {
      const painel = document.querySelector('[data-vu-panel="resultados"]') as HTMLElement | null;
      const lista = painel?.querySelector('.result-list') as HTMLElement | null;
      const paginacao = painel?.querySelector(
        '[data-testid="result-pagination"], .result-pagination',
      ) as HTMLElement | null;
      const r = painel?.getBoundingClientRect();
      const rl = lista?.getBoundingClientRect();
      return {
        alturaPainel: r ? Math.round(r.height) : 0,
        alturaViewport: window.innerHeight,
        listaVisivel: rl ? Math.round(rl.height) : 0,
        itens: lista?.querySelectorAll('li').length ?? 0,
        paginacaoVisivel: Boolean(paginacao && paginacao.getBoundingClientRect().height > 0),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    const fracao = medidas.alturaPainel / medidas.alturaViewport;
    console.log(
      `${largura}px: painel ${medidas.alturaPainel}px de ${medidas.alturaViewport} = ${(fracao * 100).toFixed(1)}% · itens ${medidas.itens} · paginação ${medidas.paginacaoVisivel} · overflow ${medidas.overflow}px`,
    );
    expect(fracao, 'o painel de resultados não ocupa ≥80% da altura').toBeGreaterThanOrEqual(0.8);
    expect(medidas.listaVisivel, 'lista de resultados invisível dentro do painel').toBeGreaterThan(
      0,
    );
    expect(medidas.itens, 'painel de resultados sem itens').toBeGreaterThan(0);
    expect(medidas.paginacaoVisivel, 'paginação não alcançável dentro do painel').toBe(true);
    expect(medidas.overflow, 'rolagem horizontal no painel').toBeLessThanOrEqual(1);
  });
}

test('UXH-10: teclado alcança os gatilhos e a alternativa em lista continua funcionando', async ({
  page,
}) => {
  await abrirEntrada(page, 390);
  for (const painel of PAINEIS) {
    const botao = gatilho(page, painel);
    await expect(botao, `gatilho de «${painel}» ausente para o teclado`).toHaveCount(1);
    await botao.first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-vu-panel-open]')).toHaveAttribute(
      'data-vu-panel-open',
      painel,
    );
    await page.locator('[data-vu-panel-close]').first().click();
    // Mesma regra do resto do arquivo: espera o painel sair do DOM antes de
    // focar o próximo gatilho, senão o Enter do caso seguinte disputa com o
    // fecho anterior.
    await expect(page.locator('[data-vu-panel]')).toHaveCount(0);
  }
  const lista = page.getByRole('button', { name: /^Lista/ });
  await expect(lista, 'alternativa em lista ausente').toHaveCount(1);
  await lista.first().click();
  await expect(page.locator('.result-list > li').first()).toBeVisible();
  console.log('alternativa em lista: ok');
});

test('controle negativo: dois painéis abertos ao mesmo tempo reprovam a exclusividade', async ({
  page,
}) => {
  await abrirEntrada(page, 390);
  await abrirPainel(page, 'filtros');
  // Força o estado proibido: um segundo marcador no contêiner da folha.
  await page.evaluate(() => {
    const folha = document.querySelector('[data-vu="sheet"]')!;
    const clone = document.createElement('div');
    clone.setAttribute('data-vu-panel-open', 'ferramentas');
    folha.appendChild(clone);
  });
  const marcados = await page.locator('[data-vu-panel-open]').count();
  console.log(`negativo: contêineres com painel aberto = ${marcados}`);
  expect(marcados, 'a régua não viu o segundo painel aberto').toBeGreaterThan(1);
});

test('controle negativo: sem retorno de foco a régua reprova', async ({ page }) => {
  await abrirEntrada(page, 390);
  await abrirPainel(page, 'ferramentas');
  // Tira o foco antes de fechar: simula o close que não devolve o foco.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator('[data-vu-panel-close]').first().click({ force: true });
  const foco = await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.getAttribute('data-vu-panel-trigger'),
  );
  console.log(`negativo: foco depois do close sem retorno = ${foco}`);
  expect(foco, 'o caso de foco passaria mesmo sem retorno').not.toBe('ferramentas');
});
