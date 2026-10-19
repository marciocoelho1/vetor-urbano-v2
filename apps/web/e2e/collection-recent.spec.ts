import { expect, test, type Page } from '@playwright/test';
import { fixtureSql, syntheticAdmin } from './helpers/synthetic-admin';
import {
  NOT_PROJECTED_MARKER,
  STUB_ACCESS_TOKEN,
  type FogoCruzadoStub,
  startFogoCruzadoStub,
} from './helpers/fogo-cruzado-stub';

test.skip(
  process.env['VETOR_ACCOUNTS_E2E'] !== '1',
  'Exige API em 127.0.0.1:8080, caixa em 8025 e PostGIS sintético isolado.',
);
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 20_000 });

/**
 * Jornadas do ticket 20 (coleta autorizada Fogo Cruzado v2) na seção administrativa «Coleta» e no
 * item coletado dentro da fila de revisão.
 *
 * UM SPEC, DOIS ARRANQUES DA API — «não configurada» e «configurada» são estados de servidor
 * diferentes e o frontend fala sempre com `127.0.0.1:8080`, então não cabem no mesmo processo:
 *
 *  1. ARRANQUE CONFIGURADO (padrão): a API sobe com
 *       --vetor.collection.enabled=true
 *       --vetor.collection.source-base-url=http://127.0.0.1:8788/api/v2   (stub local)
 *       --vetor.collection.credentials-file=<arquivo 0600 fora do repositório>
 *     Todo o stub de fonte vive em `helpers/fogo-cruzado-stub.ts` (porta fixa 8788).
 *  2. ARRANQUE DESLIGADO: `VETOR_COLLECTION_E2E=unconfigured` e a mesma API sem
 *     `vetor.collection.enabled` (estado natural do repositório). Só o bloco «não configurada» roda.
 *
 * A credencial privada é sintética e informada ao teste por `VETOR_COLLECTION_E2E_SECRETS`
 * (valores separados por vírgula) apenas para provar que NÃO aparece em DOM nem em resposta HTTP.
 */
const UNCONFIGURED = process.env['VETOR_COLLECTION_E2E'] === 'unconfigured';
const CONFIGURED = !UNCONFIGURED;
const PRIVATE_VALUES = (process.env['VETOR_COLLECTION_E2E_SECRETS'] ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const SOURCE_ID = 'fogo-cruzado';

interface FocusCall {
  testid: string;
  preventScroll: boolean;
}

/** Registra cada `HTMLElement.focus` com as opções: prova observável do `preventScroll`. */
function recordFocusCalls(): void {
  const calls: FocusCall[] = [];
  const original = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions): void {
    calls.push({
      testid: this.getAttribute('data-testid') ?? this.id ?? this.tagName.toLowerCase(),
      preventScroll: options?.preventScroll === true,
    });
    original.call(this, options);
  };
  (window as unknown as { __vuFocusCalls: FocusCall[] }).__vuFocusCalls = calls;
}

async function focusCalls(page: Page): Promise<FocusCall[]> {
  return page.evaluate(
    () => (window as unknown as { __vuFocusCalls?: FocusCall[] }).__vuFocusCalls ?? [],
  );
}

/** Limpa só as linhas da fonte autorizada: nenhuma outra fixture desta árvore é tocada. */
function resetCollectionFixture(): void {
  fixtureSql(`
    DELETE FROM collection_items WHERE source_id='${SOURCE_ID}';
    DELETE FROM collection_run_events WHERE source_id='${SOURCE_ID}';
    DELETE FROM collection_runs WHERE source_id='${SOURCE_ID}';
    DELETE FROM collection_sources WHERE source_id='${SOURCE_ID}';
    DELETE FROM clipping_review_decisions WHERE clipping_id IN (SELECT id FROM clippings WHERE source_id='${SOURCE_ID}');
    DELETE FROM clipping_reviews WHERE clipping_id IN (SELECT id FROM clippings WHERE source_id='${SOURCE_ID}');
    DELETE FROM clippings WHERE source_id='${SOURCE_ID}';
    DELETE FROM sources WHERE id='${SOURCE_ID}';
  `);
}

const collectionSection = (page: Page) =>
  page.locator('section[aria-labelledby="collection-heading"]');
const collectionPill = (page: Page) => page.getByTestId('collection-pill');
const counters = (page: Page) => page.locator('dl[aria-label="Contadores da última execução"]');

async function openSourcesView(page: Page): Promise<void> {
  const sources = page.getByRole('button', { name: 'Fontes', exact: true });
  await sources.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Coleta', exact: true })).toBeVisible();
}

async function refreshCollection(page: Page): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'GET' &&
        candidate.url().endsWith('/api/v1/admin/collections'),
    ),
    page.getByRole('button', { name: 'Atualizar estado da coleta' }).click(),
  ]);
  expect(response.status()).toBe(200);
}

/** A seção não faz polling: o operador atualiza e o teste reafirma o estado lido. */
async function refreshUntilPill(page: Page, label: string, attempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await refreshCollection(page);
    if ((await collectionPill(page).innerText()).trim() === label) return;
  }
  await expect(collectionPill(page)).toHaveText(label);
}

async function counterValue(page: Page, label: string): Promise<string> {
  return counters(page).locator('div').filter({ hasText: label }).locator('dd').innerText();
}

function scalar(sql: string): string {
  return fixtureSql(sql);
}

function latestRunState(): string {
  return scalar(
    `SELECT state FROM collection_runs WHERE source_id='${SOURCE_ID}' ORDER BY started_at DESC, id DESC LIMIT 1`,
  );
}

async function waitForTerminalRun(timeoutMs = 40_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let state = '';
  while (Date.now() < deadline) {
    state = latestRunState();
    if (state && state !== 'RUNNING') return state;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Execução da coleta não terminou (último estado: ${state || 'ausente'}).`);
}

async function waitForDatabaseValue(
  sql: string,
  expected: string,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (scalar(sql) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`O banco não chegou a «${expected}».`);
}

/**
 * Disparo manual por teclado (foco + Enter) e espera da resposta 202: sem a resposta, o aviso
 * anterior tornaria o teste cego ao segundo disparo.
 *
 * NOTA DE CONTRATO: a interface implementada NÃO tem diálogo de confirmação para o disparo manual —
 * o comando sai no acionamento explícito do controle e em nenhum outro momento (nada dispara em
 * carga, navegação ou leitura). Pausa e retomada, essas sim, exigem confirmação em dois passos.
 */
async function triggerRecent(page: Page): Promise<void> {
  const trigger = page.getByTestId('collection-trigger');
  await trigger.focus();
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'POST' &&
        candidate.url().endsWith('/api/v1/admin/collections/runs'),
    ),
    page.keyboard.press('Enter'),
  ]);
  expect(response.status()).toBe(202);
  await expect(page.getByTestId('collection-status')).toContainText('Coleta recente disparada');
}

async function activeTestId(page: Page): Promise<string> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? '',
  );
}

async function activeIsFocusVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => document.activeElement?.matches(':focus-visible') ?? false);
}

/** Caminhada real de teclado: nenhum `focus()` programático, só Tab até o controle desejado. */
async function tabTo(page: Page, testid: string, maxSteps = 900): Promise<number> {
  // Controle já focado conta como alcançado: Tab apenas avança a partir dele.
  if ((await activeTestId(page)) === testid) return 0;
  for (let step = 1; step <= maxSteps; step += 1) {
    await page.keyboard.press('Tab');
    if ((await activeTestId(page)) === testid) return step;
  }
  throw new Error(`«${testid}» não foi alcançado com Tab em ${maxSteps} passos.`);
}

async function expectNoSecretsInDom(page: Page): Promise<void> {
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  for (const value of [STUB_ACCESS_TOKEN, ...PRIVATE_VALUES]) expect(html).not.toContain(value);
  expect(html).not.toContain('accessToken');
  expect(html).not.toContain('Bearer ');
}

let stub: FogoCruzadoStub;

test.beforeAll(async () => {
  stub = await startFogoCruzadoStub();
});

test.afterAll(async () => {
  await stub?.close();
});

test.beforeEach(async () => {
  await stub.reset();
  resetCollectionFixture();
});

(CONFIGURED ? test.describe : test.describe.skip)(
  'Coleta configurada — estados distintos e jornadas',
  () => {
    test('Administrador com MFA vê a seção «Coleta», o crédito «Fonte: Instituto Fogo Cruzado» e o carregamento antes do estado', async ({
      page,
      request,
    }) => {
      await page.addInitScript(recordFocusCalls);
      await syntheticAdmin(page, request);

      // A leitura real é suspensa para que o estado de carregamento seja observável por inteiro.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/v1/admin/collections**', async (route) => {
        if (route.request().method() === 'GET') await gate;
        await route.continue();
      });

      const sources = page.getByRole('button', { name: 'Fontes', exact: true });
      await sources.focus();
      await page.keyboard.press('Enter');

      await expect(page.getByTestId('collection-loading')).toBeVisible();
      await expect(page.getByTestId('collection-state')).toHaveCount(0);
      release();

      await expect(page.getByRole('heading', { name: 'Coleta', exact: true })).toBeVisible();
      await expect(page.getByTestId('collection-credit')).toHaveText(
        'Fonte: Instituto Fogo Cruzado',
      );
      await expect(page.getByTestId('collection-loading')).toHaveCount(0);
      // Sem execução registrada: vazio próprio, nunca falha nem «não configurada».
      await expect(page.getByTestId('collection-empty')).toContainText(
        'Nenhuma execução registrada',
      );
      await expect(page.getByTestId('collection-not-configured')).toHaveCount(0);
      await expect(page.getByTestId('collection-error')).toHaveCount(0);
      await expect(collectionSection(page)).toContainText('Licença:');
      await expect(collectionSection(page)).toContainText('Limites declarados:');
      await expectNoSecretsInDom(page);
    });

    test('coleta configurada e ainda sem execução é vazio próprio, nunca falha nem «não configurada»', async ({
      page,
      request,
    }) => {
      await syntheticAdmin(page, request);
      await openSourcesView(page);

      await expect(collectionPill(page)).toHaveText('Configurada, sem execução registrada');
      await expect(page.getByTestId('collection-empty')).toContainText(
        'Nenhuma execução registrada',
      );
      await expect(page.getByTestId('collection-not-configured')).toHaveCount(0);
      await expect(page.getByTestId('collection-error')).toHaveCount(0);
      await expect(collectionSection(page)).not.toContainText('Itens vistos');
      await expect(page.getByTestId('collection-credit')).toHaveText(
        'Fonte: Instituto Fogo Cruzado',
      );
      await expect(page.getByTestId('collection-trigger')).toBeEnabled();
      await expect(page.getByTestId('collection-pause')).toBeDisabled();
      await expect(page.getByTestId('collection-resume')).toBeDisabled();
      await expect(page.getByTestId('collection-history')).toHaveCount(0);
    });

    test('concluída sem novidades é distinta de falha, e reprocessar a mesma publicação não duplica', async ({
      page,
      request,
    }) => {
      await syntheticAdmin(page, request);
      await openSourcesView(page);

      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('SUCCEEDED_NEW_ITEMS');
      await refreshUntilPill(page, 'Concluída com itens novos');
      expect(await counterValue(page, 'Itens vistos')).toBe('3');
      expect(await counterValue(page, 'Itens novos na revisão')).toBe('3');
      expect(await counterValue(page, 'Duplicados ignorados')).toBe('0');
      expect(scalar(`SELECT count(*) FROM clippings WHERE source_id='${SOURCE_ID}'`)).toBe('3');
      // Município ausente na fonte é relatado, nunca silenciado nem substituído.
      await expect(page.getByTestId('collection-missing')).toContainText('Petrópolis');
      // O recorte aprovado não filtra por presença de vítima: nenhuma chamada pede `typeOccurrence`.
      expect(
        (await stub.state()).occurrenceQueries.every((query) => !query.includes('typeOccurrence')),
      ).toBe(true);

      // Mesma fonte, mesmas referências: nada novo, nada duplicado, e isso nunca vira falha.
      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('SUCCEEDED_NO_CHANGES');
      await refreshUntilPill(page, 'Concluída sem novidades');
      await expect(collectionPill(page)).not.toHaveText('Falhou sem página concluída');
      await expect(page.getByTestId('collection-error')).toHaveCount(0);
      await expect(page.getByTestId('collection-action-error')).toHaveCount(0);
      expect(await counterValue(page, 'Itens novos na revisão')).toBe('0');
      expect(await counterValue(page, 'Duplicados ignorados')).toBe('3');
      expect(scalar(`SELECT count(*) FROM clippings WHERE source_id='${SOURCE_ID}'`)).toBe('3');
      expect(
        scalar(
          `SELECT count(*) FROM clipping_reviews r JOIN clippings c ON c.id=r.clipping_id WHERE c.source_id='${SOURCE_ID}'`,
        ),
      ).toBe('3');
      await expectNoSecretsInDom(page);
    });

    test('falha de autenticação na fonte é falha relatada, nunca «concluída sem novidades» nem zero ocorrências', async ({
      page,
      request,
    }) => {
      await stub.setMode('auth401');
      await syntheticAdmin(page, request);
      await openSourcesView(page);

      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('FAILED');
      await refreshUntilPill(page, 'Falhou sem página concluída');

      await expect(collectionPill(page)).not.toHaveText('Concluída sem novidades');
      await expect(page.getByTestId('collection-error')).toHaveCount(0);
      await expect(collectionSection(page)).toContainText('Última classe de erro');
      await expect(collectionSection(page)).toContainText('Falha de autenticação na fonte');
      await expect(page.getByTestId('collection-history')).toContainText(
        'Classe de erro: Falha de autenticação na fonte',
      );
      expect(
        scalar(
          `SELECT error_class FROM collection_runs WHERE source_id='${SOURCE_ID}' ORDER BY started_at DESC, id DESC LIMIT 1`,
        ),
      ).toBe('AUTH_FAILED');
      expect(scalar(`SELECT count(*) FROM clippings WHERE source_id='${SOURCE_ID}'`)).toBe('0');
      await expectNoSecretsInDom(page);
    });

    test('bloqueio por assinatura da fonte («error code: 1010») é classe própria, distinta de credencial inválida', async ({
      page,
      request,
    }) => {
      await stub.setMode('blocked');
      await syntheticAdmin(page, request);
      await openSourcesView(page);

      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('FAILED');
      await refreshUntilPill(page, 'Falhou sem página concluída');

      expect(latestRunState()).toBe('FAILED');
      expect(
        scalar(
          `SELECT error_class FROM collection_runs WHERE source_id='${SOURCE_ID}' ORDER BY started_at DESC, id DESC LIMIT 1`,
        ),
      ).toBe('UPSTREAM_BLOCKED');
      // O banco guarda a classe; a interface mostra o rótulo humano, nunca o token cru.
      await expect(page.getByTestId('collection-history')).toContainText(
        'Assinatura do cliente bloqueada pela fonte',
      );
      await expect(page.getByTestId('collection-history')).not.toContainText('UPSTREAM_BLOCKED');
      await expect(collectionPill(page)).not.toHaveText('Concluída sem novidades');
      await expect(page.getByTestId('collection-error')).toHaveCount(0);
      await expectNoSecretsInDom(page);
    });

    test('disparo, pausa e retomada: comando só por ativação explícita, confirmação na pausa/retomada e foco de volta sem rolagem', async ({
      page,
      request,
    }) => {
      await stub.setMode('ok', true);
      await page.addInitScript(recordFocusCalls);
      await syntheticAdmin(page, request);

      const writes: string[] = [];
      page.on('request', (candidate) => {
        if (
          candidate.method() === 'POST' &&
          candidate.url().includes('/api/v1/admin/collections')
        ) {
          writes.push(candidate.url());
        }
      });

      await openSourcesView(page);
      // Antes de qualquer ativação explícita, nenhum comando é enviado.
      expect(writes).toEqual([]);

      await triggerRecent(page);
      expect(writes).toHaveLength(1);
      // Execução real em andamento (resposta da fonte suspensa pelo stub).
      await expect(collectionPill(page)).toHaveText('Em andamento');
      await expect(page.getByTestId('collection-trigger')).toBeFocused();
      expect(
        (await focusCalls(page)).some(
          (call) => call.testid === 'collection-trigger' && call.preventScroll,
        ),
      ).toBe(true);

      // Pausa em dois passos: pedir não envia comando; só a confirmação envia.
      await page.getByTestId('collection-pause').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('collection-confirm-pause')).toBeVisible();
      expect(writes).toHaveLength(1);
      await page.getByTestId('collection-confirm-pause-button').focus();
      await page.keyboard.press('Enter');
      // O pedido de pausa precisa estar registrado antes de liberar a página suspensa.
      await waitForDatabaseValue(
        `SELECT pause_requested FROM collection_runs WHERE source_id='${SOURCE_ID}' ORDER BY started_at DESC, id DESC LIMIT 1`,
        't',
      );
      await stub.release();
      await expect(page.getByTestId('collection-status')).toContainText('Coleta pausada');
      expect(writes).toHaveLength(2);
      await expect(collectionPill(page)).toHaveText('Pausada pelo administrador');
      // Concluir a pausa troca o estado e desabilita «Pausar coleta». Focar elemento desabilitado é
      // ignorado pelo navegador e o foco cairia no `<body>`; a seção devolve o foco ao título estável
      // (`tabindex="-1"`), que continua sendo retorno visível dentro da mesma tela e sem rolagem.
      await expect(page.getByTestId('collection-heading')).toBeFocused();
      expect(
        (await focusCalls(page)).some(
          (call) => call.testid === 'collection-heading' && call.preventScroll,
        ),
      ).toBe(true);

      // Retomada idem: confirmação explícita e foco de volta ao controle que iniciou.
      await page.getByTestId('collection-resume').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('collection-confirm-resume')).toBeVisible();
      expect(writes).toHaveLength(2);
      await page.getByTestId('collection-confirm-resume-button').focus();
      // Rolagem de referência medida DEPOIS do último foco acionado pelo teste: o `locator.focus()`
      // do Playwright rola até o elemento por conta própria, o que não é o comportamento do produto
      // sob verificação. O que se mede aqui é o `focus({ preventScroll: true })` da própria seção.
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('collection-status')).toContainText('Coleta retomada');
      expect(writes).toHaveLength(3);
      // Mesma regra na retomada: o controle iniciador volta a ficar indisponível e o foco vai para o
      // título estável da seção, sempre dentro da mesma tela.
      await expect(page.getByTestId('collection-heading')).toBeFocused();
      expect(
        (await focusCalls(page)).some(
          (call) => call.testid === 'collection-heading' && call.preventScroll,
        ),
      ).toBe(true);
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

      // A retomada continua do cursor: a segunda página é pedida de novo e o recorte segue sem
      // `typeOccurrence` — disparo sem vítima é ocorrência do produto. A resposta da página retomada
      // está suspensa pelo stub igual à primeira, então é liberada aqui antes de esperar o desfecho.
      await expect(collectionPill(page)).toHaveText('Em andamento');
      await stub.release();
      expect(await waitForTerminalRun()).toBe('SUCCEEDED_NEW_ITEMS');
      await refreshUntilPill(page, 'Concluída com itens novos');
      const stubState = await stub.state();
      expect(stubState.occurrenceCalls.length).toBeGreaterThanOrEqual(2);
      expect(stubState.occurrenceQueries.every((query) => !query.includes('typeOccurrence'))).toBe(
        true,
      );
      await expectNoSecretsInDom(page);
    });

    test('teclado: alcança a seção «Coleta» e aciona disparo e pausa com Tab/Enter, com foco visível', async ({
      page,
      request,
    }) => {
      await stub.setMode('ok', true);
      await syntheticAdmin(page, request);

      const sources = page.getByRole('button', { name: 'Fontes', exact: true });
      await sources.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Coleta', exact: true })).toBeVisible();

      const steps = await tabTo(page, 'collection-trigger');
      await expect(page.getByTestId('collection-trigger')).toBeFocused();
      expect(await activeIsFocusVisible(page)).toBe(true);

      await page.keyboard.press('Enter');
      await expect(page.getByTestId('collection-status')).toContainText('Coleta recente disparada');
      await expect(page.getByTestId('collection-trigger')).toBeFocused();
      await expect(collectionPill(page)).toHaveText('Em andamento');

      await tabTo(page, 'collection-pause', 20);
      await expect(page.getByTestId('collection-pause')).toBeFocused();
      expect(await activeIsFocusVisible(page)).toBe(true);
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('collection-confirm-pause')).toBeVisible();
      // A própria seção conduz o foco do teclado para dentro da confirmação embutida.
      await expect(page.getByTestId('collection-confirm-pause-button')).toBeFocused();
      expect(await activeIsFocusVisible(page)).toBe(true);
      await page.keyboard.press('Enter');
      await waitForDatabaseValue(
        `SELECT pause_requested FROM collection_runs WHERE source_id='${SOURCE_ID}' ORDER BY started_at DESC, id DESC LIMIT 1`,
        't',
      );
      await stub.release();
      await expect(collectionPill(page)).toHaveText('Pausada pelo administrador');
      // O comando desabilita o próprio controle iniciador; o foco retorna ao título estável da seção
      // (nunca ao corpo do documento) e o teclado continua dentro de «Coleta».
      await expect(page.getByTestId('collection-heading')).toBeFocused();
      console.log(`Tab a partir de «Fontes» até «collection-trigger»: ${steps} passos.`);
      await expectNoSecretsInDom(page);
    });

    test('390 px: seção «Coleta» sem rolagem horizontal e controles alcançáveis e acionáveis', async ({
      page,
      request,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await syntheticAdmin(page, request);
      await openSourcesView(page);

      const panel = collectionSection(page);
      await expect(panel).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect(
        await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);

      for (const testid of ['collection-trigger', 'collection-pause', 'collection-resume']) {
        const control = page.getByTestId(testid);
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(391);
      }

      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('SUCCEEDED_NEW_ITEMS');
      await refreshUntilPill(page, 'Concluída com itens novos');
      await expect(counters(page)).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect(
        await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      await expectNoSecretsInDom(page);
    });

    test('item coletado nasce pendente na fila de revisão, com crédito e referência da fonte, e o revisor abre o editor', async ({
      page,
      request,
    }) => {
      await syntheticAdmin(page, request);
      await openSourcesView(page);

      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('SUCCEEDED_NEW_ITEMS');
      await refreshUntilPill(page, 'Concluída com itens novos');

      // Nada é publicado automaticamente: itens PENDING, referência da fonte presente, zero ocorrência.
      expect(
        scalar(
          `SELECT count(*) FROM clipping_reviews r JOIN clippings c ON c.id=r.clipping_id WHERE c.source_id='${SOURCE_ID}' AND r.state='PENDING'`,
        ),
      ).toBe('3');
      expect(
        scalar(
          `SELECT count(*) FROM clippings WHERE source_id='${SOURCE_ID}' AND reference IS NOT NULL`,
        ),
      ).toBe('3');
      expect(
        scalar(
          `SELECT count(*) FROM occurrence_clippings oc JOIN clippings c ON c.id=oc.clipping_id WHERE c.source_id='${SOURCE_ID}'`,
        ),
      ).toBe('0');

      const queue = page.locator('app-review-queue');
      await queue.getByRole('button', { name: 'Atualizar fila de revisão' }).click();
      const item = queue
        .locator('li[data-testid="review-item"]')
        .filter({ hasText: 'Ocorrência Fogo Cruzado 70001' });
      await expect(item).toBeVisible();
      await expect(item.getByTestId('review-origin')).toHaveText(
        'Fonte: Instituto Fogo Cruzado · referência da fonte: 70001',
      );
      await expect(item).toContainText('Referência: fogo-cruzado:70001');

      // Disparo sem vítima é ocorrência coletada, não item descartado.
      const victimless = queue
        .locator('li[data-testid="review-item"]')
        .filter({ hasText: 'Ocorrência Fogo Cruzado 70003' });
      await expect(victimless).toBeVisible();
      await expect(victimless.getByTestId('review-origin')).toHaveText(
        'Fonte: Instituto Fogo Cruzado · referência da fonte: 70003',
      );

      const editor = queue.locator('section[aria-label="Revisar clipping selecionado"]');
      await item.getByRole('button', { name: /^Revisar / }).focus();
      await page.keyboard.press('Enter');
      await expect(editor).toBeVisible();
      await expect(editor.getByTestId('review-origin-editor')).toHaveText(
        'Fonte: Instituto Fogo Cruzado · referência da fonte: 70001',
      );
      await expect(editor).toContainText('nada é publicado automaticamente');
      await expect(editor).toContainText('"type": "OPERACAO_POLICIAL"');

      await victimless.getByRole('button', { name: /^Revisar / }).focus();
      await page.keyboard.press('Enter');
      await expect(editor.getByTestId('review-origin-editor')).toHaveText(
        'Fonte: Instituto Fogo Cruzado · referência da fonte: 70003',
      );
      await expect(editor).toContainText('"type": "DISPAROS"');
      await expect(editor).toContainText('"total": 0');

      // Minimização: nenhum atributo por vítima da fonte chega à projeção nem ao DOM.
      expect(
        await page.evaluate(
          (marker) => document.documentElement.innerHTML.includes(marker),
          NOT_PROJECTED_MARKER,
        ),
      ).toBe(false);
      await expectNoSecretsInDom(page);
    });

    test('nenhuma credencial ou token da fonte aparece no DOM nem na resposta administrativa', async ({
      page,
      request,
    }) => {
      const bodies: string[] = [];
      page.on('response', (response) => {
        if (!response.url().includes('/api/v1/admin/collections')) return;
        void response
          .text()
          .then((body) => bodies.push(body))
          .catch(() => undefined);
      });

      await syntheticAdmin(page, request);
      await openSourcesView(page);

      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('SUCCEEDED_NEW_ITEMS');
      await refreshUntilPill(page, 'Concluída com itens novos');
      await expectNoSecretsInDom(page);

      await stub.setMode('auth401');
      await triggerRecent(page);
      expect(await waitForTerminalRun()).toBe('FAILED');
      await refreshUntilPill(page, 'Falhou sem página concluída');
      await expectNoSecretsInDom(page);

      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) {
        for (const value of [STUB_ACCESS_TOKEN, ...PRIVATE_VALUES])
          expect(body).not.toContain(value);
        expect(body).not.toContain('accessToken');
        expect(body).not.toContain('Bearer');
      }

      // O editor da fila mostra a extração persistida: também ali nenhum segredo.
      const queue = page.locator('app-review-queue');
      await queue.getByRole('button', { name: 'Atualizar fila de revisão' }).click();
      await expect(queue.getByTestId('review-item').first()).toBeVisible();
      await queue
        .getByTestId('review-item')
        .first()
        .getByRole('button', { name: /^Revisar / })
        .click();
      await expect(
        queue.locator('section[aria-label="Revisar clipping selecionado"]'),
      ).toBeVisible();
      await expectNoSecretsInDom(page);
    });
  },
);

(UNCONFIGURED ? test.describe : test.describe.skip)(
  'Coleta desligada — «não configurada» é estado próprio',
  () => {
    test('«não configurada» é textual e não se confunde com falha, vazio nem zero ocorrências', async ({
      page,
      request,
    }) => {
      await syntheticAdmin(page, request);
      await openSourcesView(page);

      await expect(collectionPill(page)).toHaveText('Não configurada');
      const hint = page.getByTestId('collection-not-configured');
      await expect(hint).toBeVisible();
      await expect(hint).toContainText('Não é falha nem ausência de ocorrências');
      await expect(collectionSection(page)).toContainText('Coleta desligada no servidor');
      await expect(collectionSection(page)).toContainText('Configure a credencial privada');
      await expect(page.getByTestId('collection-credit')).toHaveText(
        'Fonte: Instituto Fogo Cruzado',
      );
      await expect(page.getByTestId('collection-empty')).toHaveCount(0);
      await expect(page.getByTestId('collection-error')).toHaveCount(0);
      await expect(collectionSection(page)).not.toContainText('Itens vistos');
      await expect(page.getByTestId('collection-trigger')).toBeDisabled();
      await expectNoSecretsInDom(page);
    });
  },
);
