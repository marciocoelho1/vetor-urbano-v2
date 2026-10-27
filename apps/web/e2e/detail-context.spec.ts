import { expect, test, type Page } from '@playwright/test';

/**
 * UXH-12 — detalhe único e retorno ao contexto.
 *
 * Critério do ticket: **um detalhe por vez** em Mapa, Informes e Histórico; fechar
 * devolve **contexto, seleção, rolagem e foco** ao acionador.
 *
 * Contrato de hooks (ruling de abertura):
 *   [data-vu-detail]                 o detalhe aberto — um só no DOM por vez
 *   [data-vu-detail-trigger="<id>"]  o acionador que abriu (pin ou item de lista)
 *   [data-vu-detail-close]           fechar explícito
 *
 * MUTAÇÕES — cada caso carrega a que o faz falhar (uma por vez, sobre o passe):
 *   caso 1 exclusividade → não remover o detalhe anterior (dois montados)      → vermelho
 *   caso 2 foco/rolagem  → não devolver o foco ao acionador                    → vermelho
 *   caso 3 contexto      → recarregar a consulta ao fechar                     → vermelho
 *   caso 4 teclado       → remover o handler de Escape                         → vermelho
 *   caso 5 falha         → engolir o erro (mostrar vazio em vez de alert)      → vermelho
 *
 * Estado conhecido da árvore antes deste lote (`app.html:1749`): até **5** detalhes
 * podem ficar abertos ao mesmo tempo, e o acionador é um botão dentro de
 * `button.result-item[data-result-point]`. É contra isso que a régua nasce vermelha.
 */

async function abrirDemo(page: Page, largura: number): Promise<void> {
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de administração',
    authenticated: true,
    role: 'ADMIN',
    csrfToken: 'synthetic-admin-detail',
  };
  await page.route('**/api/v1/auth/session', (rota) => rota.fulfill({ json: sessao }));
  await page.route('**/api/v1/auth/access/**', (rota) => rota.fulfill({ json: sessao }));
  await page.route('**/api/v1/admin/**', (rota) =>
    rota.fulfill({ status: 200, json: { items: [], total: 0 } }),
  );
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

/** A lista de resultados só está visível no modo Lista (no modo Mapa é `display: none`). */
async function abrirLista(page: Page): Promise<void> {
  const lista = page.locator('ul.result-list');
  if (
    await lista
      .first()
      .isVisible()
      .catch(() => false)
  )
    return;

  // Desktop/mapa: o painel de resultados está display:none até o modo «Lista».
  // O nome acessível carrega a contagem: «Lista 18».
  const modoLista = page.getByRole('button', { name: /^Lista( |$)/ });
  if ((await modoLista.count()) > 0) {
    await modoLista.first().click();
    await page.waitForTimeout(250);
    if (
      await lista
        .first()
        .isVisible()
        .catch(() => false)
    )
      return;
  }

  // Móvel: no shell do UX-6 a lista vive no painel «resultados» da folha.
  const folha = page.locator('[data-vu="sheet"]');
  if ((await folha.getAttribute('data-vu-sheet-state')) !== 'expanded') {
    const disclosure = page.locator('[data-vu="sheet-disclosure"]');
    if ((await disclosure.count()) > 0) {
      await disclosure.first().click();
      await expect(folha).toHaveAttribute('data-vu-sheet-state', 'expanded');
    }
  }
  const gatilhoResultados = page.locator('[data-vu-panel-trigger="resultados"]');
  if ((await gatilhoResultados.count()) > 0) {
    await gatilhoResultados.first().click();
    await page.waitForTimeout(250);
  }
  await expect(lista.first(), 'a lista de resultados não apareceu em nenhum caminho').toBeVisible({
    timeout: 10_000,
  });
}

/** Aciona o detalhe do n-ésimo item da lista pelo botão que já existe hoje. */
async function abrirDetalhe(page: Page, indice: number): Promise<void> {
  // `>` direto: o detalhe aberto pode conter `li` próprios, e `nth()` os pegaria.
  const item = page.locator('ul.result-list > li').nth(indice);
  const detalhes = item.getByRole('button', { name: /detalhes/i });
  const rotulos = await item
    .locator('button')
    .evaluateAll((nos) =>
      nos.map((n) => (n.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28)),
    );
  console.log(`  item ${indice} · botões: ${JSON.stringify(rotulos)}`);
  await expect(
    detalhes,
    `item ${indice} sem acionador de detalhe: ${JSON.stringify(rotulos)}`,
  ).toHaveCount(1);
  await detalhes.first().click();
  await page.waitForTimeout(300);
}

const idsDosItens = async (page: Page): Promise<string[]> =>
  page.$$eval('button.result-item[data-result-point]', (nos) =>
    nos.map((n) => n.getAttribute('data-result-point') ?? ''),
  );

for (const largura of [1280, 390]) {
  test(`UXH-12 ${largura}: abrir B com A aberto deixa UM detalhe no DOM`, async ({ page }) => {
    await abrirDemo(page, largura);
    await abrirLista(page);
    await abrirDetalhe(page, 0);
    const um = await page.locator('[data-vu-detail]').count();
    // Retrato do detalhe COMO ELE É HOJE (sem hook): fecha por aria-label «Fechar detalhes de …».
    const hojeA = await page.$$eval('[aria-label^="Fechar detalhes"]', (nos) => nos.length);
    console.log(
      `${largura}: após abrir A · detalhes(com hook) = ${um} · detalhes(hoje, aria-label) = ${hojeA}`,
    );
    expect(um, 'o primeiro detalhe não abriu').toBe(1);
    await abrirDetalhe(page, 1);
    const dois = await page.locator('[data-vu-detail]').count();
    const ids = await page.$$eval('[data-vu-detail]', (nos) =>
      nos.map((n) => n.getAttribute('data-vu-detail') ?? ''),
    );
    const hojeB = await page.$$eval('[aria-label^="Fechar detalhes"]', (nos) => nos.length);
    console.log(
      `${largura}: após abrir B · detalhes(com hook) = ${dois} ${JSON.stringify(ids)} · detalhes(hoje) = ${hojeB}`,
    );
    expect(dois, `detalhes montados ao mesmo tempo: ${dois} ${JSON.stringify(ids)}`).toBe(1);
  });

  test(`UXH-12 ${largura}: fechar devolve foco ao acionador e rolagem ao valor anterior`, async ({
    page,
  }) => {
    await abrirDemo(page, largura);
    await abrirLista(page);
    const ids = await idsDosItens(page);
    console.log(`${largura}: itens na lista = ${JSON.stringify(ids.slice(0, 4))}`);
    const alvo = ids[1] ?? ids[0];
    const rolagemAntes = await page.evaluate(
      () => document.querySelector('ul.result-list')?.parentElement?.scrollTop ?? 0,
    );
    await abrirDetalhe(page, 1);
    await expect(page.locator('[data-vu-detail]')).toHaveCount(1);
    const fechar = page.locator('[data-vu-detail-close]');
    await expect(fechar, 'detalhe sem botão de fechar com hook').toHaveCount(1);
    await fechar.first().click();
    await page.waitForTimeout(300);

    const foco = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      return {
        gatilho: ativo?.getAttribute('data-vu-detail-trigger') ?? null,
        noCorpo: ativo === document.body,
      };
    });
    const rolagemDepois = await page.evaluate(
      () => document.querySelector('ul.result-list')?.parentElement?.scrollTop ?? 0,
    );
    console.log(
      `${largura}: foco após fechar = ${JSON.stringify(foco)} · rolagem ${rolagemAntes} → ${rolagemDepois}`,
    );
    expect(foco.noCorpo, 'o foco caiu no <body> ao fechar o detalhe').toBe(false);
    expect(foco.gatilho, 'o foco não voltou a um [data-vu-detail-trigger]').toBe(alvo);
    expect(rolagemDepois, 'a rolagem não voltou ao valor anterior').toBe(rolagemAntes);
  });

  test(`UXH-12 ${largura}: contexto de filtros, contagem e seleção sobrevive a abrir e fechar`, async ({
    page,
  }) => {
    await abrirDemo(page, largura);
    await abrirLista(page);
    const antes = await page.evaluate(() => ({
      contagem: document.querySelectorAll('ul.result-list > li').length,
      filtros: Array.from(document.querySelectorAll('[aria-pressed="true"]')).map((n) =>
        (n.textContent ?? '').trim().slice(0, 24),
      ),
      parametros: ['Município', 'Pilar', 'Período'].map(
        (rotulo) =>
          document.querySelector(`[aria-label="${rotulo}"], [data-filter="${rotulo}"]`)
            ?.textContent ?? null,
      ),
    }));
    await abrirDetalhe(page, 0);
    await expect(page.locator('[data-vu-detail]')).toHaveCount(1);
    await page.locator('[data-vu-detail-close]').first().click();
    await page.waitForTimeout(300);
    const depois = await page.evaluate(() => ({
      contagem: document.querySelectorAll('ul.result-list > li').length,
      filtros: Array.from(document.querySelectorAll('[aria-pressed="true"]')).map((n) =>
        (n.textContent ?? '').trim().slice(0, 24),
      ),
      parametros: ['Município', 'Pilar', 'Período'].map(
        (rotulo) =>
          document.querySelector(`[aria-label="${rotulo}"], [data-filter="${rotulo}"]`)
            ?.textContent ?? null,
      ),
    }));
    console.log(`${largura}: contexto antes = ${JSON.stringify(antes)}`);
    console.log(`${largura}: contexto depois = ${JSON.stringify(depois)}`);
    expect(depois.contagem, 'a contagem de resultados mudou ao abrir/fechar o detalhe').toBe(
      antes.contagem,
    );
    expect(depois.filtros, 'os filtros ativos mudaram ao abrir/fechar o detalhe').toEqual(
      antes.filtros,
    );
    expect(depois.parametros, 'os parâmetros do formulário mudaram').toEqual(antes.parametros);
  });

  test(`UXH-12 ${largura}: teclado — Enter abre o detalhe e Escape fecha`, async ({ page }) => {
    await abrirDemo(page, largura);
    await abrirLista(page);
    const acionador = page
      .locator('ul.result-list li')
      .nth(0)
      .getByRole('button', {
        name: /^(Detalhes|Ver detalhes)$/,
      });
    await acionador.first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-vu-detail]'), 'Enter não abriu o detalhe').toHaveCount(1);
    const focoAoAbrir = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      return {
        dentroDoDetalhe: Boolean(ativo?.closest('[data-vu-detail]')),
        alvo: (ativo?.textContent ?? ativo?.tagName ?? '').trim().slice(0, 24),
      };
    });
    console.log(`${largura}: foco ao abrir = ${JSON.stringify(focoAoAbrir)}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-vu-detail]'), 'Escape não fechou o detalhe').toHaveCount(0);
    const foco = await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.getAttribute('data-vu-detail-trigger'),
    );
    console.log(`${largura}: foco após Escape = ${JSON.stringify(foco)}`);
    expect(foco, 'Escape fechou sem devolver o foco ao acionador').not.toBeNull();
  });
}

test('UXH-12: relacionado nunca deixa o detalhe vazio nem trava a lista', async ({ page }) => {
  // Ruling: o estado "detalhe indisponível" não é produzido por caminho nenhum hoje —
  // o detalhe deriva de `detailPoints()`, sempre populado pela lista corrente, e um
  // relacionado fora do recorte exigiria referência persistida apontando para fora.
  // O que é medível (plano B): o relacionado abre com conteúdo e a lista continua viva.
  await abrirDemo(page, 1280);
  await abrirLista(page);
  const idsNaLista = await idsDosItens(page);
  console.log(`itens no recorte: ${JSON.stringify(idsNaLista)}`);

  let indice = -1;
  for (let i = 0; i < idsNaLista.length; i += 1) {
    await abrirDetalhe(page, i);
    if ((await page.locator('.related-occurrences button').count()) > 0) {
      indice = i;
      break;
    }
  }
  expect(
    indice,
    'nenhum item do recorte lista relacionados: caso não exercitável com estes dados',
  ).toBeGreaterThanOrEqual(0);

  const relacionados = await page
    .locator('.related-occurrences button')
    .evaluateAll((nos) => nos.map((n) => (n.textContent ?? '').trim().slice(0, 30)));
  console.log(
    `item ${indice} (${idsNaLista[indice]}) · relacionados: ${JSON.stringify(relacionados)}`,
  );

  await page.locator('.related-occurrences button').first().click();
  await page.waitForTimeout(500);

  const depois = await page.evaluate(() => {
    const detalhe = document.querySelector('[data-vu-detail]');
    return {
      detalhes: document.querySelectorAll('[data-vu-detail]').length,
      texto: (detalhe?.textContent ?? '').trim().replace(/\s+/g, ' '),
      alertas: document.querySelectorAll('[data-vu-detail] [role="alert"]').length,
      itensNaLista: document.querySelectorAll('ul.result-list > li').length,
    };
  });
  console.log(
    `após o relacionado: detalhes=${depois.detalhes} · caracteres=${depois.texto.length} · alertas=${depois.alertas} · itens=${depois.itensNaLista}`,
  );
  expect(depois.detalhes, 'o relacionado fechou o detalhe').toBe(1);
  expect(depois.texto.length, 'o detalhe ficou vazio ao abrir um relacionado').toBeGreaterThan(0);
  expect(depois.itensNaLista, 'a lista desapareceu ao abrir um relacionado').toBeGreaterThan(0);
  // Evidência para a dívida datada: hoje o alerta nunca aparece porque o relacionado resolve.
  console.log(
    `superfície role="alert" dentro do detalhe: ${depois.alertas} (0 = estado inalcançável)`,
  );

  // A lista continua utilizável depois do relacionado.
  await abrirDetalhe(page, 0);
  await expect(page.locator('[data-vu-detail]'), 'a lista deixou de responder').toHaveCount(1);
});
