import { describe, expect, it } from 'vitest';
import { SYNTHETIC_RISK_AREAS } from '../data/demo-risk-areas';
import { riskAreaDetails, riskAreaTemporalWarning } from './risk-areas';

describe('Áreas de Risco com procedência e temporalidade', () => {
  it('conserva classificação neutra da fonte e não inventa verificação individual ou início', () => {
    const area = riskAreaDetails({ n: 'Área de exemplo', f: 'NEU' });
    expect(area.group).toBe('Área classificada como neutra pela fonte');
    expect(area.sourceName).toBe('Dados de Riscos');
    expect(area.referenceTime).toEqual({ precision: 'MONTH', month: '2026-07' });
    expect(area.checkedAt).toBeUndefined();
    expect(area.presenceBeganAt).toBeUndefined();
    expect(
      riskAreaTemporalWarning(
        area,
        { start: new Date('2026-06-01T03:00:00Z'), end: new Date('2026-07-01T03:00:00Z') },
        [],
      ),
    ).toContain('Não presume domínio histórico');
    expect(riskAreaTemporalWarning(area, { start: new Date('2026-10-01T03:00:00Z') }, [])).toBe('');
  });
  it('mostra Disputado somente com evidência e mantém divergência inconclusiva como Não determinado', () => {
    const disputed = riskAreaDetails(SYNTHETIC_RISK_AREAS[0]!.properties);
    const unknown = riskAreaDetails(SYNTHETIC_RISK_AREAS[1]!.properties);
    expect(disputed.group).toBe('Disputado');
    expect(disputed.evidence).toContain('disputa');
    expect(disputed.revisions).toHaveLength(2);
    expect(unknown.group).toBe('Não determinado');
    expect(unknown.revisions[0]?.note).toContain('Divergência');
    expect(
      riskAreaDetails({
        n: 'Exemplo',
        f: 'DEMO_DISPUTED',
        demoDetails: { ...disputed, evidence: undefined },
      }).group,
    ).toBe('Não determinado');
  });
});
