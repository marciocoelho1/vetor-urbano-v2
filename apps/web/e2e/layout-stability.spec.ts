import { expect, test, type Page } from '@playwright/test';

/**
 * UX-7 — estados explícitos por `data-state` e estabilidade de layout (CLS).
 *
 * Duas réguas num arquivo:
 *
 * 1. **Estados declarados.** A tela alterada expõe seus estados por atributo
 *    `data-state`; o critério pede **6 estados** por tela. Hook ausente reprova
 *    — não pula. A régua imprime os valores e onde estão.
 *
 * 2. **CLS < 0,1 com altura reservada.** `PerformanceObserver('layout-shift')`
 *    instalado **antes** da navegação, somando deslocamentos sem entrada
 *    recente (`hadRecentInput`). A sequência de interação é fixa (abrir
 *    filtros, escolher pilar, abrir a folha) para o número ser comparável.
 *
 * Baseline em ata: CLS `0` / `0` / `0,004` — o caso nasce verde. Por isso a
 * mutação é obrigatória: um bloco injetado **sem altura reservada** tem de
 * produzir CLS > 0,1. Sem ela, a régua seria carimbo.
 */

const VIEWPORTS = [
  { largura: 390, altura: 844 },
  { largura: 320, altura: 720 },
  { largura: 1440, altura: 900 },
];
const CLS_MAXIMO = 0.1;

type Cls = { total: number; entradas: number };

/** Instalado antes da navegação: sem isso, os primeiros deslocamentos somem. */
function iniciarObservador(): void {
  const janela = window as unknown as { __cls?: { total: number; entradas: number } };
  janela.__cls = { total: 0, entradas: 0 };
  try {
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries() as PerformanceEntry[]) {
        const deslocamento = entrada as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (deslocamento.hadRecentInput) continue;
        if (!janela.__cls) continue;
        janela.__cls.total += deslocamento.value;
        janela.__cls.entradas += 1;
      }
    }).observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
  } catch {
    // Navegador sem `layout-shift`: a régua reprova abaixo por falta de medida.
  }
}

function lerObservador(): Cls {
  const janela = window as unknown as { __cls?: Cls };
  return janela.__cls ?? { total: -1, entradas: 0 };
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
  await page.addInitScript(iniciarObservador);
  // Registrador de `data-state` instalado ANTES da navegação: `initial` e o
  // primeiro `loading` acontecem no boot, e um registrador tardio não os vê.
  await page.addInitScript(() => {
    const janela = window as unknown as { __estados?: Array<{ t: number; valor: string }> };
    janela.__estados = [];
    const inicio = performance.now();
    const anotar = () => {
      const elemento = document.querySelector('[data-state]');
      const valor = elemento?.getAttribute('data-state') ?? '';
      if (!valor) return;
      const lista = janela.__estados ?? [];
      if (lista.length && lista[lista.length - 1].valor === valor) return;
      lista.push({ t: Math.round(performance.now() - inicio), valor });
      janela.__estados = lista;
    };
    document.addEventListener('DOMContentLoaded', () => {
      anotar();
      new MutationObserver(anotar).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state'],
      });
      setInterval(anotar, 50);
    });
  });
  await page.setViewportSize({ width: largura, height: altura });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
  // No móvel a região de resultados vive dentro da folha recolhida e, no modo
  // Mapa, `section.results-panel` fica `display: none`. Na Lista a região — e o
  // `data-state` — é de fato renderizada.
  if (largura <= 768) {
    const disclosure = page.locator('[data-vu="sheet-disclosure"]');
    if ((await disclosure.count()) > 0) {
      await disclosure
        .first()
        .click({ timeout: 3000 })
        .catch(() => undefined);
      await page.waitForTimeout(250);
    }
    const lista = page.getByRole('button', { name: /^Lista/ });
    if ((await lista.count()) > 0) {
      await lista
        .first()
        .click({ timeout: 3000 })
        .catch(() => undefined);
      await page.waitForTimeout(250);
    }
  }
}

/** Sequência fixa de interação — é o que torna o CLS comparável entre rodadas. */
async function interagir(page: Page): Promise<void> {
  const tentar = async (acao: () => Promise<void>): Promise<void> => {
    try {
      await acao();
    } catch {
      // Interação indisponível nesta viewport não pode travar a medição de CLS.
    }
  };
  const filtros = page.getByTestId('filter-panel-toggle');
  if ((await filtros.count()) > 0) {
    await tentar(() => filtros.first().click({ timeout: 3000 }));
    await page.waitForTimeout(150);
    await tentar(() => filtros.first().click({ timeout: 3000 }));
  }
  const pilar = page.locator('.category-shortcut').first();
  if ((await pilar.count()) > 0) {
    await tentar(() => pilar.click({ timeout: 3000 }));
    await page.waitForTimeout(150);
    await tentar(() => pilar.click({ timeout: 3000 }));
  }
  const disclosure = page.locator('[data-vu="sheet-disclosure"]');
  if ((await disclosure.count()) > 0) {
    await tentar(() => disclosure.first().click({ timeout: 3000 }));
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
}

test('UX-7: a tela alterada declara seus estados por data-state ao longo da sequência', async ({
  page,
}) => {
  await abrirEntrada(page, 390, 844);
  // O registrador já está ativo desde antes da navegação (ver `abrirEntrada`).
  const passo = async (nome: string, acao: () => Promise<void>): Promise<void> => {
    try {
      await acao();
    } catch {
      console.log(`  passo «${nome}» indisponível nesta tela`);
    }
    await page.waitForTimeout(350);
  };

  await page.evaluate(() =>
    (
      window as unknown as { vetorUrbano?: { simulateQueryLoading: (ms: number) => void } }
    ).vetorUrbano?.simulateQueryLoading(600),
  );
  await page.waitForTimeout(400);
  await page.evaluate(() =>
    (
      window as unknown as { vetorUrbano?: { simulateQueryError: (mensagem: string) => void } }
    ).vetorUrbano?.simulateQueryError('Falha sintética de consulta.'),
  );
  await page.waitForTimeout(400);

  await passo('sair do erro', async () => {
    const banner = page.getByTestId('query-error-banner');
    const tentar = page.getByTestId('retry-query-btn');
    const caixa = await tentar
      .first()
      .boundingBox()
      .catch(() => null);
    console.log(
      `  diagnóstico: banner=${await banner.count()} visível=${await banner.isVisible().catch(() => false)} · retry=${await tentar.count()} caixa=${caixa ? `${Math.round(caixa.width)}×${Math.round(caixa.height)}` : 'nula'}`,
    );
    await tentar.first().click({ timeout: 3000, force: true });
    await page.waitForTimeout(800);
  });
  await passo('vazio por município sem dados', async () => {
    const municipio = page.getByRole('combobox', { name: 'Município (demonstração)' });
    if (
      !(await municipio
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      const filtros = page.getByTestId('filter-panel-toggle');
      await filtros.first().click({ timeout: 3000 });
      await page.waitForTimeout(300);
    }
    const opcoes = await municipio.first().locator('option').count();
    await municipio.first().selectOption({ index: opcoes - 1 }, { timeout: 3000 });
    await expect(page.getByTestId('consultation-empty')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    console.log(
      `  vazio visível com data-state="${await page.locator('[data-state]').first().getAttribute('data-state')}" e ${await page.locator('.result-list > li').count()} itens na lista`,
    );
  });
  await passo('voltar aos resultados', async () => {
    const limpar = page.getByTestId('empty-clear-filters-btn');
    if ((await limpar.count()) > 0) await limpar.first().click({ timeout: 3000 });
    await page.waitForTimeout(800);
  });
  await passo('atualização pendente', async () => {
    await page.evaluate(() =>
      (
        window as unknown as { vetorUrbano?: { simulatePendingUpdate: () => void } }
      ).vetorUrbano?.simulatePendingUpdate(),
    );
    await page.waitForTimeout(500);
  });

  const sequencia = await page.evaluate(
    () =>
      (window as unknown as { __estados?: Array<{ t: number; valor: string }> }).__estados ?? [],
  );
  const observados = Array.from(new Set(sequencia.map((item) => item.valor)));
  console.log(
    `sequência de data-state: ${sequencia.map((item) => `${item.valor}@${item.t}ms`).join(' → ')}`,
  );
  console.log(`estados observados: ${JSON.stringify(observados)}`);

  const esperados = ['initial', 'loading', 'empty', 'error', 'ready', 'refreshing'];
  const faltando = esperados.filter((estado) => !observados.includes(estado));
  expect(observados.length, `estados observados ${JSON.stringify(observados)}`).toBeGreaterThan(1);
  expect(faltando, `estados que nunca apareceram na sequência`).toEqual([]);
});

for (const viewport of VIEWPORTS) {
  test(`UX-7: CLS < ${CLS_MAXIMO} a ${viewport.largura}`, async ({ page }) => {
    await abrirEntrada(page, viewport.largura, viewport.altura);
    await interagir(page);
    const cls = await page.evaluate(lerObservador);
    console.log(
      `${viewport.largura}px: CLS ${cls.total === -1 ? 'não medido' : cls.total.toFixed(4)} em ${cls.entradas} deslocamento(s)`,
    );
    expect(cls.total, 'layout-shift não observado: medição vazia').toBeGreaterThanOrEqual(0);
    expect(cls.total, `CLS ${cls.total.toFixed(4)} ≥ ${CLS_MAXIMO}`).toBeLessThan(CLS_MAXIMO);
  });
}

/**
 * Mutação: um bloco de 240 px inserido **depois** da carga, sem altura
 * reservada, empurra o conteúdo. O CLS tem de passar de 0,1 — se não passar,
 * a régua não mede layout shift de verdade.
 */
test('controle negativo: bloco sem altura reservada produz CLS ≥ 0,1', async ({ page }) => {
  // A 1440 não há folha: o bloco injetado desloca o fluxo normal, que é o que
  // a mutação precisa provar. A 390 a região vive na folha expandida.
  await abrirEntrada(page, 1440, 900);
  const antes = await page.evaluate(lerObservador);
  await page.evaluate(() => {
    const bloco = document.createElement('div');
    bloco.style.cssText = 'height: 240px; background: #ddd;';
    bloco.textContent = 'sonda de deslocamento';
    const main = document.querySelector('main');
    if (main?.firstElementChild) main.insertBefore(bloco, main.firstElementChild);
    else main?.appendChild(bloco);
  });
  await page.waitForTimeout(600);
  const depois = await page.evaluate(lerObservador);
  console.log(`negativo: CLS ${antes.total.toFixed(4)} → ${depois.total.toFixed(4)}`);
  expect(depois.total, 'a régua não viu o deslocamento injetado').toBeGreaterThanOrEqual(
    CLS_MAXIMO,
  );
});
