import type { DemoRecord } from './occurrences';
import { localDateTimeToInstant } from './occurrences';

export type FactTime =
  | { precision: 'EXACT'; instant: string }
  | { precision: 'DAY'; date: string }
  | { precision: 'INTERVAL'; start: string; end: string }
  | { precision: 'MONTH'; month: string };
export type TemporalInclusion = 'CERTAIN' | 'POSSIBLE' | 'OUTSIDE';

/** Bounds are computational only: they never claim a known time for a day/month. */
export function factTimeBounds(
  record: DemoRecord,
): { start: number; end: number; exact: boolean } | null {
  const time =
    record.factTime ??
    (record.occurredAt ? { precision: 'EXACT' as const, instant: record.occurredAt } : null);
  if (!time) return null;
  try {
    if (time.precision === 'EXACT') {
      const instant = Date.parse(time.instant);
      return Number.isFinite(instant) ? { start: instant, end: instant, exact: true } : null;
    }
    if (time.precision === 'INTERVAL') {
      const start = Date.parse(time.start),
        end = Date.parse(time.end);
      return Number.isFinite(start) && Number.isFinite(end) && start < end
        ? { start, end, exact: false }
        : null;
    }
    const date = time.precision === 'DAY' ? time.date : `${time.month}-01`;
    const start = localDateTimeToInstant(`${date}T00:00`).getTime();
    const calendar = new Date(`${date}T12:00:00Z`);
    if (time.precision === 'DAY') calendar.setUTCDate(calendar.getUTCDate() + 1);
    else calendar.setUTCMonth(calendar.getUTCMonth() + 1);
    const end = localDateTimeToInstant(`${calendar.toISOString().slice(0, 10)}T00:00`).getTime();
    return { start, end, exact: false };
  } catch {
    return null;
  }
}

export function temporalInclusion(
  record: DemoRecord,
  range: { start?: Date; end?: Date },
): TemporalInclusion {
  const bounds = factTimeBounds(record);
  if (!bounds) return 'OUTSIDE';
  const start = range.start?.getTime() ?? -Infinity;
  const end = range.end?.getTime() ?? Infinity;
  if (bounds.exact) return bounds.start >= start && bounds.start < end ? 'CERTAIN' : 'OUTSIDE';
  if (bounds.end <= start || bounds.start >= end) return 'OUTSIDE';
  return bounds.start >= start && bounds.end <= end ? 'CERTAIN' : 'POSSIBLE';
}

export function formatFactTime(record: DemoRecord): string {
  const time =
    record.factTime ??
    (record.occurredAt ? { precision: 'EXACT' as const, instant: record.occurredAt } : null);
  if (!time || !factTimeBounds(record)) return 'Data do fato não informada';
  const format = (value: string, timeStyle?: 'short') =>
    new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle,
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(value));
  if (time.precision === 'EXACT') return `${format(time.instant, 'short')} (horário de Brasília)`;
  if (time.precision === 'DAY')
    return `${time.date.split('-').reverse().join('/')} (hora não informada)`;
  if (time.precision === 'MONTH')
    return `${time.month.slice(5)}/${time.month.slice(0, 4)} (dia e hora não informados)`;
  return `Entre ${format(time.start, 'short')} e ${format(time.end, 'short')} (intervalo aproximado; fim exclusivo)`;
}

export type Situation = 'ONGOING' | 'CLOSED' | 'UNKNOWN';
export interface SituationTransition {
  situation: Situation;
  at: string;
  reason: string;
}

/** LOCAL SYNTHETIC hours only. No operational validity has been approved. */
export const SYNTHETIC_VALIDITY_HOURS: Readonly<Record<string, number>> = {
  INTERDICAO: 4,
  ALAGAMENTO: 12,
};

export function situationLabel(situation?: Situation): string {
  return situation === 'ONGOING'
    ? 'Em andamento'
    : situation === 'CLOSED'
      ? 'Encerrada'
      : 'Desconhecida';
}

export function resolveSituation<T extends DemoRecord>(
  record: T,
  reference: Date,
  validityHours: Readonly<Record<string, number>> = SYNTHETIC_VALIDITY_HOURS,
): T {
  if (record.situation !== 'ONGOING')
    return { ...record, situation: record.situation ?? 'UNKNOWN' };
  const checked = Date.parse(record.lastCheckedAt ?? '');
  const hours = validityHours[record.occurrenceType ?? ''];
  const expires = checked + hours! * 3_600_000;
  if (
    Number.isFinite(checked) &&
    Number.isFinite(hours) &&
    hours! > 0 &&
    checked <= reference.getTime() &&
    reference.getTime() < expires
  )
    return record;
  const at = Number.isFinite(expires) ? new Date(expires).toISOString() : reference.toISOString();
  return {
    ...record,
    situation: 'UNKNOWN',
    situationHistory: [
      ...(record.situationHistory ?? []),
      {
        situation: 'UNKNOWN',
        at,
        reason: Number.isFinite(expires)
          ? 'Confirmação fictícia expirada; não comprova encerramento.'
          : 'Informação insuficiente para comprovar andamento.',
      },
    ],
  };
}
