/**
 * Transporte da superfície administrativa de coleta (ticket 20 — API Fogo Cruzado v2).
 *
 * Contrato real do executor: `GET /api/v1/admin/collections` devolve **um** objeto de estado com
 * `ficha` (procedência e crédito da fonte), `source`, `lastRun`, `counters`, `reason` e `state`
 * (nulo quando a coleta está configurada mas ainda não executou). `GET .../runs` devolve `{items}`;
 * `POST .../runs` responde 202 com a execução criada.
 *
 * 401/403 são sessão inválida (`vu-session-invalid`), nunca vazio. Nenhuma mensagem de erro inclui
 * credencial, token, cabeçalho ou corpo enviado.
 */

const API = 'http://127.0.0.1:8080/api/v1';

export type CollectionState =
  | 'NOT_CONFIGURED'
  | 'RUNNING'
  | 'PAUSED'
  | 'SUCCEEDED_NO_CHANGES'
  | 'SUCCEEDED_NEW_ITEMS'
  | 'PARTIAL'
  | 'FAILED';

export type CollectionErrorClass =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INVALID_RESPONSE'
  /** A fonte bloqueou a assinatura do cliente (HTTP 403 «error code: 1010»), distinto de credencial inválida. */
  | 'UPSTREAM_BLOCKED';

export type CollectionRunKind = 'RECENT' | 'BACKFILL';
export type CollectionNotConfiguredReason = 'CREDENTIALS_MISSING' | 'COLLECTION_DISABLED';

export interface CollectionCounters {
  itemsSeen: number;
  itemsCreated: number;
  itemsDuplicated: number;
  pagesDone: number;
}

/** Ficha de procedência exigida antes da coleta real; `credit` é a contrapartida da fonte. */
export interface CollectionFicha {
  sourceId: string | null;
  publicName: string | null;
  credit: string | null;
  license: string | null;
  obtainedAt: string | null;
  documentationUrl: string | null;
  channel: string | null;
  limitations: string | null;
}

export interface CollectionSourceRow {
  sourceId: string | null;
  publicName: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  pollSeconds: number | null;
  pageSize: number | null;
  maxPages: number | null;
  paused: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorClass: CollectionErrorClass | null;
  upstreamLastUpdate: string | null;
}

export interface CollectionRun {
  id: string;
  sourceId: string | null;
  kind: CollectionRunKind;
  windowStart: string | null;
  windowEnd: string | null;
  nextPage: number | null;
  counters: CollectionCounters;
  municipalitiesMissing: string[];
  state: CollectionState;
  errorClass: CollectionErrorClass | null;
  errorDetail: string | null;
  pauseRequested: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string | null;
}

export interface CollectionStatus {
  sourceId: string | null;
  configured: boolean;
  ficha: CollectionFicha;
  reason: CollectionNotConfiguredReason | null;
  /** Nulo quando configurada e ainda sem execução — não é falha, vazio nem «não configurada». */
  state: CollectionState | null;
  source: CollectionSourceRow | null;
  lastRun: CollectionRun | null;
  counters: CollectionCounters;
}

export class CollectionApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type RawRecord = Record<string, unknown>;

function record(value: unknown): RawRecord {
  return typeof value === 'object' && value !== null ? (value as RawRecord) : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function optionalCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function collectionFicha(raw: unknown): CollectionFicha {
  const value = record(raw);
  return {
    sourceId: text(value['sourceId']),
    publicName: text(value['publicName']),
    credit: text(value['credit']),
    license: text(value['license']),
    obtainedAt: text(value['obtainedAt']),
    documentationUrl: text(value['documentationUrl']),
    channel: text(value['channel']),
    limitations: text(value['limitations']),
  };
}

export function collectionSourceRow(raw: unknown): CollectionSourceRow | null {
  if (raw === null || raw === undefined) return null;
  const value = record(raw);
  return {
    sourceId: text(value['sourceId']),
    publicName: text(value['publicName']),
    windowStart: text(value['windowStart']),
    windowEnd: text(value['windowEnd']),
    pollSeconds: optionalCount(value['pollSeconds']),
    pageSize: optionalCount(value['pageSize']),
    maxPages: optionalCount(value['maxPages']),
    paused: value['paused'] === true,
    lastAttemptAt: text(value['lastAttemptAt']),
    lastSuccessAt: text(value['lastSuccessAt']),
    lastErrorClass: text(value['lastErrorClass']) as CollectionErrorClass | null,
    upstreamLastUpdate: text(value['upstreamLastUpdate']),
  };
}

export function collectionRun(raw: unknown): CollectionRun {
  const value = record(raw);
  return {
    id: String(value['id'] ?? ''),
    sourceId: text(value['sourceId']),
    kind: (value['kind'] === 'BACKFILL' ? 'BACKFILL' : 'RECENT') as CollectionRunKind,
    windowStart: text(value['windowStart']),
    windowEnd: text(value['windowEnd']),
    nextPage: optionalCount(value['nextPage']),
    counters: {
      itemsSeen: count(value['itemsSeen']),
      itemsCreated: count(value['itemsCreated']),
      itemsDuplicated: count(value['itemsDuplicated']),
      pagesDone: count(value['pagesDone']),
    },
    municipalitiesMissing: strings(value['municipalitiesMissing']),
    state: (text(value['state']) ?? 'NOT_CONFIGURED') as CollectionState,
    errorClass: text(value['errorClass']) as CollectionErrorClass | null,
    errorDetail: text(value['errorDetail']),
    pauseRequested: value['pauseRequested'] === true,
    startedAt: text(value['startedAt']),
    finishedAt: text(value['finishedAt']),
    updatedAt: text(value['updatedAt']),
  };
}

export function collectionStatus(raw: unknown): CollectionStatus {
  const value = record(raw);
  const reason = text(value['reason']);
  const counters = record(value['counters']);
  return {
    sourceId: text(value['sourceId']),
    configured: value['configured'] === true,
    ficha: collectionFicha(value['ficha']),
    reason: (reason === 'CREDENTIALS_MISSING' || reason === 'COLLECTION_DISABLED'
      ? reason
      : null) as CollectionNotConfiguredReason | null,
    state: text(value['state']) as CollectionState | null,
    source: collectionSourceRow(value['source']),
    lastRun: value['lastRun'] == null ? null : collectionRun(value['lastRun']),
    counters: {
      itemsSeen: count(counters['itemsSeen']),
      itemsCreated: count(counters['itemsCreated']),
      itemsDuplicated: count(counters['itemsDuplicated']),
      pagesDone: count(counters['pagesDone']),
    },
  };
}

function sessionInvalid(): void {
  window.dispatchEvent(new Event('vu-session-invalid'));
}

async function errorPayload(response: Response): Promise<{ code: string; message: string | null }> {
  try {
    const body = record(JSON.parse(await response.text()) as unknown);
    return {
      code: text(body['code']) ?? 'COLLECTION_REQUEST_FAILED',
      message: text(body['message']),
    };
  } catch {
    return { code: 'COLLECTION_REQUEST_FAILED', message: null };
  }
}

async function failure(response: Response): Promise<CollectionApiError> {
  const payload = await errorPayload(response);
  if (response.status === 401 || response.status === 403) {
    // Sessão inválida é evento de sessão: nunca vira estado vazio nem resultado da coleta.
    sessionInvalid();
    return new CollectionApiError(
      response.status,
      payload.code,
      response.status === 401
        ? 'Sessão ausente ou expirada. Entre novamente.'
        : 'Sessão sem confirmação administrativa válida (ADMIN com MFA). Entre novamente.',
    );
  }
  if (response.status >= 500)
    return new CollectionApiError(
      response.status,
      payload.code,
      'A coleta não respondeu. Nenhum estado foi alterado. Tente novamente.',
    );
  // Recusa explícita do servidor (conflito, corpo inválido, janela fora do recorte) é reproduzida.
  return new CollectionApiError(
    response.status,
    payload.code,
    payload.message ?? 'O servidor recusou o comando de coleta. Nenhum estado foi alterado.',
  );
}

async function request<T>(
  path: string,
  options: { body?: unknown; csrf?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: options.body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'X-CSRF-Token': options.csrf ?? '' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) throw await failure(response);
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new CollectionApiError(
      response.status,
      'INVALID_RESPONSE',
      'A API respondeu em formato inesperado. Nenhum estado foi alterado.',
    );
  }
}

export async function fetchCollectionStatus(signal?: AbortSignal): Promise<CollectionStatus> {
  return collectionStatus(await request<unknown>('/admin/collections', { signal }));
}

export async function fetchCollectionRuns(signal?: AbortSignal): Promise<CollectionRun[]> {
  const body = await request<unknown>('/admin/collections/runs', { signal });
  const items = Array.isArray(body) ? body : record(body)['items'];
  return Array.isArray(items) ? items.map(collectionRun) : [];
}

export function startCollectionRun(
  kind: CollectionRunKind,
  csrf: string,
  window?: { from?: string; to?: string },
  signal?: AbortSignal,
): Promise<CollectionRun> {
  const body: RawRecord = { kind };
  if (window?.from) body['from'] = window.from;
  if (window?.to) body['to'] = window.to;
  return request<unknown>('/admin/collections/runs', { body, csrf, signal }).then(collectionRun);
}

export function pauseCollectionRun(
  id: string,
  csrf: string,
  signal?: AbortSignal,
): Promise<CollectionRun> {
  return request<unknown>(`/admin/collections/runs/${encodeURIComponent(id)}/pause`, {
    body: {},
    csrf,
    signal,
  }).then(collectionRun);
}

export function resumeCollectionRun(
  id: string,
  csrf: string,
  signal?: AbortSignal,
): Promise<CollectionRun> {
  return request<unknown>(`/admin/collections/runs/${encodeURIComponent(id)}/resume`, {
    body: {},
    csrf,
    signal,
  }).then(collectionRun);
}

const STATE_LABELS: Record<CollectionState, string> = {
  NOT_CONFIGURED: 'Não configurada',
  RUNNING: 'Em andamento',
  PAUSED: 'Pausada pelo administrador',
  SUCCEEDED_NO_CHANGES: 'Concluída sem novidades',
  SUCCEEDED_NEW_ITEMS: 'Concluída com itens novos',
  PARTIAL: 'Parcial com retomada preservada',
  FAILED: 'Falhou sem página concluída',
};

export type CollectionTone = 'neutral' | 'active' | 'ok' | 'attention' | 'failure';

const STATE_TONES: Record<CollectionState, CollectionTone> = {
  NOT_CONFIGURED: 'neutral',
  RUNNING: 'active',
  PAUSED: 'attention',
  SUCCEEDED_NO_CHANGES: 'ok',
  SUCCEEDED_NEW_ITEMS: 'ok',
  PARTIAL: 'attention',
  FAILED: 'failure',
};

/** Token desconhecido é exibido como veio da fonte, sem tradução inventada. */
export function collectionStateLabel(state: CollectionState | string): string {
  return STATE_LABELS[state as CollectionState] ?? state;
}

/** Estado de leitura: nulo significa configurada e ainda sem execução registrada. */
export function collectionStatusLabel(state: CollectionState | null | string): string {
  if (state === null || state === undefined || state === '') {
    return 'Configurada, sem execução registrada';
  }
  return collectionStateLabel(state);
}

export function collectionStateTone(state: CollectionState | null | string): CollectionTone {
  if (state === null || state === undefined || state === '') return 'neutral';
  return STATE_TONES[state as CollectionState] ?? 'neutral';
}

const ERROR_LABELS: Record<CollectionErrorClass, string> = {
  AUTH_FAILED: 'Falha de autenticação na fonte',
  RATE_LIMITED: 'Limite de requisições da fonte',
  UPSTREAM_UNAVAILABLE: 'Fonte indisponível',
  INVALID_RESPONSE: 'Resposta inválida da fonte',
  UPSTREAM_BLOCKED: 'Assinatura do cliente bloqueada pela fonte',
};

export function errorClassLabel(errorClass: CollectionErrorClass | string): string {
  return ERROR_LABELS[errorClass as CollectionErrorClass] ?? errorClass;
}

const PAUSABLE: CollectionState[] = ['RUNNING'];
const RESUMABLE: CollectionState[] = ['PAUSED', 'PARTIAL'];

/** Alvo real do comando: a última execução naquele estado ou a mais recente do histórico. */
function commandTarget(
  status: CollectionStatus,
  runs: CollectionRun[],
  states: CollectionState[],
): string | null {
  const last = status.lastRun;
  if (last && states.includes(last.state)) return last.id;
  const candidate = runs.find(
    (run) =>
      states.includes(run.state) &&
      (!run.sourceId || !status.sourceId || run.sourceId === status.sourceId),
  );
  return candidate?.id || null;
}

/** O servidor só pausa execução em andamento; sem alvo real o comando não é enviado. */
export function pauseTarget(status: CollectionStatus, runs: CollectionRun[]): string | null {
  return commandTarget(status, runs, PAUSABLE);
}

/** Retomada vale para execução pausada e para falha parcial com cursor preservado. */
export function resumeTarget(status: CollectionStatus, runs: CollectionRun[]): string | null {
  return commandTarget(status, runs, RESUMABLE);
}

export function formatCollectionInstant(instant: string | null): string {
  if (!instant) return 'Nunca';
  const date = new Date(instant);
  // Instante não interpretável é exibido como veio da fonte; formatar quebraria a tela inteira.
  if (Number.isNaN(date.getTime())) return instant;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}
