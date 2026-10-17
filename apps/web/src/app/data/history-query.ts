import type { DemoRecord } from '../domain/occurrences';
import { localDateTimeToInstant, normalizeSearch } from '../domain/occurrences';
import { factTimeBounds, temporalInclusion } from '../domain/temporal';
import type { Situation } from '../domain/temporal';

export const HISTORY_PAGE_SIZE = 25;

export function historySourcesFromRecords(
  records: readonly {
    clippings: readonly { source: { id: string; name: string } }[];
  }[],
): { id: string; name: string }[] {
  const sources = new Map<string, { id: string; name: string }>();
  for (const record of records) {
    for (const clipping of record.clippings) sources.set(clipping.source.id, clipping.source);
  }
  return [...sources.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name, 'pt-BR') || left.id.localeCompare(right.id),
  );
}

export interface HistoryFilters {
  text: string;
  periodStart: string;
  periodEnd: string;
  categories?: string[];
  types: string[];
  subtypes: string[];
  municipality: string;
  neighborhood: string;
  sourceId: string;
  minReliability: number | null;
  maxReliability: number | null;
  situation: Situation | '';
}

export function historyQueryParameters(filters: HistoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  const text = filters.text.trim();
  if (text) params.set('text', text);

  const start = filters.periodStart.trim();
  const end = filters.periodEnd.trim();
  if (Boolean(start) !== Boolean(end)) {
    throw new RangeError('Informe início e fim do período juntos.');
  }
  if (start && end) {
    const periodStart = localDateTimeToInstant(start);
    const periodEnd = localDateTimeToInstant(end);
    if (periodStart >= periodEnd) {
      throw new RangeError('O início do período precisa anteceder o fim exclusivo.');
    }
    params.set('periodStart', periodStart.toISOString());
    params.set('periodEnd', periodEnd.toISOString());
  }

  if (filters.categories?.length === 0) params.set('categorySelection', 'NONE');
  else for (const category of filters.categories ?? []) params.append('category', category);
  for (const type of filters.types) params.append('type', type);
  for (const subtype of filters.subtypes) params.append('subtype', subtype);
  if (filters.municipality.trim()) params.set('municipality', filters.municipality.trim());
  if (filters.neighborhood.trim()) params.set('neighborhood', filters.neighborhood.trim());
  if (filters.sourceId) params.set('sourceId', filters.sourceId);
  if (filters.minReliability !== null) {
    params.set('minReliability', String(filters.minReliability));
  }
  if (filters.maxReliability !== null) {
    params.set('maxReliability', String(filters.maxReliability));
  }
  if (filters.situation) params.set('situation', filters.situation);
  return params;
}

export function filterHistoryRecords<T extends DemoRecord>(
  records: readonly T[],
  filters: HistoryFilters,
): T[] {
  const text = normalizeSearch(filters.text);
  const start = filters.periodStart ? localDateTimeToInstant(filters.periodStart) : null;
  const end = filters.periodEnd ? localDateTimeToInstant(filters.periodEnd) : null;
  return records
    .filter((record) => record.kind === 'occurrence')
    .filter((record) => !record.publicationStatus || record.publicationStatus === 'PUBLISHED')
    .filter(
      (record) =>
        !text ||
        normalizeSearch(
          [
            record.id,
            record.name,
            record.description,
            record.location,
            record.municipality,
            record.neighborhood,
            record.sourceId,
            ...(record.references ?? []).flatMap((reference) => [
              reference.id,
              reference.title,
              reference.sourceName,
              reference.identifier,
            ]),
          ]
            .filter(Boolean)
            .join(' '),
        ).includes(text),
    )
    .filter(
      (record) =>
        filters.categories === undefined || filters.categories.includes(record.category ?? ''),
    )
    .filter(
      (record) => filters.types.length === 0 || filters.types.includes(record.occurrenceType ?? ''),
    )
    .filter(
      (record) => filters.subtypes.length === 0 || filters.subtypes.includes(record.subtype ?? ''),
    )
    .filter((record) => !filters.municipality || record.municipality === filters.municipality)
    .filter((record) => !filters.neighborhood || record.neighborhood === filters.neighborhood)
    .filter((record) => !filters.sourceId || record.sourceId === filters.sourceId)
    .filter(
      (record) =>
        filters.minReliability === null ||
        (record.reliabilityScore ?? -1) >= filters.minReliability!,
    )
    .filter(
      (record) =>
        filters.maxReliability === null ||
        (record.reliabilityScore ?? Infinity) <= filters.maxReliability!,
    )
    .filter((record) => !filters.situation || record.situation === filters.situation)
    .filter((record) => !start || !end || temporalInclusion(record, { start, end }) !== 'OUTSIDE');
}

export function orderHistoryRecords<T extends DemoRecord>(records: readonly T[]): T[] {
  return [...records].sort((left, right) => {
    const leftKey = historySortKey(left);
    const rightKey = historySortKey(right);
    if (leftKey !== rightKey) {
      if (leftKey === Number.NEGATIVE_INFINITY) return 1;
      if (rightKey === Number.NEGATIVE_INFINITY) return -1;
      return rightKey - leftKey;
    }
    return left.id === right.id ? 0 : left.id < right.id ? 1 : -1;
  });
}

export function historyPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
}

export function historyPageRecords<T>(records: readonly T[], page: number): T[] {
  const currentPage = Math.max(1, Math.min(Math.floor(page), historyPageCount(records.length)));
  const start = (currentPage - 1) * HISTORY_PAGE_SIZE;
  return records.slice(start, start + HISTORY_PAGE_SIZE);
}

function historySortKey(record: DemoRecord): number {
  const bounds = factTimeBounds(record);
  if (!bounds) return Number.NEGATIVE_INFINITY;
  return bounds.exact ? bounds.start : bounds.end;
}
