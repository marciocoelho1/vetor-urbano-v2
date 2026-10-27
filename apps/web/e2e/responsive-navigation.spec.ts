import { expect, test, type Page } from '@playwright/test';
import { syntheticAdmin } from './helpers/synthetic-admin';

/**
 * UXH-07 — navegação responsiva.
 *
 * Critério do ticket, medido no DOM em **cinco** viewports (320, 390, 768,
 * 1024, 1440):
 *
 *  (a) todo destino da barra e toda ação de topo alcançáveis, com o nome
 *      listado — não "parece que está lá";
 *  (b) o destino ativo é declarado por `aria-current="page"`, não só por cor;
 *  (c) conta, modo e tema alcançáveis **no móvel**, onde a topbar fica só com
 *      a marca;
 *  (d) `scrollWidth <= clientWidth + 1` — sem rolagem horizontal;
 *  (e) ordem de foco com o skip link primeiro.
 *
 * Mutação obrigatória: esconder um destino por CSS tem de reprovar. Régua que
 * não morde passa verde em qualquer layout.
 */

const VIEWPORTS = [320, 390, 768, 1024, 1440];
const DESTINOS = ['Mapa', 'Ocorrências', 'Histórico', 'Relatórios', 'Fontes'];
const ACOES = ['Minha conta', 'Modo', 'Modo escuro', 'Registrar ocorrência'];
const MOVEL = 768;

const FAMILIA = 'vetor_final_operations_panel';
const CONTA = process.env['VETOR_ACCOUNTS_E2E'] === '1';

async function abrir(
  page: Page,
  largura: number,
  request?: Parameters<typeof syntheticAdmin>[1],
): Promise<void> {
  if (CONTA && request) {
    // Sem sessão autenticada não existe "Minha conta": o critério (c) só é
    // medível na pilha sintética, com login real.
    await page.setViewportSize({ width: 1440, height: 900 });
    await syntheticAdmin(page, request, 'vu-uxh01-five-db');
    await page.setViewportSize({ width: largura, height: largura <= 390 ? 844 : 900 });
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    if (largura <= MOVEL) await expandir(page);
    return;
  }
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de navegação',
    authenticated: true,
    role: 'USER',
    csrfToken: 'synthetic-navigation',
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
  await page.setViewportSize({ width: largura, height: largura <= 390 ? 844 : 900 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
  if (largura <= MOVEL) await expandir(page);
}

async function expandir(page: Page): Promise<void> {
  const disclosure = page.locator('[data-vu="sheet-disclosure"]');
  if ((await disclosure.count()) > 0) {
    await disclosure
      .first()
      .click({ timeout: 3000 })
      .catch(() => undefined);
    await page.waitForTimeout(300);
  }
  // O clique deixa o foco no disclosure; tirar o foco é o que faz a ordem de
  // foco ser medida desde o começo do documento, e não do meio.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Nome acessível de cada item visível do seletor, no viewport atual. */
async function nomesVisiveis(page: Page, seletor: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const visivel = (elemento: Element) => {
      const rect = elemento.getBoundingClientRect();
      const estilo = getComputedStyle(elemento);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        estilo.visibility !== 'hidden' &&
        estilo.display !== 'none'
      );
    };
    return Array.from(document.querySelectorAll(sel))
      .filter(visivel)
      .map((elemento) => (elemento.textContent ?? '').trim())
      .filter(Boolean);
  }, seletor);
}

for (const largura of VIEWPORTS) {
  test(`UXH-07: destinos e ações alcançáveis a ${largura}, sem rolagem horizontal`, async ({
    page,
    request,
  }) => {
    await abrir(page, largura, request);
    const seletorDestinos =
      largura <= MOVEL
        ? 'nav.vu-bottom-bar button.vu-bar-item'
        : 'nav.primary-nav a, nav.primary-nav button';
    const destinos = await nomesVisiveis(page, seletorDestinos);
    console.log(`${largura}px: destinos visíveis ${JSON.stringify(destinos)}`);

    const faltandoDestino = DESTINOS.filter(
      (destino) => !destinos.some((nome) => nome.includes(destino)),
    );
    expect(faltandoDestino, `destinos ausentes a ${largura}px`).toEqual([]);

    const presentes: string[] = [];
    for (const acao of ACOES) {
      const botao = page.getByRole('button', { name: acao, exact: false });
      const visivel =
        (await botao.count()) > 0 &&
        (await botao
          .first()
          .isVisible()
          .catch(() => false));
      if (visivel) presentes.push(acao);
    }
    console.log(`  ações alcançáveis: ${JSON.stringify(presentes)}`);
    expect(faltando(presentes), `ações ausentes a ${largura}px`).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(`  overflow horizontal: ${overflow}px`);
    expect(overflow, `rolagem horizontal de ${overflow}px a ${largura}px`).toBeLessThanOrEqual(1);
  });
}

function faltando(presentes: string[]): string[] {
  return ACOES.filter((acao) => !presentes.includes(acao));
}

test('UXH-07: o destino ativo é declarado por aria-current="page"', async ({ page, request }) => {
  await abrir(page, 390, request);
  // A folha expandida cobre a barra — é o que o UX-6 assere no hit-test
  // ("expandida acerta a folha e não item"). Medir `aria-current` exige a
  // folha recolhida, senão o clique na barra é interceptado pela folha.
  const folha = page.locator('[data-vu="sheet"]');
  if ((await folha.getAttribute('data-vu-sheet-state')) === 'expanded') {
    await page.locator('[data-vu="sheet-disclosure"]').first().click({ timeout: 3000 });
    await expect(folha).toHaveAttribute('data-vu-sheet-state', 'collapsed', { timeout: 5000 });
    await page.waitForTimeout(250);
  }
  const ocorrencias = page.locator('nav.vu-bottom-bar button.vu-bar-item', {
    hasText: 'Ocorrências',
  });
  await ocorrencias.first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const marcados = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-current="page"]')).map((elemento) =>
      (elemento.textContent ?? '').trim(),
    ),
  );
  console.log(`aria-current="page" em: ${JSON.stringify(marcados)}`);
  expect(marcados, 'nenhum destino declara aria-current="page"').toContain('Ocorrências');
});

test('UXH-07: a ordem de foco começa pelo skip link', async ({ page, request }) => {
  await abrir(page, 390, request);
  // Recarregar devolve o ponto de partida da navegação sequencial ao início do
  // documento: depois de clicar na folha, o Chrome continua de onde o foco
  // estava e o "primeiro Tab" mediria o meio da tela.
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.keyboard.press('Tab');
  const primeiro = await page.evaluate(() => (document.activeElement?.textContent ?? '').trim());
  console.log(`primeiro foco: "${primeiro}"`);
  expect(primeiro).toContain('Ir para o conteúdo');
});

test('controle negativo: esconder um destino por CSS reprova a régua', async ({
  page,
  request,
}) => {
  await abrir(page, 390, request);
  const antes = await nomesVisiveis(page, 'nav.vu-bottom-bar button.vu-bar-item');
  await page.addStyleTag({
    content: 'nav.vu-bottom-bar button.vu-bar-item:nth-child(3) { display: none !important; }',
  });
  await page.waitForTimeout(200);
  const depois = await nomesVisiveis(page, 'nav.vu-bottom-bar button.vu-bar-item');
  console.log(`negativo: ${JSON.stringify(antes)} → ${JSON.stringify(depois)}`);
  expect(depois.length, 'a régua não viu o destino escondido').toBeLessThan(antes.length);
  expect(faltandoDestinoDe(depois), 'o destino escondido tinha de aparecer como ausente').toEqual([
    'Histórico',
  ]);
});

function faltandoDestinoDe(destinos: string[]): string[] {
  return DESTINOS.filter((destino) => !destinos.some((nome) => nome === destino));
}
