/**
 * Transporte do painel de operação (ticket 22).
 *
 * Contrato real: `GET /api/v1/admin/operations` responde com `generatedAt`, `sources`, `queue` e
 * `confirmations`. Cada bloco tem um `state` próprio — fonte não configurada, conector pausado,
 * falha de alimentação, sucesso sem novidades, fila vazia e antecedência não configurada nunca são
 * reduzidos a zero nem confundidos entre si.
 *
 * 401/403 são sessão inválida (`vu-session-invalid`), nunca vazio: o painel é restrito no servidor.
 */

const API = 'http://127.0.0.1:8080/api/v1';

export type OperationAssessment =
  | 'PAUSED'
  | 'NEVER_ATTEMPTED'
  | 'FAILING'
  | 'RUNNING'
  | 'PARTIAL'
  | 'UP_TO_DATE_NO_NEW_ITEMS'
  | 'NEW_ITEMS'
  | 'IDLE';

export interface OperationRun {
  id: string;
  kind: string | null;
  state: string | null;
  itemsSeen: number;
  itemsCreated: number;
  itemsDuplicated: number;
  pagesDone: number;
  finishedAt: string | null;
}

export interface OperationSource {
  id: string;
  name: string | null;
  credit: string | null;
  attribution: string | null;
  paused: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  pollSeconds: number | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorClass: string | null;
  lastRun: OperationRun | null;
  assessment: OperationAssessment;
  assessmentLabel: string;
  detail: string;
}

export interface OperationQueue {
  state: 'EMPTY' | 'HAS_PENDING';
  pending: number;
  highPriority: number;
  oldestQueuedAt: string | null;
  longestWaitSeconds: number;
  label: string;
}

export interface ExpiringConfirmation {
  occurrenceId: string;
  type: string | null;
  municipality: string | null;
  confirmedAt: string | null;
  expiresAt: string | null;
}

export interface OperationConfirmations {
  state: 'CONFIGURED' | 'NOT_CONFIGURED';
  windowSeconds: number | null;
  expiring: ExpiringConfirmation[];
  expired: number;
  typesWithoutDeadline: string[];
  typesWithoutAutomaticExtension: string[];
  label: string;
  detail: string;
}

export interface OperationsPanel {
  generatedAt: string;
  sources: {
    state: 'CONFIGURED' | 'NOT_CONFIGURED';
    items: OperationSource[];
    label?: string;
    detail?: string;
  };
  queue: OperationQueue;
  confirmations: OperationConfirmations;
  limitations: string;
}

export class OperationsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => text(item)).filter((item): item is string => !!item)
    : [];
}

async function failure(response: Response): Promise<OperationsApiError> {
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new Event('vu-session-invalid'));
    return new OperationsApiError(
      response.status,
      'SESSION_REQUIRED',
      'Sessão ausente, expirada ou sem segundo fator. Entre novamente como Administrador.',
    );
  }
  let code = 'OPERATIONS_UNAVAILABLE';
  let message = 'Painel de operação indisponível. Tente novamente.';
  try {
    const body = (await response.json()) as Record<string, unknown>;
    code = text(body['code']) ?? code;
    message = text(body['message']) ?? message;
  } catch {
    // Corpo fora do contrato: mantém a mensagem segura, sem reproduzir conteúdo do servidor.
  }
  return new OperationsApiError(response.status, code, message);
}

export function operationSource(raw: unknown): OperationSource {
  const value = record(raw);
  const run = record(value['lastRun']);
  return {
    id: text(value['id']) ?? '',
    name: text(value['name']),
    credit: text(value['credit']),
    attribution: text(value['attribution']),
    paused: value['paused'] === true,
    windowStart: text(value['windowStart']),
    windowEnd: text(value['windowEnd']),
    pollSeconds: typeof value['pollSeconds'] === 'number' ? value['pollSeconds'] : null,
    lastAttemptAt: text(value['lastAttemptAt']),
    lastSuccessAt: text(value['lastSuccessAt']),
    lastErrorClass: text(value['lastErrorClass']),
    lastRun:
      value['lastRun'] == null
        ? null
        : {
            id: text(run['id']) ?? '',
            kind: text(run['kind']),
            state: text(run['state']),
            itemsSeen: count(run['itemsSeen']),
            itemsCreated: count(run['itemsCreated']),
            itemsDuplicated: count(run['itemsDuplicated']),
            pagesDone: count(run['pagesDone']),
            finishedAt: text(run['finishedAt']),
          },
    assessment: (text(value['assessment']) ?? 'IDLE') as OperationAssessment,
    assessmentLabel: text(value['assessmentLabel']) ?? 'Sem leitura de estado',
    detail: text(value['detail']) ?? '',
  };
}

export function operationsPanel(raw: unknown): OperationsPanel {
  const value = record(raw);
  const sources = record(value['sources']);
  const queue = record(value['queue']);
  const confirmations = record(value['confirmations']);
  return {
    generatedAt: text(value['generatedAt']) ?? '',
    sources: {
      state: sources['state'] === 'CONFIGURED' ? 'CONFIGURED' : 'NOT_CONFIGURED',
      items: Array.isArray(sources['items']) ? sources['items'].map(operationSource) : [],
      label: text(sources['label']) ?? undefined,
      detail: text(sources['detail']) ?? undefined,
    },
    queue: {
      state: queue['state'] === 'HAS_PENDING' ? 'HAS_PENDING' : 'EMPTY',
      pending: count(queue['pending']),
      highPriority: count(queue['highPriority']),
      oldestQueuedAt: text(queue['oldestQueuedAt']),
      longestWaitSeconds: count(queue['longestWaitSeconds']),
      label: text(queue['label']) ?? '',
    },
    confirmations: {
      state: confirmations['state'] === 'CONFIGURED' ? 'CONFIGURED' : 'NOT_CONFIGURED',
      windowSeconds:
        typeof confirmations['windowSeconds'] === 'number' ? confirmations['windowSeconds'] : null,
      expiring: Array.isArray(confirmations['expiring'])
        ? confirmations['expiring'].map((item) => {
            const row = record(item);
            return {
              occurrenceId: text(row['occurrenceId']) ?? '',
              type: text(row['type']),
              municipality: text(row['municipality']),
              confirmedAt: text(row['confirmedAt']),
              expiresAt: text(row['expiresAt']),
            };
          })
        : [],
      expired: count(confirmations['expired']),
      typesWithoutDeadline: strings(confirmations['typesWithoutDeadline']),
      typesWithoutAutomaticExtension: strings(confirmations['typesWithoutAutomaticExtension']),
      label: text(confirmations['label']) ?? '',
      detail: text(confirmations['detail']) ?? '',
    },
    limitations: text(value['limitations']) ?? '',
  };
}

export async function fetchOperationsPanel(signal?: AbortSignal): Promise<OperationsPanel> {
  const response = await fetch(`${API}/admin/operations`, {
    method: 'GET',
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await failure(response);
  const raw = await response.text();
  try {
    return operationsPanel(JSON.parse(raw));
  } catch (error) {
    if (error instanceof OperationsApiError) throw error;
    throw new OperationsApiError(
      response.status,
      'INVALID_RESPONSE',
      'A API respondeu em formato inesperado para o painel de operação.',
    );
  }
}

/** Tons estáveis por estado, para a pílula não depender do texto traduzido. */
export function operationTone(assessment: OperationAssessment): 'ok' | 'warn' | 'alert' | 'muted' {
  switch (assessment) {
    case 'NEW_ITEMS':
    case 'UP_TO_DATE_NO_NEW_ITEMS':
      return 'ok';
    case 'FAILING':
      return 'alert';
    case 'PARTIAL':
    case 'NEVER_ATTEMPTED':
    case 'IDLE':
      return 'warn';
    case 'PAUSED':
    case 'RUNNING':
    default:
      return 'muted';
  }
}

/** Espera legível sem prometer prazo: só converte segundos já medidos pelo servidor. */
export function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'sem espera acumulada';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1).replace('.', ',')} h`;
  return `${(seconds / 86400).toFixed(1).replace('.', ',')} d`;
}
