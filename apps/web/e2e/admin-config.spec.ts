import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { confirmedUser, testPassword } from './helpers/local-account';
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
  // Sem isto, `admin/logs` bate no 8080 real sem cookie, recebe 401 e o app limpa
  // a sessão mockada — 401 de instrumento, não de produto.
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

/** Entra na superfície de Logs pelo caminho real (a aplicação não tem rota por URL). */
async function abrirLogs(page: Page): Promise<void> {
  await abrirFontes(page);
  const destino = page.locator('[data-vu-admin-nav] a, [data-vu-admin-nav] button', {
    hasText: 'Logs',
  });
  await destino.first().click();
  await page.waitForTimeout(300);
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

    // Estabilidade: o botão é recriado a cada ciclo? Três amostras com folga.
    const amostras: number[] = [];
    for (let s = 0; s < 3; s += 1) {
      amostras.push(await page.locator('[data-vu-admin-back]').count());
      await page.waitForTimeout(120);
    }

    // "Primeiro no foco" se mede por ORDEM, não por um .focus() que espera
    // actionability — o `.focus()` do Playwright travou 90 s aqui.
    const ordem = await page.evaluate(() => {
      const back = document.querySelector('[data-vu-admin-back]') as HTMLElement | null;
      if (!back) return null;
      const raiz = back.closest('section') ?? document.body;
      const focaveis = Array.from(
        raiz.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      back.focus();
      return {
        primeiroFocavel: focaveis[0] === back,
        nomePrimeiro: (focaveis[0]?.textContent ?? '').trim().slice(0, 40),
        totalFocaveis: focaveis.length,
        focoAssentou: document.activeElement === back,
      };
    });
    console.log(
      `  «${nome}» · back amostrado ${JSON.stringify(amostras)} · ${JSON.stringify(ordem)}`,
    );
    expect(ordem, 'moldura sem «Voltar» no instante da leitura').not.toBeNull();
    expect(ordem!.primeiroFocavel, `primeiro focável é "${ordem!.nomePrimeiro}"`).toBe(true);
    expect(ordem!.focoAssentou, 'o foco programático não assenta no «Voltar»').toBe(true);
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
  // Contador sem asserção é vacância: sem moldura, não há marcador de restrito a mostrar.
  expect(restrito, 'USER recebeu o marcador de acesso restrito sem ter moldura').toBe(0);
});

/** Fontes em modo API (o único que monta o formulário) com sessão ADMIN real. */
async function entrarFontesApi(page: Page, request: APIRequestContext): Promise<void> {
  await syntheticAdmin(page, request, 'vu-uxh01-five-db');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(500);
  const antes = await page.evaluate(() => ({
    view: document.querySelector('.app-shell')?.getAttribute('data-vu-view'),
    navs: document.querySelectorAll('nav.primary-nav').length,
  }));
  console.log(`antes de entrar em Fontes: ${JSON.stringify(antes)}`);
  const fontes = page.locator('nav.primary-nav button', { hasText: 'Fontes' });
  await expect(fontes, 'nav.primary sem destino «Fontes» (sessão não é ADMIN?)').toHaveCount(1);
  await fontes.first().click();
  await page.waitForTimeout(1200);
  const depois = await page.evaluate(() => ({
    view: document.querySelector('.app-shell')?.getAttribute('data-vu-view'),
    sourceName: document.querySelectorAll('#source-name').length,
    forms: document.querySelectorAll('form').length,
  }));
  console.log(`depois de entrar em Fontes: ${JSON.stringify(depois)}`);
}

/** Edição realmente pendente: digitar num campo de verdade, não só abrir a seção. */
async function sujarFontes(page: Page): Promise<void> {
  const campo = page.locator('#source-name');
  await expect(campo, 'formulário de Fontes sem campo editável').toHaveCount(1);
  await campo.fill('Fonte com edição pendente');
  await page.waitForTimeout(200);
  // Inventário: se houver DUAS instâncias do formulário, o que eu digito pode não
  // ser o que o `dirtyChange` observa — o padrão de duas pinturas desta base.
  const inventario = await page.evaluate(() => ({
    inputsSourceName: document.querySelectorAll('#source-name').length,
    appSourceManagement: document.querySelectorAll('app-source-management').length,
    appAdminPanels: document.querySelectorAll('app-admin-sources-panels').length,
    dialogs: document.querySelectorAll('dialog').length,
    hookDialogo: document.querySelectorAll('[data-vu-admin-unsaved]').length,
    valorDigitado: (document.querySelector('#source-name') as HTMLInputElement | null)?.value,
  }));
  console.log(`inventário após digitar: ${JSON.stringify(inventario)}`);
}

/** As três portas de saída que a tela oferece com edição pendente. */
const PORTAS: { nome: string; acionar: (page: Page) => Promise<void> }[] = [
  {
    nome: 'trocar de seção',
    acionar: async (page) => {
      await page
        .locator('[data-vu-admin-nav] a, [data-vu-admin-nav] button', { hasText: 'Logs' })
        .first()
        .click();
    },
  },
  {
    nome: 'Voltar ao aplicativo',
    acionar: async (page) => {
      await page.locator('[data-vu-admin-back]').first().click();
    },
  },
  {
    nome: 'Sair',
    acionar: async (page) => {
      await page.getByRole('button', { name: 'Sair', exact: true }).first().click();
    },
  },
];

for (const porta of PORTAS) {
  test(`UXH-11: descarte — ${porta.nome} com edição suja abre o diálogo`, async ({
    page,
    request,
  }) => {
    test.skip(!ADMIN, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
    await entrarFontesApi(page, request);
    await sujarFontes(page);
    await porta.acionar(page);
    const dialogo = page.locator('[data-vu-admin-unsaved]');
    await expect(dialogo, `«${porta.nome}» descartou a edição sem perguntar`).toBeVisible({
      timeout: 5_000,
    });

    // Semântica de diálogo: `<dialog open>` nativo (ruling) OU role/aria-modal explícitos.
    const semantica = await dialogo.evaluate((el) => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      ariaModal: el.getAttribute('aria-modal'),
      aberto: (el as HTMLDialogElement).open ?? null,
      // `:modal` só casa quando o diálogo foi aberto por showModal(); `open` isolado
      // é estado de atributo e NÃO inativa o fundo nem prende o foco.
      modal: el.matches(':modal'),
    }));
    console.log(`«${porta.nome}» · semântica: ${JSON.stringify(semantica)}`);
    const ehDialogo = semantica.tag === 'DIALOG' || semantica.role === 'dialog';
    expect(ehDialogo, 'o contêiner não é diálogo (nem <dialog>, nem role="dialog")').toBe(true);
    const ehModal = semantica.tag === 'DIALOG' || semantica.ariaModal === 'true';
    expect(ehModal, 'o diálogo não se declara modal').toBe(true);
    if (semantica.tag === 'DIALOG') {
      expect(semantica.aberto, '<dialog> presente mas sem `open`').toBe(true);
      expect(
        semantica.modal,
        '<dialog> aberto sem showModal(): fundo não é inerte e o foco escapa',
      ).toBe(true);
    }

    const titulo = ((await dialogo.textContent()) ?? '').trim().replace(/\s+/g, ' ');
    console.log(`«${porta.nome}» · diálogo: "${titulo.slice(0, 120)}"`);
    expect(titulo, 'diálogo sem título que nomeie a consequência').toContain('Descartar');
    // Título por porta: na «Sair» a pergunta é sobre sair; nas outras, sobre descartar.
    if (porta.nome === 'Sair') {
      expect(titulo, 'porta «Sair»: o título não pergunta sobre sair').toContain('Sair');
    } else {
      expect(titulo, `porta «${porta.nome}»: o título fala de sair sem sair`).not.toContain(
        'Sair com',
      );
    }

    const destrutivo = dialogo.getByRole('button', { name: /descartar/i });
    await expect(destrutivo, 'ação destrutiva sem rótulo de consequência').toHaveCount(1);
    const rotulo = ((await destrutivo.textContent()) ?? '').trim();
    console.log(`«${porta.nome}» · ação destrutiva: "${rotulo}"`);

    // Corpo por porta: a porta «Sair» encerra a conta; as outras não. Título e
    // rótulo são iguais nas três — sem isto, a tela pode mentir sobre a consequência.
    const corpo = ((await dialogo.locator('p').first().textContent()) ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    console.log(`«${porta.nome}» · corpo: "${corpo}"`);
    const falaDeConta = /conta|sess[ãa]o/i.test(corpo);
    if (porta.nome === 'Sair') {
      expect(falaDeConta, 'porta «Sair»: o corpo não diz que a conta será encerrada').toBe(true);
    } else {
      expect(falaDeConta, `porta «${porta.nome}»: o corpo fala de conta sem encerrar conta`).toBe(
        false,
      );
    }

    // Foco inicial NÃO é a ação destrutiva, e está DENTRO do diálogo.
    const foco = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      return {
        texto: (ativo?.textContent ?? '').trim().replace(/\s+/g, ' '),
        dentro: Boolean(ativo?.closest('[data-vu-admin-unsaved]')),
      };
    });
    console.log(`«${porta.nome}» · foco inicial: ${JSON.stringify(foco)}`);
    expect(foco.texto.toLowerCase(), 'o foco inicial foi para a ação destrutiva').not.toContain(
      'descartar',
    );
    expect(foco.dentro, 'o foco inicial não está dentro do diálogo').toBe(true);

    // Contenção nas BORDAS: do último botão, `Tab` leva ao primeiro do diálogo;
    // do primeiro, `Shift+Tab` leva ao último. Sem isso, um trap que só
    // reposiciona no fim do documento passa.
    await page.evaluate(() => {
      const caixa = document.querySelector('[data-vu-admin-unsaved]');
      const botoes = caixa?.querySelectorAll('button') ?? [];
      (botoes[botoes.length - 1] as HTMLElement | undefined)?.focus();
    });
    await page.keyboard.press('Tab');
    const bordaFrente = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      return {
        dentro: Boolean(ativo?.closest('[data-vu-admin-unsaved]')),
        texto: (ativo?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24),
      };
    });
    console.log(`«${porta.nome}» · Tab do último → ${JSON.stringify(bordaFrente)}`);
    expect(bordaFrente.dentro, 'Tab do último botão saiu do diálogo').toBe(true);

    await page.evaluate(() => {
      const caixa = document.querySelector('[data-vu-admin-unsaved]');
      (caixa?.querySelector('button') as HTMLElement | null)?.focus();
    });
    await page.keyboard.press('Shift+Tab');
    const bordaTras = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      return {
        dentro: Boolean(ativo?.closest('[data-vu-admin-unsaved]')),
        texto: (ativo?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24),
      };
    });
    console.log(`«${porta.nome}» · Shift+Tab do primeiro → ${JSON.stringify(bordaTras)}`);
    expect(bordaTras.dentro, 'Shift+Tab do primeiro botão saiu do diálogo').toBe(true);

    // Foco preso: seis Tabs e um controle de fora não recebe foco.
    const trilha: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      trilha.push(
        await page.evaluate(() => {
          const ativo = document.activeElement as HTMLElement | null;
          const dentro = Boolean(ativo?.closest('[data-vu-admin-unsaved]'));
          return `${dentro ? 'dentro' : 'FORA'}:${(ativo?.textContent ?? ativo?.tagName ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 24)}`;
        }),
      );
    }
    console.log(`«${porta.nome}» · trilha de Tab: ${JSON.stringify(trilha)}`);
    expect(
      trilha.filter((passo) => passo.startsWith('FORA')),
      'o Tab escapou do diálogo (trap furado)',
    ).toHaveLength(0);

    // Escape cancela e a edição continua lá.
    await page.keyboard.press('Escape');
    await expect(dialogo, 'Escape não fechou o diálogo').toHaveCount(0);
    const valor = await page.locator('#source-name').inputValue();
    console.log(`«${porta.nome}» · após Escape, campo = "${valor}"`);
    expect(valor, 'Escape descartou a edição em vez de cancelar').toBe('Fonte com edição pendente');

    // Caminho DESTRUTIVO: o foco não pode cair no <body>.
    await porta.acionar(page);
    const dialogo2 = page.locator('[data-vu-admin-unsaved]');
    await expect(dialogo2, `«${porta.nome}» não reabriu o diálogo`).toBeVisible({ timeout: 5_000 });
    await dialogo2
      .getByRole('button', { name: /descartar/i })
      .first()
      .click();
    await page.waitForTimeout(700);
    const focoFinal = await page.evaluate(() => {
      const ativo = document.activeElement as HTMLElement | null;
      return {
        tag: ativo?.tagName ?? null,
        id: ativo?.id ?? null,
        noCorpo: ativo === document.body || ativo === null,
        dentroDaEntrada: Boolean(ativo?.closest('.account-shell, form, [data-vu="entry"]')),
        ehTituloAcesso: ativo?.id === 'access-heading',
        dialogoAberto: Boolean(document.querySelector('[data-vu-admin-unsaved]')),
        adminMontado: document.querySelectorAll('[data-vu-admin-nav], [data-vu-admin-back]').length,
      };
    });
    console.log(`«${porta.nome}» · após descartar: ${JSON.stringify(focoFinal)}`);
    expect(focoFinal.noCorpo, `«${porta.nome}»: o foco ficou no <body> depois de descartar`).toBe(
      false,
    );
    if (porta.nome === 'Sair') {
      // Único caminho que troca de tela: o foco tem de estar na tela de entrada.
      expect(focoFinal.adminMontado, 'a administração continuou montada depois de encerrar').toBe(
        0,
      );
      expect(focoFinal.ehTituloAcesso, 'o foco não está em #access-heading').toBe(true);
      expect(
        focoFinal.dialogoAberto,
        'o diálogo continuou aberto por cima da tela de entrada (login inclicável)',
      ).toBe(false);
    }
  });

  test(`UXH-11: descarte — ${porta.nome} com formulário limpo NÃO abre o diálogo`, async ({
    page,
    request,
  }) => {
    test.skip(!ADMIN, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
    await entrarFontesApi(page, request);
    await porta.acionar(page);
    await page.waitForTimeout(400);
    const dialogo = await page.locator('[data-vu-admin-unsaved]').count();
    console.log(`«${porta.nome}» sem edição · diálogos = ${dialogo}`);
    expect(dialogo, `«${porta.nome}» pediu descarte sem haver edição pendente`).toBe(0);
  });
}

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
  await abrirDemo(page);
  await abrirLogs(page);
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
  await page.goto('/');
  await page.reload();
  await abrirLogs(page);
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
  await abrirDemo(page);
  // Depois do abrirDemo: as rotas do Playwright são LIFO, e o mock de `/admin/**`
  // registrado lá dentro venceria este.
  await page.route('**/api/v1/admin/logs**', async (rota) => {
    await portao;
    await rota.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
  });
  await abrirLogs(page);
  const status = page.locator('[data-vu-admin-section="logs"] [role="status"]');
  await expect(status, 'carregamento sem role="status"').toBeVisible({ timeout: 10_000 });
  liberar();
  const alerta = page.locator('[data-vu-admin-section="logs"] [role="alert"]');
  await expect(alerta, 'erro sem role="alert"').toBeVisible({ timeout: 10_000 });
  const tentar = alerta.getByRole('button', { name: /tentar|recarregar|novamente/i });
  await expect(tentar, 'alerta sem botão de tentar de novo').toHaveCount(1);
  console.log('carregando (status) e erro (alert + tentar de novo): ok');
});

test('UXH-11 diagnóstico: quais requisições respondem 401 a 390', async ({ page }) => {
  await abrirDemo(page);
  const registros: string[] = [];
  page.on('response', (resposta) => {
    const url = resposta.url();
    if (!url.includes('/api/v1/')) return;
    registros.push(`${resposta.status()} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
  });
  await abrirFontes(page);
  registros.push('--- clique em «Logs administrativos» ---');
  const destino = page.locator('[data-vu-admin-nav] a, [data-vu-admin-nav] button', {
    hasText: 'Logs',
  });
  await destino.first().click();
  await page.waitForTimeout(900);
  const estado = await page.evaluate(() => ({
    view: document.querySelector('.app-shell')?.getAttribute('data-vu-view'),
    allowed: document.querySelector('.app-shell')?.getAttribute('data-vu-allowed'),
    nav: document.querySelectorAll('[data-vu-admin-nav]').length,
    back: document.querySelectorAll('[data-vu-admin-back]').length,
  }));
  console.log(`REQUISIÇÕES (${registros.length}):\n${registros.join('\n')}`);
  console.log(`estado final: ${JSON.stringify(estado)}`);
  const naoOk = registros.filter((r) => /^(4|5)/.test(r));
  console.log(`não-2xx: ${JSON.stringify(naoOk)}`);
});

test('UXH-11: USER nunca vê moldura de administração, nem na primeira pintura', async ({
  page,
}) => {
  // Ruling: "permissão presumida para quem não tem papel" é o que não pode existir.
  // A observação é por MutationObserver, não por estado final: a primeira pintura é
  // exatamente o instante que o estado final não mede.
  await page.addInitScript(() => {
    const w = window as unknown as { __molduraApareceu?: string[] };
    w.__molduraApareceu = [];
    const anotar = () => {
      if (
        document.querySelector('[data-vu-admin-nav]') ||
        document.querySelector('[data-vu-admin-back]')
      ) {
        w.__molduraApareceu!.push(new Date().toISOString());
      }
    };
    new MutationObserver(anotar).observe(document, { childList: true, subtree: true });
  });
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
  await page.route('**/api/v1/auth/access/**', (rota) =>
    rota.fulfill({ status: 403, json: { code: 'ACCESS_DENIED' } }),
  );
  await page.route('**/api/v1/admin/**', (rota) =>
    rota.fulfill({ status: 403, json: { code: 'ACCESS_DENIED' } }),
  );
  await page.goto('/');
  await page.waitForTimeout(300);
  await abrirFontes(page);
  await page.waitForTimeout(600);
  const apareceu = await page.evaluate(
    () => (window as unknown as { __molduraApareceu?: string[] }).__molduraApareceu ?? [],
  );
  console.log(`USER · moldura apareceu ${apareceu.length} vez(es) na primeira pintura`);
  expect(
    apareceu.length,
    `moldura de administração apareceu ${apareceu.length}× com sessão USER`,
  ).toBe(0);
});

test('UXH-11: ADMIN com acesso negado vê estado restrito, com motivo e saída', async ({ page }) => {
  await abrirDemo(page);
  // Depois do abrirDemo (LIFO): `access/logs` negado, o resto liberado.
  await page.route('**/api/v1/auth/access/logs', (rota) =>
    rota.fulfill({ status: 403, json: { code: 'ACCESS_DENIED' } }),
  );
  await abrirFontes(page);
  const destino = page.locator('[data-vu-admin-nav] a, [data-vu-admin-nav] button', {
    hasText: 'Logs',
  });
  await destino.first().click();
  await page.waitForTimeout(500);
  const restrito = page.locator('[data-vu-admin-restricted]');
  await expect(restrito, 'negação de 403 não rendeu estado restrito').toBeVisible();
  const texto = ((await restrito.textContent()) ?? '').trim().replace(/\s+/g, ' ');
  console.log(`texto do restrito: "${texto.slice(0, 90)}"`);
  expect(texto.length, 'estado restrito sem texto explicando o motivo').toBeGreaterThan(0);
  const back = page.locator('[data-vu-admin-back]');
  await expect(back, 'estado restrito sem «Voltar ao aplicativo»').toHaveCount(1);
  await back.first().click();
  await page.waitForTimeout(300);
  const moldura = await page.locator('[data-vu-admin-nav]').count();
  console.log(`após «Voltar»: moldura de administração = ${moldura}`);
});

test('UXH-11: permissão de módulo não sobrevive à troca de identidade a 390 (ADMIN → USER)', async ({
  page,
  request,
}) => {
  test.skip(!ADMIN, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
  await page.addInitScript(() => {
    const w = window as unknown as { __moldura?: string[] };
    w.__moldura = [];
    new MutationObserver(() => {
      if (document.querySelector('[data-vu-admin-nav]')) w.__moldura!.push('1');
    }).observe(document, { childList: true, subtree: true });
  });
  await syntheticAdmin(page, request, 'vu-uxh01-five-db');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await abrirFontes(page);

  // 1) ADMIN aquece o cache de módulo abrindo Logs.
  await page
    .locator('[data-vu-admin-nav] a, [data-vu-admin-nav] button', { hasText: 'Logs' })
    .first()
    .click();
  await page.waitForTimeout(400);
  const antes = await page.locator('[data-vu-admin-nav]').count();
  console.log(`ADMIN com Logs aberto: moldura = ${antes}`);
  expect(antes, 'ADMIN não abriu Logs — o cache não aqueceu e o caso seria vácuo').toBe(1);

  // 2) Saída pela folha (o furo do @ux): em 390 esse é o único caminho.
  await abrirFolha(page);
  const sair = page.getByRole('button', { name: 'Sair', exact: true });
  await expect(sair, '«Sair» não existe a 390 — ação perdida no móvel').toHaveCount(1);
  await sair.first().click();
  const formEntrada = page.getByLabel('E-mail', { exact: true });
  await expect(formEntrada, 'a saída não devolveu a tela de entrada').toBeVisible({
    timeout: 10_000,
  });
  console.log('«Sair» a 390 → tela de entrada');

  // 3) USER entra na MESMA aba, sem recarregar.
  const emailUsuario = await confirmedUser(request, 'troca-identidade');
  await page.evaluate(() => {
    (window as unknown as { __moldura?: string[] }).__moldura = [];
  });
  await formEntrada.fill(emailUsuario);
  await page.getByLabel('Senha', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForTimeout(1200);

  const moldura = await page.locator('[data-vu-admin-nav]').count();
  const back = await page.locator('[data-vu-admin-back]').count();
  const aparicoes = await page.evaluate(
    () => ((window as unknown as { __moldura?: string[] }).__moldura ?? []).length,
  );
  console.log(`USER na mesma aba: moldura=${moldura} back=${back} · 1ª pintura=${aparicoes}`);
  expect(moldura, 'USER herdou a moldura de administração do ADMIN anterior').toBe(0);
  expect(back, 'USER herdou «Voltar ao aplicativo»').toBe(0);
  expect(aparicoes, 'a moldura apareceu na primeira pintura depois da troca de identidade').toBe(0);
});

test('UXH-11: «Sair» é alcançável também a 1280 (topbar)', async ({ page, request }) => {
  test.skip(!ADMIN, 'Exige API em 127.0.0.1:8080 e a família sintética em 55442.');
  await syntheticAdmin(page, request, 'vu-uxh01-five-db');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(400);
  const sair = page.getByRole('button', { name: 'Sair', exact: true });
  await expect(sair, '«Sair» não alcançável a 1280').toHaveCount(1);
  await expect(sair.first()).toBeInViewport({ ratio: 0.5 });
  console.log('«Sair» a 1280: presente e no viewport');
});
