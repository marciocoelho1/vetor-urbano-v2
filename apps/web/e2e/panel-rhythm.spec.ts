import { expect, test, type Page } from '@playwright/test';
import { syntheticAdmin, syntheticDatabaseContainer } from './helpers/synthetic-admin';

/**
 * UX-2 — ritmo e container dos painéis.
 *
 * Critério: **≤6 paddings distintos, todos entre 12 e 32 px**; `gap` ∈
 * {8, 12, 16} em container com mais de um filho. Medido por CSS **computado**
 * (não por declaração) em painel e cartão, a 390/768/1440, com a sessão da
 * pilha sintética — é o único lote cujo critério mora inteiramente atrás do D7.
 *
 * Regras de contagem, declaradas para o passe falar a mesma língua:
 *  - padding é valor computado em px; `0` e `auto` não entram;
 *  - `gap` só conta em container `flex`/`grid` com mais de um filho visível;
 *  - mede-se o painel **aberto**, nunca o recolhido.
 *
 * O caso negativo injeta `padding: 7px` num cartão e exige reprovação — régua
 * que não morde passa verde em qualquer ritmo.
 */

const CONTAINER = 'vu-uxh01-five-db';
const VIEWPORTS = [390, 768, 1440];
const PADDING_MINIMO = 12;
const PADDING_MAXIMO = 32;
const PADDING_DISTINTOS_MAXIMOS = 6;
const GAPS_PERMITIDOS = [8, 12, 16];

const PAINEIS =
  '.workspace-card, .risk-areas-panel, .results-panel, .vu-sheet-panel, section[aria-labelledby="operations-heading"]';

test.skip(
  process.env['VETOR_ACCOUNTS_E2E'] !== '1',
  'Exige API em 127.0.0.1:8080, caixa em 8025 e PostGIS sintético isolado.',
);
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 20_000 });

type Ritmo = {
  paddings: Array<{ seletor: string; valor: number; lado: string }>;
  distintos: number[];
  gaps: Array<{ seletor: string; valor: number }>;
  gapsDistintos: number[];
  medidos: number;
};

/** Serializada para o navegador. */
function lerRitmo(seletorPaineis: string): Ritmo {
  const visivel = (elemento: Element): boolean => {
    const rect = elemento.getBoundingClientRect();
    const estilo = getComputedStyle(elemento);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      estilo.visibility !== 'hidden' &&
      estilo.display !== 'none'
    );
  };
  const rotular = (elemento: Element): string => {
    const classe = (elemento.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
    return `${elemento.tagName.toLowerCase()}${classe ? '.' + classe : ''}`;
  };

  const paddings: Array<{ seletor: string; valor: number; lado: string }> = [];
  const alvos = Array.from(document.querySelectorAll(seletorPaineis)).filter(visivel);
  for (const elemento of alvos) {
    const estilo = getComputedStyle(elemento);
    const rotulo = rotular(elemento);
    for (const lado of ['top', 'right', 'bottom', 'left'] as const) {
      const valor = Number.parseFloat(estilo.getPropertyValue(`padding-${lado}`));
      if (!Number.isFinite(valor) || valor === 0) continue;
      paddings.push({ seletor: rotulo, valor: Number(valor.toFixed(1)), lado });
    }
  }

  const gaps: Array<{ seletor: string; valor: number }> = [];
  for (const elemento of alvos) {
    const estilo = getComputedStyle(elemento);
    if (!['flex', 'grid'].includes(estilo.display)) continue;
    const filhos = Array.from(elemento.children).filter(visivel);
    if (filhos.length < 2) continue;
    for (const bruto of [estilo.rowGap, estilo.columnGap]) {
      const valor = Number.parseFloat(bruto);
      if (!Number.isFinite(valor)) continue; // `normal` não é gap declarado
      if (valor === 0) continue;
      gaps.push({ seletor: rotular(elemento), valor: Number(valor.toFixed(1)) });
    }
  }

  const distintos = Array.from(new Set(paddings.map((item) => item.valor))).sort((a, b) => a - b);
  const gapsDistintos = Array.from(new Set(gaps.map((item) => item.valor))).sort((a, b) => a - b);
  return { paddings, distintos, gaps, gapsDistintos, medidos: alvos.length };
}

async function abrirPaineis(
  page: Page,
  request: Parameters<typeof syntheticAdmin>[1],
  largura: number,
): Promise<void> {
  syntheticDatabaseContainer(CONTAINER);
  // Login em desktop: desde o UX-6 a topbar no móvel esconde `.topbar-actions`,
  // e o helper espera "Minha conta" visível ao fim do MFA. A viewport alvo vem depois.
  await page.setViewportSize({ width: 1440, height: 900 });
  await syntheticAdmin(page, request, CONTAINER);
  const fontes = page.getByRole('button', { name: 'Fontes', exact: true });
  await fontes.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Operação', exact: true })).toBeVisible();
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
}

for (const largura of VIEWPORTS) {
  test(`UX-2: ≤${PADDING_DISTINTOS_MAXIMOS} paddings distintos entre ${PADDING_MINIMO} e ${PADDING_MAXIMO}px a ${largura}`, async ({
    page,
    request,
  }) => {
    await abrirPaineis(page, request, largura);
    const ritmo = await page.evaluate(lerRitmo, PAINEIS);

    console.log(
      `${largura}px: ${ritmo.medidos} painéis/cartões medidos · paddings distintos ${JSON.stringify(ritmo.distintos)} · gaps ${JSON.stringify(ritmo.gapsDistintos)}`,
    );
    const porValor = new Map<number, number>();
    for (const padding of ritmo.paddings) {
      porValor.set(padding.valor, (porValor.get(padding.valor) ?? 0) + 1);
    }
    console.log(
      `  frequência: ${Array.from(porValor.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([valor, total]) => `${valor}px×${total}`)
        .join('  ')}`,
    );
    for (const padding of ritmo.paddings.filter(
      (item) => item.valor < PADDING_MINIMO || item.valor > PADDING_MAXIMO,
    )) {
      console.log(
        `  fora da faixa: ${padding.seletor} padding-${padding.lado} = ${padding.valor}px`,
      );
    }
    for (const gap of ritmo.gaps.filter((item) => !GAPS_PERMITIDOS.includes(item.valor))) {
      console.log(`  gap fora: ${gap.seletor} = ${gap.valor}px`);
    }

    expect(ritmo.medidos, 'nenhum painel/cartão medido: régua vazia').toBeGreaterThan(2);
    expect(
      ritmo.distintos.length,
      `paddings distintos ${JSON.stringify(ritmo.distintos)} (limite ${PADDING_DISTINTOS_MAXIMOS})`,
    ).toBeLessThanOrEqual(PADDING_DISTINTOS_MAXIMOS);
    expect(
      ritmo.distintos.filter((valor) => valor < PADDING_MINIMO || valor > PADDING_MAXIMO),
      `paddings fora de ${PADDING_MINIMO}–${PADDING_MAXIMO}px`,
    ).toEqual([]);
    expect(
      ritmo.gapsDistintos.filter((valor) => !GAPS_PERMITIDOS.includes(valor)),
      `gaps fora de ${JSON.stringify(GAPS_PERMITIDOS)}`,
    ).toEqual([]);
  });
}

/**
 * Controle negativo: um cartão com `padding: 7px` tem de aparecer na lista e
 * ser reprovado pela faixa. Sem isso, uma régua que medisse só declarações
 * passaria verde com o ritmo quebrado.
 */
test('controle negativo: padding de 7px num cartão reprova a régua', async ({ page, request }) => {
  await abrirPaineis(page, request, 390);
  const antes = await page.evaluate(lerRitmo, PAINEIS);
  const classes = await page.evaluate((seletor) => {
    const elemento = Array.from(document.querySelectorAll(seletor)).find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return elemento ? (elemento.getAttribute('class') ?? '').split(/\s+/)[0] : null;
  }, PAINEIS);
  expect(classes, 'nenhum cartão para injetar o padding').toBeTruthy();
  await page.addStyleTag({ content: `.${classes} { padding: 7px !important; }` });
  await page.waitForTimeout(150);
  const depois = await page.evaluate(lerRitmo, PAINEIS);
  console.log(
    `negativo: distintos ${JSON.stringify(antes.distintos)} → ${JSON.stringify(depois.distintos)}`,
  );
  expect(depois.distintos, 'a régua não viu o padding de 7px').toContain(7);
  expect(
    depois.distintos.filter((valor) => valor < PADDING_MINIMO || valor > PADDING_MAXIMO),
    'o padding injetado tinha de reprovar a faixa',
  ).toContain(7);
});
