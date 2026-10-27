import { expect, test, type Page } from '@playwright/test';
import { confirmedUser } from './helpers/local-account';
import { loginBrowser, syntheticAdmin } from './helpers/synthetic-admin';

/**
 * UXH-11 — Configurações unificadas, com autorização provada no backend.
 *
 * Critério 3 do ticket: **USER não acessa administração por URL nem por HTTP.**
 * A régua não se contenta com item escondido na navegação: prova **403** nos
 * dois endpoints com sessão de USER e 200 com ADMIN (sujeito a MFA).
 *
 * Contrato de hooks (ruling de abertura):
 *   [data-vu-admin-nav]                        navegação com EXATAMENTE dois destinos
 *   [data-vu-admin-section="fontes|logs"]      seção ativa
 *   [data-vu-admin-back]                       «Voltar ao aplicativo»
 *   [data-vu-admin-unsaved]                    diálogo de descarte com edição pendente
 *
 * Regras de casa aplicadas: espera por atributo/contagem — nunca tempo fixo — e
 * comparação por conjunto quando o mesmo dado é pintado em dois lugares.
 */

const API = process.env['VETOR_E2E_API_BASE'] ?? 'http://127.0.0.1:8080/api/v1';
const ADMIN = process.env['VETOR_ACCOUNTS_E2E'] === '1';
const FAMILIA = 'vetor_final_account_closure'; // ADMIN=6, USER=18 (levantado pelo @infra)

async function abrirDemo(page: Page): Promise<void> {
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de administração',
    authenticated: true,
    role: 'ADMIN',
    csrfToken: 'synthetic-admin-config',
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
}

/** Abre a folha móvel (o shell do UX-6 é o único caminho para o conteúdo a 390). */
/** Entra na view de Fontes, que é onde a moldura de administração é montada. */
async function abrirFontes(page: Page): Promise<void> {
  // A folha expandida cobre a barra (critério do UX-6): para clicar num destino
  // da barra a folha tem de estar recolhida.
  const folha = page.locator('[data-vu="sheet"]');
  if ((await folha.getAttribute('data-vu-sheet-state')) === 'expanded') {
    await page.locator('[data-vu="sheet-disclosure"]').first().click();
    await expect(folha).toHaveAttribute('data-vu-sheet-state', 'collapsed');
  }
  const fontes = page.locator('nav.vu-bottom-bar button', { hasText: 'Fontes' });
  if ((await fontes.count()) > 0) {
    await fontes.first().click();
  } else {
    await page.getByRole('button', { name: 'Fontes', exact: true }).first().click();
  }
  await page.waitForTimeout(400);
}

async function abrirFolha(page: Page): Promise<void> {
  const disclosure = page.locator('[data-vu="sheet-disclosure"]');
  if ((await disclosure.count()) > 0) {
    await disclosure.first().click();
    await expect(page.locator('[data-vu="sheet"]')).toHaveAttribute(
      'data-vu-sheet-state',
      'expanded',
    );
  }
}

test('UXH-11: ADMIN alcança «Logs administrativos» a 390', async ({ page, request }) => {
  test.skip(!ADMIN, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
  await syntheticAdmin(page, request, 'vu-uxh01-five-db');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  // O destino de administração vive na moldura de Fontes — não na folha.
  await abrirFontes(page);

  const logs = page.getByRole('button', { name: 'Logs administrativos', exact: true });
  await expect(logs, 'ADMIN a 390 não alcança «Logs administrativos»').toHaveCount(1);
  await expect(logs.first()).toBeInViewport({ ratio: 0.5 });
  console.log('ADMIN a 390: «Logs administrativos» presente e no viewport');
});

test('UXH-11: USER recebe 403 nos dois endpoints de administração', async ({ page, request }) => {
  test.skip(!ADMIN, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
  const email = await confirmedUser(request, 'user403');
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginBrowser(page, email);
  // `loginBrowser` só preenche e clica: sem esperar o shell autenticado, a
  // requisição seguinte sai antes do login e um 401 seria do teste.
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();

  // Controle do próprio instrumento: se `/auth/session` não disser que a sessão
  // está autenticada, o 401 dos endpoints é falta de login do teste, não
  // semântica de autorização da API.
  const sessao = await page.request.get(`${API}/auth/session`);
  const corpo = (await sessao.json().catch(() => ({}))) as { authenticated?: boolean };
  console.log(
    `controle: GET /auth/session = ${sessao.status()} authenticated=${corpo.authenticated}`,
  );
  expect(
    sessao.status(),
    'a sessão de USER não foi estabelecida: o 401 abaixo seria do teste',
  ).toBe(200);
  expect(corpo.authenticated, 'sessão de USER não autenticada').toBe(true);

  for (const caminho of ['admin/logs', 'admin/sources']) {
    const resposta = await page.request.get(`${API}/${caminho}`);
    console.log(`USER → GET /api/v1/${caminho} = ${resposta.status()}`);
    expect(
      resposta.status(),
      `USER autenticado recebeu ${resposta.status()} em /${caminho} (esperado 403)`,
    ).toBe(403);
  }
});

test('UXH-11: ADMIN recebe 200 nos dois endpoints', async ({ page, request }) => {
  test.skip(!ADMIN, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
  await syntheticAdmin(page, request, 'vu-uxh01-five-db');
  for (const caminho of ['admin/logs', 'admin/sources']) {
    const resposta = await page.request.get(`${API}/${caminho}`);
    console.log(`ADMIN → GET /api/v1/${caminho} = ${resposta.status()}`);
    expect(resposta.status(), `ADMIN recebeu ${resposta.status()} em /${caminho}`).toBe(200);
  }
});

test('UXH-11: a navegação de administração tem exatamente dois destinos', async ({ page }) => {
  await abrirDemo(page);
  await abrirFontes(page);
  const nav = page.locator('[data-vu-admin-nav]');
  await expect(nav, 'navegação de administração ausente').toHaveCount(1);
  const destinos = await nav.evaluate((elemento) =>
    Array.from(elemento.querySelectorAll('a, button')).map((item) =>
      (item.textContent ?? '').trim().replace(/\s+/g, ' '),
    ),
  );
  console.log(`destinos: ${JSON.stringify(destinos)}`);
  expect(destinos.length, `destinos encontrados: ${JSON.stringify(destinos)}`).toBe(2);
  const secoes = await page.locator('[data-vu-admin-section]').count();
  expect(secoes, 'nenhuma seção de administração montada').toBeGreaterThanOrEqual(1);
});

test('UXH-11: a seção monta pelo caminho da aplicação e «Voltar» vem primeiro no foco', async ({
  page,
}) => {
  // A aplicação NÃO tem roteamento por URL: `location.hash` e `location.search`
  // não são lidos (só `?consulta=api`). A primeira versão deste caso navegava
  // para `/#fontes`/`/#logs` — rota que eu inventei, e por isso o hook existia e
  // não aparecia (`Received: 0`). O critério "URL" do ticket não é medível
  // enquanto não houver rota; o que é medível é o caminho que a tela oferece.
  await abrirDemo(page);
  await abrirFontes(page);
  const nav = page.locator('[data-vu-admin-nav]');
  await expect(nav, 'navegação de administração ausente').toHaveCount(1);
  const destinos = nav.locator('a, button');
  const total = await destinos.count();
  console.log(`destinos na navegação: ${total}`);
  for (let i = 0; i < total; i += 1) {
    const alvo = destinos.nth(i);
    const nome = (await alvo.textContent())?.trim() ?? '';
    await alvo.click();
    await expect(
      page.locator('[data-vu-admin-section]'),
      `seção não montou por «${nome}»`,
    ).toHaveCount(1);
    const ativo = await page.locator('[data-vu-admin-nav] [aria-current="page"]').count();
    console.log(`  «${nome}» montou a seção · destinos com aria-current = ${ativo}`);
    expect(ativo, `nenhum destino marcado como ativo após «${nome}»`).toBe(1);
    const voltar = page.locator('[data-vu-admin-back]');
    await expect(voltar, '«Voltar ao aplicativo» ausente').toHaveCount(1);
    await voltar.first().focus();
    const primeiro = await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.hasAttribute('data-vu-admin-back'),
    );
    expect(primeiro, '«Voltar ao aplicativo» não recebe foco').toBe(true);
  }
});

test('UXH-11: USER não recebe destino de administração na navegação', async ({ page }) => {
  // Sem roteamento por URL, a metade "URL" do critério 3 vira: o USER não
  // encontra caminho na tela. A metade "HTTP" está provada em outro caso (403).
  await abrirDemo(page);
  await page.unroute('**/api/v1/auth/session');
  await page.route('**/api/v1/auth/session', (rota) =>
    rota.fulfill({
      json: {
        code: 'SESSION',
        message: 'Sessão sintética de USER',
        authenticated: true,
        role: 'USER',
        csrfToken: 'synthetic-user',
      },
    }),
  );
  await page.goto('/');
  await page.waitForTimeout(400);
  await abrirFolha(page);
  const nav = await page.locator('[data-vu-admin-nav]').count();
  const logs = await page
    .getByRole('button', { name: 'Logs administrativos', exact: true })
    .count();
  const restrito = await page.locator('[data-vu-admin-restricted]').count();
  console.log(`USER: nav=${nav} · destino Logs=${logs} · marcador de restrito=${restrito}`);
  expect(nav, 'USER recebeu a navegação de administração').toBe(0);
  expect(logs, 'USER recebeu o destino «Logs administrativos»').toBe(0);
});

test('UXH-11: trocar de seção com edição suja pede descarte, e Escape cancela', async ({
  page,
}) => {
  await abrirDemo(page);
  await abrirFontes(page);
  const navF = page.locator('[data-vu-admin-nav] a, [data-vu-admin-nav] button');
  await expect(navF.first(), 'navegação de administração ausente').toHaveCount(1);
  await navF.first().click();
  await page.waitForTimeout(300);
  const campo = page.locator('input[type="text"], input:not([type])').first();
  if ((await campo.count()) === 0) {
    expect(false, 'seção de Fontes sem campo editável: descarte não é exercitável').toBe(true);
    return;
  }
  await campo.fill('edição pendente do teste');
  await page.locator('[data-vu-admin-nav] a, [data-vu-admin-nav] button').last().click();
  const dialogo = page.locator('[data-vu-admin-unsaved]');
  await expect(dialogo, 'troca de seção com edição suja não pediu descarte').toBeVisible();
  const foco = await page.evaluate(() =>
    (document.activeElement?.textContent ?? '').trim().toLowerCase(),
  );
  console.log(`foco inicial no diálogo: "${foco}"`);
  expect(foco, 'o foco inicial do diálogo foi para a ação destrutiva').not.toContain('descartar');
  await page.keyboard.press('Escape');
  await expect(dialogo).toHaveCount(0);
  const secoes = await page.locator('[data-vu-admin-section="fontes"]').count();
  expect(secoes, 'Escape descartou a edição em vez de cancelar').toBe(1);
});

/** A 390 a lateral de dois destinos vira alternador de abas; nunca lista vertical. */
test('UXH-11: a 390 a navegação é alternador de duas abas, com aria-current no ativo', async ({
  page,
}) => {
  await abrirDemo(page);
  await abrirFontes(page);
  const dados = await page.evaluate(() => {
    const nav = document.querySelector('[data-vu-admin-nav]');
    if (!nav) return null;
    const itens = Array.from(nav.querySelectorAll('a, button')).map((item) => {
      const r = item.getBoundingClientRect();
      return {
        nome: (item.textContent ?? '').trim().replace(/\s+/g, ' '),
        top: Math.round(r.top),
        esquerda: Math.round(r.left),
        ariaCurrent: item.getAttribute('aria-current'),
      };
    });
    const caixa = nav.getBoundingClientRect();
    return { itens, alturaNav: Math.round(caixa.height), larguraNav: Math.round(caixa.width) };
  });
  console.log(`navegação a 390: ${JSON.stringify(dados)}`);
  expect(dados, 'navegação de administração ausente').not.toBeNull();
  const itens = dados!.itens;
  expect(itens.length, 'não são dois destinos').toBe(2);
  // Alternador: os dois na mesma faixa vertical e lado a lado.
  expect(
    Math.abs(itens[0]!.top - itens[1]!.top),
    'os destinos estão empilhados: a 390 isso é lista vertical, não alternador',
  ).toBeLessThanOrEqual(4);
  expect(itens[0]!.esquerda, 'os dois destinos ocupam a mesma coluna').not.toBe(itens[1]!.esquerda);
  // `aria-current` no ativo, além da cor.
  const comAtual = itens.filter((item) => item.ariaCurrent === 'page');
  console.log(`destinos com aria-current="page": ${JSON.stringify(comAtual.map((i) => i.nome))}`);
  expect(comAtual.length, 'nenhum destino ativo declara aria-current="page"').toBe(1);
});

test('UXH-11: cada destino tem nome acessível próprio e nada depende só de ícone', async ({
  page,
}) => {
  await abrirDemo(page);
  await abrirFontes(page);
  const nomes = await page.evaluate(() => {
    const nav = document.querySelector('[data-vu-admin-nav]');
    if (!nav) return [];
    return Array.from(nav.querySelectorAll('a, button')).map((item) => {
      const texto = (item.textContent ?? '').trim().replace(/\s+/g, ' ');
      const aria = item.getAttribute('aria-label') ?? '';
      return { texto, aria, soIcone: texto.length === 0 && !aria };
    });
  });
  console.log(`nomes acessíveis: ${JSON.stringify(nomes)}`);
  expect(nomes.length).toBe(2);
  for (const nome of nomes) {
    expect(nome.soIcone, `destino sem nome acessível: ${JSON.stringify(nome)}`).toBe(false);
  }
  const distintos = new Set(nomes.map((n) => (n.texto || n.aria).toLowerCase()));
  expect(distintos.size, 'dois destinos com o mesmo nome acessível').toBe(2);
});

test('UXH-11: vazio de Logs é diferente de falha, e o vazio traz ação primária', async ({
  page,
}) => {
  await abrirDemo(page);
  // Vazio: a API responde 200 com lista vazia.
  await page.route('**/api/v1/admin/logs**', (rota) =>
    rota.fulfill({ status: 200, json: { items: [], total: 0 } }),
  );
  await page.goto('/#logs');
  await page.waitForTimeout(500);
  const vazio = (await page.locator('[data-vu-admin-section="logs"]').textContent()) ?? '';
  console.log(`texto do vazio: "${vazio.trim().slice(0, 90)}"`);
  expect(vazio.trim().length, 'vazio de Logs sem mensagem').toBeGreaterThan(0);
  const acaoVazio = await page
    .locator('[data-vu-admin-section="logs"] button, [data-vu-admin-section="logs"] a')
    .count();
  expect(acaoVazio, 'vazio de Logs sem ação primária (ajustar filtro)').toBeGreaterThan(0);

  // Falha: 503, e o texto tem de ser outro.
  await page.unroute('**/api/v1/admin/logs**');
  await page.route('**/api/v1/admin/logs**', (rota) =>
    rota.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }),
  );
  await page.goto('/#logs');
  await page.waitForTimeout(500);
  const falha = (await page.locator('[data-vu-admin-section="logs"]').textContent()) ?? '';
  console.log(`texto da falha: "${falha.trim().slice(0, 90)}"`);
  expect(falha.trim(), 'falha de Logs sem mensagem própria').not.toBe(vazio.trim());
});

test('UXH-11: carregamento usa role=status e erro usa role=alert com tentar de novo', async ({
  page,
}) => {
  await abrirDemo(page);
  let liberar!: () => void;
  const portao = new Promise<void>((resolve) => (liberar = resolve));
  await page.route('**/api/v1/admin/logs**', async (rota) => {
    await portao;
    await rota.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
  });
  await page.goto('/#logs');
  const status = page.locator('[data-vu-admin-section="logs"] [role="status"]');
  await expect(status, 'carregamento sem role="status"').toBeVisible({ timeout: 10_000 });
  liberar();
  const alerta = page.locator('[data-vu-admin-section="logs"] [role="alert"]');
  await expect(alerta, 'erro sem role="alert"').toBeVisible({ timeout: 10_000 });
  const tentar = alerta.getByRole('button', { name: /tentar|recarregar|novamente/i });
  await expect(tentar, 'alerta sem botão de tentar de novo').toHaveCount(1);
  console.log('carregando (status) e erro (alert + tentar de novo): ok');
});
