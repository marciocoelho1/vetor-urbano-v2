import type { DemoRecord } from './occurrences';
import { factTimeBounds, type FactTime } from './temporal';

export type RiskAreaCode =
  'CV' | 'TCP' | 'ADA' | 'MIL' | 'LJ' | 'MNI' | 'NEU' | 'DEMO_DISPUTED' | 'DEMO_UNKNOWN';
export interface RiskAreaRevision {
  version: string;
  group: string;
  referenceTime?: FactTime;
  note: string;
}
export interface RiskAreaDetails {
  name: string;
  group: string;
  sourceName: string;
  sourceUrl?: string;
  referenceTime?: FactTime;
  checkedAt?: string;
  registeredAt?: string;
  presenceBeganAt?: FactTime;
  version: string;
  evidence?: string;
  synthetic: boolean;
  revisions: RiskAreaRevision[];
}
export const RISK_AREA_SOURCE_URL = 'https://dadosderiscos.com.br/mapa-rj-risco-faccoes.html';
const GROUP_LABELS: Partial<Record<RiskAreaCode, string>> = {
  CV: 'Comando Vermelho (CV)',
  TCP: 'Terceiro Comando Puro (TCP)',
  ADA: 'Amigos dos Amigos (ADA)',
  MIL: 'Milícia',
  LJ: 'Liga da Justiça (CL220)',
  MNI: 'Milícia de Nova Iguaçu',
  NEU: 'Área classificada como neutra pela fonte',
};

/** Existing properties retain their source meaning. Layer reference is not individual verification. */
export function riskAreaDetails(properties: {
  n: string;
  f: RiskAreaCode;
  demoDetails?: RiskAreaDetails;
}): RiskAreaDetails {
  if (properties.demoDetails) {
    const details = properties.demoDetails;
    return details.group === 'Disputado' && !details.evidence?.trim()
      ? { ...details, group: 'Não determinado' }
      : details;
  }
  return {
    name: properties.n,
    group: GROUP_LABELS[properties.f] ?? 'Indisponível',
    sourceName: 'Dados de Riscos',
    sourceUrl: RISK_AREA_SOURCE_URL,
    referenceTime: { precision: 'MONTH', month: '2026-07' },
    version: 'Cópia local original; versão da fonte indisponível',
    synthetic: false,
    revisions: [],
  };
}

export function riskAreaTemporalWarning(
  area: RiskAreaDetails,
  range: { start?: Date; end?: Date } | null,
  facts: DemoRecord[],
): string {
  if (!area.referenceTime)
    return 'Referência temporal indisponível; não é possível estabelecer compatibilidade com os fatos.';
  const reference = factTimeBounds({
    id: 'reference-only',
    kind: 'poi',
    coordinates: [0, 0],
    factTime: area.referenceTime,
  });
  if (!reference)
    return 'Referência temporal indisponível; não é possível estabelecer compatibilidade com os fatos.';
  const earlier =
    (range?.start && range.start.getTime() < reference.start) ||
    facts.some((fact) => {
      const bounds = factTimeBounds(fact);
      return bounds && bounds.start < reference.start;
    });
  return earlier
    ? 'Referência da camada posterior ao período ou a fatos da consulta. Não presume domínio histórico a partir da camada atual.'
    : '';
}
