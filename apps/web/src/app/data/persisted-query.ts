import type { Coordinates, DemoRecord, LocalFilters } from '../domain/occurrences';
import type { Situation } from '../domain/temporal';
import { OCCURRENCE_CATALOGUE } from '../domain/catalogue';

export interface PersistedOccurrence {
  id: string;
  happeningId: string;
  title: string;
  description: string;
  category: string;
  type: string;
  subtype: string;
  situation: Situation;
  effectiveSituation?: Situation;
  verification?: {
    confirmedAt: string;
    expiresAt: string | null;
    effectVersion: number;
    verificationVersion: number;
    appliesToCurrentVersion: boolean;
  } | null;
  reliability: number;
  municipality: string;
  neighborhood: string;
  locationPrecision: 'POINT' | 'TERRITORY';
  coordinates: Coordinates | null;
  temporalMatch: 'CERTAIN' | 'POSSIBLE' | 'OUTSIDE';
  temporal: {
    occurredAt: string | null;
    occurredFrom: string | null;
    occurredUntil: string | null;
  };
  clippings: {
    id: string;
    title: string;
    source: { id: string; name: string };
    sourcePublishedAt: string;
    collectedAt: string;
    reference?: string | null;
  }[];
}

export interface PersistedQueryResponse {
  generatedAt: string;
  counts: {
    occurrences: number;
    happenings: number;
    mappedOccurrences: number;
    listOnlyOccurrences: number;
    temporallyCertain: number;
    temporallyPossible: number;
  };
  items: PersistedOccurrence[];
  relatedItems: PersistedOccurrence[];
}

export function isLocalPersistedQuery(): boolean {
  return (
    typeof location !== 'undefined' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname) &&
    new URLSearchParams(location.search).get('consulta') === 'api'
  );
}

function subtypeId(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replaceAll(' ', '_');
}

export function persistedQueryParameters(filters: LocalFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.start && filters.end) {
    params.set('periodStart', filters.start.toISOString());
    params.set('periodEnd', filters.end.toISOString());
  }
  const repeated: [string, string[] | undefined][] = [
    ['category', filters.categories],
    ['type', filters.types],
    ['subtype', filters.subtypes?.map(subtypeId)],
    ['municipality', filters.municipalities],
    ['neighborhood', filters.neighborhoods],
    ['sourceId', filters.sources],
    ['situation', filters.situations],
  ];
  for (const [key, values] of repeated) for (const value of values ?? []) params.append(key, value);
  if (filters.categories?.length === 0) params.set('categorySelection', 'NONE');
  if (filters.textQuery?.trim()) params.set('text', filters.textQuery.trim());
  if (filters.minScore !== undefined) params.set('minReliability', String(filters.minScore));
  if (filters.maxScore !== undefined) params.set('maxReliability', String(filters.maxScore));
  if (filters.center && filters.radiusMeters !== undefined) {
    params.set('longitude', String(filters.center[0]));
    params.set('latitude', String(filters.center[1]));
    params.set('radiusMeters', String(filters.radiusMeters));
  }
  if (filters.timeStart) params.set('timeStart', filters.timeStart);
  if (filters.timeEnd) params.set('timeEnd', filters.timeEnd);
  if (filters.bounds) {
    ['west', 'south', 'east', 'north'].forEach((key, index) =>
      params.set(key, String(filters.bounds![index])),
    );
  }
  return params;
}

export function persistedRecord(item: PersistedOccurrence): DemoRecord & {
  kind: 'occurrence';
  name: string;
  description: string;
  location: string;
  insertedAt: string;
} {
  const first = item.clippings[0];
  const type = OCCURRENCE_CATALOGUE.find((entry) => entry.id === item.type);
  const subtype = type?.subtypes.find((label) => subtypeId(label) === item.subtype);
  return {
    id: item.id,
    kind: 'occurrence',
    name: item.title,
    description: item.description,
    happeningId: item.happeningId,
    category: item.category,
    occurrenceType: item.type,
    typeLabel: type?.label ?? item.type,
    subtype: item.subtype === 'NAO_INFORMADO' ? undefined : (subtype ?? item.subtype),
    situation: item.effectiveSituation ?? item.situation,
    lastCheckedAt: item.verification?.appliesToCurrentVersion
      ? item.verification.confirmedAt
      : undefined,
    reliabilityScore: item.reliability,
    municipality: item.municipality,
    neighborhood: item.neighborhood,
    location: `${item.neighborhood}, ${item.municipality}`,
    locationPrecision: item.locationPrecision,
    coordinates: item.coordinates,
    publicationStatus: 'PUBLISHED',
    occurredAt: item.temporal.occurredAt ?? undefined,
    factTime: item.temporal.occurredAt
      ? { precision: 'EXACT', instant: item.temporal.occurredAt }
      : {
          precision: 'INTERVAL',
          start: item.temporal.occurredFrom!,
          end: item.temporal.occurredUntil!,
        },
    sourceId: first?.source.id,
    sourcePublishedAt: first?.sourcePublishedAt,
    collectedAt: first?.collectedAt,
    insertedAt: first?.collectedAt ?? '',
    references: item.clippings.map((clip) => ({
      id: clip.id,
      title: clip.title,
      sourceName: clip.source.name,
      identifier: clip.reference || clip.id,
      ...(/^https?:\/\//i.test(clip.reference || '') ? { url: clip.reference! } : {}),
    })),
  };
}

export async function fetchPersistedQuery(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<PersistedQueryResponse> {
  return fetchQueryResponse('occurrences', params, signal);
}

export async function fetchPersistedHistoryQuery(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<PersistedQueryResponse> {
  return fetchQueryResponse('history/occurrences', params, signal);
}

export async function fetchPersistedReportQuery(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<PersistedQueryResponse> {
  return fetchQueryResponse('reports/occurrences', params, signal);
}

export async function fetchPersistedReportExport(
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<PersistedQueryResponse> {
  return fetchQueryResponse('reports/occurrences/export', params, signal);
}

async function fetchQueryResponse(
  resource: string,
  params: URLSearchParams,
  signal: AbortSignal,
): Promise<PersistedQueryResponse> {
  const response = await fetch(`http://127.0.0.1:8080/api/v1/${resource}?${params}`, {
    signal,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new Event('vu-session-invalid'));
      throw new Error('Sessão ausente ou expirada. Entre novamente.');
    }
    throw new Error(
      response.status === 400
        ? 'A API recusou os filtros. Revise os valores da consulta.'
        : 'A API local ou o banco está indisponível. Tente carregar novamente.',
    );
  }
  return response.json() as Promise<PersistedQueryResponse>;
}

export async function recordPersistedPdfExport(
  filters: LocalFilters,
  metadata: {
    generatedAt: string;
    counts: PersistedQueryResponse['counts'];
    outcome: 'SUCCEEDED' | 'FAILED';
  },
  csrf: string,
): Promise<void> {
  const response = await fetch(
    `http://127.0.0.1:8080/api/v1/reports/exports/pdf?${persistedQueryParameters(filters)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(metadata),
    },
  );
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new Event('vu-session-invalid'));
    throw new Error('Sessão ausente, expirada ou sem confirmação. Entre novamente.');
  }
  if (!response.ok)
    throw new Error(
      'Não foi possível registrar a exportação no servidor. Nenhum arquivo foi baixado. Tente novamente.',
    );
}
