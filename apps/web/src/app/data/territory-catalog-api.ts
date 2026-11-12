/**
 * Contrato real do catálogo territorial (UXH-03): `GET /api/v1/territories` devolve o conjunto da
 * versão aprovada mais a cobertura do recorte legal. A tela não calcula cobertura, não normaliza
 * geometria e não inventa centro: `internalPoint` é `[longitude, latitude]` persistido pelo servidor.
 */
const API = 'http://127.0.0.1:8080/api/v1';

export interface TerritoryDataset {
  id: string;
  source: string;
  sourceUrl: string;
  license: string;
  attribution: string;
  referenceDate: string;
  obtainedAt: string;
  checksum: string;
  limitations: string;
}

export type TerritoryLevel = 'MUNICIPALITY' | 'BAIRRO' | 'RA' | 'AP';

export interface TerritoryItem {
  id: string;
  officialCode: string;
  level: TerritoryLevel;
  name: string;
  /** Contexto do território pai: é o que desambigua homônimo («Centro» existe em muitos). */
  parentName?: string | null;
  parentLevel?: TerritoryLevel | null;
  version: number | null;
  validated: boolean;
  internalPoint: [number, number] | null;
  referenceDate: string | null;
}

export interface TerritoryCoverage {
  level: string;
  expected: number | null;
  available: number | null;
  pending: number | null;
  expectedSource: 'LEGAL_RECORTE' | 'SEM_RECORTE_LEGAL';
  /** Qual versão do recorte legal gerou o número; `null` quando não há recorte (bairro/RA/AP). */
  expectedRecorteVersion?: number | null;
}

export interface TerritoryCatalog {
  dataset: TerritoryDataset | null;
  coverage: TerritoryCoverage;
  items: TerritoryItem[];
}

export class TerritoryCatalogError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchTerritoryCatalog(
  level: TerritoryLevel = 'MUNICIPALITY',
  signal?: AbortSignal,
): Promise<TerritoryCatalog> {
  const response = await fetch(`${API}/territories?level=${level}`, {
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('vu-session-invalid'));
    throw new TerritoryCatalogError(
      response.status,
      response.status === 503
        ? 'Catálogo territorial indisponível. Tente novamente.'
        : 'Não foi possível carregar o catálogo territorial.',
    );
  }
  return response.json() as Promise<TerritoryCatalog>;
}

/** Comparação sem acento e sem caixa, a mesma regra da API; aqui só filtra a lista já carregada. */
export function normalizeTerritoryName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Ordem alfabética com os disponíveis antes dos pendentes: nenhuma relevância inventada, só o
 * critério do @ux (evitar lista morta no topo).
 */
export function filterTerritories(items: TerritoryItem[], term: string): TerritoryItem[] {
  const needle = normalizeTerritoryName(term.trim());
  return items
    .filter((item) => !needle || normalizeTerritoryName(item.name).includes(needle))
    .sort((left, right) => {
      if (left.validated !== right.validated) return left.validated ? -1 : 1;
      return normalizeTerritoryName(left.name).localeCompare(
        normalizeTerritoryName(right.name),
        'pt-BR',
      );
    });
}

/** Nome acessível da opção: `nome, IBGE código`, e a razão quando não há centro a oferecer. */
export function territoryOptionLabel(item: TerritoryItem): string {
  // Bairro carrega o município no rótulo: sem isso, dois «Centro» ficam indistinguíveis.
  const base =
    item.level === 'BAIRRO' && item.parentName
      ? `${item.name} (${item.parentName}), IBGE ${item.officialCode}`
      : `${item.name}, IBGE ${item.officialCode}`;
  return item.validated && item.internalPoint !== null ? base : `${base}, sem geometria validada`;
}

export function coverageLabel(coverage: TerritoryCoverage): string {
  const expected = coverage.expected;
  const available = coverage.available;
  if (expected === null || available === null)
    return 'Cobertura do catálogo territorial indisponível.';
  if (expected === 0) return 'Nenhum município no recorte legal.';
  if (available === 0) return 'Nenhum município com geometria validada.';
  if (available === expected)
    return `${expected} municípios no catálogo, todos com geometria validada.`;
  return `Cobertura parcial: ${available} de ${expected} municípios com geometria validada.`;
}

export function countLabel(count: number, level: TerritoryLevel = 'MUNICIPALITY'): string {
  const singular = level === 'BAIRRO' ? 'bairro' : level === 'RA' ? 'área de risco' : 'município';
  const plural = level === 'BAIRRO' ? 'bairros' : level === 'RA' ? 'áreas de risco' : 'municípios';
  if (count === 0) return `Nenhum ${singular} encontrado`;
  return count === 1 ? `1 ${singular} encontrado` : `${count} ${plural} encontrados`;
}

export function attributionLabel(dataset: TerritoryDataset | null): string {
  if (!dataset) return '';
  const referenceDate = dataset.referenceDate ? `, data-base ${dataset.referenceDate}` : '';
  return `Fonte: ${dataset.source}${referenceDate} · ${dataset.license}`;
}
