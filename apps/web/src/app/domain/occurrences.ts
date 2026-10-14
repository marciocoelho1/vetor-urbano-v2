export type DatePreset = '1w' | '1m' | '3m' | '6m' | '1y';
export type RecordKind = 'occurrence' | 'poi';
export type OperationalStatus = 'ACTIVE' | 'MONITORING' | 'RESOLVED' | 'EXPIRED';
export type Coordinates = [longitude: number, latitude: number];

export interface DemoRecord {
  id: string;
  kind: RecordKind;
  name?: string;
  description?: string;
  location?: string;
  category?: string;
  group?: string;
  crime?: string;
  poiType?: string;
  typeLabel?: string;
  exclusive?: boolean;
  severity?: string;
  occurredAt?: string;
  insertedAt?: string;
  operationalStatus?: OperationalStatus;
  lastCheckedAt?: string;
  expiresAt?: string;
  coordinates: Coordinates;
  sourceId?: string;
  properties?: Record<string, string>;
}

export interface LocalFilters {
  categories?: string[];
  groups?: string[];
  crimes?: string[];
  poiTypes?: string[];
  exclusivePois?: boolean;
  operationalStatuses?: OperationalStatus[];
  start?: Date;
  end?: Date;
  timeStart?: string;
  timeEnd?: string;
  center?: Coordinates;
  radiusMeters?: number;
}

export interface SourceMetadata {
  id: string;
  name: string;
  url: string;
  license: string;
  referenceDate: string;
  limitations: string;
}

export interface AggregateStatistic {
  territory: string;
  period: string;
  indicator: string;
  value: number;
  unit: string;
  sourceId: string;
}

export interface ImportedDataset {
  records: DemoRecord[];
  aggregates: AggregateStatistic[];
  source: SourceMetadata;
}

const TIME_ZONE = 'America/Sao_Paulo';
const EARTH_RADIUS_METERS = 6_371_008.8;
export const MINIMUM_RADIUS_METERS = 100;
export const INITIAL_RADIUS_METERS = 1000;
export const MAXIMUM_RADIUS_METERS = 25_000;
export const RADIUS_STEP_METERS = 100;

function zonedParts(date: Date, timeZone = TIME_ZONE): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
}

function localPartsToInstant(parts: Record<string, number>, timeZone = TIME_ZONE): Date {
  const desired = Date.UTC(
    parts['year']!,
    parts['month']! - 1,
    parts['day']!,
    parts['hour'] ?? 0,
    parts['minute'] ?? 0,
    parts['second'] ?? 0,
  );
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(
      actual['year']!,
      actual['month']! - 1,
      actual['day']!,
      actual['hour']!,
      actual['minute']!,
      actual['second']!,
    );
    const correction = desired - represented;
    if (correction === 0) break;
    guess += correction;
  }
  return new Date(guess);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calendarRange(preset: DatePreset, reference: Date): { start: Date; end: Date } {
  const local = zonedParts(reference);
  const end = new Date(reference);
  let year = local['year']!;
  let month = local['month']!;
  let day = local['day']!;

  if (preset === '1w') {
    const prior = new Date(Date.UTC(year, month - 1, day - 7));
    year = prior.getUTCFullYear();
    month = prior.getUTCMonth() + 1;
    day = prior.getUTCDate();
  } else {
    const monthCounts: Record<Exclude<DatePreset, '1w'>, number> = {
      '1m': 1,
      '3m': 3,
      '6m': 6,
      '1y': 12,
    };
    const totalMonths = year * 12 + month - 1 - monthCounts[preset];
    year = Math.floor(totalMonths / 12);
    month = (totalMonths % 12) + 1;
    day = Math.min(day, daysInMonth(year, month));
  }

  return {
    start: localPartsToInstant({ ...local, year, month, day }),
    end,
  };
}

export function localDateTimeToInstant(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error('Informe data e hora no formato esperado.');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText ?? 0),
  };
  const normalized = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() + 1 !== parts.month ||
    normalized.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    throw new Error('Data e hora inválidas.');
  }
  return localPartsToInstant(parts);
}

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  const [longitudeA, latitudeA] = from;
  const [longitudeB, latitudeB] = to;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function timeInRange(instant: string, start?: string, end?: string): boolean {
  if (!start && !end) return true;
  const parts = zonedParts(new Date(instant));
  const time = `${String(parts['hour']).padStart(2, '0')}:${String(parts['minute']).padStart(2, '0')}`;
  if (start && end) {
    return start <= end ? time >= start && time <= end : time >= start || time <= end;
  }
  return start ? time >= start : time <= end!;
}

export function filterRecords<T extends DemoRecord>(records: T[], filters: LocalFilters): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;

    if (record.kind === 'poi') {
      const collective =
        record.exclusive !== true && filters.poiTypes?.includes(record.poiType ?? '') === true;
      const exclusive = record.exclusive === true && filters.exclusivePois === true;
      if (!collective && !exclusive) return false;
    } else {
      const categoryMatch = filters.categories?.includes(record.category ?? '') === true;
      const groupSelected = filters.groups?.includes(record.group ?? '') === true;
      const crimeRefinesGroup =
        groupSelected &&
        record.group === 'CRIMES' &&
        (filters.crimes?.length ?? 0) > 0 &&
        !filters.crimes?.includes(record.crime ?? '');
      const groupMatch = groupSelected && !crimeRefinesGroup;
      if (!categoryMatch && !groupMatch) return false;

      if (filters.operationalStatuses?.length) {
        if (!filters.operationalStatuses.includes(record.operationalStatus ?? 'EXPIRED'))
          return false;
      }
      if (
        filters.start &&
        record.occurredAt &&
        Date.parse(record.occurredAt) < filters.start.getTime()
      )
        return false;
      if (
        filters.end &&
        record.occurredAt &&
        Date.parse(record.occurredAt) >= filters.end.getTime()
      )
        return false;
      if (
        record.occurredAt &&
        !timeInRange(record.occurredAt, filters.timeStart, filters.timeEnd)
      ) {
        return false;
      }
    }

    if (filters.center && filters.radiusMeters !== undefined && filters.radiusMeters > 0) {
      if (distanceMeters(filters.center, record.coordinates) > filters.radiusMeters) return false;
    }

    seen.add(record.id);
    return true;
  });
}
