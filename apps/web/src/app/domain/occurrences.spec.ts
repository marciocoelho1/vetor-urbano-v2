import { describe, expect, it } from 'vitest';
import {
  calendarRange,
  distanceMeters,
  filterRecords,
  localDateTimeToInstant,
  type DemoRecord,
  type SourceMetadata,
} from './occurrences';
import { createRadiusCircle } from '../maps/radius-geometry';
import { parseOpenDataset } from '../data-exchange/source-import';

const source: SourceMetadata = {
  id: 'isp-demo',
  name: 'ISP-RJ — arquivo demonstrativo',
  url: 'https://example.invalid/dataset.csv',
  license: 'Licença a confirmar',
  referenceDate: '2026-09',
  limitations: 'Fixture exclusivamente sintética para teste.',
};

const records: DemoRecord[] = [
  {
    id: 'security-theft',
    kind: 'occurrence',
    category: 'SEGURANCA',
    group: 'CRIMES',
    crime: 'FURTO',
    occurredAt: '2026-10-10T14:00:00.000Z',
    operationalStatus: 'ACTIVE',
    coordinates: [-43.1817, -22.9264],
  },
  {
    id: 'traffic-old',
    kind: 'occurrence',
    category: 'TRANSITO',
    group: 'ALERTA',
    occurredAt: '2026-09-01T14:00:00.000Z',
    operationalStatus: 'EXPIRED',
    coordinates: [-43.19, -22.91],
  },
  {
    id: 'collective-poi',
    kind: 'poi',
    poiType: 'UPA',
    exclusive: false,
    coordinates: [-43.18, -22.92],
  },
  {
    id: 'client-poi',
    kind: 'poi',
    poiType: 'UPA',
    exclusive: true,
    coordinates: [-43.18, -22.92],
  },
];

describe('frontend domain rules', () => {
  it('combina tipos por OU e pilar por E, aceitando característica adicional uma única vez', () => {
    const theft = {
      id: 'furto',
      kind: 'occurrence' as const,
      category: 'SEGURANCA',
      occurrenceType: 'FURTO',
      coordinates: [-43.2, -22.9] as [number, number],
    };
    const robbery = { ...theft, id: 'roubo', occurrenceType: 'ROUBO' };
    const accident = { ...theft, id: 'acidente', category: 'TRANSITO', occurrenceType: 'ACIDENTE' };
    const collisionWithRollover = {
      ...accident,
      id: 'acidente-caracteristicas',
      subtype: 'Colisão',
      additionalClassifications: [
        { category: 'TRANSITO', occurrenceType: 'ACIDENTE', subtype: 'Capotamento' },
      ],
    };
    const extraTheft = {
      ...robbery,
      id: 'roubo-com-furto',
      additionalClassifications: [{ category: 'SEGURANCA', occurrenceType: 'FURTO' }],
    };
    expect(
      filterRecords([theft, robbery, accident], {
        categories: ['SEGURANCA', 'TRANSITO'],
        types: ['ROUBO', 'FURTO'],
      }).map((record) => record.id),
    ).toEqual(['furto', 'roubo']);
    expect(
      filterRecords([theft, robbery, accident], {
        categories: ['TRANSITO'],
        types: ['ROUBO', 'FURTO'],
      }),
    ).toEqual([]);
    expect(
      filterRecords([extraTheft, extraTheft], { categories: ['SEGURANCA'], types: ['FURTO'] }).map(
        (record) => record.id,
      ),
    ).toEqual(['roubo-com-furto']);
    expect(
      filterRecords([collisionWithRollover, collisionWithRollover], {
        categories: ['TRANSITO'],
        types: ['ACIDENTE'],
      }).map((record) => record.id),
    ).toEqual(['acidente-caracteristicas']);
    const crossPillar = {
      ...accident,
      additionalClassifications: [{ category: 'SEGURANCA', occurrenceType: 'FURTO' }],
    };
    expect(filterRecords([crossPillar], { categories: ['TRANSITO'], types: ['FURTO'] })).toEqual(
      [],
    );
    expect(
      filterRecords([crossPillar], { categories: ['SEGURANCA'], types: ['FURTO'] }).map(
        (record) => record.id,
      ),
    ).toEqual(['acidente']);
  });
  it('consulta recente exclui datas ausentes, futuras e registros sem publicação aprovada', () => {
    const base: DemoRecord = {
      id: 'published',
      kind: 'occurrence',
      category: 'TRANSITO',
      coordinates: [-43.2, -22.9],
      occurredAt: '2026-10-14T15:00:00Z',
      publicationStatus: 'PUBLISHED',
    };
    const examples: DemoRecord[] = [
      base,
      { ...base, id: 'pending', publicationStatus: 'PENDING' },
      { ...base, id: 'dismissed', publicationStatus: 'DISMISSED' },
      { ...base, id: 'withdrawn', publicationStatus: 'WITHDRAWN' },
      { ...base, id: 'undated', occurredAt: undefined },
      { ...base, id: 'invalid', occurredAt: 'data desconhecida' },
      { ...base, id: 'at-end', occurredAt: '2026-10-15T15:00:00Z' },
      { ...base, id: 'old', occurredAt: '2026-10-14T14:59:59Z' },
    ];
    const result = filterRecords(examples, {
      categories: ['TRANSITO'],
      ...calendarRange('24h', new Date('2026-10-15T15:00:00Z')),
    });
    expect(result.map((record) => record.id)).toEqual(['published']);
  });
  it('uses a clamped calendar month in São Paulo rather than a fixed number of days', () => {
    const range = calendarRange('1m', new Date('2026-03-31T15:00:00.000Z'));

    expect(range.start.toISOString()).toBe('2026-02-28T15:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-03-31T15:00:00.000Z');
  });

  it('combines legacy group and crime refinements with the category using AND', () => {
    const result = filterRecords(records, {
      categories: ['SEGURANCA'],
      groups: ['CRIMES'],
      crimes: ['ROUBO_VEICULO'],
      start: new Date('2026-10-10T00:00:00.000Z'),
      end: new Date('2026-10-11T00:00:00.000Z'),
    });

    expect(result.map((record) => record.id)).toEqual([]);
  });

  it('interprets manually entered date-times in America/Sao_Paulo', () => {
    expect(localDateTimeToInstant('2026-10-10T12:00').toISOString()).toBe(
      '2026-10-10T15:00:00.000Z',
    );
  });

  it('filters collective and client-exclusive POIs without crossing their visibility', () => {
    const collective = filterRecords(records, { poiTypes: ['UPA'] });
    const exclusive = filterRecords(records, { exclusivePois: true });

    expect(collective.map((record) => record.id)).toEqual(['collective-poi']);
    expect(exclusive.map((record) => record.id)).toEqual(['client-poi']);
  });

  it('uses an inclusive spherical radius in meters', () => {
    const origin: [number, number] = [-43.2, -22.9];
    const point: [number, number] = [-43.1999, -22.9];
    const radius = distanceMeters(origin, point);
    const record = { ...records[0]!, coordinates: point };

    expect(
      filterRecords([record], {
        categories: ['SEGURANCA'],
        center: origin,
        radiusMeters: radius,
      }),
    ).toEqual([record]);
  });

  it('creates a closed GeoJSON radius polygon whose vertices lie at the requested distance', () => {
    const center: [number, number] = [-43.19, -22.91];
    const circle = createRadiusCircle(center, 100);
    const ring = circle.geometry.coordinates[0]!;

    expect(circle.type).toBe('Feature');
    expect(circle.geometry.type).toBe('Polygon');
    expect(ring).toHaveLength(65);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(distanceMeters(center, ring[0] as [number, number])).toBeCloseTo(100, 0);
  });

  it('imports aggregate CSV as area-period statistics and keeps source provenance', () => {
    const imported = parseOpenDataset(
      'aggregate-csv',
      'territorio,periodo,indicador,valor,unidade\nRio de Janeiro,2026-09,FURTO,12,casos',
      source,
    );

    expect(imported.aggregates).toEqual([
      {
        territory: 'Rio de Janeiro',
        period: '2026-09',
        indicator: 'FURTO',
        value: 12,
        unit: 'casos',
        sourceId: 'isp-demo',
      },
    ]);
    expect(imported.records).toEqual([]);
  });

  it('accepts UTF-8 BOM and quoted commas in standard aggregate CSV headers and values', () => {
    const imported = parseOpenDataset(
      'aggregate-csv',
      '\uFEFFterritorio,periodo,indicador,valor,unidade\r\n"Rio, Centro",2026-09,FURTO,12,casos',
      source,
    );

    expect(imported.aggregates[0]).toMatchObject({
      territory: 'Rio, Centro',
      period: '2026-09',
      value: 12,
      unit: 'casos',
    });
  });

  it('imports only validated Point features and strips unrecognized properties', () => {
    const imported = parseOpenDataset(
      'events-geojson',
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'safe-event',
            geometry: { type: 'Point', coordinates: [-43.2, -22.9] },
            properties: {
              nome: 'Evento de teste',
              categoria: 'TRANSITO',
              grupo: 'ALERTA',
              ocorridoEm: '2026-10-10T12:00:00Z',
              descricao: 'Fixture sem dados pessoais.',
              telefone: 'este campo deve ser descartado',
            },
          },
        ],
      }),
      source,
    );

    expect(imported.records).toHaveLength(1);
    expect(imported.records[0]?.sourceId).toBe('isp-demo');
    expect(imported.records[0]?.properties).not.toHaveProperty('telefone');
    expect(imported.aggregates).toEqual([]);
  });

  it('rejects aggregate files with missing or invalid provenance instead of guessing', () => {
    expect(() =>
      parseOpenDataset(
        'aggregate-csv',
        'territorio,periodo,indicador,valor,unidade\nRio,2026-09,FURTO,abc,casos',
        source,
      ),
    ).toThrow(/valor/i);
  });

  it('rejects an event source whose point is outside WGS84 longitude bounds', () => {
    expect(() =>
      parseOpenDataset(
        'events-geojson',
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [181, -22.9] },
              properties: {
                nome: 'Evento',
                categoria: 'TRANSITO',
                ocorridoEm: '2026-10-10T12:00:00Z',
              },
            },
          ],
        }),
        source,
      ),
    ).toThrow(/WGS84/i);
  });
});
