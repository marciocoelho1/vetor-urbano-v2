import type { Feature, Polygon } from 'geojson';
import type { RiskAreaCode, RiskAreaDetails } from '../domain/risk-areas';

/** Separate authored fixtures. Never written into, or inferred from, the attributed layer. */
export const SYNTHETIC_RISK_AREAS: (Feature<
  Polygon,
  { n: string; f: RiskAreaCode; demoDetails: RiskAreaDetails }
> & { id: number })[] = [
  {
    type: 'Feature',
    id: -1,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-43.203, -22.905],
          [-43.197, -22.905],
          [-43.197, -22.901],
          [-43.203, -22.901],
          [-43.203, -22.905],
        ],
      ],
    },
    properties: {
      n: 'Exemplo fictício de área disputada',
      f: 'DEMO_DISPUTED',
      demoDetails: {
        name: 'Exemplo fictício de área disputada',
        group: 'Disputado',
        sourceName: 'Fonte fictícia — Demonstração local',
        synthetic: true,
        referenceTime: { precision: 'DAY', date: '2026-10-01' },
        version: 'DEMO v2',
        evidence:
          'Referência fictícia DEMO:DISPUTA:02 descreve explicitamente disputa entre grupos fictícios. Não representa o local real.',
        revisions: [
          {
            version: 'DEMO v1',
            group: 'Não determinado',
            referenceTime: { precision: 'DAY', date: '2026-09-01' },
            note: 'Informação sintética insuficiente sobre grupo.',
          },
          {
            version: 'DEMO v2',
            group: 'Disputado',
            referenceTime: { precision: 'DAY', date: '2026-10-01' },
            note: 'Evidência fictícia explícita de disputa: DEMO:DISPUTA:02.',
          },
        ],
      },
    },
  },
  {
    type: 'Feature',
    id: -2,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-43.193, -22.914],
          [-43.187, -22.914],
          [-43.187, -22.91],
          [-43.193, -22.91],
          [-43.193, -22.914],
        ],
      ],
    },
    properties: {
      n: 'Exemplo fictício sem grupo determinado',
      f: 'DEMO_UNKNOWN',
      demoDetails: {
        name: 'Exemplo fictício sem grupo determinado',
        group: 'Não determinado',
        sourceName: 'Fonte fictícia — Demonstração local',
        synthetic: true,
        version: 'DEMO v1',
        revisions: [
          {
            version: 'DEMO v1',
            group: 'Não determinado',
            note: 'Divergência fictícia entre referências: informação insuficiente; segue para revisão, sem evidência de disputa.',
          },
        ],
      },
    },
  },
];
