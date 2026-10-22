/**
 * Transporte da confiabilidade (tickets 23 e 24).
 *
 * Contrato real da API:
 * - `GET /admin/reliability/rules` → versões da regra e versão vigente;
 * - `POST /admin/reliability/occurrences/{id}/evaluations` → avaliação com fatores internos;
 * - `GET .../evaluations/{versao}/reproduction` → reprodução da mesma versão;
 * - `POST .../evaluations/{versao}/publication` → publica a nota 1–5 (409 se bloqueada);
 * - `GET /admin/source-ratings/{id}/recommendation` → recomendação com amostra e justificativa;
 * - `POST /admin/source-ratings/{id}/decisions` → decisão humana justificada;
 * - `GET /admin/source-ratings/{id}/flags` → ocorrências sinalizadas para reavaliação.
 *
 * 401/403 viram `ReliabilityApiError` (sessão inválida), nunca lista vazia: a área é restrita no
 * servidor. Erro de leitura nunca é apresentado como «sem dados».
 */

const API = 'http://127.0.0.1:8080/api/v1';

export type ReliabilityRecommendation = 'UPGRADE' | 'KEEP' | 'DOWNGRADE' | 'INSUFFICIENT_SAMPLE';

export interface ReliabilityRule {
  version: number;
  summary: string;
  provenance: string;
  createdAt: string;
}

export interface ReliabilityRules {
  currentVersion: number;
  items: ReliabilityRule[];
}

export interface ReliabilityFactorStatus {
  status: string;
  value?: number;
  neutralBaseUsed?: boolean;
  reason?: string;
}

export interface ReliabilityEvaluation {
  occurrenceId: string;
  evaluationVersion: number;
  ruleVersion: number;
  note: number;
  state: 'RECORDED' | 'PUBLISHED';
  evaluatedAt: string;
  blocking: string[];
  factors: {
    quality: ReliabilityFactorStatus;
    corroboration: { status: string; count: number; capped: number; bonus: number };
    divergence: { status: string; penalty: number; effect: string; reason: string };
    completeness: { status: string; blocking: string[]; fieldStatus: Record<string, string> };
    rounding: string;
    formula: string;
  };
  context: {
    ruleVersion: number;
    occurrenceRevision: number;
    sources: Array<{
      clippingId: string;
      sourceId: string;
      sourceName: string | null;
      rating: number | null;
      traceableReference: boolean;
      referenceSource: boolean;
    }>;
    reproductions: Array<{ clippingId: string; sourceId: string; reproductionOf: string }>;
    publicExposure: string;
  };
}

export interface ReliabilityReproduction {
  occurrenceId: string;
  evaluationVersion: number;
  ruleVersion: number;
  reproduced: boolean;
  storedNote: number;
  recomputedNote: number;
  differences: string[];
  message: string;
}

export interface ReliabilitySample {
  applicable: number;
  confirmed: number;
  disproven: number;
  inconclusive: number;
  correctedBySource: number;
  systemErrors: number;
  minimum: number;
}

export interface SourceRecommendation {
  sourceId: string;
  currentRating: number;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  sample: ReliabilitySample;
  recommendation: ReliabilityRecommendation;
  justification: string;
  canChange: boolean;
  limitations: string;
}

export interface SourceRatingDecision {
  sourceId: string;
  decisionId: number;
  decision: 'APPROVED' | 'REJECTED';
  recommendation: ReliabilityRecommendation;
  previousRating: number;
  appliedRating: number;
  appliedSourceVersion: number;
  flaggedOccurrences: number;
  message: string;
}

export interface SourceReevaluationFlag {
  id: number;
  occurrence_id: string;
  reason: string;
  created_at: string;
  resolved_at: string | null;
  current_note: number;
}

export interface OccurrenceOption {
  id: string;
  title: string;
  happeningId: string;
  revision: number;
}

export class ReliabilityApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReliabilityApiError';
  }

  get sessionInvalid(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get blocked(): boolean {
    return this.status === 409;
  }
}

async function failure(response: Response): Promise<ReliabilityApiError> {
  if (response.status === 401 || response.status === 403) {
    return new ReliabilityApiError(
      response.status,
      'SESSION_REQUIRED',
      'Entre como administrador para avaliar confiabilidade e decidir notas de fonte.',
    );
  }
  let code = 'UNEXPECTED';
  let message = '';
  try {
    const body = (await response.json()) as { code?: string; message?: string; error?: string };
    code = body.code ?? body.error ?? code;
    message = body.message ?? '';
  } catch {
    // Corpo não-JSON: mantém a mensagem padrão do estado.
  }
  if (response.status === 409) {
    return new ReliabilityApiError(
      409,
      code,
      message ||
        'Avaliação bloqueada: essencial ausente ou conflito essencial impede publicar a nota.',
    );
  }
  return new ReliabilityApiError(
    response.status,
    code,
    message ||
      'Falha ao falar com a API de confiabilidade. A falha não significa ausência de dados.',
  );
}

async function read<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  if (!response.ok) throw await failure(response);
  const raw = await response.text();
  if (!raw.trim()) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ReliabilityApiError(
      500,
      'INVALID_RESPONSE',
      'A API respondeu em formato inesperado.',
    );
  }
}

function write(path: string, csrf: string, body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(body),
  };
}

export function fetchReliabilityRules(signal?: AbortSignal): Promise<ReliabilityRules> {
  return read<ReliabilityRules>('admin/reliability/rules', { signal });
}

export function fetchLatestEvaluation(
  occurrenceId: string,
  signal?: AbortSignal,
): Promise<ReliabilityEvaluation> {
  return read<ReliabilityEvaluation>(
    `admin/reliability/occurrences/${encodeURIComponent(occurrenceId)}/evaluations/latest`,
    { signal },
  );
}

export function evaluateOccurrence(
  occurrenceId: string,
  csrf: string,
  key: string,
): Promise<ReliabilityEvaluation> {
  return read<ReliabilityEvaluation>(
    `admin/reliability/occurrences/${encodeURIComponent(occurrenceId)}/evaluations`,
    write(`admin/reliability/occurrences/${encodeURIComponent(occurrenceId)}/evaluations`, csrf, {
      evaluationKey: key,
    }),
  );
}

export function reproduceEvaluation(
  occurrenceId: string,
  version: number,
  signal?: AbortSignal,
): Promise<ReliabilityReproduction> {
  return read<ReliabilityReproduction>(
    `admin/reliability/occurrences/${encodeURIComponent(occurrenceId)}/evaluations/${version}/reproduction`,
    { signal },
  );
}

export function publishNote(
  occurrenceId: string,
  version: number,
  csrf: string,
): Promise<{ note: number; message: string }> {
  const path = `admin/reliability/occurrences/${encodeURIComponent(occurrenceId)}/evaluations/${version}/publication`;
  return read<{ note: number; message: string }>(path, write(path, csrf, {}));
}

export function fetchRecommendation(
  sourceId: string,
  signal?: AbortSignal,
): Promise<SourceRecommendation> {
  return read<SourceRecommendation>(
    `admin/source-ratings/${encodeURIComponent(sourceId)}/recommendation`,
    { signal },
  );
}

export function recordVerification(
  sourceId: string,
  csrf: string,
  statement: { statementKey: string; statementExcerpt: string; result: string; note: string },
): Promise<{ result: string; message: string }> {
  const path = `admin/source-ratings/${encodeURIComponent(sourceId)}/verifications`;
  return read<{ result: string; message: string }>(path, write(path, csrf, statement));
}

export function decideSourceRating(
  sourceId: string,
  csrf: string,
  decision: 'APPROVED' | 'REJECTED',
  justification: string,
): Promise<SourceRatingDecision> {
  const path = `admin/source-ratings/${encodeURIComponent(sourceId)}/decisions`;
  return read<SourceRatingDecision>(path, write(path, csrf, { decision, justification }));
}

export function fetchReevaluationFlags(
  sourceId: string,
  signal?: AbortSignal,
): Promise<SourceReevaluationFlag[]> {
  return read<{ items: SourceReevaluationFlag[] }>(
    `admin/source-ratings/${encodeURIComponent(sourceId)}/flags`,
    { signal },
  ).then((body) => body.items ?? []);
}

/** Lista de ocorrências publicadas vem do módulo de revisão; não é inventada no cliente. */
export async function fetchOccurrenceOptions(signal?: AbortSignal): Promise<OccurrenceOption[]> {
  const body = await read<{ occurrences?: Array<Record<string, unknown>> }>(
    'admin/review-clippings/options',
    { signal },
  );
  return (body.occurrences ?? []).map((item) => ({
    id: String(item['id']),
    title: String(item['title'] ?? item['id']),
    happeningId: String(item['happening_id'] ?? ''),
    revision: Number(item['revision'] ?? 0),
  }));
}

const LABELS: Record<ReliabilityRecommendation, string> = {
  UPGRADE: 'Subir nota',
  KEEP: 'Manter nota',
  DOWNGRADE: 'Descer nota',
  INSUFFICIENT_SAMPLE: 'Amostra insuficiente',
};

export function recommendationLabel(recommendation: ReliabilityRecommendation): string {
  return LABELS[recommendation] ?? 'Estado desconhecido';
}

/** Cor estável por estado, para não depender do texto traduzido. */
export function recommendationTone(
  recommendation: ReliabilityRecommendation,
): 'ok' | 'warn' | 'alert' | 'muted' {
  switch (recommendation) {
    case 'UPGRADE':
      return 'ok';
    case 'KEEP':
      return 'muted';
    case 'DOWNGRADE':
      return 'alert';
    default:
      return 'warn';
  }
}

/** Traduz o código de bloqueio do servidor sem esconder o motivo original. */
export function blockingLabel(reason: string): string {
  const [code, field] = reason.split(':');
  switch (code) {
    case 'ESSENTIAL_NOT_INFORMED':
      return `Campo essencial não informado: ${field}`;
    case 'ESSENTIAL_NOT_APPLICABLE':
      return `Campo essencial marcado como não se aplica: ${field}`;
    case 'ESSENTIAL_CONFLICT_UNRESOLVED':
      return 'Conflito essencial não resolvido';
    default:
      return reason;
  }
}
