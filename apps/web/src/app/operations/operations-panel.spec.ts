import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsPanel } from './operations-panel';

const panel = (overrides: Record<string, unknown> = {}) => ({
  generatedAt: '2026-10-22T12:00:00Z',
  sources: {
    state: 'CONFIGURED',
    items: [
      {
        id: 'fogo-cruzado',
        name: 'Fogo Cruzado (API v2)',
        credit: 'Instituto Fogo Cruzado',
        attribution: 'Fonte: Instituto Fogo Cruzado',
        paused: false,
        windowStart: '2026-06-01',
        windowEnd: null,
        pollSeconds: 86400,
        lastAttemptAt: '2026-10-22T11:00:00Z',
        lastSuccessAt: '2026-10-22T10:00:00Z',
        lastErrorClass: null,
        lastRun: {
          id: 'run-1',
          kind: 'RECENT',
          state: 'SUCCEEDED_NO_CHANGES',
          itemsSeen: 40,
          itemsCreated: 0,
          itemsDuplicated: 40,
          pagesDone: 2,
          finishedAt: '2026-10-22T11:00:05Z',
        },
        assessment: 'UP_TO_DATE_NO_NEW_ITEMS',
        assessmentLabel: 'Sem novidades na última execução',
        detail: 'A última execução foi bem-sucedida e nenhuma publicação nova apareceu.',
      },
    ],
  },
  queue: {
    state: 'HAS_PENDING',
    pending: 2,
    highPriority: 1,
    oldestQueuedAt: '2026-10-22T09:00:00Z',
    longestWaitSeconds: 10800,
    label: '2 item(ns) aguardando revisão humana',
  },
  confirmations: {
    state: 'CONFIGURED',
    windowSeconds: 86400,
    expiring: [
      {
        occurrenceId: 'occ-1',
        type: 'INTERDICAO',
        municipality: 'Rio de Janeiro',
        confirmedAt: '2026-10-22T10:00:00Z',
        expiresAt: '2026-10-22T23:00:00Z',
      },
    ],
    expired: 0,
    typesWithoutDeadline: [],
    typesWithoutAutomaticExtension: [],
    label: '24 h de antecedência (1 confirmação(ões) próxima(s) de expirar)',
    detail: 'Somente prazos aprovados por tipo são usados nesta lista.',
  },
  limitations: 'Estado do ambiente local sintético; não comprova coleta real.',
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('painel de operação', () => {
  let fixture: ComponentFixture<OperationsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationsPanel],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function create(handler: () => Response | Promise<Response>): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => handler()),
    );
    fixture = TestBed.createComponent(OperationsPanel);
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const query = (testId: string) => root().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const until = async (assertion: () => void): Promise<void> => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      assertion();
    });
  };

  it('mostra sucesso sem novidades, espera da fila e crédito da fonte', async () => {
    create(() => json(panel()));
    await until(() => expect(query('operations-source-pill')).not.toBeNull());
    expect(query('operations-source-pill')?.textContent).toContain(
      'Sem novidades na última execução',
    );
    expect(query('operations-source-credit')?.textContent).toContain(
      'Fonte: Instituto Fogo Cruzado',
    );
    expect(query('operations-source-run')?.textContent).toContain('SUCCEEDED_NO_CHANGES');
    expect(query('operations-queue-pending')?.textContent?.trim()).toBe('2');
    expect(query('operations-queue-wait')?.textContent).toContain('3,0 h');
    expect(query('operations-expiring-item')?.textContent).toContain('occ-1');
    expect(query('operations-limitations')?.textContent).toContain('não comprova coleta real');
    expect(query('operations-sources-not-configured')).toBeNull();
  });

  it('distingue fonte não configurada, fila vazia e antecedência não configurada', async () => {
    create(() =>
      json(
        panel({
          sources: {
            state: 'NOT_CONFIGURED',
            items: [],
            label: 'Nenhuma fonte de coleta configurada',
            detail: 'Coleta não configurada não é falha nem ausência de ocorrências.',
          },
          queue: {
            state: 'EMPTY',
            pending: 0,
            highPriority: 0,
            oldestQueuedAt: null,
            longestWaitSeconds: 0,
            label: 'Fila de revisão vazia',
          },
          confirmations: {
            state: 'NOT_CONFIGURED',
            windowSeconds: null,
            expiring: [],
            expired: 0,
            typesWithoutDeadline: ['DESLIZAMENTO'],
            typesWithoutAutomaticExtension: [],
            label: 'Antecedência não configurada',
            detail: 'Defina vetor.operations.expiry-window para listar confirmações.',
          },
        }),
      ),
    );
    await until(() => expect(query('operations-sources-not-configured')).not.toBeNull());
    expect(query('operations-sources-not-configured')?.textContent).toContain('não é falha');
    expect(query('operations-queue-label')?.textContent).toContain('vazia');
    expect(query('operations-queue-pending')).toBeNull();
    expect(query('operations-confirmations-not-configured')?.textContent).toContain(
      'vetor.operations.expiry-window',
    );
    expect(query('operations-expiring-item')).toBeNull();
  });

  it('mantém erro visível com repetição e não apaga a explicação', async () => {
    create(() => json({ code: 'OPERATIONS_UNAVAILABLE', message: 'Painel fora do ar.' }, 503));
    await until(() => expect(query('operations-error')).not.toBeNull());
    expect(query('operations-error')?.textContent).toContain('Painel fora do ar.');
    const retry = query('operations-retry') as HTMLButtonElement;
    expect(retry.textContent).toContain('Tentar novamente');
    retry.click();
    fixture.detectChanges();
    expect(
      (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length,
    ).toBeGreaterThan(1);
  });

  it('move o foco para a seção existente sem alterar dados', async () => {
    const target = document.createElement('h2');
    target.id = 'collection-heading';
    target.tabIndex = -1;
    document.body.append(target);
    try {
      create(() => json(panel()));
      await until(() => expect(query('operations-nav-collection')).not.toBeNull());
      (query('operations-nav-collection') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(target);
      expect(query('operations-notice')?.textContent).toContain('Foco movido');
    } finally {
      target.remove();
    }
  });
});
