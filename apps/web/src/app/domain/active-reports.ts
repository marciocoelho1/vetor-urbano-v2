import { distanceMeters, isMappedRecord, type Coordinates, type DemoRecord } from './occurrences';
import { factTimeBounds, resolveSituation, temporalInclusion, type Situation } from './temporal';

export const INFORMES_INITIAL_RADIUS_METERS = 5000;
export const INFORMES_MAXIMUM_RADIUS_METERS = 5000;
export const INFORMES_MINIMUM_RADIUS_METERS = 100;
export const INFORMES_RADIUS_STEP_METERS = 100;

export interface ActiveReportItem<T extends DemoRecord = DemoRecord> {
  record: T;
  distanceMeters: number;
  distanceLabel: string;
  isOngoing: boolean;
  isClosed: boolean;
  isUnknown: boolean;
  isUncertainTime: boolean;
  isUncertainSituation: boolean;
  temporalStatus: 'RECENT' | 'VIGENTE_ANTIGA';
}

export interface ActiveReportsQuery {
  center: Coordinates;
  radiusMeters: number;
  referenceTime?: Date;
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const km = (distanceMeters / 1000).toFixed(1).replace('.', ',');
  return `${km} km`;
}

export function queryActiveReports<T extends DemoRecord>(
  records: T[],
  query: ActiveReportsQuery,
): ActiveReportItem<T>[] {
  const [lng, lat] = query.center;
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return [];
  }

  const radius = Math.min(
    INFORMES_MAXIMUM_RADIUS_METERS,
    Math.max(INFORMES_MINIMUM_RADIUS_METERS, query.radiusMeters),
  );

  const referenceTime = query.referenceTime ?? new Date();
  const twentyFourHoursAgo = new Date(referenceTime.getTime() - 24 * 3600 * 1000);

  const seenIds = new Set<string>();
  const items: ActiveReportItem<T>[] = [];

  for (const record of records) {
    if (record.kind !== 'occurrence') continue;
    if (seenIds.has(record.id)) continue;
    if (!isMappedRecord(record)) continue;

    const distance = distanceMeters(query.center, record.coordinates);
    if (distance > radius) continue;

    const resolved = resolveSituation(record, referenceTime);
    const inclusion = temporalInclusion(resolved, {
      start: twentyFourHoursAgo,
      end: referenceTime,
    });
    const isRecent = inclusion !== 'OUTSIDE';
    const isOngoing = resolved.situation === 'ONGOING';

    if (!isRecent && !isOngoing) continue;

    seenIds.add(record.id);

    const isClosed = resolved.situation === 'CLOSED';
    const isUnknown = resolved.situation === 'UNKNOWN';
    const isUncertainTime =
      Boolean(resolved.factTime && resolved.factTime.precision !== 'EXACT') ||
      inclusion === 'POSSIBLE';
    const isUncertainSituation = isUnknown;
    const temporalStatus: 'RECENT' | 'VIGENTE_ANTIGA' = isRecent ? 'RECENT' : 'VIGENTE_ANTIGA';

    items.push({
      record: resolved,
      distanceMeters: Math.round(distance),
      distanceLabel: formatDistance(distance),
      isOngoing,
      isClosed,
      isUnknown,
      isUncertainTime,
      isUncertainSituation,
      temporalStatus,
    });
  }

  items.sort((left, right) => {
    if (left.isOngoing !== right.isOngoing) {
      return left.isOngoing ? -1 : 1;
    }
    const leftTime = factTimeBounds(left.record)?.start ?? 0;
    const rightTime = factTimeBounds(right.record)?.start ?? 0;
    return rightTime - leftTime;
  });

  return items;
}
