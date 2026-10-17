import type { DemoRecord, LocalFilters } from './occurrences';
import { summarizeReport } from './report-summary';
import { factTimeBounds, temporalInclusion } from './temporal';

export interface AnalysisSnapshot {
  generatedAt: string;
  filters: LocalFilters;
  items: DemoRecord[];
  counts: { occurrences: number; happenings: number };
}

function comparableFilters(filters: LocalFilters): string {
  const { start, end, municipalities, neighborhoods, bounds, center, radiusMeters, ...rest } =
    filters;
  // These dimensions identify the periods/territories being compared, not different selections.
  void start;
  void end;
  void municipalities;
  void neighborhoods;
  void bounds;
  void center;
  void radiusMeters;
  return JSON.stringify(
    Object.entries(rest)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value]),
  );
}

export function snapshotDuration(snapshot: AnalysisSnapshot): number | null {
  const { start, end } = snapshot.filters;
  if (!start || !end) return null;
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  return Number.isFinite(days) && days > 0 ? days : null;
}

export function snapshotDailyAverage(snapshot: AnalysisSnapshot): number | null {
  const days = snapshotDuration(snapshot);
  if (days === null || snapshot.filters.timeStart || snapshot.filters.timeEnd) return null;
  if (
    !snapshot.items.every(
      (item) =>
        factTimeBounds(item)?.exact && temporalInclusion(item, snapshot.filters) === 'CERTAIN',
    )
  )
    return null;
  return snapshot.counts.occurrences / days;
}

export function compareReports(a: AnalysisSnapshot, b: AnalysisSnapshot) {
  const delta = b.counts.occurrences - a.counts.occurrences;
  const comparable = comparableFilters(a.filters) === comparableFilters(b.filters);
  const summaries = [summarizeReport(a.items, a.filters), summarizeReport(b.items, b.filters)];
  return {
    delta,
    certaintyA: summaries[0]!,
    certaintyB: summaries[1]!,
    percent: a.counts.occurrences > 0 && comparable ? (100 * delta) / a.counts.occurrences : null,
    tables: summaries[0]!.tables.map((table, index) => {
      const rowsA = new Map(table.rows.map((row) => [row.label, row.count]));
      const rowsB = new Map(summaries[1]!.tables[index]!.rows.map((row) => [row.label, row.count]));
      return {
        title: table.title,
        rows: [...new Set([...rowsA.keys(), ...rowsB.keys()])]
          .sort((x, y) => x.localeCompare(y, 'pt-BR'))
          .map((label) => ({
            label,
            a: rowsA.get(label) ?? 0,
            b: rowsB.get(label) ?? 0,
            delta: (rowsB.get(label) ?? 0) - (rowsA.get(label) ?? 0),
          })),
      };
    }),
  };
}
