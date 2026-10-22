/**
 * Transporte da administração de ocorrências (pedido do responsável em 22/10/2026).
 *
 * Contrato real:
 * - `GET /admin/occurrences?sort=last_update|alphabetical&status=…` → lista com contagens e regra de
 *   ordenação; excluídas ficam fora.
 * - `PUT /admin/occurrences/{id}` → edição de todos os campos com `expectedVersion`.
 * - `POST /admin/occurrences/bulk` → ação em lote (`ACTIVE`, `INACTIVE`, `CONCLUDED`, `DELETE`);
 *   `DELETE` exige `password` **uma única vez** para o lote inteiro.
 *
 * 401/403 = sessão inválida; 409 = lista mudou; 400/403 na exclusão = senha ausente ou incorreta.
 * Falha de leitura nunca vira lista vazia.
 */

const API = 'http://127.0.0.1:8080/api/v1';

export type AdministrativeStatus = 'ACTIVE' | 'INACTIVE' | 'CONCLUDED';
export type BulkAction = AdministrativeStatus | 'DELETE';
export type OccurrenceSort = 'last_update' | 'alphabetical';
export type OccurrenceFilter = AdministrativeStatus | 'ALL';

export interface AdminOccurrence {
  id: string;
  title: string;
  category: string;
  occurrence_type: string;
  situation: string;
  administrative_status: AdministrativeStatus;
  municipality: string;
  neighborhood: string;
  revision: number;
  occurred_at: string | null;
  updated_at: string | null;
  reliability: number;
}

export interface AdminOccurrenceList {
  items: AdminOccurrence[];
  sort: OccurrenceSort;
  status: OccurrenceFilter;
  counts: Record<AdministrativeStatus, number>;
  rule: string;
}

export class OccurrenceAdminError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OccurrenceAdminError';
  }

  get sessionInvalid(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** Senha recusada na exclusão: nada foi excluído. */
  get passwordRejected(): boolean {
    return this.status === 403 && !this.sessionInvalid;
  }
}

async function failure(response: Response, fallback: string): Promise<OccurrenceAdminError> {
  if (response.status === 401 || response.status === 403) {
    let message = 'Entre como administrador para administrar ocorrências.';
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      // Corpo vazio: mantém a mensagem de sessão.
    }
    return new OccurrenceAdminError(response.status, 'SESSION_OR_PASSWORD', message);
  }
  let code = 'UNEXPECTED';
  let message = '';
  try {
    const body = (await response.json()) as { code?: string; message?: string; error?: string };
    code = body.code ?? body.error ?? code;
    message = body.message ?? '';
  } catch {
    // Corpo não-JSON.
  }
  return new OccurrenceAdminError(response.status, code, message || fallback);
}

async function read<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    throw await failure(response, 'Falha ao falar com a administração de ocorrências.');
  }
  return (await response.json()) as T;
}

export function fetchAdminOccurrences(
  sort: OccurrenceSort,
  status: OccurrenceFilter,
  signal?: AbortSignal,
): Promise<AdminOccurrenceList> {
  const query = new URLSearchParams({ sort, status });
  return read<AdminOccurrenceList>(`admin/occurrences?${query.toString()}`, { signal });
}

/** Cadastro manual em tempo real: sem clipping, com acontecimento escolhido ou criado. */
export function createOccurrence(
  csrf: string,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return read<Record<string, unknown>>('admin/occurrences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(fields),
  });
}

export function saveOccurrence(
  id: string,
  csrf: string,
  fields: Record<string, unknown>,
  expectedVersion: number,
): Promise<Record<string, unknown>> {
  return read<Record<string, unknown>>(`admin/occurrences/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify({ ...fields, expectedVersion }),
  });
}

export function bulkOccurrences(
  csrf: string,
  ids: string[],
  action: BulkAction,
  password?: string,
): Promise<{ action: BulkAction; affected: number; ids: string[]; message: string }> {
  return read<{ action: BulkAction; affected: number; ids: string[]; message: string }>(
    'admin/occurrences/bulk',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(password ? { ids, action, password } : { ids, action }),
    },
  );
}

export const STATUS_LABELS: Record<AdministrativeStatus, string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  CONCLUDED: 'Concluído',
};

export const ACTION_LABELS: Record<BulkAction, string> = {
  ACTIVE: 'Marcar como ativo',
  INACTIVE: 'Marcar como inativo',
  CONCLUDED: 'Marcar como concluído',
  DELETE: 'Excluir selecionadas',
};

/** Data de atualização legível; ausência é declarada, nunca preenchida com a data da ocorrência. */
export function updateLabel(occurrence: AdminOccurrence): string {
  if (!occurrence.updated_at) return 'Atualização não registrada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(occurrence.updated_at));
}
