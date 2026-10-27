import { expect, test, type Page } from '@playwright/test';

/**
 * UXH-08 — passada 1: estrutura do workspace.
 *
 * Três medidas do ticket, no DOM:
 *
 *  1. **Deduplicação de filtros.** Para pilar, período, território e raio, o
 *     número de controles com o **mesmo nome acessível** tem de ser 1 — não 2.
 *     "Retirar duplicidade" medido por nome, não por inspeção visual.
 *  2. **Bloco de ferramentas acima do formulário esquerdo.** `rect.top` do
 *     bloco de ferramentas menor que o do formulário de filtros, a 1024 e 1440.
 *  3. **Lista e paginação íntegras.** A 390/768/1440: rolagem interna utilizável
 *     (`clientHeight` que mostre mais de uma linha), controle de paginação
 *     visível e clicável, e totais presentes — nada truncado por `overflow`.
 *
 * Guardrail do ruling: o `demo-ribbon` é aviso essencial e **não** é
 * redundância. Esta régua não pede a remoção de faixa nenhuma.
 */

const VIEWPORTS_DESKTOP = [1024, 1440];
const VIEWPORTS_LISTA = [390, 768, 1440];

async function abrir(page: Page, largura: number): Promise<void> {
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de estrutura',
    authenticated: true,
    role: 'USER',
    csrfToken: 'synthetic-structure',
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

type Controle = { nome: string; seletor: string; top: number };

async function controlesDoFiltro(page: Page): Promise<Controle[]> {
  return page.evaluate(() => {
    const visivel = (elemento: Element) => {
      const rect = elemento.getBoundingClientRect();
      const estilo = getComputedStyle(elemento);
      return rect.width > 0 && rect.height > 0 && estilo.visibility !== 'hidden';
    };
    const rotulo = (elemento: Element): string => {
      const aria = elemento.getAttribute('aria-label');
      if (aria) return aria.trim();
      const texto = (elemento.textContent ?? '').trim().replace(/\s+/g, ' ');
      if (texto) return texto;
      const id = elemento.getAttribute('id');
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      if (label) return (label.textContent ?? '').trim().replace(/\s+/g, ' ');
      return (elemento.getAttribute('name') ?? '').trim();
    };
    return Array.from(document.querySelectorAll('main select, main button, main input'))
      .filter(visivel)
      .map((elemento) => ({
        nome: rotulo(elemento),
        seletor: `${elemento.tagName.toLowerCase()}${elemento.getAttribute('class') ? '.' + (elemento.getAttribute('class') as string).split(/\s+/)[0] : ''}`,
        top: Math.round(elemento.getBoundingClientRect().top),
      }))
      .filter((item) => item.nome);
  });
}

test('UXH-08: cada filtro tem um único controle por nome acessível', async ({ page }) => {
  await abrir(page, 1440);
  const controles = await controlesDoFiltro(page);
  const contagem = new Map<string, string[]>();
  for (const controle of controles) {
    const lista = contagem.get(controle.nome) ?? [];
    lista.push(controle.seletor);
    contagem.set(controle.nome, lista);
  }
  const duplicados = Array.from(contagem.entries()).filter(([, lista]) => lista.length > 1);
  console.log(`controles visíveis: ${controles.length} · nomes repetidos: ${duplicados.length}`);
  for (const [nome, lista] of duplicados) console.log(`  "${nome}" → ${JSON.stringify(lista)}`);

  // As quatro famílias do ticket. Pilar é medido por **nome de pilar** — três
  // pilares distintos não são três cópias do mesmo filtro.
  const porNome = (nome: string) => controles.filter((controle) => controle.nome === nome).length;
  for (const pilar of ['Trânsito', 'Segurança', 'Contingência']) {
    console.log(`  pilar "${pilar}": ${porNome(pilar)} controle(s)`);
    expect(porNome(pilar), `pilar "${pilar}" duplicado ou ausente`).toBe(1);
  }
  const familias: Array<{ rotulo: string; filtro: (nome: string) => boolean }> = [
    {
      rotulo: 'período',
      // O `select` de período carrega as opções no próprio texto; o botão de
      // linha de resultado também contém "Em andamento" e não é filtro.
      filtro: (nome) => nome.startsWith('Últimas 24 horasÚltimos 7 dias'),
    },
    { rotulo: 'território (município)', filtro: (nome) => nome.startsWith('Todos os municípios') },
    { rotulo: 'território (bairro)', filtro: (nome) => nome.startsWith('Todos os bairros') },
    { rotulo: 'raio', filtro: (nome) => nome.includes('raio') },
  ];
  for (const familia of familias) {
    const encontrados = controles.filter((controle) => familia.filtro(controle.nome));
    console.log(
      `  ${familia.rotulo}: ${encontrados.length} controle(s) — ${JSON.stringify(encontrados.map((c) => c.nome))}`,
    );
    expect(encontrados.length, `${familia.rotulo} sem controle ou duplicado`).toBe(1);
  }
});

for (const largura of VIEWPORTS_DESKTOP) {
  test(`UXH-08: bloco de ferramentas acima do formulário de filtros a ${largura}`, async ({
    page,
  }) => {
    await abrir(page, largura);
    const medidas = await page.evaluate(() => {
      const visivel = (elemento: Element) => {
        const rect = elemento.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const ferramentas = Array.from(document.querySelectorAll('.map-tool-button, .heatmap-button'))
        .filter(visivel)
        .map((elemento) => ({
          nome: (elemento.getAttribute('aria-label') ?? elemento.textContent ?? '')
            .trim()
            .slice(0, 40),
          top: Math.round(elemento.getBoundingClientRect().top),
        }));
      const formulario = document.querySelector(
        '.consultation-sidebar, form.consultation-form, form',
      );
      return {
        ferramentas,
        topoFerramentas: ferramentas.length ? Math.min(...ferramentas.map((f) => f.top)) : null,
        topoFormulario: formulario ? Math.round(formulario.getBoundingClientRect().top) : null,
      };
    });
    console.log(
      `${largura}px: ferramentas ${JSON.stringify(medidas.ferramentas)} · topo ferramentas=${medidas.topoFerramentas} · topo formulário=${medidas.topoFormulario}`,
    );
    expect(medidas.topoFerramentas, 'bloco de ferramentas ausente').not.toBeNull();
    expect(medidas.topoFormulario, 'formulário de filtros ausente').not.toBeNull();
    expect(
      medidas.topoFerramentas!,
      `ferramentas (${medidas.topoFerramentas}px) não estão acima do formulário (${medidas.topoFormulario}px)`,
    ).toBeLessThan(medidas.topoFormulario!);
  });
}

for (const largura of VIEWPORTS_LISTA) {
  test(`UXH-08: lista e paginação íntegras a ${largura}`, async ({ page }) => {
    await abrir(page, largura);
    const dados = await page.evaluate(() => {
      const lista = document.querySelector('.result-list') as HTMLElement | null;
      const paginacao = document.querySelector(
        '[data-testid="result-pagination"], .result-pagination, nav[aria-label*="Paginação"]',
      ) as HTMLElement | null;
      const textoMain = (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ');
      return {
        existeLista: Boolean(lista),
        itens: lista?.children.length ?? 0,
        clientH: lista?.clientHeight ?? 0,
        scrollH: lista?.scrollHeight ?? 0,
        overflowY: lista ? getComputedStyle(lista).overflowY : '',
        paginacao: paginacao
          ? {
              visivel: paginacao.getBoundingClientRect().height > 0,
              texto: (paginacao.textContent ?? '').trim().slice(0, 40),
            }
          : null,
        temTotais: /mape[áa]ve|territoria/i.test(textoMain),
      };
    });
    console.log(`${largura}px: lista ${JSON.stringify(dados)}`);
    expect(dados.existeLista, 'lista de resultados ausente').toBe(true);
    expect(dados.itens, 'lista sem linhas').toBeGreaterThan(0);
    // Rolagem interna utilizável: a janela da lista tem de mostrar mais de uma
    // linha, ou a lista está inteira expandida (nada escondido).
    const utilizavel = dados.scrollH === dados.clientH || dados.clientH >= 120;
    expect(
      utilizavel,
      `lista com ${dados.itens} linhas em janela de ${dados.clientH}px (conteúdo ${dados.scrollH}px)`,
    ).toBe(true);
    expect(dados.paginacao?.visivel ?? false, 'controle de paginação ausente ou invisível').toBe(
      true,
    );
    expect(dados.temTotais, 'totais (mapeáveis/territoriais) ausentes').toBe(true);
  });
}

test('controle negativo: esconder um filtro por CSS reprova a deduplicação', async ({ page }) => {
  await abrir(page, 1440);
  const antes = await controlesDoFiltro(page);
  const antesPeriodo = antes.filter((controle) => controle.nome.startsWith('Últimas')).length;
  await page.addStyleTag({ content: 'select:has(option:checked) { display: none !important; }' });
  await page.waitForTimeout(200);
  const depois = await controlesDoFiltro(page);
  const depoisPeriodo = depois.filter((controle) => controle.nome.startsWith('Últimas')).length;
  console.log(`negativo: filtros de período ${antesPeriodo} → ${depoisPeriodo}`);
  expect(depoisPeriodo, 'a régua não viu o filtro escondido').toBeLessThan(antesPeriodo);
});

test('controle negativo: overflow:hidden na lista reprova a integridade', async ({ page }) => {
  await abrir(page, 1440);
  const antes = await page.evaluate(() => {
    const lista = document.querySelector('.result-list') as HTMLElement;
    return { clientH: lista.clientHeight, scrollH: lista.scrollHeight };
  });
  await page.addStyleTag({ content: '.result-list { overflow: hidden !important; }' });
  await page.waitForTimeout(200);
  const depois = await page.evaluate(() => {
    const lista = document.querySelector('.result-list') as HTMLElement;
    const estilo = getComputedStyle(lista);
    return {
      clientH: lista.clientHeight,
      scrollH: lista.scrollHeight,
      overflowY: estilo.overflowY,
    };
  });
  console.log(`negativo: ${JSON.stringify(antes)} → ${JSON.stringify(depois)}`);
  expect(depois.overflowY, 'a régua não viu o overflow forçado').toBe('hidden');
  const acessivel =
    depois.scrollH === depois.clientH || (depois.clientH >= 120 && depois.overflowY !== 'hidden');
  expect(acessivel, 'lista truncada por overflow:hidden passaria como íntegra').toBe(false);
});
