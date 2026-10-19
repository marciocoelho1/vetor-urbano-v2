import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CollectionApiError,
  collectionStateLabel,
  collectionStateTone,
  collectionStatusLabel,
  errorClassLabel,
  fetchCollectionRuns,
  fetchCollectionStatus,
  formatCollectionInstant,
  pauseCollectionRun,
  pauseTarget,
  resumeCollectionRun,
  resumeTarget,
  startCollectionRun,
  type CollectionRun,
  type CollectionStatus,
} from './collection-api';

const counters = { itemsSeen: 40, itemsCreated: 4, itemsDuplicated: 36, pagesDone: 2 };

const status = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sourceId: 'vu-demo-source-001',
  configured: true,
  ficha: {
    sourceId: 'vu-demo-source-001',
    publicName: 'Fogo Cruzado (API v2)',
    credit: 'Instituto Fogo Cruzado',
    license: 'uso livre — Creative Commons / domínio público (instrumento exato pendente)',
    obtainedAt: '2026-10-19',
    documentationUrl: 'https://api.fogocruzado.org.br/docs',
    channel: 'API Fogo Cruzado v2 (conta autorizada do responsável)',
    limitations: 'base colaborativa de terceiros, sem SLA, cobertura por região metropolitana',
  },
  reason: null,
  state: 'SUCCEEDED_NEW_ITEMS',
  source: {
    sourceId: 'vu-demo-source-001',
    publicName: 'Fogo Cruzado (API v2)',
    windowStart: '2026-06-01',
    windowEnd: null,
    pollSeconds: 900,
    pageSize: 100,
    maxPages: 200,
    paused: false,
    lastAttemptAt: '2026-10-19T12:00:00Z',
    lastSuccessAt: '2026-10-19T12:00:00Z',
    lastErrorClass: null,
    upstreamLastUpdate: '2026-10-19T11:30:00Z',
  },
  lastRun: {
    id: 'run-1',
    sourceId: 'vu-demo-source-001',
    kind: 'RECENT',
    windowStart: '2026-06-01',
    windowEnd: '2026-10-19',
    nextPage: null,
    take: 100,
    maxPages: 200,
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
    updatedAt: '2026-10-19T12:00:00Z',
  },
  counters,
  ...overrides,
});

const run = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'run-1',
  sourceId: 'vu-demo-source-001',
  kind: 'RECENT',
  windowStart: '2026-06-01',
  windowEnd: '2026-10-19',
  pagesDone: 2,
  itemsSeen: 40,
  itemsCreated: 4,
  itemsDuplicated: 36,
  municipalitiesMissing: [],
  state: 'SUCCEEDED_NEW_ITEMS',
  errorClass: null,
  errorDetail: null,
  pauseRequested: false,
  startedAt: '2026-10-19T11:59:00Z',
  finishedAt: '2026-10-19T12:00:00Z',
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('transporte da coleta autorizada', () => {
  it('lê o estado da fonte com a ficha de procedência, contadores e janela', async () => {
    const fetcher = vi.fn(async () => Response.json(status()));
    vi.stubGlobal('fetch', fetcher);
    const view = await fetchCollectionStatus();
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/api/v1/admin/collections',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(view).toMatchObject({
      sourceId: 'vu-demo-source-001',
      configured: true,
      reason: null,
      state: 'SUCCEEDED_NEW_ITEMS',
      ficha: { credit: 'Instituto Fogo Cruzado', publicName: 'Fogo Cruzado (API v2)' },
      counters: { itemsSeen: 40, itemsCreated: 4, itemsDuplicated: 36, pagesDone: 2 },
      source: { windowStart: '2026-06-01', lastAttemptAt: '2026-10-19T12:00:00Z', paused: false },
      lastRun: { id: 'run-1', municipalitiesMissing: ['Petrópolis'] },
    });
  });

  it('preserva o estado nulo de «sem execução registrada» e o motivo de não configurada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(status({ state: null, lastRun: null }))),
    );
    const empty = await fetchCollectionStatus();
    expect(empty.state).toBeNull();
    expect(empty.lastRun).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          status({
            configured: false,
            reason: 'CREDENTIALS_MISSING',
            state: 'NOT_CONFIGURED',
            source: null,
            lastRun: null,
          }),
        ),
      ),
    );
    const off = await fetchCollectionStatus();
    expect(off.state).toBe('NOT_CONFIGURED');
    expect(off.reason).toBe('CREDENTIALS_MISSING');
    expect(off.source).toBeNull();
  });

  it('trata 401 como sessão inválida e nunca como estado vazio', async () => {
    const sessionInvalid = vi.fn();
    window.addEventListener('vu-session-invalid', sessionInvalid);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(fetchCollectionStatus()).rejects.toThrow(/Sessão ausente ou expirada/);
    expect(sessionInvalid).toHaveBeenCalledTimes(1);
    window.removeEventListener('vu-session-invalid', sessionInvalid);
  });

  it('trata 403 como sessão administrativa inválida, distinta de vazio e de indisponibilidade', async () => {
    const sessionInvalid = vi.fn();
    window.addEventListener('vu-session-invalid', sessionInvalid);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ code: 'CSRF_REQUIRED', message: 'Recarregue a sessão.' }, { status: 403 }),
      ),
    );
    const failure = await fetchCollectionStatus().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CollectionApiError);
    expect((failure as CollectionApiError).status).toBe(403);
    expect((failure as Error).message).toMatch(/Sessão sem confirmação administrativa válida/);
    expect(sessionInvalid).toHaveBeenCalledTimes(1);
    window.removeEventListener('vu-session-invalid', sessionInvalid);
  });

  it('mostra a recusa do servidor no conflito e não inventa mensagem para indisponibilidade', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            code: 'COLLECTION_RUN_ACTIVE',
            message: 'Já existe execução em andamento para esta fonte.',
          },
          { status: 409 },
        ),
      ),
    );
    await expect(startCollectionRun('RECENT', 'csrf-1')).rejects.toThrow(
      /Já existe execução em andamento para esta fonte/,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(fetchCollectionStatus()).rejects.toThrow(
      /A coleta não respondeu. Nenhum estado foi alterado/,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('não é json', { status: 200 })),
    );
    await expect(fetchCollectionStatus()).rejects.toThrow(/formato inesperado/i);
  });

  it('não devolve credencial, token nem corpo enviado em mensagem de erro', async () => {
    const secret = 'csrf-secret-token-123';
    const cases = [
      Response.json(
        { code: 'INVALID_COLLECTION_RUN', message: 'Revise o corpo da requisição da coleta.' },
        { status: 400 },
      ),
      Response.json({ code: 'COLLECTION_UNAVAILABLE' }, { status: 503 }),
      new Response(null, { status: 401 }),
      new Response('não é json', { status: 200 }),
    ];
    for (const response of cases) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response.clone()),
      );
      const failure = await fetchCollectionStatus()
        .then(() => null)
        .catch((error: unknown) => error as Error);
      expect(failure).not.toBeNull();
      expect(failure!.message).not.toContain(secret);
      expect(failure!.message).not.toMatch(/X-CSRF-Token|Authorization|Bearer/i);
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 'COLLECTION_RUN_ACTIVE', message: 'Execução em andamento.' },
          { status: 409 },
        ),
      ),
    );
    const startFailure = await startCollectionRun('RECENT', secret)
      .then(() => null)
      .catch((error: unknown) => error as Error);
    expect(startFailure!.message).not.toContain(secret);
  });

  it('dispara a execução manual recente com CSRF e aceita 202 do servidor', async () => {
    const fetcher = vi.fn(async () => Response.json(run({ state: 'RUNNING' }), { status: 202 }));
    vi.stubGlobal('fetch', fetcher);
    const started = await startCollectionRun('RECENT', 'csrf-1');
    expect(started.id).toBe('run-1');
    expect(started.state).toBe('RUNNING');
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/api/v1/admin/collections/runs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-1' }),
        body: JSON.stringify({ kind: 'RECENT' }),
      }),
    );
  });

  it('pausa e retoma a execução identificada devolvendo o estado observado', async () => {
    const fetcher = vi.fn(async () => Response.json(run({ state: 'PAUSED' })));
    vi.stubGlobal('fetch', fetcher);
    expect((await pauseCollectionRun('run-9', 'csrf-1')).state).toBe('PAUSED');
    expect(fetcher).toHaveBeenLastCalledWith(
      'http://127.0.0.1:8080/api/v1/admin/collections/runs/run-9/pause',
      expect.objectContaining({ method: 'POST' }),
    );
    await resumeCollectionRun('run-9', 'csrf-1');
    expect(fetcher).toHaveBeenLastCalledWith(
      'http://127.0.0.1:8080/api/v1/admin/collections/runs/run-9/resume',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('lê o histórico de execuções com contadores e classe de erro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          items: [
            run(),
            run({
              id: 'run-0',
              state: 'FAILED',
              errorClass: 'AUTH_FAILED',
              errorDetail: 'credencial recusada',
            }),
          ],
        }),
      ),
    );
    const runs = await fetchCollectionRuns();
    expect(runs.map((entry) => entry.id)).toEqual(['run-1', 'run-0']);
    expect(runs[1]?.errorClass).toBe('AUTH_FAILED');
    expect(runs[0]?.counters.itemsDuplicated).toBe(36);
  });
});

describe('vocabulário e alvos de comando da coleta', () => {
  it('dá texto distinto a cada estado e não confunde «não configurada» com falha', () => {
    expect(collectionStateLabel('NOT_CONFIGURED')).toBe('Não configurada');
    expect(collectionStateLabel('SUCCEEDED_NO_CHANGES')).toBe('Concluída sem novidades');
    expect(collectionStateLabel('SUCCEEDED_NEW_ITEMS')).toBe('Concluída com itens novos');
    expect(collectionStateLabel('FAILED')).toBe('Falhou sem página concluída');
    expect(collectionStateLabel('PARTIAL')).toBe('Parcial com retomada preservada');
    expect(collectionStateLabel('PAUSED')).toBe('Pausada pelo administrador');
    expect(collectionStateLabel('RUNNING')).toBe('Em andamento');
    expect(collectionStatusLabel(null)).toBe('Configurada, sem execução registrada');
    expect(collectionStateTone('NOT_CONFIGURED')).toBe('neutral');
    expect(collectionStateTone(null)).toBe('neutral');
    expect(collectionStateTone('FAILED')).toBe('failure');
    expect(collectionStateTone('SUCCEEDED_NEW_ITEMS')).toBe('ok');
    expect(errorClassLabel('AUTH_FAILED')).toBe('Falha de autenticação na fonte');
    expect(errorClassLabel('RATE_LIMITED')).toBe('Limite de requisições da fonte');
    expect(errorClassLabel('UPSTREAM_UNAVAILABLE')).toBe('Fonte indisponível');
    expect(errorClassLabel('INVALID_RESPONSE')).toBe('Resposta inválida da fonte');
    // Classe real da fonte (HTTP 403 «error code: 1010»): sem rótulo, o histórico exibiria o token cru.
    expect(errorClassLabel('UPSTREAM_BLOCKED')).toBe('Assinatura do cliente bloqueada pela fonte');
  });

  it('escolhe a execução pausável e a retomável sem inventar identificador', () => {
    const base = status() as unknown as CollectionStatus;
    const running = { ...base, lastRun: { ...base.lastRun!, state: 'RUNNING' as const } };
    expect(pauseTarget(running, [])).toBe('run-1');
    expect(resumeTarget(running, [])).toBeNull();
    const paused = { ...base, lastRun: { ...base.lastRun!, state: 'PAUSED' as const } };
    expect(resumeTarget(paused, [])).toBe('run-1');
    expect(pauseTarget(paused, [])).toBeNull();
    const withoutRun = { ...base, state: null, lastRun: null };
    expect(
      resumeTarget(withoutRun, [
        run({ id: 'run-7', state: 'PARTIAL' }),
      ] as unknown as CollectionRun[]),
    ).toBe('run-7');
    expect(
      pauseTarget(withoutRun, [
        run({ id: 'run-8', state: 'FAILED' }),
      ] as unknown as CollectionRun[]),
    ).toBeNull();
    expect(pauseTarget(withoutRun, [])).toBeNull();
  });

  it('apresenta instantes em America/Sao_Paulo, «nunca» quando ausente e valor cru quando ilegível', () => {
    expect(formatCollectionInstant('2026-10-19T12:00:00Z')).toBe('19/10/2026, 09:00');
    expect(formatCollectionInstant(null)).toBe('Nunca');
    expect(formatCollectionInstant('19/10/2026 09:00')).toBe('19/10/2026 09:00');
  });
});
