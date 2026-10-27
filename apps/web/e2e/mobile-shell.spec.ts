import { expect, test, type Page } from '@playwright/test';

/**
 * UX-6 — shell móvel, passada 1: hooks, topbar, conteúdo, paradas de foco e
 * hit-test do disclosure.
 *
 * Regra dura desta régua: **hook ausente é falha, não pulo.** Foi assim que a
 * spec antiga (`ux6-folha-barra.spec.ts`) virou fixture inútil — ela pulava o
 * app real e provava só a si mesma. Aqui, se `[data-vu="bottom-bar"]` não
 * existe, o teste reprova com o seletor na mensagem.
 *
 * Medições a 390, 320 e 768:
 *  - topbar ≤ **64 px**;
 *  - conteúdo ≥ **80%** do viewport;
 *  - **0 paradas de foco cortadas** (`pxVisiveis == largura` para cada alvo
 *    focável visível);
 *  - clique no centro da barra acerta a folha (hit-test), com o estado em
 *    `data-vu-sheet-state` ∈ {`collapsed`, `expanded`}.
 *
 * Nada de literal: as alturas medidas vêm do DOM, e o teste imprime os números
 * para que o conserto use `--vu-target`/`--vu-sheet-gap`, não números soltos.
 *
 * REGRA DE CASA (27/10): asserção que depende de mudança de estado espera o
 * **atributo de estado** (`data-vu-sheet-state`, `aria-expanded`, `data-theme`),
 * nunca um tempo fixo nem "a linha seguinte". Três vezes a mesma classe nesta
 * rodada: leitura no meio de `border-color .15s` (UX-9), folha em transição
 * (UX-6) e folha após o clique com a conta dentro dela (UXH-07). O produto
 * estava certo nas três; o instrumento é que lia antes do render.
 */

const VIEWPORTS = [
  { largura: 390, altura: 844 },
  { largura: 320, altura: 720 },
  { largura: 768, altura: 1024 },
];
const TOPBAR_MAXIMA = 64;
const CONTEUDO_MINIMO = 0.8;

type Caixa = {
  presente: boolean;
  altura: number;
  largura: number;
  topo: number;
  base: number;
  z: string;
};
type Parada = { rotulo: string; largura: number; pxVisiveis: number; cortada: boolean };
type Shell = {
  topbar: Caixa;
  barra: Caixa;
  folha: Caixa;
  disclosure: Caixa;
  estado: string | null;
  conteudo: { altura: number; viewport: number; razao: number };
  paradas: { total: number; cortadas: Parada[] };
  teclado: Array<{ rotulo: string; texto: string; nome: string; contem: boolean | null }>;
};

/** Serializada para o navegador. */
function lerShell(): Shell {
  const caixa = (seletor: string): Caixa => {
    const elemento = document.querySelector(seletor);
    if (!elemento) return { presente: false, altura: 0, largura: 0, topo: 0, base: 0, z: '' };
    const rect = elemento.getBoundingClientRect();
    return {
      presente: true,
      altura: Number(rect.height.toFixed(1)),
      largura: Number(rect.width.toFixed(1)),
      topo: Number(rect.top.toFixed(1)),
      base: Number(rect.bottom.toFixed(1)),
      z: getComputedStyle(elemento).zIndex,
    };
  };
  const rotular = (elemento: Element): string => {
    const classe = (elemento.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
    const texto = (elemento.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${elemento.tagName.toLowerCase()}${classe ? '.' + classe : ''}${texto ? ` «${texto}»` : ''}`;
  };

  const focaveis = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((elemento) => {
    // Pino do mapa fora da viewport é comportamento normal do mapa, não parada
    // de foco cortada: a parada do shell é o que está no fluxo do documento.
    if (elemento.closest('#map-canvas')) return false;
    const rect = elemento.getBoundingClientRect();
    const estilo = getComputedStyle(elemento);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      estilo.visibility !== 'hidden' &&
      estilo.display !== 'none'
    );
  });
  const cortadas: Parada[] = [];
  for (const elemento of focaveis) {
    const rect = elemento.getBoundingClientRect();
    const visivel =
      Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) +
      Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const larguraVisivel = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
    const pxVisiveis = Number(Math.max(0, larguraVisivel).toFixed(1));
    const cortada =
      pxVisiveis + 0.5 < rect.width ||
      visivel <= 0 ||
      rect.left < 0 ||
      rect.right > window.innerWidth + 0.5;
    if (cortada) {
      cortadas.push({
        rotulo: rotular(elemento),
        largura: Number(rect.width.toFixed(1)),
        pxVisiveis,
        cortada,
      });
    }
  }

  const main = document.querySelector('main');
  const alturaConteudo = main ? Number(main.getBoundingClientRect().height.toFixed(1)) : 0;

  return {
    topbar: caixa('.topbar'),
    barra: caixa('[data-vu="bottom-bar"]'),
    folha: caixa('[data-vu="sheet"]'),
    disclosure: caixa('[data-vu="sheet-disclosure"]'),
    estado:
      document.querySelector('[data-vu="sheet"]')?.getAttribute('data-vu-sheet-state') ?? null,
    conteudo: {
      altura: alturaConteudo,
      viewport: window.innerHeight,
      razao: Number((alturaConteudo / window.innerHeight).toFixed(3)),
    },
    paradas: { total: focaveis.length, cortadas },
    // Ordem de DOM: `querySelectorAll` já devolve na ordem do documento.
    // Nome acessível: **contém** o texto visível (WCAG 2.5.3), comparados
    // depois de normalizar decoração (`×`, `⌄`) e contadores. Texto vazio
    // devolve `null`: "vazio contém tudo" seria vacuidade — o FAB é asserido
    // por igualdade de papel e nome, não por aqui.
    teclado: focaveis.map((elemento) => {
      const texto = (elemento.textContent ?? '').trim().replace(/\s+/g, ' ');
      const rotuloAria = (elemento.getAttribute('aria-label') ?? '').trim();
      const nome = rotuloAria || texto;
      const normalizar = (valor: string) =>
        valor
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[×✕⌄⌃▾▴]/g, ' ')
          .replace(/\d+/g, ' ')
          .replace(/[^\p{L}\s]/gu, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      return {
        rotulo: rotular(elemento),
        texto,
        nome,
        contem: texto ? normalizar(nome).includes(normalizar(texto)) : null,
      };
    }),
  };
}

async function abrirEntrada(page: Page, largura: number, altura: number): Promise<void> {
  const sessao = { code: 'S', message: 's', authenticated: true, role: 'USER', csrfToken: 'x' };
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
  await page.setViewportSize({ width: largura, height: altura });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
}

test('UX-6: os hooks do shell existem (ausente é falha, não pulo)', async ({ page }) => {
  await abrirEntrada(page, 390, 844);
  const shell = await page.evaluate(lerShell);
  expect(shell.barra.presente, '[data-vu="bottom-bar"] ausente no DOM').toBe(true);
  expect(shell.folha.presente, '[data-vu="sheet"] ausente no DOM').toBe(true);
  expect(shell.disclosure.presente, '[data-vu="sheet-disclosure"] ausente no DOM').toBe(true);
  expect(['collapsed', 'expanded'], 'data-vu-sheet-state fora do contrato').toContain(shell.estado);
});

for (const viewport of VIEWPORTS) {
  test(`UX-6: topbar ≤ ${TOPBAR_MAXIMA}px e conteúdo ≥ ${CONTEUDO_MINIMO * 100}% a ${viewport.largura}`, async ({
    page,
  }) => {
    await abrirEntrada(page, viewport.largura, viewport.altura);
    const shell = await page.evaluate(lerShell);
    console.log(
      `${viewport.largura}px: topbar ${shell.topbar.altura}px · conteúdo ${shell.conteudo.altura}px de ${shell.conteudo.viewport} = ${(shell.conteudo.razao * 100).toFixed(1)}% · barra ${shell.barra.altura || '—'}px`,
    );
    expect(shell.topbar.presente, '.topbar ausente').toBe(true);
    expect(
      shell.topbar.altura,
      `topbar ${shell.topbar.altura}px > ${TOPBAR_MAXIMA}px`,
    ).toBeLessThanOrEqual(TOPBAR_MAXIMA);
    expect(
      shell.conteudo.razao,
      `conteúdo ${(shell.conteudo.razao * 100).toFixed(1)}% do viewport (mínimo ${CONTEUDO_MINIMO * 100}%)`,
    ).toBeGreaterThanOrEqual(CONTEUDO_MINIMO);
  });

  test(`UX-6: nenhuma parada de foco cortada a ${viewport.largura}`, async ({ page }) => {
    await abrirEntrada(page, viewport.largura, viewport.altura);
    const shell = await page.evaluate(lerShell);
    console.log(
      `${viewport.largura}px: ${shell.paradas.total} paradas, ${shell.paradas.cortadas.length} cortadas`,
    );
    for (const parada of shell.paradas.cortadas.slice(0, 8)) {
      console.log(`  cortada ${parada.rotulo} ${parada.pxVisiveis}/${parada.largura}px visíveis`);
    }
    expect(shell.paradas.total, 'nenhuma parada de foco: medição vazia').toBeGreaterThan(5);
    // `pxVisiveis == largura` é a forma operacional de "não cortada".
    expect(
      shell.paradas.cortadas.map(
        (parada) => `${parada.rotulo} ${parada.pxVisiveis}/${parada.largura}`,
      ),
      `paradas cortadas a ${viewport.largura}`,
    ).toEqual([]);
  });
}

/**
 * UX-6 — hit-test do centro da barra **nos dois estados**, que é o único jeito
 * de "a folha cobre a barra" significar algo:
 *
 *  - recolhida: a folha não cobre — o clique acerta um `vu-bar-item`;
 *  - expandida: a folha cobre — o clique acerta a folha e **não** um item.
 *
 * A mutação fecha o par: com a folha forçada a `z` 800 na expandida, o clique
 * volta a acertar item da barra e o caso **tem** de reprovar. Sem isso, a
 * asserção da expandida poderia passar sem a folha cobrir nada.
 */
test('UX-6: hit-test do centro da barra nos dois estados', async ({ page }) => {
  const alvo = () =>
    page.evaluate(() => {
      const barra = document.querySelector('[data-vu="bottom-bar"]');
      if (!barra) return null;
      const rect = barra.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const atingido = document.elementFromPoint(x, y);
      return {
        x: Math.round(x),
        y: Math.round(y),
        rotulo: atingido
          ? `${atingido.tagName.toLowerCase()}.${(atingido.getAttribute('class') ?? '').split(/\s+/)[0]}`
          : 'nada',
        naFolha: Boolean(atingido?.closest('[data-vu="sheet"]')),
        naItem: Boolean(atingido?.closest('.vu-bar-item')),
      };
    });

  await abrirEntrada(page, 390, 844);
  const recolhida = await alvo();
  console.log(
    `hit-test recolhida: (${recolhida?.x}, ${recolhida?.y}) atingiu ${recolhida?.rotulo} — item=${recolhida?.naItem}`,
  );
  expect(recolhida?.naItem, 'recolhida: o centro da barra não acertou um item da barra').toBe(true);

  await page.locator('[data-vu="sheet-disclosure"]').first().click();
  // Estado, não tempo: o clique resolve quando o evento é despachado, e
  // `mobileSheet` chega ao template no ciclo de detecção de mudanças seguinte.
  // Com a conta dentro da folha (UXH-07) o render ficou um ciclo mais caro e a
  // leitura na linha seguinte passou a pegar `collapsed` — falso vermelho de
  // instrumento, 27/10. Asserção que depende de mudança de estado espera o
  // atributo de estado, nunca um tempo fixo.
  await expect(page.locator('[data-vu="sheet"]')).toHaveAttribute(
    'data-vu-sheet-state',
    'expanded',
  );
  const expandida = await alvo();
  const geometria = await page.evaluate(lerShell);
  console.log(
    `hit-test expandida: atingiu ${expandida?.rotulo} — folha=${expandida?.naFolha} item=${expandida?.naItem}`,
  );
  console.log(
    `  geometria: folha ${geometria.folha.topo}→${geometria.folha.base} (z ${geometria.folha.z}) · barra ${geometria.barra.topo}→${geometria.barra.base} (z ${geometria.barra.z}) · viewport ${geometria.conteudo.viewport}`,
  );
  expect(expandida?.naFolha, 'expandida: o centro da barra não acertou a folha').toBe(true);
  expect(expandida?.naItem, 'expandida: o centro da barra ainda acertou item da barra').toBe(false);

  // Mutação: folha abaixo da barra na expandida → o caso acima tem de falhar.
  await page.addStyleTag({ content: '[data-vu="sheet"] { z-index: 800 !important; }' });
  await page.waitForTimeout(200);
  const mutado = await alvo();
  console.log(`mutação z=800: atingiu ${mutado?.rotulo} — item=${mutado?.naItem}`);
  expect(mutado?.naItem, 'a régua não detectou a folha abaixo da barra').toBe(true);
});

/**
 * Controle negativo: a régua tem de acompanhar a altura real, não um número
 * herdado. Como a topbar de hoje já estoura o teto, a sonda **encolhe** para
 * 50 px: se o leitor devolver 50, ele lê o DOM; se devolver 233, está medindo
 * outra coisa.
 */
test('controle negativo: topbar reduzida a 50px é lida pela régua', async ({ page }) => {
  await abrirEntrada(page, 390, 844);
  const antes = await page.evaluate(lerShell);
  await page.addStyleTag({
    content:
      '.topbar { height: 50px !important; min-height: 0 !important; max-height: 50px !important; overflow: hidden; }',
  });
  await page.waitForTimeout(200);
  const depois = await page.evaluate(lerShell);
  console.log(`negativo: topbar ${antes.topbar.altura}px → ${depois.topbar.altura}px`);
  expect(depois.topbar.altura, 'a régua não acompanhou a altura injetada').toBeLessThanOrEqual(
    TOPBAR_MAXIMA,
  );
  expect(depois.topbar.altura).not.toBe(antes.topbar.altura);
});

/** UX-6 passada 2 — contrato de `z`: barra ≤940, folha 950 colapsada, 1200 expandida. */
test('UX-6: z da barra ≤ 940 e da folha 950 / 1200 nos dois estados', async ({ page }) => {
  await abrirEntrada(page, 390, 844);
  const fechada = await page.evaluate(lerShell);
  expect(fechada.barra.presente && fechada.folha.presente, 'hooks ausentes: sem z para medir').toBe(
    true,
  );
  const zBarra = Number(fechada.barra.z);
  const zFolha = Number(fechada.folha.z);
  console.log(`z colapsada: barra ${zBarra} · folha ${zFolha} (${fechada.estado})`);
  expect(zBarra, `z da barra ${zBarra} > 940`).toBeLessThanOrEqual(940);
  expect(zFolha, `z da folha colapsada ${zFolha} ≠ 950`).toBe(950);

  await page.locator('[data-vu="sheet-disclosure"]').first().click();
  // Estado, não tempo: o clique resolve quando o evento é despachado, e
  // `mobileSheet` chega ao template no ciclo de detecção de mudanças seguinte.
  // Com a conta dentro da folha (UXH-07) o render ficou um ciclo mais caro e a
  // leitura na linha seguinte passou a pegar `collapsed` — falso vermelho de
  // instrumento, 27/10. Asserção que depende de mudança de estado espera o
  // atributo de estado, nunca um tempo fixo.
  await expect(page.locator('[data-vu="sheet"]')).toHaveAttribute(
    'data-vu-sheet-state',
    'expanded',
  );
  const aberta = await page.evaluate(lerShell);
  console.log(`z expandida: folha ${aberta.folha.z} (${aberta.estado})`);
  expect(aberta.estado, 'estado depois do disclosure').toBe('expanded');
  expect(Number(aberta.folha.z), `z da folha expandida ${aberta.folha.z} ≠ 1200`).toBe(1200);
});

/** UX-6 passada 2 — a folha assenta na altura medida da barra + `--vu-sheet-gap`. */
test('UX-6: bottom da folha = altura da barra + 12, com delta ≤ 1px', async ({ page }) => {
  await abrirEntrada(page, 390, 844);
  const shell = await page.evaluate(lerShell);
  expect(shell.barra.presente).toBe(true);
  const offset = Number((shell.conteudo.viewport - shell.folha.base).toFixed(1));
  const esperado = Number((shell.barra.altura + 12).toFixed(1));
  console.log(
    `bottom: folha assenta em ${offset}px · barra ${shell.barra.altura}px + 12 = ${esperado}px`,
  );
  expect(
    Math.abs(offset - esperado),
    `folha a ${offset}px, esperado ${esperado}px`,
  ).toBeLessThanOrEqual(1);
});

/** UX-6 passada 2 — um nome, um alvo: o FAB é o único "Registrar ocorrência". */
test('UX-6: o FAB é 48×48 e é o único «Registrar ocorrência» no móvel', async ({ page }) => {
  await abrirEntrada(page, 390, 844);
  const botoes = page.getByRole('button', { name: 'Registrar ocorrência', exact: true });
  const total = await botoes.count();
  console.log(`«Registrar ocorrência»: ${total} alvo(s) no móvel`);
  expect(total, 'nome duplicado ou ausente no móvel').toBe(1);
  const caixa = await botoes.first().evaluate((elemento) => {
    const rect = elemento.getBoundingClientRect();
    return {
      largura: Number(rect.width.toFixed(1)),
      altura: Number(rect.height.toFixed(1)),
      texto: (elemento.textContent ?? '').trim(),
    };
  });
  console.log(
    `FAB: ${caixa.largura}×${caixa.altura} «${caixa.texto}» (ícone puro: nome por igualdade)`,
  );
  expect(caixa.largura).toBeGreaterThanOrEqual(47.5);
  expect(caixa.largura).toBeLessThanOrEqual(48.5);
  expect(caixa.altura).toBeGreaterThanOrEqual(47.5);
  expect(caixa.altura).toBeLessThanOrEqual(48.5);
});

/** UX-6 passada 2 — teclado: ordem do DOM, skip link primeiro, nome contém o texto (2.5.3). */
test('UX-6: teclado em ordem de DOM, skip link primeiro, nome acessível contém o texto', async ({
  page,
}) => {
  await abrirEntrada(page, 390, 844);
  const shell = await page.evaluate(lerShell);
  console.log(
    `teclado: ${shell.teclado.length} paradas em ordem de DOM (registro, não asserção de contagem)`,
  );
  expect(shell.teclado.length, 'nenhuma parada de teclado: medição vazia').toBeGreaterThan(5);
  expect(
    shell.teclado[0]?.texto.toLowerCase(),
    `primeira parada é «${shell.teclado[0]?.texto}»`,
  ).toContain('ir para o conteúdo');
  const divergentes = shell.teclado
    .filter((parada) => parada.contem === false)
    .map((parada) => `${parada.rotulo} nome «${parada.nome}» não contém «${parada.texto}»`);
  for (const divergencia of divergentes.slice(0, 8)) console.log(`  ${divergencia}`);
  expect(divergentes, 'nome acessível não contém o texto visível').toEqual([]);
  // A contenção só é exigível de quem tem texto visível; o FAB (ícone puro) é
  // asserido por igualdade no caso dele, e aqui aparece como `null`.
  const semTexto = shell.teclado.filter((parada) => parada.contem === null).length;
  console.log(`  ${semTexto} parada(s) sem texto visível — contenção não se aplica`);
});

/** Mutação de `z` e de `bottom`: a régua tem de enxergar o valor injetado. */
test('controle negativo: z e bottom injetados são lidos pela régua', async ({ page }) => {
  await abrirEntrada(page, 390, 844);
  await page.addStyleTag({
    content: '[data-vu="sheet"] { z-index: 900 !important; bottom: 56px !important; }',
  });
  await page.waitForTimeout(200);
  const shell = await page.evaluate(lerShell);
  const offset = Number((shell.conteudo.viewport - shell.folha.base).toFixed(1));
  console.log(`negativo: z ${shell.folha.z} · bottom ${offset}px (esperado 56)`);
  expect(Number(shell.folha.z), 'a régua não viu o z injetado').toBe(900);
  expect(
    Math.abs(offset - 56),
    `a régua não viu o bottom injetado (${offset}px)`,
  ).toBeLessThanOrEqual(1);
});
