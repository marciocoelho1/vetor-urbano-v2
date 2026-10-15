import { describe, expect, it } from 'vitest';
import type { Coordinates, DemoRecord } from './occurrences';
import { INFORMES_MAXIMUM_RADIUS_METERS, queryActiveReports } from './active-reports';

describe('active-reports domain', () => {
  const central: Coordinates = [-43.1923, -22.9035];
  const referenceTime = new Date('2026-10-15T15:00:00Z');
  const hoursAgo = (hours: number) =>
    new Date(referenceTime.getTime() - hours * 3_600_000).toISOString();

  // Glória is ~2.5 km from Central do Brasil (< 5 km)
  const gloriaCoords: Coordinates = [-43.1748, -22.9194];
  // Engenho de Dentro is ~11.1 km from Central do Brasil (> 5 km)
  const engenhoCoords: Coordinates = [-43.3, -22.891];

  const baseRecord: DemoRecord = {
    id: 'test-1',
    kind: 'occurrence',
    name: 'Ocorrência de teste',
    coordinates: gloriaCoords,
    locationPrecision: 'POINT',
    situation: 'ONGOING',
    occurredAt: hoursAgo(2),
  };

  it('impõe teto estrito de 5 km ao raio de busca', () => {
    // Record at 6 km should NOT be included even if caller passes 10_000 m
    const farRecord: DemoRecord = {
      ...baseRecord,
      id: 'far-record',
      coordinates: engenhoCoords, // ~11 km away
    };

    const results = queryActiveReports([farRecord], {
      center: central,
      radiusMeters: 10_000, // Should be clamped to 5000 m max
      referenceTime,
    });

    expect(results).toHaveLength(0);
  });

  it('une recentes de 24 horas (inclusive encerradas) e vigentes antigas, sem duplicar', () => {
    const recentClosed: DemoRecord = {
      ...baseRecord,
      id: 'recent-closed',
      situation: 'CLOSED',
      occurredAt: hoursAgo(5),
    };
    const recentOngoing: DemoRecord = {
      ...baseRecord,
      id: 'recent-ongoing',
      situation: 'ONGOING',
      occurredAt: hoursAgo(3),
    };
    const recentUnknown: DemoRecord = {
      ...baseRecord,
      id: 'recent-unknown',
      situation: 'UNKNOWN',
      occurredAt: hoursAgo(10),
    };
    const oldOngoing: DemoRecord = {
      ...baseRecord,
      id: 'old-ongoing',
      situation: 'ONGOING',
      occurredAt: hoursAgo(36), // > 24 hours ago
      lastCheckedAt: hoursAgo(1),
      occurrenceType: 'INTERDICAO', // 4h validity -> still valid
    };
    const oldClosed: DemoRecord = {
      ...baseRecord,
      id: 'old-closed',
      situation: 'CLOSED',
      occurredAt: hoursAgo(36),
    };
    const oldUnknown: DemoRecord = {
      ...baseRecord,
      id: 'old-unknown',
      situation: 'UNKNOWN',
      occurredAt: hoursAgo(40),
    };

    const results = queryActiveReports(
      [recentClosed, recentOngoing, recentUnknown, oldOngoing, oldClosed, oldUnknown],
      {
        center: central,
        radiusMeters: INFORMES_MAXIMUM_RADIUS_METERS,
        referenceTime,
      },
    );

    const ids = results.map((item) => item.record.id);
    expect(ids).toContain('recent-closed');
    expect(ids).toContain('recent-ongoing');
    expect(ids).toContain('recent-unknown');
    expect(ids).toContain('old-ongoing');

    // Old closed and old unknown are strictly excluded
    expect(ids).not.toContain('old-closed');
    expect(ids).not.toContain('old-unknown');

    // Highlights and statuses
    const ongoingItem = results.find((item) => item.record.id === 'old-ongoing');
    expect(ongoingItem?.isOngoing).toBe(true);
    expect(ongoingItem?.temporalStatus).toBe('VIGENTE_ANTIGA');

    const closedItem = results.find((item) => item.record.id === 'recent-closed');
    expect(closedItem?.isClosed).toBe(true);
    expect(closedItem?.temporalStatus).toBe('RECENT');

    // Deduplication check
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('exclui registros fora do raio de proximidade e registros somente territoriais', () => {
    const nearRecord: DemoRecord = {
      ...baseRecord,
      id: 'near-record',
      coordinates: gloriaCoords, // ~2.5 km
    };
    const outsideRecord: DemoRecord = {
      ...baseRecord,
      id: 'outside-record',
      coordinates: engenhoCoords, // ~11 km
    };
    const territoryRecord: DemoRecord = {
      ...baseRecord,
      id: 'territory-record',
      locationPrecision: 'TERRITORY',
      coordinates: gloriaCoords,
    };

    const results = queryActiveReports([nearRecord, outsideRecord, territoryRecord], {
      center: central,
      radiusMeters: 3000,
      referenceTime,
    });

    const ids = results.map((item) => item.record.id);
    expect(ids).toContain('near-record');
    expect(ids).not.toContain('outside-record');
    expect(ids).not.toContain('territory-record');
  });

  it('trata expiração de confirmação como situação desconhecida no recorte temporal compatível', () => {
    // An old record whose confirmation has expired:
    // Should turn into UNKNOWN. Because it is older than 24h, it must be excluded.
    const expiredOldRecord: DemoRecord = {
      ...baseRecord,
      id: 'expired-old',
      situation: 'ONGOING',
      occurrenceType: 'INTERDICAO', // 4h synthetic validity
      occurredAt: hoursAgo(48),
      lastCheckedAt: hoursAgo(10), // Checked 10h ago (> 4h validity) -> expired
    };

    // A recent record whose confirmation has expired:
    // Should turn into UNKNOWN, but remains in the 24h window, so it is included as uncertain situation.
    const expiredRecentRecord: DemoRecord = {
      ...baseRecord,
      id: 'expired-recent',
      situation: 'ONGOING',
      occurrenceType: 'INTERDICAO',
      occurredAt: hoursAgo(12),
      lastCheckedAt: hoursAgo(6), // Checked 6h ago (> 4h) -> expired
    };

    const results = queryActiveReports([expiredOldRecord, expiredRecentRecord], {
      center: central,
      radiusMeters: 5000,
      referenceTime,
    });

    const ids = results.map((item) => item.record.id);
    expect(ids).not.toContain('expired-old');
    expect(ids).toContain('expired-recent');

    const item = results.find((r) => r.record.id === 'expired-recent');
    expect(item?.isOngoing).toBe(false);
    expect(item?.isUnknown).toBe(true);
    expect(item?.isUncertainSituation).toBe(true);
  });
});
