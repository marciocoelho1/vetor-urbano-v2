import { describe, expect, it } from 'vitest';
import { createXlsxWorkbook } from './xlsx-export';
import { buildAdvancedReportSheets } from './report-workbook';
import type { PersistedQueryResponse } from '../data/persisted-query';

const response: PersistedQueryResponse = {
  generatedAt: '2026-10-17T15:00:00Z',
  counts: {
    occurrences: 2,
    happenings: 1,
    mappedOccurrences: 1,
    listOnlyOccurrences: 1,
    temporallyCertain: 1,
    temporallyPossible: 1,
  },
  items: [
    {
      id: 'occ-exact',
      happeningId: 'event-1',
      title: '=HYPERLINK("https://example.test")',
      description: 'Descrição fictícia',
      category: 'TRANSITO',
      type: 'ACIDENTE',
      subtype: 'COLISAO',
      situation: 'UNKNOWN',
      reliability: 4,
      municipality: 'Rio de Janeiro',
      neighborhood: 'Centro',
      locationPrecision: 'POINT',
      coordinates: [-43.19, -22.9],
      temporalMatch: 'CERTAIN',
      temporal: { occurredAt: '2026-10-17T12:00:00Z', occurredFrom: null, occurredUntil: null },
      clippings: [
        {
          id: 'ref-a',
          title: 'Publicação sintética',
          source: { id: 'source-a', name: 'Fonte de teste' },
          sourcePublishedAt: '2026-10-17T12:10:00Z',
          collectedAt: '2026-10-17T12:12:00Z',
        },
      ],
    },
    {
      id: 'occ-interval',
      happeningId: 'event-1',
      title: 'Ocorrência territorial',
      description: 'Intervalo aproximado',
      category: 'SEGURANCA',
      type: 'FURTO',
      subtype: 'NAO_INFORMADO',
      situation: 'CLOSED',
      reliability: 2,
      municipality: 'Rio de Janeiro',
      neighborhood: 'Bairro de teste',
      locationPrecision: 'TERRITORY',
      coordinates: null,
      temporalMatch: 'POSSIBLE',
      temporal: {
        occurredAt: null,
        occurredFrom: '2026-10-16T00:00:00Z',
        occurredUntil: '2026-10-18T00:00:00Z',
      },
      clippings: [
        {
          id: 'ref-b',
          title: 'Outra publicação',
          source: { id: 'source-b', name: 'Outra fonte' },
          sourcePublishedAt: '2026-10-17T11:00:00Z',
          collectedAt: '2026-10-17T11:30:00Z',
        },
      ],
    },
  ],
  relatedItems: [],
};

describe('workbook da consulta avançada', () => {
  it('preserva as três abas, colunas aprovadas, instante e intervalo sem inventar zero', () => {
    const sheets = buildAdvancedReportSheets(response, {
      filterSummary: 'Pilar: Trânsito',
      periodStart: '2026-10-17T00:00:00Z',
      periodEnd: '2026-10-18T00:00:00Z',
    });
    const [recut, occurrences, references] = sheets;

    expect(sheets.map((sheet) => sheet.name)).toEqual(['Recorte', 'Ocorrências', 'Referências']);
    expect(recut?.rows).toContainEqual(['Fuso de apresentação', 'America/Sao_Paulo']);
    expect(recut?.rows).toContainEqual(['Filtros ativos', 'Pilar: Trânsito']);
    expect(recut?.rows).toContainEqual(['Período inicial UTC', '2026-10-17T00:00:00Z']);
    expect(recut?.rows).toContainEqual(['Período final exclusivo UTC', '2026-10-18T00:00:00Z']);
    expect(recut?.rows).toContainEqual(['Total de ocorrências', 2]);
    expect(recut?.rows).toContainEqual(['Total de acontecimentos', 1]);
    expect(occurrences?.rows[0]).toEqual([
      'ID da ocorrência',
      'ID do acontecimento',
      'Título',
      'Descrição',
      'Pilar',
      'Tipo',
      'Subtipo',
      'Situação',
      'Município',
      'Bairro',
      'Precisão geográfica',
      'Longitude',
      'Latitude',
      'Precisão temporal',
      'Instante UTC',
      'Início UTC',
      'Fim exclusivo UTC',
      'Quantidade de referências',
    ]);
    expect(occurrences?.rows[1]?.[2]).toBe('=HYPERLINK("https://example.test")');
    expect(occurrences?.rows[1]?.[7]).toBeNull();
    expect(occurrences?.rows[1]?.slice(13, 17)).toEqual([
      'Exata',
      '2026-10-17T12:00:00Z',
      null,
      null,
    ]);
    expect(occurrences?.rows[2]?.slice(10, 17)).toEqual([
      'Somente território',
      null,
      null,
      'Intervalo aproximado',
      null,
      '2026-10-16T00:00:00Z',
      '2026-10-18T00:00:00Z',
    ]);
    expect(occurrences?.rows[2]?.[6]).toBeNull();
    expect(references?.rows[0]).toEqual([
      'ID da ocorrência',
      'ID da referência',
      'Título da publicação',
      'Fonte',
      'Publicada em UTC',
      'Coletada em UTC',
    ]);
    expect(references?.rows.slice(1).map((row) => row.slice(0, 2))).toEqual([
      ['occ-exact', 'ref-a'],
      ['occ-interval', 'ref-b'],
    ]);
    expect(JSON.stringify(sheets)).not.toMatch(/nota interna|fator de avaliação/i);
  });

  it('registra o crédito da fonte autorizada apenas quando o recorte a referencia', () => {
    const withoutCredit = buildAdvancedReportSheets(response, { filterSummary: 'Sem coleta' });
    expect(JSON.stringify(withoutCredit)).not.toContain('Crédito de fonte autorizada');

    const withCredit = buildAdvancedReportSheets(
      { ...response, attribution: [' Fonte: Instituto Fogo Cruzado ', ''] },
      { filterSummary: 'Com coleta' },
    );
    expect(withCredit[0]?.rows).toContainEqual([
      'Crédito de fonte autorizada',
      'Fonte: Instituto Fogo Cruzado',
    ]);
    expect(withCredit.map((sheet) => sheet.name)).toEqual([
      'Recorte',
      'Ocorrências',
      'Referências',
    ]);
  });

  it('divide abas acima do limite mantendo cabeçalho e todos os registros/referências', () => {
    const sheets = buildAdvancedReportSheets(response, { filterSummary: 'Pilar: Trânsito' }, 1);

    expect(sheets.map((sheet) => sheet.name)).toEqual([
      'Recorte',
      'Ocorrências',
      'Ocorrências (2)',
      'Referências',
      'Referências (2)',
    ]);
    expect(
      sheets
        .filter((sheet) => sheet.name.startsWith('Ocorrências'))
        .flatMap((sheet) => sheet.rows.slice(1).map((row) => row[0])),
    ).toEqual(['occ-exact', 'occ-interval']);
    expect(
      sheets
        .filter((sheet) => sheet.name.startsWith('Referências'))
        .flatMap((sheet) => sheet.rows.slice(1).map((row) => row[1])),
    ).toEqual(['ref-a', 'ref-b']);
  });

  it('serializa entrada iniciada com igual como texto inline, nunca como fórmula', async () => {
    const sheets = buildAdvancedReportSheets(response, { filterSummary: 'Pilar: Trânsito' });
    const workbook = await createXlsxWorkbook(sheets);
    const packageText = new TextDecoder().decode(workbook);

    expect(packageText).toContain('t="inlineStr"');
    expect(packageText).toContain('=HYPERLINK(&quot;https://example.test&quot;)');
    expect(packageText).not.toMatch(/<f(?:\s|>)/);
  });
});
