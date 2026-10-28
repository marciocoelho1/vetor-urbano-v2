import { persistedRecord, type PersistedOccurrence } from './persisted-query';
import { distanceMeters, type Coordinates } from '../domain/occurrences';
import { formatDistance } from '../domain/active-reports';
import type { Situation } from '../domain/temporal';

export type Validity =
  | 'CONFIRMED'
  | 'NOT_CONFIRMED'
  | 'MISSING_CONFIGURATION'
  | 'MISSING_EVIDENCE'
  | 'NO_APPROVED_EXTENSION'
  | 'EXPIRED'
  | 'NOT_APPLICABLE';
export interface ActiveReportResponse {
  evaluatedAt: string;
  limitation: string;
  items: {
    occurrence: PersistedOccurrence;
    effectiveSituation: Situation;
    validity: Validity;
    verification?: {
      confirmedAt: string;
      expiresAt: string | null;
      effectVersion: number;
      verificationVersion: number;
      appliesToCurrentVersion: boolean;
    } | null;
  }[];
}
export function activeReportRecords(response: ActiveReportResponse, center: Coordinates) {
  // Server membership/precision/temporalMatch are authoritative. Distance here is display only.
  return response.items.map((item) => {
    const record = persistedRecord(item.occurrence);
    const distance = record.coordinates ? distanceMeters(center, record.coordinates) : null;
    const situation = item.effectiveSituation;
    return {
      ...record,
      lastCheckedAt: item.verification?.appliesToCurrentVersion
        ? item.verification.confirmedAt
        : undefined,
      situation,
      storedSituation: item.occurrence.situation,
      validityLabel: {
        CONFIRMED: 'Vigência validada pelo servidor',
        NOT_CONFIRMED: 'Vigência não confirmada',
        MISSING_CONFIGURATION: 'Sem configuração de vigência',
        MISSING_EVIDENCE: 'Sem evidência de confirmação',
        NO_APPROVED_EXTENSION: 'Sem extensão automática aprovada para este tipo',
        EXPIRED: 'Confirmação expirada; não significa encerramento',
        NOT_APPLICABLE: 'Vigência não se aplica à situação armazenada',
      }[item.validity],
      distanceMeters: distance ?? 0,
      distanceLabel:
        distance === null ? 'Distância indisponível' : `${formatDistance(distance)} (aproximada)`,
      isOngoing: situation === 'ONGOING' && item.validity === 'CONFIRMED',
      isClosed: situation === 'CLOSED',
      isUnknown: situation === 'UNKNOWN',
      isUncertainTime: item.occurrence.temporalMatch === 'POSSIBLE',
      isUncertainSituation: situation === 'UNKNOWN',
      temporalStatus:
        item.occurrence.temporalMatch === 'OUTSIDE'
          ? ('VIGENTE_ANTIGA' as const)
          : ('RECENT' as const),
    };
  });
}
export async function fetchActiveReports(
  center: Coordinates,
  radiusMeters: number,
  signal: AbortSignal,
  filters: { pillar?: string; type?: string; situation?: string } = {},
): Promise<ActiveReportResponse> {
  const params = new URLSearchParams({
    longitude: String(center[0]),
    latitude: String(center[1]),
    radiusMeters: String(radiusMeters),
  });
  // UXH-13: os filtros próprios de Informes viajam na requisição; ausentes não poluem a URL.
  if (filters.pillar) params.set('pillar', filters.pillar);
  if (filters.type) params.set('type', filters.type);
  if (filters.situation) params.set('situation', filters.situation);
  const response = await fetch(`http://127.0.0.1:8080/api/v1/active-reports?${params}`, {
    signal,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new Event('vu-session-invalid'));
    throw new Error('Sessão ausente ou expirada. Entre novamente.');
  }
  if (!response.ok)
    throw new Error(
      response.status === 400
        ? 'Revise o centro WGS84 e o raio de 1 a 5000 metros.'
        : 'Consulta indisponível. Esta falha não significa ausência de ocorrências.',
    );
  return response.json() as Promise<ActiveReportResponse>;
}
