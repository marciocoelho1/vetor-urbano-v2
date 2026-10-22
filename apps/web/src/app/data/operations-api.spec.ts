import { describe, expect, it } from 'vitest';
import { formatWait, operationTone, operationsPanel } from './operations-api';

const raw = {
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
        lastSuccessAt: null,
        lastErrorClass: 'RATE_LIMITED',
        lastRun: {
          id: 'run-1',
          kind: 'RECENT',
          state: 'FAILED',
          itemsSeen: 0,
          itemsCreated: 0,
          itemsDuplicated: 0,
          pagesDone: 1,
          finishedAt: '2026-10-22T11:00:05Z',
        },
        assessment: 'FAILING',
        assessmentLabel: 'Falha de alimentação: limite de taxa da fonte',
        detail: 'A última tentativa falhou e não houve sucesso posterior.',
      },
    ],
  },
  queue: {
    state: 'HAS_PENDING',
    pending: 12,
    highPriority: 3,
    oldestQueuedAt: '2026-10-22T09:00:00Z',
    longestWaitSeconds: 10800,
    label: '12 item(ns) aguardando revisão humana',
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
        expiresAt: '2026-10-22T12:00:00Z',
      },
    ],
    expired: 2,
    typesWithoutDeadline: [],
    typesWithoutAutomaticExtension: ['ROUBO'],
    label: '24 h de antecedência (1 confirmação(ões) próxima(s) de expirar)',
    detail: 'Somente prazos aprovados por tipo são usados nesta lista.',
  },
  limitations: 'Estado do ambiente local sintético.',
};

describe('contrato do painel de operação', () => {
  it('lê o corpo real sem confundir falha, fila e confirmação', () => {
    const view = operationsPanel(raw);
    expect(view.sources.state).toBe('CONFIGURED');
    expect(view.sources.items[0]?.assessment).toBe('FAILING');
    expect(view.sources.items[0]?.lastErrorClass).toBe('RATE_LIMITED');
    expect(view.sources.items[0]?.attribution).toBe('Fonte: Instituto Fogo Cruzado');
    expect(view.queue.state).toBe('HAS_PENDING');
    expect(view.queue.pending).toBe(12);
    expect(view.confirmations.expiring[0]?.occurrenceId).toBe('occ-1');
    expect(view.confirmations.typesWithoutAutomaticExtension).toEqual(['ROUBO']);
  });

  it('trata ausência de configuração e corpo incompleto sem inventar estado saudável', () => {
    const empty = operationsPanel({
      generatedAt: '2026-10-22T12:00:00Z',
      sources: {
        state: 'NOT_CONFIGURED',
        items: [],
        label: 'Nenhuma fonte',
        detail: 'Não é falha.',
      },
      queue: { state: 'EMPTY', pending: 0 },
      confirmations: { state: 'NOT_CONFIGURED', expiring: [] },
      limitations: 'Sintético.',
    });
    expect(empty.sources.items).toEqual([]);
    expect(empty.sources.detail).toBe('Não é falha.');
    expect(empty.queue.longestWaitSeconds).toBe(0);
    expect(empty.confirmations.windowSeconds).toBeNull();
    expect(empty.confirmations.typesWithoutDeadline).toEqual([]);

    const broken = operationsPanel({});
    expect(broken.sources.state).toBe('NOT_CONFIGURED');
    expect(broken.queue.state).toBe('EMPTY');
    expect(broken.confirmations.state).toBe('NOT_CONFIGURED');
    expect(broken.generatedAt).toBe('');
  });

  it('dá tons distintos a sucesso, falha, pausa e estados sem leitura', () => {
    expect(operationTone('UP_TO_DATE_NO_NEW_ITEMS')).toBe('ok');
    expect(operationTone('NEW_ITEMS')).toBe('ok');
    expect(operationTone('FAILING')).toBe('alert');
    expect(operationTone('PARTIAL')).toBe('warn');
    expect(operationTone('NEVER_ATTEMPTED')).toBe('warn');
    expect(operationTone('PAUSED')).toBe('muted');
  });

  it('formata espera medida pelo servidor sem prometer prazo', () => {
    expect(formatWait(0)).toBe('sem espera acumulada');
    expect(formatWait(45)).toBe('45 s');
    expect(formatWait(600)).toBe('10 min');
    expect(formatWait(7200)).toBe('2,0 h');
    expect(formatWait(172800)).toBe('2,0 d');
  });
});
