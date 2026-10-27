import { expect, test, type Page } from '@playwright/test';

/**
 * Lote D, passada 1 — UXH-13 (Informes com filtros próprios no servidor) e
 * UXH-14 (Histórico com filtros no topo e sem Reprodução temporal).
 *
 * Hooks que a régua procura (contrato):
 *   [data-vu-informes-filters]        bloco de filtros próprios de Informes
 *   [data-vu-informes-criteria]       critérios aplicados junto aos resultados
 *   [data-vu-informes-radius]         controle de raio, teto 5 km
 *   [data-vu-history-filters]         filtros no topo do Histórico
 *   [data-vu-history-complements]     complementos recolhidos
 *   [data-vu-history-apply]           botão «Aplicar filtros»
 *   [data-vu-history-table]           tabela (desktop)
 *   [data-vu-history-list]            lista (móvel)
 *   [data-vu-history-snapshot]        marcação do snapshot da consulta
 *   [data-vu-replay]                  NÃO pode existir (Reprodução temporal removida)
 *
 * Mutações por caso (uma por vez, sobre o passe):
 *   1 herança do Mapa   → copiar filtros do Mapa para Informes
 *   2 filtros no servidor → filtrar só no cliente (requisição sem os parâmetros)
 *   3 teto do raio      → aceitar raio > 5000 m na requisição
 *   4 erro × vazio      → usar o mesmo texto/estado nos dois
 *   5 Aplicar filtros   → aplicar sem clique (ao digitar)
 *   6 reprodutor        → reintroduzir qualquer controle de reprodução
 *   7 tabela × lista    → renderizar tabela no móvel (ou lista no desktop)
 */

const sessaoAdmin = {
  code: 'SESSION',
  message: 'Sessão sintética de administração',
  authenticated: true,
  role: 'ADMIN',
  csrfToken: 'synthetic-admin-lote-d',
};

async function abrir(page: Page, largura: number, rota = '/'): Promise<void> {
  // Rede de segurança para o modo API: sem isso, qualquer consulta real recebe 401
  // (não há cookie nesta régua), o app limpa a sessão e cai na tela de entrada.
  // Registrada ANTES das rotas específicas porque o Playwright resolve em LIFO.
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
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(rota);
  await expect(page.locator('main')).toBeVisible();
}

/** Navega para uma view pelo rótulo, tentando cada contêiner e só clicando no visível. */
async function irPara(page: Page, rotulo: RegExp): Promise<void> {
  const candidatos = [
    page.locator('nav.vu-bottom-bar button', { hasText: rotulo }),
    page.locator('nav.primary-nav button', { hasText: rotulo }),
    page.locator('nav.primary-nav a', { hasText: rotulo }),
    page.getByRole('button', { name: rotulo }),
  ];
  const vistos: string[] = [];
  for (const alvo of candidatos) {
    const total = await alvo.count();
    for (let i = 0; i < total; i += 1) {
      const item = alvo.nth(i);
      const visivel = await item.isVisible().catch(() => false);
      const texto = (await item.textContent().catch(() => ''))?.trim().slice(0, 20) ?? '';
      vistos.push(`${texto}${visivel ? '' : '(oculto)'}`);
      if (!visivel) continue;
      try {
        await item.click({ timeout: 5_000 });
        await page.waitForTimeout(700);
        return;
      } catch {
        // segue para o próximo candidato
      }
    }
  }
  throw new Error(`destino ${rotulo} não acionável · candidatos: ${JSON.stringify(vistos)}`);
}

/** Guarda as URLs de consulta observadas durante uma ação. */
function observarConsultas(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/v1/') && /query|occurrence|history|insight/i.test(url)) urls.push(url);
  });
  return urls;
}

test('UXH-13: Informes (view active) tem filtros próprios e não herda os do Mapa', async ({
  page,
}) => {
  await abrir(page, 1280);
  // Filtra no Mapa para que a herança, se existir, seja detectável.
  const pilarMapa = page.getByRole('button', { name: 'Trânsito', exact: true });
  if ((await pilarMapa.count()) > 0) await pilarMapa.first().click();
  await page.waitForTimeout(300);
  await irPara(page, /Ocorrências/);

  const filtros = page.locator('[data-vu-informes-filters]');
  await expect(filtros, 'Informes sem bloco de filtros próprio').toHaveCount(1);
  const criterios = page.locator('[data-vu-informes-criteria]');
  await expect(criterios, 'critérios aplicados não aparecem junto aos resultados').toHaveCount(1);
  const texto = ((await criterios.textContent()) ?? '').trim().replace(/\s+/g, ' ');
  console.log(`critérios em Informes: "${texto.slice(0, 90)}"`);
  expect(texto.toLowerCase(), 'Informes herdou o filtro de pilar do Mapa').not.toContain(
    'trânsito',
  );
});

test('UXH-13: filtros combinados vão na requisição do servidor', async ({ page }) => {
  await abrir(page, 1280);
  await irPara(page, /Ocorrências/);
  const urls = observarConsultas(page);
  const pilar = page.locator('[data-vu-informes-filters]').getByRole('button', {
    name: /Trânsito|Segurança/,
  });
  if ((await pilar.count()) > 0) await pilar.first().click();
  const aplicar = page.locator(
    '[data-vu-informes-filters] [data-vu-history-apply], [data-vu-informes-filters] button',
    { hasText: /Aplicar/i },
  );
  if ((await aplicar.count()) > 0) await aplicar.first().click();
  await page.waitForTimeout(900);
  console.log(`requisições: ${JSON.stringify(urls.slice(-3))}`);
  expect(
    urls.length,
    'nenhuma requisição de consulta disparada ao aplicar filtros',
  ).toBeGreaterThan(0);
  const comFiltro = urls.filter((u) => /pillar|pilar|situation|situacao|type|tipo/i.test(u));
  expect(
    comFiltro.length,
    `nenhuma requisição levou o filtro (últimas: ${JSON.stringify(urls.slice(-2))})`,
  ).toBeGreaterThan(0);
});

test('UXH-13: raio máximo de 5 km é respeitado na requisição', async ({ page }) => {
  await abrir(page, 1280);
  await irPara(page, /Ocorrências/);
  const raio = page.locator(
    '[data-vu-informes-radius] input[type="range"], [data-vu-informes-radius] input[type="number"]',
  );
  await expect(raio, 'controle de raio ausente em Informes').toHaveCount(1);
  const urls = observarConsultas(page);
  await raio.first().evaluate((el: HTMLInputElement) => {
    el.value = '9000';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  const comRaio = urls.filter((u) => /radius|raio/i.test(u));
  console.log(`requisições com raio: ${JSON.stringify(comRaio.slice(-2))}`);
  if (comRaio.length === 0) {
    expect(comRaio.length, 'a requisição não leva o raio').toBeGreaterThan(0);
  }
  const valores = comRaio.flatMap((u) =>
    [...u.matchAll(/radius\w*=(\d+)/gi)].map((m) => Number(m[1])),
  );
  console.log(`valores de raio enviados: ${JSON.stringify(valores)}`);
  expect(
    Math.max(...valores, 0),
    'raio acima de 5000 m foi enviado ao servidor',
  ).toBeLessThanOrEqual(5000);
});

test('UXH-14: Histórico tem filtros no topo, complementos recolhidos e Aplicar', async ({
  page,
}) => {
  // Ruling: em `?consulta=api` o botão é a porta única; em demonstração o recorte
  // acompanha os campos. Este caso mede o modo API.
  await abrir(page, 1280, '/?consulta=api');
  await irPara(page, /Histórico/);
  await expect(
    page.locator('[data-vu-history-filters]'),
    'Histórico sem filtros no topo',
  ).toHaveCount(1);
  await expect(
    page.locator('[data-vu-history-apply]'),
    'Histórico sem «Aplicar filtros»',
  ).toHaveCount(1);
  const complementos = page.locator('[data-vu-history-complements]');
  await expect(complementos, 'Histórico sem bloco de complementos').toHaveCount(1);
  const recolhido = await complementos.evaluate(
    (el) =>
      el.hasAttribute('hidden') ||
      el.getAttribute('aria-expanded') === 'false' ||
      (el as HTMLElement).offsetParent === null,
  );
  console.log(`complementos recolhidos: ${recolhido}`);
  expect(recolhido, 'os complementos começam abertos').toBe(true);
  await expect(page.locator('[data-vu-history-snapshot]'), 'sem marcação de snapshot').toHaveCount(
    1,
  );
});

test('UXH-14: Reprodução temporal não existe mais', async ({ page }) => {
  await abrir(page, 1280);
  await irPara(page, /Histórico/);
  const hooks = await page.locator('[data-vu-replay]').count();
  const controles = await page.getByRole('button', { name: /reprodu|replay|play|pausar/i }).count();
  const textos = await page
    .locator('main')
    .evaluate((el) => (/reprodu[çc][ãa]o temporal/i.test(el.textContent ?? '') ? 1 : 0));
  console.log(`reprodutor: hooks=${hooks} · controles=${controles} · menção no texto=${textos}`);
  expect(hooks, 'hook de Reprodução temporal ainda presente').toBe(0);
  expect(controles, 'controle de reprodução ainda presente').toBe(0);
  expect(textos, 'o texto ainda menciona Reprodução temporal').toBe(0);
});

test('UXH-14: tabela no desktop vira cartões no móvel (medido por geometria)', async ({ page }) => {
  // Ruling: uma marcação, duas apresentações. A asserção é o layout computado —
  // a 1280 as cinco células dividem o mesmo `top`; a 390 empilham e cada uma
  // ganha rótulo pelo `::before`.
  const medir = async (rotulo: string) => {
    const dados = await page.evaluate(() => {
      const linha = document.querySelector('[data-vu-history-table] tbody tr');
      const celulas = linha ? Array.from(linha.querySelectorAll('td')) : [];
      return {
        celulas: celulas.length,
        tops: celulas.map((c) => Math.round(c.getBoundingClientRect().top)),
        rotulos: celulas.map((c) => getComputedStyle(c, '::before').content.replace(/"/g, '')),
        displayLinha: linha ? getComputedStyle(linha).display : null,
      };
    });
    console.log(`${rotulo}: ${JSON.stringify(dados)}`);
    return dados;
  };

  await abrir(page, 1280);
  await irPara(page, /Histórico/);
  await expect(page.locator('[data-vu-history-table]'), 'Histórico sem tabela').toHaveCount(1);
  const desktop = await medir('1280');
  expect(desktop.celulas, 'a linha não tem as cinco colunas').toBe(5);
  expect(new Set(desktop.tops).size, 'no desktop as células não estão na mesma linha').toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const movel = await medir('390');
  expect(
    new Set(movel.tops).size,
    'no móvel as células continuam lado a lado (tabela não virou cartão)',
  ).toBeGreaterThan(1);
  const rotuladas = movel.rotulos.filter((r) => r && r !== 'none').length;
  expect(rotuladas, 'no móvel as células não mostram rótulo (::before)').toBe(5);
});

test('UXH-14: recolher complementos mantém o recorte na requisição', async ({ page }) => {
  // Ruling: recolher é apresentação, não recorte. Campo escondido mantém o valor e
  // continua indo na consulta ao aplicar. Mutação: recolher zerando o valor.
  await abrir(page, 1280, '/?consulta=api');
  await irPara(page, /Histórico/);

  const bloco = page.locator('[data-vu-history-complements]');
  await expect(bloco, 'Histórico sem bloco de complementos').toHaveCount(1);
  // O alternador é irmão do bloco na árvore do @executor (`...-toggle`); aceito os dois.
  const alternador = page
    .locator(
      '[data-vu-history-complements-toggle], [data-vu-history-complements] button[aria-expanded]',
    )
    .first();
  await expect(alternador, 'complementos sem alternador com aria-expanded').toHaveCount(1);
  await alternador.click();
  await expect(alternador).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(250);

  // Escolhe um complemento de verdade: primeiro checkbox de filtro, ou select com opções.
  const escolha = await page.evaluate(() => {
    const caixa = document.querySelector('[data-vu-history-complements]');
    if (!caixa) return null;
    const checkbox = caixa.querySelector(
      'input[type="checkbox"][data-filter]',
    ) as HTMLInputElement | null;
    if (checkbox) {
      checkbox.click();
      return { tipo: 'checkbox', chave: checkbox.getAttribute('data-filter') ?? '' };
    }
    const select = caixa.querySelector('select') as HTMLSelectElement | null;
    if (select && select.options.length > 1) {
      select.selectedIndex = select.options.length - 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return { tipo: 'select', chave: select.name || 'select', valor: select.value };
    }
    return { tipo: 'nenhum', chave: '' };
  });
  console.log(`complemento escolhido: ${JSON.stringify(escolha)}`);
  expect(escolha?.tipo, 'nenhum controle de complemento encontrado no bloco').not.toBe('nenhum');

  // Recolhe e exige o resumo do que está ativo.
  await alternador.click();
  await expect(alternador).toHaveAttribute('aria-expanded', 'false');
  // O resumo mora no alternador, não no bloco: o bloco com `[hidden]` ainda devolve
  // o texto dos controles escondidos, e ler dali mediria a coisa errada.
  const resumo = ((await alternador.textContent()) ?? '').trim().replace(/\s+/g, ' ');
  console.log(`resumo com bloco recolhido: "${resumo.slice(0, 80)}"`);
  expect(resumo.toLowerCase(), 'sem resumo do que está aplicado com o bloco recolhido').toMatch(
    /complemento|aplicad|ativo/,
  );

  const urls = observarConsultas(page);
  await page.locator('[data-vu-history-apply]').first().click();
  await page.waitForTimeout(1200);
  console.log(`requisições após aplicar: ${JSON.stringify(urls.slice(-2))}`);
  expect(urls.length, 'aplicar não disparou consulta').toBeGreaterThan(0);
  const referencia = (escolha?.valor ?? escolha?.chave ?? '').split(':')[0].toLowerCase();
  const levou = urls.some((u) => u.toLowerCase().includes(referencia.slice(0, 8)));
  expect(
    levou,
    `o complemento "${escolha?.valor ?? escolha?.chave}" não foi para a requisição após recolher: ${JSON.stringify(urls.slice(-2))}`,
  ).toBe(true);
});
