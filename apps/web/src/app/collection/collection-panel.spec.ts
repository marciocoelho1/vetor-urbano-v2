import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../auth/session';
import { CollectionPanel } from './collection-panel';

const CSRF = 'csrf-secret-token-123';

const ficha = {
  sourceId: 'vu-demo-source-001',
  publicName: 'Fogo Cruzado (API v2)',
  credit: 'Instituto Fogo Cruzado',
  license: 'uso livre — Creative Commons / domínio público (instrumento exato pendente)',
  obtainedAt: '2026-10-19',
  documentationUrl: 'https://api.fogocruzado.org.br/docs',
  channel: 'API Fogo Cruzado v2 (conta autorizada do responsável)',
  limitations: 'base colaborativa de terceiros, sem SLA, cobertura por região metropolitana',
};

const source = {
  sourceId: 'vu-demo-source-001',
  publicName: 'Fogo Cruzado (API v2)',
  windowStart: '2026-06-01',
  windowEnd: null,
  pollSeconds: 60,
  pageSize: 100,
  maxPages: 20,
  paused: false,
  lastAttemptAt: '2026-10-19T12:00:00Z',
  lastSuccessAt: '2026-10-19T12:00:00Z',
  lastErrorClass: null,
  upstreamLastUpdate: '2026-10-19T11:30:00Z',
};

const run = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  sourceId: 'vu-demo-source-001',
  kind: 'RECENT',
  windowStart: '2026-06-01',
  windowEnd: '2026-10-19',
  pagesDone: 2,
  itemsSeen: 40,
  itemsCreated: 4,
  itemsDuplicated: 36,
  municipalitiesMissing: ['Petrópolis'],
  state: 'SUCCEEDED_NEW_ITEMS',
  errorClass: null,
  errorDetail: null,
  pauseRequested: false,
  startedAt: '2026-10-19T11:59:00Z',
  finishedAt: '2026-10-19T12:00:00Z',
  ...overrides,
});

const status = (overrides: Record<string, unknown> = {}) => ({
  sourceId: 'vu-demo-source-001',
  configured: true,
  ficha,
  reason: null,
  backfillLimits: { maxPagesPerWindow: 100, maxPagesPerAttempt: 20, minPageIntervalSeconds: 1 },
  state: 'SUCCEEDED_NEW_ITEMS',
  source,
  lastRun: run(),
  counters: { itemsSeen: 40, itemsCreated: 4, itemsDuplicated: 36, pagesDone: 2 },
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type PostHandler = (url: string, options?: RequestInit) => Response;
type Routes = {
  status?: () => Response | Promise<Response>;
  runs?: () => Response | Promise<Response>;
};

function fetcher(routes: Routes, posts: PostHandler[] = []) {
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      const handler = posts.shift();
      if (!handler) throw new Error(`POST inesperado: ${url}`);
      return handler(url, options);
    }
    if (url.endsWith('/admin/collections/runs'))
      return (routes.runs ?? (() => json({ items: [] })))();
    return (routes.status ?? (() => json(status())))();
  });
}

describe('painel administrativo da Coleta', () => {
  let fixture: ComponentFixture<CollectionPanel>;
  let session: Session;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionPanel],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    session = TestBed.inject(Session);
    session.state.set({
      code: 'AUTHENTICATED',
      message: 'Sessão sintética',
      role: 'ADMIN',
      authenticated: true,
      csrfToken: CSRF,
    });
    vi.spyOn(session, 'csrfToken').mockReturnValue(CSRF);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function create(routes: Routes, posts: PostHandler[] = []) {
    const fetchMock = fetcher(routes, posts);
    vi.stubGlobal('fetch', fetchMock);
    fixture = TestBed.createComponent(CollectionPanel);
    fixture.detectChanges();
    return fetchMock;
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const testid = (id: string) => root().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const button = (name: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((entry) =>
      entry.textContent?.includes(name),
    );
  const until = async (assertion: () => void): Promise<void> => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      assertion();
    });
  };

  it('mostra carregamento e depois estado, crédito da fonte, contadores, janela e ausência de municípios', async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((done) => (resolve = done));
    await create({ status: () => pending, runs: () => json({ items: [run()] }) });
    expect(testid('collection-loading')).not.toBeNull();
    expect(testid('collection-error')).toBeNull();
    resolve(json(status()));
    await until(() => expect(testid('collection-state')).not.toBeNull());
    const panel = testid('collection-state')!;
    expect(panel.textContent).toContain('Concluída com itens novos');
    expect(testid('collection-credit')!.textContent).toContain('Fonte: Instituto Fogo Cruzado');
    expect(panel.textContent).toContain('19/10/2026, 09:00');
    expect(panel.textContent).toContain('Itens vistos');
    expect(panel.textContent).toContain('40');
    expect(panel.textContent).toContain('36');
    expect(panel.textContent).toContain('2026-06-01');
    expect(panel.textContent).toContain('Petrópolis');
    expect(root().textContent).toContain('sem SLA');
    expect(testid('collection-loading')).toBeNull();
    expect(root().textContent).not.toContain(CSRF);
  });

  it('trata «não configurada» fora de erro e fora de zero, mantendo o crédito da fonte', async () => {
    await create({
      status: () =>
        json(
          status({
            configured: false,
            reason: 'CREDENTIALS_MISSING',
            state: 'NOT_CONFIGURED',
            source: null,
            lastRun: null,
            counters: { itemsSeen: 0, itemsCreated: 0, itemsDuplicated: 0, pagesDone: 0 },
          }),
        ),
      runs: () => json({ items: [] }),
    });
    await until(() => expect(testid('collection-not-configured')).not.toBeNull());
    expect(testid('collection-error')).toBeNull();
    expect(testid('collection-empty')).toBeNull();
    expect(testid('collection-not-configured')!.textContent).toMatch(/sem credencial privada/);
    expect(testid('collection-not-configured')!.textContent).toMatch(/não é falha/i);
    expect(testid('collection-credit')!.textContent).toContain('Instituto Fogo Cruzado');
    expect(root().textContent).not.toContain('Itens vistos');
    expect(button('Executar coleta recente agora')?.disabled).toBe(true);
    expect(root().textContent).toMatch(/Configure a credencial privada fora do repositório/);
    expect(root().textContent).not.toContain(CSRF);
  });

  it('distingue vazio de erro quando a coleta está configurada e ainda não executou', async () => {
    await create({
      status: () => json(status({ state: null, lastRun: null })),
      runs: () => json({ items: [] }),
    });
    await until(() => expect(testid('collection-empty')).not.toBeNull());
    expect(testid('collection-error')).toBeNull();
    expect(testid('collection-not-configured')).toBeNull();
    expect(testid('collection-empty')!.textContent).toMatch(/nenhuma execução registrada/i);
    expect(root().textContent).not.toContain('Itens vistos');
    expect(testid('collection-credit')!.textContent).toContain('Instituto Fogo Cruzado');
  });

  it('distingue erro com retry e preserva o estado anterior quando a leitura falha', async () => {
    let fail = false;
    await create({
      status: () => (fail ? json({}, 503) : json(status())),
      runs: () => (fail ? json({}, 503) : json({ items: [run()] })),
    });
    await until(() => expect(testid('collection-state')).not.toBeNull());
    fail = true;
    button('Atualizar estado da coleta')!.click();
    fixture.detectChanges();
    await until(() => expect(testid('collection-error')).not.toBeNull());
    expect(testid('collection-error')!.textContent).toMatch(/A coleta não respondeu/);
    expect(testid('collection-state')!.textContent).toContain('Itens vistos');
    expect(testid('collection-state')!.textContent).toContain('Instituto Fogo Cruzado');
    fail = false;
    button('Tentar novamente')!.click();
    fixture.detectChanges();
    await until(() => expect(testid('collection-error')).toBeNull());
    expect(testid('collection-state')).not.toBeNull();
  });

  it('dispara a coleta recente com CSRF e devolve o foco ao botão sem rolar', async () => {
    const fetchMock = await create(
      { status: () => json(status()), runs: () => json({ items: [run()] }) },
      [() => json(run({ state: 'RUNNING' }), 202)],
    );
    await until(() => expect(testid('collection-state')).not.toBeNull());
    const trigger = button('Executar coleta recente agora')!;
    const focus = vi.spyOn(trigger, 'focus');
    trigger.click();
    fixture.detectChanges();
    await until(() => expect(testid('collection-status')!.textContent).toContain('run-1'));
    const started = fetchMock.mock.calls.find(
      ([url, options]) => String(url).endsWith('/runs') && options?.method === 'POST',
    )!;
    expect(String(started[0])).toBe('http://127.0.0.1:8080/api/v1/admin/collections/runs');
    expect(started[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'X-CSRF-Token': CSRF }),
      body: JSON.stringify({ kind: 'RECENT' }),
    });
    await vi.waitFor(() => expect(focus).toHaveBeenCalledWith({ preventScroll: true }));
    expect(root().textContent).not.toContain(CSRF);
  });

  it('envia uma carga retroativa com período e território explícitos, distinta da coleta recente', async () => {
    const fetchMock = await create(
      {
        status: () => json(status({ state: null, lastRun: null })),
        runs: () => json({ items: [] }),
      },
      [(_url, options) => json(run({ kind: 'BACKFILL', state: 'RUNNING' }), 202)],
    );
    await until(() => expect(testid('collection-backfill-from')).not.toBeNull());
    expect(root().textContent).toContain('RM-RJ e cidade do Rio de Janeiro');
    expect(root().textContent).toContain('2026-06-01');

    const from = testid('collection-backfill-from') as HTMLInputElement;
    const to = testid('collection-backfill-to') as HTMLInputElement;
    from.value = '2026-06-04';
    from.dispatchEvent(new Event('input'));
    to.value = '2026-06-09';
    to.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Iniciar carga retroativa delimitada')!.click();
    await until(() => expect(testid('collection-status')!.textContent).toContain('2026-06-04'));

    const started = fetchMock.mock.calls.find(
      ([url, options]) => String(url).endsWith('/runs') && options?.method === 'POST',
    )!;
    expect(started[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'X-CSRF-Token': CSRF }),
      body: JSON.stringify({ kind: 'BACKFILL', from: '2026-06-04', to: '2026-06-09' }),
    });
    expect(testid('collection-status')!.textContent).toContain('Carga retroativa');
    expect(root().textContent).toContain('Executar coleta recente agora');
  });

  it('associa cada data inválida à mensagem correspondente para tecnologia assistiva', async () => {
    await create({
      status: () => json(status({ state: null, lastRun: null })),
      runs: () => json({ items: [] }),
    });
    await until(() => expect(testid('collection-backfill-from')).not.toBeNull());

    const from = testid('collection-backfill-from') as HTMLInputElement;
    const to = testid('collection-backfill-to') as HTMLInputElement;
    from.value = '2026-05-31';
    from.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(from.getAttribute('aria-invalid')).toBe('true');
    expect(from.getAttribute('aria-describedby')).toBe('collection-backfill-from-error');
    expect(root().querySelector('#collection-backfill-from-error')?.textContent).toContain(
      '2026-06-01',
    );

    from.value = '2026-06-03';
    from.dispatchEvent(new Event('input'));
    to.value = '2026-06-02';
    to.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(from.getAttribute('aria-invalid')).toBeNull();
    expect(to.getAttribute('aria-invalid')).toBe('true');
    expect(to.getAttribute('aria-describedby')).toBe('collection-backfill-to-error');
    expect(root().querySelector('#collection-backfill-to-error')?.textContent).toContain(
      'data inicial',
    );
  });

  it('mantém a validação acessível sem alertar durante a edição e foca o primeiro campo inválido ao enviar', async () => {
    const fetchMock = await create({
      status: () => json(status({ state: null, lastRun: null })),
      runs: () => json({ items: [] }),
    });
    await until(() => expect(testid('collection-backfill-from')).not.toBeNull());

    const from = testid('collection-backfill-from') as HTMLInputElement;
    from.value = '2026-05-31';
    from.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const trigger = button('Iniciar carga retroativa delimitada')!;
    expect(trigger.disabled).toBe(false);
    expect(testid('collection-backfill-validation')).toBeNull();

    trigger.click();
    await vi.waitFor(() => expect(document.activeElement).toBe(from));
    expect(testid('collection-action-error')?.textContent).toContain('período válido');
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('identifica progresso, limite por etapa e retomada sem confundir carga retroativa com recente', async () => {
    const backfill = run({
      id: 'backfill-1',
      kind: 'BACKFILL',
      state: 'PAUSED',
      windowStart: '2026-06-01',
      windowEnd: '2026-06-10',
      pagesDone: 20,
      nextPage: 21,
      maxPages: 20,
    });
    const recent = run({ id: 'recent-1', kind: 'RECENT', state: 'SUCCEEDED_NO_CHANGES' });
    await create({
      status: () => json(status({ state: 'PAUSED', lastRun: backfill })),
      runs: () => json({ items: [backfill, recent] }),
    });
    await until(() => expect(testid('collection-history')).not.toBeNull());
    expect(testid('collection-progress')?.textContent).toContain(
      '20 página(s) concluída(s); limite de 20 por etapa',
    );
    const history = testid('collection-history')!.textContent ?? '';
    expect(history).toContain('Carga retroativa');
    expect(history).toContain('2026-06-01');
    expect(history).toContain('2026-06-10');
    expect(history).toContain('Coleta recente');
    expect(button('Retomar coleta')).toBeTruthy();
    expect(root().textContent).toContain('Pausa');
  });

  it('explica limites acumulados de BACKFILL e permite janela nova sem oferecer retomada após o teto', async () => {
    const capped = run({
      id: 'backfill-capped',
      kind: 'BACKFILL',
      state: 'PARTIAL',
      errorClass: 'BACKFILL_LIMIT_REACHED',
      errorDetail: 'Limite acumulado atingido; cursor preservado.',
    });
    await create({
      status: () => json(status({ state: 'PARTIAL', lastRun: capped })),
      runs: () => json({ items: [capped] }),
    });
    await until(() => expect(testid('collection-backfill-limits')).not.toBeNull());

    expect(testid('collection-backfill-limits')?.textContent).toContain('100 páginas');
    expect(testid('collection-backfill-limits')?.textContent).toContain('1 s entre páginas');
    expect(testid('collection-pill')?.textContent).toContain('limite acumulado da janela atingido');
    expect(button('Retomar coleta')?.disabled).toBe(true);
    expect(button('Iniciar carga retroativa delimitada')?.disabled).toBe(false);
    expect(testid('collection-history')?.textContent).toContain('nova janela necessária');
  });

  it('exige confirmação explícita antes de pausar e preserva o estado quando o comando falha', async () => {
    const fetchMock = await create(
      {
        status: () => json(status({ state: 'RUNNING', lastRun: run({ state: 'RUNNING' }) })),
        runs: () => json({ items: [run({ state: 'RUNNING' })] }),
      },
      [
        () =>
          json(
            {
              code: 'COLLECTION_RUN_NOT_RUNNING',
              message: 'Só é possível pausar execução em andamento.',
            },
            409,
          ),
      ],
    );
    await until(() => expect(testid('collection-state')).not.toBeNull());
    button('Pausar coleta')!.click();
    fixture.detectChanges();
    expect(testid('collection-confirm-pause')).not.toBeNull();
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
    button('Confirmar pausa')!.click();
    fixture.detectChanges();
    await until(() =>
      expect(testid('collection-action-error')?.textContent).toMatch(
        /Só é possível pausar execução em andamento/,
      ),
    );
    expect(testid('collection-state')!.textContent).toContain('Itens vistos');
    expect(fetchMock.mock.calls.find(([url]) => String(url).endsWith('/run-1/pause'))?.[0]).toBe(
      'http://127.0.0.1:8080/api/v1/admin/collections/runs/run-1/pause',
    );
    await until(() => expect(testid('collection-confirm-pause')).toBeNull());
    expect(root().textContent).not.toContain(CSRF);
  });

  it('cancela a confirmação sem enviar comando e retoma a execução pausada após confirmar', async () => {
    const fetchMock = await create(
      {
        status: () => json(status({ state: 'PAUSED', lastRun: run({ state: 'PAUSED' }) })),
        runs: () => json({ items: [run({ state: 'PAUSED' })] }),
      },
      [() => json(run({ state: 'RUNNING' }))],
    );
    await until(() => expect(testid('collection-state')).not.toBeNull());
    button('Retomar coleta')!.click();
    fixture.detectChanges();
    expect(testid('collection-confirm-resume')).not.toBeNull();
    button('Cancelar')!.click();
    fixture.detectChanges();
    expect(testid('collection-confirm-resume')).toBeNull();
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
    button('Retomar coleta')!.click();
    fixture.detectChanges();
    button('Confirmar retomada')!.click();
    fixture.detectChanges();
    await until(() => expect(testid('collection-status')!.textContent).toContain('run-1'));
    expect(
      fetchMock.mock.calls.find(
        ([url, options]) => String(url).endsWith('/run-1/resume') && options?.method === 'POST',
      ),
    ).toBeTruthy();
  });

  it('devolve o foco ao título estável quando o comando concluído desabilita o próprio controle', async () => {
    // Pausa concluída: a execução sai de RUNNING e o botão «Pausar coleta» fica desabilitado. Focar
    // elemento desabilitado é ignorado pelo navegador e o foco cairia no corpo do documento — o
    // retorno precisa existir na mesma tela, e o título da seção é o alvo estável.
    let paused = false;
    await create(
      {
        status: () =>
          json(
            paused
              ? status({ state: 'PAUSED', lastRun: run({ state: 'PAUSED' }) })
              : status({ state: 'RUNNING', lastRun: run({ state: 'RUNNING' }) }),
          ),
        runs: () => json({ items: [run({ state: paused ? 'PAUSED' : 'RUNNING' })] }),
      },
      [
        () => {
          paused = true;
          return json(run({ state: 'PAUSED' }));
        },
      ],
    );
    await until(() => expect(testid('collection-state')).not.toBeNull());
    button('Pausar coleta')!.click();
    fixture.detectChanges();
    button('Confirmar pausa')!.click();
    fixture.detectChanges();
    await until(() => expect(button('Pausar coleta')!.disabled).toBe(true));
    await vi.waitFor(() => expect(document.activeElement).toBe(testid('collection-heading')));
  });

  it('não oferece pausa sem execução em andamento e trata 401 como sessão inválida', async () => {
    const sessionInvalid = vi.fn();
    window.addEventListener('vu-session-invalid', sessionInvalid);
    await create({
      status: () =>
        json(
          status({ state: 'SUCCEEDED_NO_CHANGES', lastRun: run({ municipalitiesMissing: [] }) }),
        ),
      runs: () => json({ items: [run({ state: 'SUCCEEDED_NO_CHANGES' })] }),
    });
    await until(() => expect(testid('collection-state')).not.toBeNull());
    expect(button('Pausar coleta')!.disabled).toBe(true);
    expect(button('Retomar coleta')!.disabled).toBe(true);
    expect(root().textContent).toMatch(/Nenhuma execução em andamento para pausar ou retomar/);
    expect(root().textContent).toMatch(/todos os municípios da lista aprovada/);
    sessionInvalid.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    button('Atualizar estado da coleta')!.click();
    fixture.detectChanges();
    await until(() => expect(testid('collection-error')).not.toBeNull());
    expect(sessionInvalid).toHaveBeenCalled();
    expect(testid('collection-error')!.textContent).toMatch(/Sessão ausente ou expirada/);
    expect(root().textContent).not.toContain(CSRF);
    window.removeEventListener('vu-session-invalid', sessionInvalid);
  });

  it('lista o histórico com contadores, classe de erro e detalhe relatado', async () => {
    await create({
      status: () => json(status()),
      runs: () =>
        json({
          items: [
            run(),
            run({
              id: 'run-0',
              state: 'FAILED',
              errorClass: 'AUTH_FAILED',
              errorDetail: 'credencial da fonte recusada',
            }),
          ],
        }),
    });
    await until(() => expect(testid('collection-history')).not.toBeNull());
    const history = testid('collection-history')!.textContent ?? '';
    expect(history).toContain('run-0');
    expect(history).toContain('Falha de autenticação na fonte');
    expect(history).toContain('Falhou sem página concluída');
    expect(history).toContain('credencial da fonte recusada');
    expect(root().textContent).not.toContain(CSRF);
  });
});
