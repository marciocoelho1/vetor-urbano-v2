export type SourceAccessMethod = 'MANUAL' | 'PUBLIC_PAGE' | 'RSS' | 'PUBLIC_API' | 'OTHER';
export type SourcePillar = 'TRANSITO' | 'SEGURANCA' | 'CONTINGENCIA';

export interface PublicSource {
  name: string;
  url: string | null;
}

export interface ManagedSource extends PublicSource {
  id: string;
  channel: string;
  territories: string[];
  pillars: SourcePillar[];
  accessMethod: SourceAccessMethod;
  accessConfigurationRef: string;
  rating: number;
  ratingJustification: string;
  version: number;
  authorId: string | null;
  createdAt: string;
}

export interface SourceDraft {
  name: string;
  channel: string;
  url: string | null;
  territories: string[];
  pillars: SourcePillar[];
  accessMethod: SourceAccessMethod;
  rating: number;
  ratingJustification: string;
}

export interface SourceHistory {
  sourceId: string;
  versions: ManagedSource[];
}

export class SourceApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const API = 'http://127.0.0.1:8080/api/v1';

export async function fetchPublicSources(signal?: AbortSignal): Promise<PublicSource[]> {
  const response = await fetch(`${API}/sources`, {
    signal,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) throw apiError(response.status, body);
  return body.items as PublicSource[];
}

export async function fetchManagedSources(signal?: AbortSignal): Promise<ManagedSource[]> {
  const response = await fetch(`${API}/admin/sources`, {
    signal,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) throw apiError(response.status, body);
  return body.items as ManagedSource[];
}

export async function fetchSourceHistory(id: string, signal?: AbortSignal): Promise<SourceHistory> {
  const response = await fetch(`${API}/admin/sources/${encodeURIComponent(id)}/versions`, {
    signal,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) throw apiError(response.status, body);
  return body as SourceHistory;
}

export async function createManagedSource(
  draft: SourceDraft,
  csrf: string,
): Promise<ManagedSource> {
  const response = await fetch(`${API}/admin/sources`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: JSON.stringify(draft),
  });
  const body = await response.json();
  if (!response.ok) throw apiError(response.status, body);
  return body as ManagedSource;
}

export async function updateManagedSource(
  id: string,
  draft: SourceDraft,
  expectedVersion: number,
  csrf: string,
): Promise<ManagedSource> {
  const response = await fetch(`${API}/admin/sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
    },
    body: JSON.stringify({ ...draft, expectedVersion }),
  });
  const body = await response.json();
  if (!response.ok) throw apiError(response.status, body);
  return body as ManagedSource;
}

function apiError(status: number, body: { code?: string; message?: string }): SourceApiError {
  if (status === 401) window.dispatchEvent(new Event('vu-session-invalid'));
  const message =
    status >= 500
      ? 'A API ou o banco de fontes está indisponível. Tente novamente.'
      : body.message || 'A API recusou a operação de fontes.';
  return new SourceApiError(status, body.code || 'SOURCE_REQUEST_FAILED', message);
}
