import { expect, test, type Page } from '@playwright/test';

/**
 * Lote D, passada 2a — UXH-15 (estado do relatório) e UXH-16 (cópia do Mapa).
 *
 * Hooks do contrato (nomes meus; o componente pode renomear, eu ajusto o seletor):
 *   [data-vu-report-state="empty|draft|generated"]  estado do relatório
 *   [data-vu-report-generate]                        «Gerar»
 *   [data-vu-report-update]                          «Atualizar»
 *   [data-vu-report-new]                             «Novo relatório»
 *   [data-vu-report-snapshot]                        bloco do snapshot aplicado
 *   [data-vu-report-total]                           total do snapshot (texto com número)
 *   [data-vu-report-period]                          período do snapshot
 *   [data-vu-report-copy-map]                        «Gerar relatório no Mapa»
 *   [data-vu-report-conflict]                        diálogo «Substituir e gerar» / «Manter atual»
 *   [data-vu-report-alert]                           erro de geração (role="alert")
 *
 * Mutações por caso:
 *   1 início vazio        → gerar recorte implícito sem período
 *   2 rascunho ≠ snapshot → recalcular ao editar filtro
 *   3 falha ≠ vazio       → engolir erro como lista vazia
 *   4 sessão preservada   → perder o snapshot ao trocar de módulo
 *   5 cópia do Mapa       → copiar continuamente (pan/zoom/filtros posteriores)
 */

const sessaoAdmin = {
  code: 'SESSION',
  message: 'Sessão sintética de administração',
  authenticated: true,
  role: 'ADMIN',
  csrfToken: 'synthetic-report',
};

async function abrirRelatorios(page: Page, largura = 1280, rota = '/?consulta=api'): Promise<void> {
  await page.route('**/api/v1/**', (r) =>
    r.fulfill({ status: 200, json: { items: [], records: [], total: 0, page: 1 } }),
  );
  await page.route('**/api/v1/auth/session', (r) => r.fulfill({ json: sessaoAdmin }));
  await page.route('**/api/v1/auth/access/**', (r) => r.fulfill({ json: sessaoAdmin }));
  await page.route('**/api/v1/admin/**', (r) =>
    r.fulfill({ status: 200, json: { items: [], total: 0 } }),
  );
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
  // Sem teto curto, um hook ausente custa 90 s por clique e a linha de base vira 5 min.
  page.setDefaultTimeout(6_000);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(rota);
  await expect(page.locator('main')).toBeVisible();
  const destinos = [
    page.locator('nav.primary-nav button', { hasText: /Relatórios/i }),
    page.locator('nav.vu-bottom-bar button', { hasText: /Relatórios/i }),
    page.getByRole('button', { name: /Relatórios/i }),
  ];
  for (const alvo of destinos) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      await page.waitForTimeout(700);
      return;
    }
  }
  throw new Error('destino «Relatórios» não acionável');
}

test('UXH-15: antes de gerar não há gráfico, indicador nem recorte implícito', async ({ page }) => {
  await abrirRelatorios(page);
  const estado = page.locator('[data-vu-report-state]');
  await expect(estado, 'sem estado de relatório declarado').toHaveCount(1);
  console.log(`estado inicial: ${await estado.getAttribute('data-vu-report-state')}`);
  expect(await estado.getAttribute('data-vu-report-state')).toBe('empty');
  await expect(page.locator('[data-vu-report-snapshot]')).toHaveCount(0);

  // «Gerar» sem período tem de bloquear com mensagem, não gerar.
  const gerar = page.locator('[data-vu-report-generate]');
  await expect(gerar, 'sem botão «Gerar»').toHaveCount(1);
  await gerar.first().click();
  await page.waitForTimeout(600);
  const depois = await estado.getAttribute('data-vu-report-state');
  const mensagem = (await page.locator('main').textContent()) ?? '';
  console.log(`estado após «Gerar» sem período: ${depois}`);
  expect(depois, 'gerou recorte sem período preenchido').toBe('empty');
  expect(mensagem.toLowerCase(), 'sem mensagem explicando o bloqueio').toMatch(
    /per[íi]odo|informe|escolha|obrigat[óo]ri/,
  );
});

/**
 * Payload do contrato do relatório: `counts` e `relatedItems` são obrigatórios no
 * caminho real, e o catch-all devolve um corpo genérico que não os tem.
 * A sequência de valores permite distinguir "não mudou" de "mudou" sem igualdade trivial.
 */
async function mockRelatorio(page: Page, valores: number[]): Promise<void> {
  let chamada = 0;
  await page.route('**/api/v1/reports/occurrences**', (r) => {
    const n = valores[Math.min(chamada, valores.length - 1)] ?? 0;
    chamada += 1;
    return r.fulfill({
      json: {
        generatedAt: '2026-10-28T12:00:00Z',
        attribution: [],
        items: [],
        relatedItems: [],
        counts: {
          occurrences: n,
          happenings: n,
          mappedOccurrences: n,
          listOnlyOccurrences: 0,
          temporallyCertain: n,
          temporallyPossible: 0,
        },
      },
    });
  });
}

/** Navega SEM recarregar a página — `goto` destrói o estado em memória do relatório. */
async function irParaModulo(page: Page, rotulo: RegExp): Promise<void> {
  for (const alvo of [
    page.locator('nav.primary-nav button', { hasText: rotulo }),
    page.locator('nav.vu-bottom-bar button', { hasText: rotulo }),
    page.getByRole('button', { name: rotulo }),
  ]) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      await page.waitForTimeout(700);
      return;
    }
  }
  throw new Error(`destino ${rotulo} não acionável`);
}

/** Preparação determinística: um chip de filtro no Mapa deixa `queryFilters()` não-nulo. */
async function recorteNoMapa(page: Page): Promise<void> {
  for (const alvo of [
    page.locator('nav.primary-nav button', { hasText: /Mapa/i }),
    page.locator('nav.vu-bottom-bar button', { hasText: /Mapa/i }),
  ]) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      break;
    }
  }
  await page.waitForTimeout(600);
  // Os chips de filtro vivem no painel de filtros: se ele estiver recolhido, abre.
  let chips = page.locator('[data-filter]');
  if ((await chips.count()) === 0) {
    for (const gatilho of [
      page.getByRole('button', { name: /Filtros/i }),
      page.getByRole('button', { name: /filtros avançados/i }),
    ]) {
      if ((await gatilho.count()) > 0 && (await gatilho.first().isVisible())) {
        await gatilho.first().click();
        await page.waitForTimeout(500);
        chips = page.locator('[data-filter]');
        if ((await chips.count()) > 0) break;
      }
    }
  }
  const total = await chips.count();
  expect(total, 'nenhum chip [data-filter] no Mapa para preparar o recorte').toBeGreaterThan(0);
  // O chip pode estar fora de vista no painel; aqui o objetivo é o ESTADO do filtro,
  // não a hit-area do controle (que tem régua própria no UX-3).
  await chips.first().evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(400);
  console.log(`recorte no Mapa: chip ${await chips.first().getAttribute('data-filter')}`);
}

test('UXH-15: rascunho não muda o snapshot até «Atualizar»', async ({ page }) => {
  await abrirRelatorios(page);
  await recorteNoMapa(page);
  await irParaModulo(page, /Relatórios/i);
  await mockRelatorio(page, [3, 5]);
  await page.locator('[data-vu-report-generate]').first().click();
  await page.waitForTimeout(1200);
  const estado = page.locator('[data-vu-report-state]');
  console.log(`estado após gerar: ${await estado.getAttribute('data-vu-report-state')}`);
  expect(await estado.getAttribute('data-vu-report-state'), 'não gerou com recorte do Mapa').toBe(
    'generated',
  );

  // Espera o estado, não o relógio: se o snapshot não voltar, o caso falha com nome.
  const ler = async () => {
    await expect(
      page.locator('[data-vu-report-total]'),
      'o snapshot não está na tela depois de voltar ao módulo',
    ).toHaveCount(1, { timeout: 4_000 });
    return {
      total: (
        (await page
          .locator('[data-vu-report-total]')
          .first()
          .textContent()
          .catch(() => '')) ?? ''
      ).trim(),
      periodo: (
        (await page
          .locator('[data-vu-report-period]')
          .first()
          .textContent()
          .catch(() => '')) ?? ''
      ).trim(),
    };
  };
  const antes = await ler();
  console.log(`snapshot antes: ${JSON.stringify(antes)}`);
  expect(antes.total, 'snapshot sem total').not.toBe('');

  // Muda o RASCUNHO (o mesmo chip, desligado) sem atualizar: o snapshot não se move.
  for (const alvo of [
    page.locator('nav.primary-nav button', { hasText: /Mapa/i }),
    page.locator('nav.vu-bottom-bar button', { hasText: /Mapa/i }),
  ]) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      break;
    }
  }
  await page.waitForTimeout(400);
  await page
    .locator('[data-filter]')
    .first()
    .evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(400);
  await irParaModulo(page, /Relatórios/i);
  const durante = await ler();
  console.log(`snapshot após mexer no rascunho: ${JSON.stringify(durante)}`);
  expect(durante, 'o snapshot mudou com a edição do rascunho').toEqual(antes);

  await page.locator('[data-vu-report-update]').first().click();
  await page.waitForTimeout(1400);
  const depois = await ler();
  console.log(`snapshot após «Atualizar»: ${JSON.stringify(depois)}`);
  expect(depois, '«Atualizar» não recalculou o snapshot').not.toEqual(antes);
});

test('UXH-15: falha do servidor é alerta, não "nenhum resultado"', async ({ page }) => {
  await abrirRelatorios(page);
  await recorteNoMapa(page);
  await irParaModulo(page, /Relatórios/i);
  await mockRelatorio(page, [3]);
  await page.route('**/api/v1/**', (r) =>
    r.fulfill({ status: 500, json: { code: 'UNAVAILABLE', message: 'Falha sintética' } }),
  );
  await page.locator('[data-vu-report-generate]').first().click();
  await page.waitForTimeout(1400);
  const alerta = page.locator('[data-vu-report-alert], main [role="alert"]');
  await expect(alerta.first(), 'falha do servidor sem role="alert"').toBeVisible();
  const texto = ((await alerta.first().textContent()) ?? '').trim();
  console.log(`alerta: "${texto.slice(0, 90)}"`);
  expect(texto.toLowerCase(), 'a falha foi apresentada como resultado vazio').not.toMatch(
    /nenhum resultado|sem resultados/,
  );
});

test('UXH-15: snapshot sobrevive à troca de módulo e «Novo relatório» confirma', async ({
  page,
}) => {
  await abrirRelatorios(page);
  await recorteNoMapa(page);
  await irParaModulo(page, /Relatórios/i);
  await mockRelatorio(page, [3]);
  await page.locator('[data-vu-report-generate]').first().click();
  await page.waitForTimeout(1200);
  const total = (
    (await page
      .locator('[data-vu-report-total]')
      .first()
      .textContent()
      .catch(() => '')) ?? ''
  ).trim();
  expect(total, 'snapshot sem total após gerar').not.toBe('');

  for (const alvo of [
    page.locator('nav.primary-nav button', { hasText: /Mapa/i }),
    page.locator('nav.vu-bottom-bar button', { hasText: /Mapa/i }),
  ]) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      break;
    }
  }
  await page.waitForTimeout(500);
  await irParaModulo(page, /Relatórios/i);
  const totalDepois = (
    (await page
      .locator('[data-vu-report-total]')
      .first()
      .textContent()
      .catch(() => '')) ?? ''
  ).trim();
  console.log(`total antes=${total} · depois de voltar=${totalDepois}`);
  expect(totalDepois, 'o snapshot se perdeu ao trocar de módulo').toBe(total);

  await page.locator('[data-vu-report-new]').first().click();
  await page.waitForTimeout(500);
  const confirmacao = page.locator('[data-vu-report-conflict], [role="dialog"]');
  await expect(confirmacao.first(), '«Novo relatório» limpou sem confirmar').toBeVisible();
  const texto = ((await confirmacao.first().textContent()) ?? '').toLowerCase();
  console.log(`confirmação: "${texto.replace(/\s+/g, ' ').slice(0, 80)}"`);
  expect(texto).toMatch(/novo|limpar|descartar|perder/);
});

test('UXH-16: «Gerar relatório no Mapa» copia uma vez e não segue o Mapa', async ({ page }) => {
  await abrirRelatorios(page);
  await recorteNoMapa(page);
  await irParaModulo(page, /Relatórios/i);
  await mockRelatorio(page, [3]);
  const copiar = page.locator('[data-vu-report-copy-map]');
  await expect(copiar, 'sem controle «Gerar relatório no Mapa»').toHaveCount(1);
  await copiar.first().click();
  await page.waitForTimeout(1200);
  const estado = await page.locator('[data-vu-report-state]').getAttribute('data-vu-report-state');
  console.log(`estado após cópia do Mapa: ${estado}`);
  expect(estado, 'a cópia do Mapa não gerou relatório').toBe('generated');

  const ler = async () => ({
    total: (
      (await page
        .locator('[data-vu-report-total]')
        .first()
        .textContent()
        .catch(() => '')) ?? ''
    ).trim(),
    periodo: (
      (await page
        .locator('[data-vu-report-period]')
        .first()
        .textContent()
        .catch(() => '')) ?? ''
    ).trim(),
  });
  const antes = await ler();

  // Mexer no Mapa depois NÃO pode alterar o relatório copiado.
  for (const alvo of [
    page.locator('nav.primary-nav button', { hasText: /Mapa/i }),
    page.locator('nav.vu-bottom-bar button', { hasText: /Mapa/i }),
  ]) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      break;
    }
  }
  await page.waitForTimeout(400);
  const chips = page.locator('[data-filter]');
  if ((await chips.count()) > 1) await chips.nth(1).evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(500);
  await irParaModulo(page, /Relatórios/i);
  const depois = await ler();
  console.log(
    `total "${antes.total}" → "${depois.total}" · período "${antes.periodo}" → "${depois.periodo}"`,
  );
  expect(depois, 'o relatório copiado seguiu os filtros posteriores do Mapa').toEqual(antes);
});
