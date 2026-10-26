import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * UX-4 — três durações e par `reduce`.
 *
 * Duas varreduras, porque uma sozinha mente:
 *
 * 1. **Estática** nas folhas de estilo: `transition`/`animation` fora dos blocos
 *    `@media (prefers-reduced-motion: reduce)`. Duração declarada tem de estar
 *    em `{120, 240, 400}` ms ou ser `0s`; no máximo **2** easings distintos.
 *    O bloco `reduce` fica fora de propósito: ali `0.01ms` e `none` são o par,
 *    não duração de produto — contá-los como violação faria alguém "consertar"
 *    justamente o que a casa escreveu para não animar.
 *
 * 2. **Computada** no DOM: `transitionDuration`/`animationDuration` de todo
 *    elemento visível — é o que o navegador usa, inclusive o que vem de
 *    `var(--vu-motion-*)`. Sob `reducedMotion: 'reduce'`, o par tem de zerar
 *    **movimento em curso**: transição em `0s`, animação ≤ 1 ms e nenhuma
 *    iteração infinita. Não se assere `transform` textual: `transform` é usado
 *    para posicionamento (mapa, pinos, painéis) e `transform: none` seria
 *    requisito novo, não o critério.
 *
 * Cada varredura tem controle negativo: um valor injetado fora do conjunto tem
 * de ser reprovado — régua que não morde passa verde em tudo.
 */

const PERMITIDAS_MS = [120, 240, 400];
const EASINGS_MAXIMOS = 2;
const SRC = resolve(process.cwd(), 'src');

const RE_MEDIA_REDUCE = /@media\s*\(prefers-reduced-motion:\s*reduce\)/;
const RE_PROPRIEDADE = /\b(transition|animation)(-duration)?\s*:\s*([^;{}]*)/g;
const RE_TEMPO = /(\d+(?:\.\d+)?)(ms|s)\b/g;
const RE_EASING =
  /cubic-bezier\([^)]*\)|var\(--vu-ease-[a-z-]+\)|\b(?:ease-in-out|ease-in|ease-out|ease|linear|step-start|step-end)\b/g;

type Ocorrencia = { arquivo: string; linha: number; valor: string };

type Varredura = {
  duracoesFora: Ocorrencia[];
  easings: Map<string, Ocorrencia[]>;
  declaracoes: number;
  arquivos: number;
};

function varrerEstilos(raiz: string): Varredura {
  const arquivos: string[] = [];
  const andar = (diretorio: string): void => {
    for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
      const caminho = join(diretorio, entrada.name);
      if (entrada.isDirectory()) andar(caminho);
      else if (entrada.name.endsWith('.scss')) arquivos.push(caminho);
    }
  };
  andar(raiz);

  const duracoesFora: Ocorrencia[] = [];
  const easings = new Map<string, Ocorrencia[]>();
  let declaracoes = 0;

  for (const arquivo of arquivos.sort()) {
    const rel = relative(raiz, arquivo);
    const linhas = readFileSync(arquivo, 'utf8').split('\n');
    let dentroReduce = false;
    let profundidade = 0;
    // Declaração quebrada em várias linhas: sem juntar, o valor da linha
    // seguinte (`transform 480ms …,`) escaparia da varredura.
    let pendente: { linha: number; texto: string } | null = null;

    const analisar = (ocorrencia: Ocorrencia): void => {
      declaracoes += 1;
      const trecho = ocorrencia.valor;
      const vistos = new Set<number>();
      for (const tempo of trecho.matchAll(RE_TEMPO)) {
        const ms = tempo[2] === 's' ? Number(tempo[1]) * 1000 : Number(tempo[1]);
        if (ms === 0 || vistos.has(ms)) continue;
        vistos.add(ms);
        if (!PERMITIDAS_MS.includes(ms)) {
          duracoesFora.push({ ...ocorrencia, valor: `${ms}ms  (${trecho.replace(/\s+/g, ' ')})` });
        }
      }
      for (const easing of trecho.matchAll(RE_EASING)) {
        const chave = easing[0];
        easings.set(chave, [...(easings.get(chave) ?? []), ocorrencia]);
      }
    };

    for (const [indice, linha] of linhas.entries()) {
      const abre = (linha.match(/\{/g) ?? []).length;
      const fecha = (linha.match(/\}/g) ?? []).length;

      if (dentroReduce) {
        profundidade += abre - fecha;
        if (profundidade <= 0) dentroReduce = false;
        continue;
      }
      if (RE_MEDIA_REDUCE.test(linha)) {
        dentroReduce = true;
        profundidade = abre - fecha;
        if (profundidade <= 0) dentroReduce = false;
        continue;
      }

      const limpa = linha.replace(/\/\/.*$/, '');
      if (pendente) {
        pendente.texto += ` ${limpa.trim()}`;
        if (limpa.includes(';') || limpa.includes('}')) {
          analisar({ arquivo: rel, linha: pendente.linha, valor: pendente.texto });
          pendente = null;
        }
        continue;
      }

      for (const achado of limpa.matchAll(RE_PROPRIEDADE)) {
        const trecho = achado[3].trim();
        const resto = limpa.slice(achado.index);
        if (!resto.includes(';') && !resto.includes('}')) {
          pendente = { linha: indice + 1, texto: trecho };
          continue;
        }
        analisar({ arquivo: rel, linha: indice + 1, valor: trecho });
      }
    }
    if (pendente) analisar({ arquivo: rel, linha: pendente.linha, valor: pendente.texto });
  }
  return { duracoesFora, easings, declaracoes, arquivos: arquivos.length };
}

/** Serializada para o navegador. */
function lerMovimento() {
  const duracoes = new Map<string, number>();
  let comTransicao = 0;
  let comAnimacao = 0;
  let infinitas = 0;
  for (const elemento of Array.from(document.querySelectorAll('*'))) {
    const estilo = getComputedStyle(elemento);
    for (const bruto of estilo.transitionDuration.split(',')) {
      const segundos = Number.parseFloat(bruto.trim());
      if (!Number.isFinite(segundos)) continue;
      const ms = Math.round(segundos * 1000);
      duracoes.set(`${ms}ms`, (duracoes.get(`${ms}ms`) ?? 0) + 1);
      if (ms > 0) comTransicao += 1;
    }
    for (const bruto of estilo.animationDuration.split(',')) {
      const segundos = Number.parseFloat(bruto.trim());
      if (!Number.isFinite(segundos)) continue;
      const ms = Math.round(segundos * 1000);
      duracoes.set(`${ms}ms`, (duracoes.get(`${ms}ms`) ?? 0) + 1);
      if (ms > 0) comAnimacao += 1;
    }
    if (estilo.animationIterationCount === 'infinite') infinitas += 1;
  }
  return {
    duracoes: Array.from(duracoes.entries()).sort((a, b) => b[1] - a[1]),
    comTransicao,
    comAnimacao,
    infinitas,
  };
}

async function abrirEntrada(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
}

test('UX-4: durações declaradas estão em {120, 240, 400} ms e há no máximo 2 easings', () => {
  const varredura = varrerEstilos(SRC);
  console.log(
    `${varredura.arquivos} folhas, ${varredura.declaracoes} declarações de transição/animação, ` +
      `${varredura.duracoesFora.length} fora do conjunto, ${varredura.easings.size} easings`,
  );
  for (const ocorrencia of varredura.duracoesFora) {
    console.log(`  fora ${ocorrencia.arquivo}:${ocorrencia.linha} ${ocorrencia.valor}`);
  }
  for (const [easing, usos] of varredura.easings) {
    console.log(
      `  easing ${easing} — ${usos.length} uso(s), ex.: ${usos[0].arquivo}:${usos[0].linha}`,
    );
  }

  // Anti-vacuidade: sem declarações lidas, "0 fora" seria verdade trivial.
  expect(
    varredura.declaracoes,
    'nenhuma declaração de transição/animação encontrada',
  ).toBeGreaterThan(5);
  expect(
    varredura.duracoesFora.map((ocorrencia) => `${ocorrencia.arquivo}:${ocorrencia.linha}`),
    'durações fora de {120, 240, 400}ms',
  ).toEqual([]);
  const easings = Array.from(varredura.easings.keys());
  expect(easings.length, `easings distintos: ${easings.join(', ')}`).toBeLessThanOrEqual(
    EASINGS_MAXIMOS,
  );
});

test('UX-4: o CSS computado não usa duração fora de {120, 240, 400} ms', async ({ page }) => {
  await abrirEntrada(page);
  const movimento = await page.evaluate(lerMovimento);
  console.log(
    `computado: ${movimento.duracoes.map(([duracao, total]) => `${duracao}×${total}`).join('  ')}`,
  );
  const fora = movimento.duracoes
    .map(([duracao]) => duracao)
    .filter((duracao) => !['0ms', ...PERMITIDAS_MS.map((ms) => `${ms}ms`)].includes(duracao));
  expect(movimento.comTransicao, 'nenhuma transição computada: medição vazia').toBeGreaterThan(0);
  expect(fora, 'durações computadas fora do conjunto').toEqual([]);
});

test('UX-4: sob reduced-motion não há movimento em curso', async ({ page }) => {
  await abrirEntrada(page);
  // Controle: sem a emulação existe movimento — senão o zero abaixo não prova nada.
  const normal = await page.evaluate(lerMovimento);
  expect(normal.comTransicao, 'sem movimento em no-preference: medição vazia').toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduzido = await page.evaluate(lerMovimento);
  console.log(
    `reduce: ${reduzido.duracoes.map(([duracao, total]) => `${duracao}×${total}`).join('  ')} ` +
      `(transições>0: ${reduzido.comTransicao}, animações>0: ${reduzido.comAnimacao}, infinitas: ${reduzido.infinitas})`,
  );
  expect(reduzido.comTransicao, 'transição em curso sob reduce').toBe(0);
  // `animation-duration: 0.01ms` é o par da casa: zero absoluto não é o critério.
  const animacaoAcimaDe1ms = reduzido.duracoes
    .filter(([duracao]) => duracao !== '0ms')
    .filter(([duracao]) => Number.parseInt(duracao, 10) > 1);
  expect(
    animacaoAcimaDe1ms.map(([duracao]) => duracao),
    'animação acima de 1ms sob reduce',
  ).toEqual([]);
  expect(reduzido.infinitas, 'iteração infinita sob reduce').toBe(0);
});

/**
 * Controle negativo das duas varreduras: um arquivo sintético com duração e
 * easing fora do conjunto tem de ser reprovado, e um elemento injetado com
 * `transition: 500ms` tem de aparecer no computado.
 */
test('controle negativo: duração fora do conjunto é reprovada nas duas varreduras', async ({
  page,
}) => {
  const temporario = resolve(process.cwd(), 'test-results', 'sonda-motion');
  const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  mkdirSync(temporario, { recursive: true });
  writeFileSync(
    join(temporario, 'sonda.scss'),
    '.sonda { transition: all 500ms linear; }\n' +
      '@media (prefers-reduced-motion: reduce) {\n' +
      '  .sonda { transition: none; animation-duration: 0.01ms; }\n' +
      '}\n',
  );
  const varredura = varrerEstilos(temporario);
  rmSync(temporario, { recursive: true, force: true });

  expect(varredura.duracoesFora.map((ocorrencia) => ocorrencia.valor)).toEqual([
    '500ms  (all 500ms linear)',
  ]);
  // O bloco `reduce` não pode entrar: `0.01ms` ali é par, não violação.
  expect(varredura.duracoesFora).toHaveLength(1);

  await abrirEntrada(page);
  await page.evaluate(() => {
    const sonda = document.createElement('div');
    sonda.textContent = 'sonda 500ms';
    sonda.style.cssText = 'transition: opacity 500ms linear; opacity: 0.5;';
    document.body.appendChild(sonda);
  });
  const movimento = await page.evaluate(lerMovimento);
  expect(
    movimento.duracoes.map(([duracao]) => duracao),
    'a varredura computada não viu os 500ms injetados',
  ).toContain('500ms');
});
