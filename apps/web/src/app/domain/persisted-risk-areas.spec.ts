import { describe, expect, it } from 'vitest';
import {
  persistedRiskAreaFeature,
  territorialInstantLabel,
  type RiskAreaSnapshot,
} from './persisted-risk-areas';

export const snapshot: RiskAreaSnapshot = {
  territoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  version: 2,
  approvedVersion: 2,
  name: 'Área sintética',
  indicatedGroup: null,
  sourceId: 'source-demo',
  sourceName: 'Fonte original sintética',
  sourceUrl: null,
  evidenceReference: 'Divergência a revisar; não comprova disputa',
  referenceDate: null,
  limitations: 'Sem validação operacional',
  recordedAt: '2026-10-18T12:00:00Z',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-43, -23],
        [-43.01, -23],
        [-43.01, -23.01],
        [-43, -23],
      ],
    ],
  },
};

describe('projeção da versão territorial persistida', () => {
  it('distingue disputa com evidência de grupo desconhecido na classificação cartográfica', () => {
    const disputed = persistedRiskAreaFeature(
      {
        ...snapshot,
        indicatedGroup: 'Disputado',
        evidenceReference: 'Evidência específica de disputa',
      },
      2,
    );
    expect(disputed.properties.f).toBe('DEMO_DISPUTED');
    expect(persistedRiskAreaFeature(snapshot, 3).properties.f).toBe('DEMO_UNKNOWN');
    const unsupported = persistedRiskAreaFeature(
      { ...snapshot, indicatedGroup: 'Disputado', evidenceReference: null },
      4,
    );
    expect(unsupported.properties.f).toBe('DEMO_UNKNOWN');
    expect(unsupported.properties.demoDetails.group).toBe('Não determinado');
  });
  it('apresenta o registro técnico em America/Sao_Paulo sem alterar o instante armazenado', () => {
    expect(territorialInstantLabel(snapshot.recordedAt)).toBe(
      '18/10/2026, 09:00:00 (America/Sao_Paulo)',
    );
    expect(snapshot.recordedAt).toBe('2026-10-18T12:00:00Z');
  });
  it('preserva identidade/procedência e não transforma registro técnico em referência ou divergência em Disputado', () => {
    const feature = persistedRiskAreaFeature(snapshot, 1);
    expect(feature.geometry).toEqual(snapshot.geometry);
    expect(feature.properties.demoDetails).toMatchObject({
      territoryId: snapshot.territoryId,
      version: '2',
      group: 'Não determinado',
      registeredAt: '2026-10-18T12:00:00Z',
      sourceName: 'Fonte original sintética',
      limitations: 'Sem validação operacional',
      synthetic: false,
    });
    expect(feature.properties.demoDetails?.referenceTime).toBeUndefined();
    expect(feature.properties.demoDetails?.presenceBeganAt).toBeUndefined();
  });
});
