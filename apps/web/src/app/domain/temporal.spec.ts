import { parseOpenDataset } from '../data-exchange/source-import';
import { describe, expect, it } from 'vitest';
import { filterRecords, type DemoRecord } from './occurrences';
import { temporalInclusion, resolveSituation, situationLabel, formatFactTime } from './temporal';

const base: DemoRecord = {
  id: 'ficticio',
  kind: 'occurrence',
  category: 'TRANSITO',
  coordinates: [-43.2, -22.9],
};
const range = { start: new Date('2026-10-14T15:00:00Z'), end: new Date('2026-10-15T15:00:00Z') };

describe('consulta de datas do fato com precisão explícita', () => {
  it('inclui sobreposição possível sem substituir fato antigo por publicação recente', () => {
    const examples: DemoRecord[] = [
      { ...base, id: 'dia', factTime: { precision: 'DAY', date: '2026-10-14' } },
      { ...base, id: 'mes', factTime: { precision: 'MONTH', month: '2026-10' } },
      {
        ...base,
        id: 'antigo',
        occurredAt: '2026-09-01T15:00:00Z',
        sourcePublishedAt: '2026-10-15T14:00:00Z',
      },
      { ...base, id: 'limite', occurredAt: '2026-10-14T15:00:00Z' },
      { ...base, id: 'fim', occurredAt: '2026-10-15T15:00:00Z' },
    ];
    expect(
      filterRecords(examples, { categories: ['TRANSITO'], ...range }).map((record) => record.id),
    ).toEqual(['dia', 'mes', 'limite']);
    expect(temporalInclusion(examples[0]!, range)).toBe('POSSIBLE');
    expect(temporalInclusion(examples[3]!, range)).toBe('CERTAIN');
  });
});

describe('situação de produto independente do legado', () => {
  it('expira confirmação em Desconhecida, preserva histórico e sai da consulta estrita', () => {
    const ongoing: DemoRecord = {
      ...base,
      occurrenceType: 'INTERDICAO',
      situation: 'ONGOING',
      lastCheckedAt: '2026-10-15T12:00:00Z',
      situationHistory: [
        { situation: 'ONGOING', at: '2026-10-15T12:00:00Z', reason: 'Confirmação fictícia' },
      ],
    };
    const before = resolveSituation(ongoing, new Date('2026-10-15T15:59:59Z'), { INTERDICAO: 4 });
    const after = resolveSituation(ongoing, new Date('2026-10-15T16:00:00Z'), { INTERDICAO: 4 });
    expect(before.situation).toBe('ONGOING');
    expect(after.situation).toBe('UNKNOWN');
    expect(after.lastCheckedAt).toBe('2026-10-15T12:00:00Z');
    expect(after.situationHistory).toHaveLength(2);
    expect(after.situationHistory?.[1]).toMatchObject({
      situation: 'UNKNOWN',
      at: '2026-10-15T16:00:00.000Z',
    });
    expect(
      filterRecords([before, after], { categories: ['TRANSITO'], situations: ['ONGOING'] }),
    ).toEqual([before]);
    expect(
      resolveSituation(after, new Date('2026-10-16T12:00:00Z'), { INTERDICAO: 4 }).situationHistory,
    ).toHaveLength(2);
  });
  it('não deduz situação por quatro estados legados ou confirmação ausente', () => {
    for (const operationalStatus of ['ACTIVE', 'MONITORING', 'RESOLVED', 'EXPIRED'] as const) {
      expect(resolveSituation({ ...base, operationalStatus }, range.end, {}).situation).toBe(
        'UNKNOWN',
      );
    }
    expect(resolveSituation({ ...base, situation: 'ONGOING' }, range.end, {}).situation).toBe(
      'UNKNOWN',
    );
    expect(situationLabel('CLOSED')).toBe('Encerrada');
  });
  it('mostra dia/mês sem inventar hora e intervalo contido como inclusão certa', () => {
    expect(formatFactTime({ ...base, factTime: { precision: 'DAY', date: '2026-10-14' } })).toBe(
      '14/10/2026 (hora não informada)',
    );
    expect(formatFactTime({ ...base, factTime: { precision: 'MONTH', month: '2026-10' } })).toBe(
      '10/2026 (dia e hora não informados)',
    );
    expect(
      temporalInclusion(
        {
          ...base,
          factTime: {
            precision: 'INTERVAL',
            start: '2026-10-14T16:00:00Z',
            end: '2026-10-14T18:00:00Z',
          },
        },
        range,
      ),
    ).toBe('CERTAIN');
  });
});

it('importa dia histórico sem inventar meia-noite nem converter estado legado em confirmação', () => {
  const imported = parseOpenDataset(
    'events-geojson',
    JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-43.2, -22.9] },
          properties: {
            nome: 'Fato fictício',
            categoria: 'TRANSITO',
            ocorridoEm: '2026-10-14',
            statusOperacional: 'ACTIVE',
          },
        },
      ],
    }),
    {
      id: 'demo',
      name: 'Fonte fictícia',
      url: 'https://example.invalid',
      license: 'Fixture sintética',
      referenceDate: '2026-10',
      limitations: 'Sem validade operacional.',
    },
  );
  expect(formatFactTime(imported.records[0]!)).toBe('14/10/2026 (hora não informada)');
  expect(resolveSituation(imported.records[0]!, range.end).situation).toBe('UNKNOWN');
});
