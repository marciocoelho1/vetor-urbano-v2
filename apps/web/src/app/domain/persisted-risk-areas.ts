import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { RiskAreaCode, RiskAreaDetails } from './risk-areas';

export function territorialInstantLabel(instant: string): string {
  return `${new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(instant))} (America/Sao_Paulo)`;
}

export interface RiskAreaSnapshot {
  territoryId: string;
  version: number;
  approvedVersion: number | null;
  name: string;
  indicatedGroup: string | null;
  sourceId: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  evidenceReference: string | null;
  referenceDate: string | null;
  limitations: string | null;
  recordedAt: string;
  geometry: Polygon | MultiPolygon;
  actor?: string | null;
  historicalActor?: string | null;
  actorRole?: string;
  justification?: string;
}

/** Only the approved public snapshot enters the map; unknown never means disputed. */
export function persistedRiskAreaFeature(
  area: RiskAreaSnapshot,
  id: number,
): Feature<Polygon | MultiPolygon, { n: string; f: RiskAreaCode; demoDetails: RiskAreaDetails }> & {
  id: number;
} {
  const disputed = area.indicatedGroup?.trim() === 'Disputado';
  const group =
    disputed && !area.evidenceReference?.trim()
      ? 'Não determinado'
      : area.indicatedGroup?.trim() || 'Não determinado';
  const known = ['CV', 'TCP', 'ADA', 'MIL', 'LJ', 'MNI', 'NEU'];
  return {
    type: 'Feature',
    id,
    geometry: area.geometry,
    properties: {
      n: area.name,
      f: (group === 'Disputado'
        ? 'DEMO_DISPUTED'
        : known.includes(group)
          ? group
          : 'DEMO_UNKNOWN') as RiskAreaCode,
      demoDetails: {
        territoryId: area.territoryId,
        name: area.name,
        group,
        sourceName: area.sourceName || 'Indisponível',
        sourceUrl: area.sourceUrl || undefined,
        referenceTime: area.referenceDate
          ? { precision: 'DAY', date: area.referenceDate }
          : undefined,
        registeredAt: area.recordedAt,
        version: String(area.version),
        evidence: area.evidenceReference || undefined,
        limitations: area.limitations || undefined,
        synthetic: false,
        revisions: [],
      },
    },
  };
}
