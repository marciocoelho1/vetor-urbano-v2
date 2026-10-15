import { factTimeBounds, type FactTime } from '../domain/temporal';
import type {
  AggregateStatistic,
  DemoRecord,
  ImportedDataset,
  SourceMetadata,
} from '../domain/occurrences';

const EVENT_CATEGORIES = new Set(['TRANSITO', 'SEGURANCA', 'CONTINGENCIA']);
const ALLOWED_EVENT_FIELDS = [
  'nome',
  'descricao',
  'local',
  'categoria',
  'grupo',
  'tipoCrime',
  'tipoTransito',
  'tipoContingencia',
  'impactoVia',
  'areaAfetada',
  'severidade',
  'ocorridoEm',
  'statusOperacional',
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('CSV inválido: aspas não foram fechadas.');
  row.push(value);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

function validateSource(source: SourceMetadata): void {
  const fields = [source.id, source.name, source.license, source.referenceDate, source.limitations];
  if (fields.some((field) => !field.trim())) {
    throw new Error('Informe origem, licença, data de referência e limitações antes de importar.');
  }
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('A origem precisa ser informada como endereço HTTP ou HTTPS.');
  }
}

function parseAggregateCsv(text: string, source: SourceMetadata): AggregateStatistic[] {
  const rows = parseCsv(text);
  const headers = rows.shift()?.map((header) => header.trim().toLocaleLowerCase('pt-BR')) ?? [];
  const aliases: Record<string, string[]> = {
    territory: ['territorio', 'território', 'municipio', 'município', 'area', 'área'],
    period: ['periodo', 'período', 'mes', 'mês', 'ano'],
    indicator: ['indicador', 'tipo', 'categoria'],
    value: ['valor', 'quantidade', 'total'],
    unit: ['unidade', 'unidade_medida', 'unidade de medida'],
  };
  const indexes = Object.fromEntries(
    Object.entries(aliases).map(([field, candidates]) => [
      field,
      headers.findIndex((header) => candidates.includes(header)),
    ]),
  );
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new Error(
      'CSV agregado precisa das colunas território, período, indicador, valor e unidade.',
    );
  }

  return rows.map((row, rowIndex) => {
    const get = (field: string): string => row[indexes[field]!] ?? '';
    const territory = get('territory').trim();
    const period = get('period').trim();
    const indicator = get('indicator').trim();
    const numericValue = Number(get('value').trim().replace(',', '.'));
    const unit = get('unit').trim();
    if (!territory || !indicator || !unit || !/^\d{4}(?:-\d{2})?$/.test(period)) {
      throw new Error(
        `Linha ${rowIndex + 2}: território, período, indicador e unidade são obrigatórios.`,
      );
    }
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error(`Linha ${rowIndex + 2}: valor precisa ser um número não negativo.`);
    }
    return { territory, period, indicator, value: numericValue, unit, sourceId: source.id };
  });
}

function parseEventGeoJson(text: string, source: SourceMetadata): DemoRecord[] {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error('GeoJSON inválido: não foi possível interpretar o arquivo.');
  }
  if (
    !document ||
    typeof document !== 'object' ||
    !('type' in document) ||
    document.type !== 'FeatureCollection' ||
    !('features' in document) ||
    !Array.isArray(document.features)
  ) {
    throw new Error('O arquivo de eventos precisa ser uma GeoJSON FeatureCollection.');
  }

  return document.features.map((feature: unknown, index: number) => {
    if (
      !feature ||
      typeof feature !== 'object' ||
      !('geometry' in feature) ||
      !('properties' in feature)
    ) {
      throw new Error(`Feature ${index + 1}: estrutura incompleta.`);
    }
    const featureRecord = feature as Record<string, unknown>;
    const geometry = featureRecord['geometry'];
    const properties = featureRecord['properties'];
    if (
      !geometry ||
      typeof geometry !== 'object' ||
      !('type' in geometry) ||
      geometry.type !== 'Point' ||
      !('coordinates' in geometry) ||
      !Array.isArray(geometry.coordinates) ||
      typeof properties !== 'object' ||
      !properties ||
      Array.isArray(properties)
    ) {
      throw new Error(`Feature ${index + 1}: esperado Point e properties válidos.`);
    }
    const coordinates = geometry.coordinates;
    const longitude = coordinates[0];
    const latitude = coordinates[1];
    if (
      typeof longitude !== 'number' ||
      typeof latitude !== 'number' ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new Error(`Feature ${index + 1}: coordenadas fora dos limites WGS84.`);
    }

    const input = properties as Record<string, unknown>;
    const safeProperties = Object.fromEntries(
      ALLOWED_EVENT_FIELDS.flatMap((field) => {
        const value = input[field];
        return typeof value === 'string' ? [[field, value]] : [];
      }),
    );
    const category = safeProperties['categoria'];
    const name = safeProperties['nome'];
    const occurredAt = safeProperties['ocorridoEm'];
    if (
      !name ||
      !category ||
      !EVENT_CATEGORIES.has(category) ||
      !occurredAt ||
      !Number.isFinite(Date.parse(occurredAt))
    ) {
      throw new Error(
        `Feature ${index + 1}: nome, categoria reconhecida e data do fato são obrigatórios.`,
      );
    }

    const factTime: FactTime = /^\d{4}-\d{2}$/.test(occurredAt)
      ? { precision: 'MONTH', month: occurredAt }
      : /^\d{4}-\d{2}-\d{2}$/.test(occurredAt)
        ? { precision: 'DAY', date: occurredAt }
        : { precision: 'EXACT', instant: new Date(occurredAt).toISOString() };
    if (
      !factTimeBounds({
        id: 'import-validation',
        kind: 'occurrence',
        coordinates: [longitude, latitude],
        factTime,
      })
    ) {
      throw new Error(`Feature ${index + 1}: precisão ou data do fato inválida.`);
    }

    return {
      id:
        typeof featureRecord['id'] === 'string' ? featureRecord['id'] : `${source.id}-${index + 1}`,
      kind: 'occurrence',
      name,
      description: safeProperties['descricao'] ?? '',
      location: safeProperties['local'] ?? 'Local não informado',
      category,
      group: safeProperties['grupo'] ?? 'OUTROS_REGISTROS',
      crime: safeProperties['tipoCrime'],
      typeLabel:
        safeProperties['tipoCrime'] ??
        safeProperties['tipoTransito'] ??
        safeProperties['tipoContingencia'],
      severity: safeProperties['severidade'],
      occurredAt: factTime.precision === 'EXACT' ? factTime.instant : undefined,
      factTime,
      situation: 'UNKNOWN',
      operationalStatus: 'EXPIRED',
      coordinates: [longitude, latitude],
      sourceId: source.id,
      properties: safeProperties,
    };
  });
}

export function parseOpenDataset(
  kind: 'aggregate-csv' | 'events-geojson',
  text: string,
  source: SourceMetadata,
): ImportedDataset {
  validateSource(source);
  if (!text.trim()) throw new Error('O arquivo está vazio.');
  if (kind === 'aggregate-csv') {
    return { records: [], aggregates: parseAggregateCsv(text, source), source };
  }
  return { records: parseEventGeoJson(text, source), aggregates: [], source };
}
