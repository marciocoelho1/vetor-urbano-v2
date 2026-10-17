import { describe, expect, it } from 'vitest';
import type { DemoRecord } from '../domain/occurrences';
import {
  HISTORY_PAGE_SIZE,
  filterHistoryRecords,
  mergeHistorySources,
  historySourcesFromRecords,
  historyPageCount,
  historyPageRecords,
  historyQueryParameters,
  orderHistoryRecords,
  type HistoryFilters,
} from './history-query';

const occurrence = (id: string, factTime: DemoRecord['factTime']): DemoRecord => ({
  id,
  kind: 'occurrence',
  coordinates: null,
  factTime,
});

describe('consulta do Histórico avançado', () => {
  it('deriva opções de fonte de todas as referências sem duplicar fontes', () => {
    const sources = historySourcesFromRecords([
      { clippings: [{ source: { id: 'source-b', name: 'Fonte B' } }] },
      {
        clippings: [
          { source: { id: 'source-a', name: 'Fonte A' } },
          { source: { id: 'source-b', name: 'Fonte B' } },
        ],
      },
    ]);

    expect(sources).toEqual([
      { id: 'source-a', name: 'Fonte A' },
      { id: 'source-b', name: 'Fonte B' },
    ]);
  });

  it('combina fontes atuais e observadas no histórico por ID em ordem estável', () => {
    expect(
      mergeHistorySources(
        [
          { id: 'source-z', name: 'Fonte Beta' },
          { id: 'source-a', name: 'Fonte Beta' },
        ],
        [
          { id: 'source-z', name: 'Fonte Beta' },
          { id: 'source-b', name: 'Fonte Alfa' },
        ],
      ),
    ).toEqual([
      { id: 'source-b', name: 'Fonte Alfa' },
      { id: 'source-a', name: 'Fonte Beta' },
      { id: 'source-z', name: 'Fonte Beta' },
    ]);
  });

  it('ordena exatos e intervalos pelo instante ou pelo fim exclusivo e desempata por ID decrescente', () => {
    const ordered = orderHistoryRecords([
      occurrence('hist-a-intervalo', {
        precision: 'INTERVAL',
        start: '2026-10-14T10:00:00Z',
        end: '2026-10-15T12:00:00Z',
      }),
      occurrence('hist-z-exato', { precision: 'EXACT', instant: '2026-10-15T12:00:00Z' }),
      occurrence('hist-recente', { precision: 'EXACT', instant: '2026-10-16T12:00:00Z' }),
      occurrence('hist-antigo', {
        precision: 'INTERVAL',
        start: '2026-10-13T10:00:00Z',
        end: '2026-10-14T12:00:00Z',
      }),
    ]);

    expect(ordered.map(({ id }) => id)).toEqual([
      'hist-recente',
      'hist-z-exato',
      'hist-a-intervalo',
      'hist-antigo',
    ]);
  });

  it('divide um snapshot completo em páginas de 25 sem duplicar nem omitir IDs', () => {
    const records = Array.from({ length: 63 }, (_, index) =>
      occurrence(`hist-${String(index + 1).padStart(3, '0')}`, {
        precision: 'EXACT',
        instant: `2026-10-${String(16 - Math.floor(index / 24)).padStart(2, '0')}T12:00:00Z`,
      }),
    );
    const first = historyPageRecords(records, 1);
    const second = historyPageRecords(records, 2);
    const third = historyPageRecords(records, 3);

    expect(HISTORY_PAGE_SIZE).toBe(25);
    expect(historyPageCount(records.length)).toBe(3);
    expect(first).toHaveLength(25);
    expect(second).toHaveLength(25);
    expect(third).toHaveLength(13);
    expect(new Set([...first, ...second, ...third].map(({ id }) => id)).size).toBe(63);
  });

  it('serializa filtros combinados, período semiaberto e seleção explícita vazia', () => {
    const params = historyQueryParameters({
      text: 'VU-HIST-004',
      periodStart: '2026-10-01T00:00',
      periodEnd: '2026-10-17T00:00',
      categories: [],
      types: ['ACIDENTE'],
      subtypes: ['ACIDENTE:COLISAO'],
      municipality: 'Rio de Janeiro',
      neighborhood: 'Centro',
      sourceId: 'vu-demo-source-002',
      minReliability: 3,
      maxReliability: 4,
      situation: 'ONGOING',
    });

    expect(params.get('text')).toBe('VU-HIST-004');
    expect(params.get('categorySelection')).toBe('NONE');
    expect(params.getAll('type')).toEqual(['ACIDENTE']);
    expect(params.getAll('subtype')).toEqual(['ACIDENTE:COLISAO']);
    expect(params.get('municipality')).toBe('Rio de Janeiro');
    expect(params.get('neighborhood')).toBe('Centro');
    expect(params.get('sourceId')).toBe('vu-demo-source-002');
    expect(params.get('minReliability')).toBe('3');
    expect(params.get('maxReliability')).toBe('4');
    expect(params.get('situation')).toBe('ONGOING');
    expect(params.get('periodStart')).toBe('2026-10-01T03:00:00.000Z');
    expect(params.get('periodEnd')).toBe('2026-10-17T03:00:00.000Z');
  });

  it('mantém somente ocorrências publicadas no histórico local', () => {
    const filters: HistoryFilters = {
      text: '',
      periodStart: '',
      periodEnd: '',
      types: [],
      subtypes: [],
      municipality: '',
      neighborhood: '',
      sourceId: '',
      minReliability: null,
      maxReliability: null,
      situation: '',
    };
    const records = [
      {
        ...occurrence('publicada', { precision: 'EXACT', instant: '2026-10-15T12:00:00Z' }),
        publicationStatus: 'PUBLISHED' as const,
      },
      {
        ...occurrence('pendente', { precision: 'EXACT', instant: '2026-10-15T12:00:00Z' }),
        publicationStatus: 'PENDING' as const,
      },
      {
        ...occurrence('retirada', { precision: 'EXACT', instant: '2026-10-15T12:00:00Z' }),
        publicationStatus: 'WITHDRAWN' as const,
      },
    ];

    expect(filterHistoryRecords(records, filters).map(({ id }) => id)).toEqual(['publicada']);
  });
});
