import { describe, expect, it } from 'vitest';
import { localDateTimeToInstant } from '../domain/occurrences';
import {
  persistedQueryParameters,
  persistedRecord,
  type PersistedOccurrence,
} from './persisted-query';

describe('consulta persistida', () => {
  it('envia instantes de Brasília, alternativas e subtipo vinculado ao tipo sem recalcular o raio', () => {
    const params = persistedQueryParameters({
      start: localDateTimeToInstant('2026-10-15T05:00'),
      end: localDateTimeToInstant('2026-10-15T10:00'),
      categories: ['TRANSITO', 'CONTINGENCIA'],
      subtypes: ['ACIDENTE:Colisão', 'INCENDIO:Em veículo'],
      center: [-43.1915, -22.9033],
      radiusMeters: 1000,
      sources: ['vu-demo-source-002'],
    });
    expect(params.get('periodStart')).toBe('2026-10-15T08:00:00.000Z');
    expect(params.get('periodEnd')).toBe('2026-10-15T13:00:00.000Z');
    expect(params.getAll('category')).toEqual(['TRANSITO', 'CONTINGENCIA']);
    expect(params.getAll('subtype')).toEqual(['ACIDENTE:COLISAO', 'INCENDIO:EM_VEICULO']);
    expect(params.get('longitude')).toBe('-43.1915');
    expect(params.get('latitude')).toBe('-22.9033');
    expect(params.get('radiusMeters')).toBe('1000');
    expect(params.get('sourceId')).toBe('vu-demo-source-002');
  });

  it('não inventa início para Em andamento e preserva horários e área visível explícita', () => {
    const params = persistedQueryParameters({
      situations: ['ONGOING'],
      timeStart: '22:00',
      timeEnd: '07:00',
      bounds: [-44, -23, -43, -22],
    });
    expect(params.has('periodStart')).toBe(false);
    expect(params.get('situation')).toBe('ONGOING');
    expect(params.get('west')).toBe('-44');
    expect(params.get('north')).toBe('-22');
    expect(params.get('timeEnd')).toBe('07:00');
  });

  it('preserva território sem pin, intervalo incerto, situação e referências sem multiplicar fatos', () => {
    const item: PersistedOccurrence = {
      id: 'synthetic',
      happeningId: 'context',
      title: 'Exemplo',
      description: 'Fictício',
      category: 'SEGURANCA',
      type: 'FURTO',
      subtype: 'NAO_INFORMADO',
      situation: 'ONGOING',
      reliability: 3,
      municipality: 'Rio de Janeiro',
      neighborhood: 'Setor demonstrativo',
      locationPrecision: 'TERRITORY',
      coordinates: null,
      temporalMatch: 'POSSIBLE',
      temporal: {
        occurredAt: null,
        occurredFrom: '2026-10-14T14:00:00Z',
        occurredUntil: '2026-10-15T16:00:00Z',
      },
      clippings: ['a', 'b', 'c'].map((id) => ({
        id,
        title: `Publicação ${id}`,
        source: { id: 'source', name: 'Fonte sintética' },
        sourcePublishedAt: '2026-10-15T12:00:00Z',
        collectedAt: '2026-10-15T12:01:00Z',
      })),
    };
    const record = persistedRecord(item);
    expect(record.coordinates).toBeNull();
    expect(record.occurredAt).toBeUndefined();
    expect(record.factTime).toEqual({
      precision: 'INTERVAL',
      start: item.temporal.occurredFrom,
      end: item.temporal.occurredUntil,
    });
    expect(record.situation).toBe('ONGOING');
    expect(record.references).toHaveLength(3);
    expect(record.id).toBe('synthetic');
    expect(record.happeningId).toBe('context');
  });
});
