import { expect, test, type Page } from '@playwright/test';

/**
 * UX-5 — corte de copy. Régua no DOM, por texto **próprio** de cada bloco.
 *
 * O que conta como **linha de apoio**: bloco visível dentro de `main` cujo texto
 * próprio (nós de texto do elemento, não dos filhos) tem 40 caracteres ou mais.
 * Ficam de fora, por definição: título, rótulo de controle, botão, link, dado
 * da consulta e mensagem de estado.
 *
 * Cada bloco é classificado em **obrigação** ou **prosa**. Obrigação é conteúdo
 * que carrega dever e não pode ser cortado para bater número: atribuição de
 * fonte, licença, data, limitação do dado, aviso de demonstração e procedimento
 * de correção. A régua imprime os dois conjuntos: o critério do lote (`≤20
 * linhas`, `média ≤60 ch`) é aplicado à **prosa**, porque cortar obrigação
 * está proibido pelo próprio lote — e média que só fecha encolhendo atribuição
 * seria critério reduzido pela porta dos fundos.
 *
 * Repetição é medida por frase normalizada (≥30 ch) presente em mais de um
 * bloco. Instrução padrão é frase imperativa (clique/selecione/…) repetida em
 * mais de um bloco.
 */

const MINIMO_CH = 40;
const MAXIMO_LINHAS = 20;
const MEDIA_MAXIMA_CH = 60;
const MARCA_OBRIGACAO =
  /atribui|licen[cç]|fonte|sintétic|fict[ií]ci|demonstra|corre[cç][õo]|limita|precis[ãa]o compat|compat[íi]vel|n[ãa]o entram|geocodificador|refer[êe]ncia:|direitos/i;

type Bloco = { rotulo: string; chars: number; tipo: 'obrigacao' | 'prosa'; texto: string };
type Relatorio = {
  blocos: Bloco[];
  prosa: { total: number; media: number; maior: Bloco | null };
  obrigacao: { total: number; media: number; maior: Bloco | null };
  repetidas: Array<{ frase: string; blocos: string[] }>;
  instrucoesPadrao: Array<{ frase: string; blocos: string[] }>;
  details: number;
  detailsEscopo: number;
  detailsResumos: string[];
  mistos: Array<{ rotulo: string; obrigatorias: string[]; cortaveis: string[] }>;
};

/** Serializada para o navegador. */
function lerCopy(entrada: { minimoCh: number; marcaObrigacao: string }): Relatorio {
  const marca = new RegExp(entrada.marcaObrigacao, 'i');
  const visivel = (elemento: Element): boolean => {
    const caixa = elemento.getBoundingClientRect();
    const estilo = getComputedStyle(elemento);
    return (
      caixa.width > 0 &&
      caixa.height > 0 &&
      estilo.visibility !== 'hidden' &&
      estilo.display !== 'none'
    );
  };
  const textoProprio = (elemento: Element): string =>
    Array.from(elemento.childNodes)
      .filter((no) => no.nodeType === Node.TEXT_NODE)
      .map((no) => no.textContent ?? '')
      .join(' ')
      .trim()
      .replace(/\s+/g, ' ');

  const rotular = (elemento: Element): string => {
    const classe = (elemento.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
    return `${elemento.tagName.toLowerCase()}${classe ? '.' + classe : ''}`;
  };

  const proibidos = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'label',
    'legend',
    'button',
    'a',
    'input',
    'select',
    'textarea',
    'summary',
  ];
  const blocos: Array<{
    rotulo: string;
    chars: number;
    tipo: 'obrigacao' | 'prosa';
    texto: string;
  }> = [];
  for (const elemento of Array.from(document.querySelectorAll('main *'))) {
    if (proibidos.includes(elemento.tagName.toLowerCase())) continue;
    if (elemento.closest('[role="alert"], [role="status"], .result-list, .overview-metric, footer'))
      continue;
    if (!visivel(elemento)) continue;
    const texto = textoProprio(elemento);
    if (texto.length < entrada.minimoCh) continue;
    blocos.push({
      rotulo: rotular(elemento),
      chars: texto.length,
      tipo: marca.test(texto) ? 'obrigacao' : 'prosa',
      texto,
    });
  }

  const media = (lista: typeof blocos): number =>
    lista.length
      ? Math.round(lista.reduce((total, bloco) => total + bloco.chars, 0) / lista.length)
      : 0;
  const maior = (lista: typeof blocos): Bloco | null =>
    lista.length ? lista.reduce((a, b) => (b.chars > a.chars ? b : a)) : null;

  const prosa = blocos.filter((bloco) => bloco.tipo === 'prosa');
  const obrigacao = blocos.filter((bloco) => bloco.tipo === 'obrigacao');

  // Bloco misto: parte obrigação, parte explicação de interface. A régua não
  // decide o corte — ela imprime as duas partes, porque quem separa precisa
  // saber qual oração é qual.
  const mistos = blocos
    .map((bloco) => {
      const oracoes = bloco.texto
        .split(/(?<=[.;])\s+/)
        .map((oracao) => oracao.trim())
        .filter((oracao) => oracao.length >= 20);
      const obrigatorias = oracoes.filter((oracao) => marca.test(oracao));
      const cortaveis = oracoes.filter((oracao) => !marca.test(oracao));
      return { rotulo: bloco.rotulo, obrigatorias, cortaveis };
    })
    .filter((bloco) => bloco.obrigatorias.length > 0 && bloco.cortaveis.length > 0);

  const frases = new Map<string, string[]>();
  const imperativas = new Map<string, string[]>();
  const normalizar = (frase: string) =>
    frase
      .toLowerCase()
      .replace(/[«»"“”]/g, '')
      .replace(/[.,;:!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  for (const bloco of blocos) {
    for (const frase of bloco.texto.split(/(?<=[.!?])\s+/)) {
      const chave = normalizar(frase);
      if (chave.length < 30) continue;
      frases.set(chave, [...(frases.get(chave) ?? []), bloco.rotulo]);
      if (
        /^(clique|selecione|escolha|informe|use|preencha|arraste|confira|consulte|aplique|digite)\b/.test(
          chave,
        )
      ) {
        imperativas.set(chave, [...(imperativas.get(chave) ?? []), bloco.rotulo]);
      }
      // A chave de imperativa precisa nascer do texto cru, não normalizado.
      const cru = frase.trim().toLowerCase();
      if (
        /^(clique|selecione|escolha|informe|use|preencha|arraste|confira|consulte|aplique|digite)\b/.test(
          cru,
        )
      ) {
        imperativas.set(chave, [...(imperativas.get(chave) ?? []), bloco.rotulo]);
      }
    }
  }
  const repetir = (mapa: Map<string, string[]>) =>
    Array.from(mapa.entries())
      .filter(([, onde]) => new Set(onde).size > 1)
      .map(([frase, onde]) => ({ frase, blocos: Array.from(new Set(onde)) }));

  const details = Array.from(document.querySelectorAll('main details'))
    .filter(visivel)
    .map((elemento) => ({
      resumo: (elemento.querySelector('summary')?.textContent ?? '').trim().replace(/\s+/g, ' '),
      classe: (elemento.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0] ?? '',
    }));
  // "De escopo" é o bloco que declara o alcance do dado, não qualquer disclosure
  // de ferramenta (ex.: "Definir centro por coordenadas"). A classificação é
  // impressa inteira para poder ser contestada sem sonda nova.
  const escopo = details.filter((item) =>
    /escopo|limita|origem|proced[êe]ncia|hist[óo]rico da situa/i.test(item.resumo),
  );

  return {
    blocos,
    prosa: { total: prosa.length, media: media(prosa), maior: maior(prosa) },
    obrigacao: { total: obrigacao.length, media: media(obrigacao), maior: maior(obrigacao) },
    repetidas: repetir(frases),
    instrucoesPadrao: repetir(imperativas),
    details: details.length,
    detailsEscopo: escopo.length,
    detailsResumos: details.map((item) => `${item.resumo} [${item.classe}]`),
    mistos,
  };
}

async function abrirEntrada(page: Page): Promise<void> {
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
}

test('UX-5: prosa ≤ 20 blocos, máximo de 60 ch por bloco, sem repetição nem instrução padrão', async ({
  page,
}) => {
  await abrirEntrada(page);
  const relatorio = await page.evaluate(lerCopy, {
    minimoCh: MINIMO_CH,
    marcaObrigacao: MARCA_OBRIGACAO.source,
  });

  console.log(
    `blocos: ${relatorio.blocos.length} (prosa ${relatorio.prosa.total}, obrigação ${relatorio.obrigacao.total})`,
  );
  console.log(
    `prosa: total ${relatorio.prosa.total} (limite ${MAXIMO_LINHAS}), maior bloco ${relatorio.prosa.maior?.chars ?? 0} ch (limite ${MEDIA_MAXIMA_CH} por bloco), média ${relatorio.prosa.media} ch (registro, não asserção)`,
  );
  console.log(
    `obrigação (não cortável): média ${relatorio.obrigacao.media} ch, maior ${relatorio.obrigacao.maior?.chars ?? 0} ch — ${relatorio.obrigacao.maior?.rotulo ?? '—'}`,
  );
  for (const bloco of relatorio.blocos) {
    console.log(`  ${bloco.tipo} ${bloco.rotulo} ${bloco.chars}ch «${bloco.texto.slice(0, 60)}…»`);
  }
  for (const repetida of relatorio.repetidas) {
    console.log(`  repetida «${repetida.frase.slice(0, 50)}» em ${repetida.blocos.join(', ')}`);
  }
  for (const instrucao of relatorio.instrucoesPadrao) {
    console.log(
      `  instrução padrão «${instrucao.frase.slice(0, 50)}» em ${instrucao.blocos.join(', ')}`,
    );
  }
  for (const misto of relatorio.mistos) {
    console.log(
      `  misto ${misto.rotulo} — obrigação «${misto.obrigatorias[0]?.slice(0, 48)}…» / cortável «${misto.cortaveis[0]?.slice(0, 48)}…»`,
    );
  }
  console.log(
    `details: ${relatorio.details} no total, ${relatorio.detailsEscopo} de escopo — ${relatorio.detailsResumos.join(' | ')}`,
  );

  expect(
    relatorio.blocos.length,
    'nenhum bloco de apoio encontrado: medição vazia',
  ).toBeGreaterThan(2);
  expect(relatorio.prosa.total, `prosa acima de ${MAXIMO_LINHAS} blocos`).toBeLessThanOrEqual(
    MAXIMO_LINHAS,
  );
  // Critério do ruling: **máximo por bloco** ≤60 ch. Com n=1 a média seria o
  // mesmo número com outro nome; com n>1 ela esconde o bloco que estoura.
  expect(
    relatorio.prosa.maior?.chars ?? 0,
    `maior bloco de prosa ${relatorio.prosa.maior?.chars ?? 0} ch — «${relatorio.prosa.maior?.texto.slice(0, 60)}…»`,
  ).toBeLessThanOrEqual(MEDIA_MAXIMA_CH);
  expect(
    relatorio.repetidas.map((repetida) => repetida.frase.slice(0, 40)),
    'frases repetidas entre blocos',
  ).toEqual([]);
  expect(
    relatorio.instrucoesPadrao.map((instrucao) => instrucao.frase.slice(0, 40)),
    'instruções padrão repetidas',
  ).toEqual([]);
  expect(
    relatorio.detailsEscopo,
    `details de escopo: ${relatorio.detailsEscopo} (limite ≤1; hoje 0 e criar um para bater número está proibido)`,
  ).toBeLessThanOrEqual(1);
});

/**
 * Controle negativo: um parágrafo de 300 ch injetado tem de virar o maior bloco
 * e ser contado. Sem isso, "média ≤ 60" poderia passar por não enxergar texto.
 */
test('controle negativo: parágrafo de 300 ch é contado e vira o maior', async ({ page }) => {
  await abrirEntrada(page);
  const antes = await page.evaluate(lerCopy, {
    minimoCh: MINIMO_CH,
    marcaObrigacao: MARCA_OBRIGACAO.source,
  });
  await page.evaluate(() => {
    const paragrafo = document.createElement('p');
    paragrafo.id = 'sonda-copy';
    paragrafo.textContent = `${'Sonda '.repeat(50).trim()}!`;
    document.querySelector('main')?.appendChild(paragrafo);
  });
  const depois = await page.evaluate(lerCopy, {
    minimoCh: MINIMO_CH,
    marcaObrigacao: MARCA_OBRIGACAO.source,
  });
  const injetado = depois.blocos.find((bloco) => bloco.texto.startsWith('Sonda Sonda'));
  console.log(
    `negativo: blocos ${antes.blocos.length}→${depois.blocos.length}, injetado ${injetado?.chars ?? 0} ch`,
  );
  expect(injetado, 'a régua não viu o parágrafo injetado').toBeTruthy();
  expect(injetado?.chars).toBe(300);
  expect(depois.blocos.length).toBe(antes.blocos.length + 1);
});
