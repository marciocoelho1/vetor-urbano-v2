import type { DemoRecord, LocalFilters } from './occurrences';
import { OCCURRENCE_CATALOGUE } from './catalogue';
import { factTimeBounds, situationLabel, temporalInclusion } from './temporal';

export interface SummaryTable {
  title: string;
  rows: { label: string; count: number }[];
}

const pillars: Record<string, string> = {
  TRANSITO: 'Trânsito',
  SEGURANCA: 'Segurança',
  CONTINGENCIA: 'Contingência',
};

function monthAt(instant: number): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date(instant));
  return `${parts.find((p) => p.type === 'month')!.value}/${parts.find((p) => p.type === 'year')!.value}`;
}

function monthLabel(record: DemoRecord): string {
  const bounds = factTimeBounds(record);
  if (!bounds) return 'Data não informada';
  const start = monthAt(bounds.start);
  return start === monthAt(bounds.exact ? bounds.end : bounds.end - 1)
    ? start
    : 'Intervalo entre meses';
}

export function summarizeReport(records: DemoRecord[], filters: LocalFilters) {
  const items = [...new Map(records.map((item) => [item.id, item])).values()];
  const table = (title: string, labels: (item: DemoRecord) => string[]): SummaryTable => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const label of new Set(labels(item))) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return {
      title,
      rows: [...counts]
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
        .map(([label, count]) => ({ label, count })),
    };
  };
  const certain = items.filter((item) => temporalInclusion(item, filters) === 'CERTAIN').length;
  const possible = items.filter((item) => temporalInclusion(item, filters) === 'POSSIBLE').length;
  return {
    certain,
    possible,
    unknown: items.length - certain - possible,
    tables: [
      table('Pilar', (item) =>
        [item.category, ...(item.additionalClassifications ?? []).map((c) => c.category)].map(
          (category) => pillars[category ?? ''] ?? category ?? 'Pilar não informado',
        ),
      ),
      table('Pilar e tipo', (item) =>
        [
          { category: item.category, occurrenceType: item.occurrenceType },
          ...(item.additionalClassifications ?? []),
        ].map(
          (c) =>
            `${pillars[c.category ?? ''] ?? c.category ?? 'Pilar não informado'} · ${OCCURRENCE_CATALOGUE.find((t) => t.id === c.occurrenceType)?.label ?? c.occurrenceType ?? 'Tipo não informado'}`,
        ),
      ),
      table('Situação', (item) => [situationLabel(item.situation)]),
      table('Tempo do fato', (item) => [monthLabel(item)]),
      table('Município e bairro', (item) => [
        `${item.municipality || 'Município não informado'} · ${item.neighborhood || 'Bairro não informado'}`,
      ]),
      table('Precisão territorial', (item) => [
        item.locationPrecision === 'TERRITORY'
          ? 'Somente território'
          : item.coordinates
            ? 'Ponto informado'
            : 'Precisão não informada',
      ]),
    ],
  };
}
