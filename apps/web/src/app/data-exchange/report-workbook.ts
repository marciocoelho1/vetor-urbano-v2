import type { PersistedQueryResponse } from '../data/persisted-query';
import { OCCURRENCE_CATALOGUE } from '../domain/catalogue';
import type { SpreadsheetCell, SpreadsheetSheet } from './xlsx-export';
import { XLSX_MAX_DATA_ROWS_PER_SHEET } from './xlsx-export';

const OCCURRENCE_HEADERS = [
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
];

const REFERENCE_HEADERS = [
  'ID da ocorrência',
  'ID da referência',
  'Título da publicação',
  'Fonte',
  'Publicada em UTC',
  'Coletada em UTC',
];

const CATEGORY_LABELS: Record<string, string> = {
  TRANSITO: 'Trânsito',
  SEGURANCA: 'Segurança',
  CONTINGENCIA: 'Contingência',
};

const SITUATION_LABELS: Record<string, string> = {
  ONGOING: 'Em andamento',
  CLOSED: 'Encerrada',
  UNKNOWN: 'Desconhecida',
};

const LIMITATIONS = [
  'Dados sintéticos do ambiente local; não usar para decisões operacionais.',
  'A consulta inclui registros publicados disponíveis no momento da geração.',
  'Intervalos aproximados preservam seus limites e não indicam um instante exato.',
  'Registros sem coordenada sustentada permanecem disponíveis para consulta em lista.',
  'Referências não aumentam a contagem de ocorrências ou acontecimentos.',
  'Notas de fontes, fatores internos e dados restritos não são exportados.',
].join(' ');

type SheetGroup = 'Ocorrências' | 'Referências';

function splitSheet(
  group: SheetGroup,
  headers: string[],
  rows: SpreadsheetCell[][],
  maxDataRows: number,
  widths: number[],
): SpreadsheetSheet[] {
  if (!Number.isInteger(maxDataRows) || maxDataRows < 1) {
    throw new Error('O limite de linhas por aba XLSX precisa ser positivo.');
  }
  const result: SpreadsheetSheet[] = [];
  for (let offset = 0; offset < rows.length || offset === 0; offset += maxDataRows) {
    const part = Math.floor(offset / maxDataRows) + 1;
    const name = part === 1 ? group : `${group} (${part})`;
    result.push({
      name,
      rows: [headers, ...rows.slice(offset, offset + maxDataRows)],
      columnWidths: widths,
    });
  }
  return result;
}

export function buildAdvancedReportSheets(
  response: PersistedQueryResponse,
  metadata: { filterSummary: string; periodStart?: string; periodEnd?: string },
  maxDataRows = XLSX_MAX_DATA_ROWS_PER_SHEET,
): SpreadsheetSheet[] {
  const occurrenceRows: SpreadsheetCell[][] = response.items.map((item) => {
    const exactInstant = item.temporal.occurredAt || null;
    return [
      item.id,
      item.happeningId,
      item.title,
      item.description,
      CATEGORY_LABELS[item.category] ?? item.category,
      OCCURRENCE_CATALOGUE.find((entry) => entry.id === item.type)?.label ?? item.type,
      item.subtype === 'NAO_INFORMADO' ? null : item.subtype || null,
      SITUATION_LABELS[item.situation] ?? item.situation,
      item.municipality || null,
      item.neighborhood || null,
      item.locationPrecision === 'POINT' ? 'Ponto' : 'Somente território',
      item.coordinates?.[0] ?? null,
      item.coordinates?.[1] ?? null,
      exactInstant
        ? 'Exata'
        : item.temporal.occurredFrom || item.temporal.occurredUntil
          ? 'Intervalo aproximado'
          : null,
      exactInstant,
      exactInstant ? null : item.temporal.occurredFrom || null,
      exactInstant ? null : item.temporal.occurredUntil || null,
      item.clippings.length,
    ];
  });

  const referenceRows: SpreadsheetCell[][] = response.items.flatMap((item) =>
    item.clippings.map((clipping) => [
      item.id,
      clipping.id,
      clipping.title,
      clipping.source.name,
      clipping.sourcePublishedAt || null,
      clipping.collectedAt || null,
    ]),
  );
  const referencedSources = new Set(
    response.items.flatMap((item) => item.clippings.map((clipping) => clipping.source.id)),
  );

  const recut: SpreadsheetSheet = {
    name: 'Recorte',
    rows: [
      ['Campo', 'Valor'],
      ['Gerado em UTC', response.generatedAt],
      ['Período inicial UTC', metadata.periodStart || null],
      ['Período final exclusivo UTC', metadata.periodEnd || null],
      ['Fuso de apresentação', 'America/Sao_Paulo'],
      ['Filtros ativos', metadata.filterSummary],
      ['Total de ocorrências', response.counts.occurrences],
      ['Total de acontecimentos', response.counts.happenings],
      ['Ocorrências com coordenadas', response.counts.mappedOccurrences],
      ['Ocorrências apenas em lista', response.counts.listOnlyOccurrences],
      ['Datas temporalmente certas', response.counts.temporallyCertain],
      ['Datas temporalmente possíveis', response.counts.temporallyPossible],
      ['Fontes referenciadas', referencedSources.size],
      ['Limitações', LIMITATIONS],
    ],
    columnWidths: [34, 100],
  };

  return [
    recut,
    ...splitSheet(
      'Ocorrências',
      OCCURRENCE_HEADERS,
      occurrenceRows,
      maxDataRows,
      [28, 28, 36, 48, 18, 30, 28, 20, 26, 24, 26, 16, 16, 28, 26, 26, 26, 28],
    ),
    ...splitSheet(
      'Referências',
      REFERENCE_HEADERS,
      referenceRows,
      maxDataRows,
      [28, 28, 48, 32, 24, 24],
    ),
  ];
}
