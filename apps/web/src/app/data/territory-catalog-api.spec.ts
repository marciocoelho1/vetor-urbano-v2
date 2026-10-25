import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attributionLabel,
  countLabel,
  coverageLabel,
  fetchTerritoryCatalog,
  filterTerritories,
  normalizeTerritoryName,
  territoryOptionLabel,
  type TerritoryItem,
} from './territory-catalog-api';

afterEach(() => vi.unstubAllGlobals());

const item = (overrides: Partial<TerritoryItem>): TerritoryItem => ({
  id: 'synthetic-1',
  officialCode: '3304557',
  level: 'MUNICIPALITY',
  name: 'Rio de Janeiro',
  version: 1,
  validated: true,
  internalPoint: [-43.2, -22.91],
  referenceDate: '2026-10-24',
  ...overrides,
});

describe('catálogo territorial — limite do cliente', () => {
  it('carrega a listagem municipal com sessão e sem geometria', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset: null,
        coverage: {
          level: 'MUNICIPALITY',
          expected: 22,
          available: 22,
          pending: 0,
          expectedSource: 'LEGAL_RECORTE',
        },
        items: [item({})],
      }),
    });
    vi.stubGlobal('fetch', fetch);

    const catalog = await fetchTerritoryCatalog();

    expect(catalog.coverage.expected).toBe(22);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/api/v1/territories?level=MUNICIPALITY',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('trata 503 como indisponível, nunca como catálogo vazio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(fetchTerritoryCatalog()).rejects.toThrow(
      'Catálogo territorial indisponível. Tente novamente.',
    );
  });

  it('filtra sem acento e sem caixa, com disponíveis antes dos pendentes', () => {
    const items = [
      item({
        id: 'n',
        name: 'Niterói',
        officialCode: '3303302',
        validated: false,
        internalPoint: null,
      }),
      item({ id: 's', name: 'São Gonçalo', officialCode: '3304904' }),
      item({ id: 'r', name: 'Rio de Janeiro' }),
    ];

    expect(filterTerritories(items, 'sao').map((entry) => entry.id)).toEqual(['s']);
    expect(filterTerritories(items, 'NITEROI').map((entry) => entry.id)).toEqual(['n']);
    // 'o' casa com todos; disponíveis primeiro, depois alfabético por nome normalizado.
    expect(filterTerritories(items, '').map((entry) => entry.id)).toEqual(['r', 's', 'n']);
    expect(normalizeTerritoryName('São Gonçalo')).toBe('SAO GONCALO');
  });

  it('desambigua homônimos pelo código IBGE e conta a cobertura pelo servidor', () => {
    expect(territoryOptionLabel(item({ name: 'Bom Jesus', officialCode: '3300605' }))).toBe(
      'Bom Jesus, IBGE 3300605',
    );
    // Opção sem centro anunciado: o motivo entra no nome, não só na linha visual.
    expect(
      territoryOptionLabel(
        item({
          name: 'Angra dos Reis',
          officialCode: '3300100',
          validated: false,
          internalPoint: null,
        }),
      ),
    ).toBe('Angra dos Reis, IBGE 3300100, sem geometria validada');
    expect(
      coverageLabel({
        level: 'MUNICIPALITY',
        expected: 22,
        available: 18,
        pending: 4,
        expectedSource: 'LEGAL_RECORTE',
      }),
    ).toBe('Cobertura parcial: 18 de 22 municípios com geometria validada.');
    expect(
      coverageLabel({
        level: 'MUNICIPALITY',
        expected: 22,
        available: 22,
        pending: 0,
        expectedSource: 'LEGAL_RECORTE',
      }),
    ).toBe('22 municípios no catálogo, todos com geometria validada.');
    expect(
      coverageLabel({
        level: 'MUNICIPALITY',
        expected: 22,
        available: 0,
        pending: 22,
        expectedSource: 'LEGAL_RECORTE',
      }),
    ).toBe('Nenhum município com geometria validada.');
  });

  it('anuncia contagem em texto, com singular e zero explícitos', () => {
    expect(countLabel(0)).toBe('Nenhum município encontrado');
    expect(countLabel(1)).toBe('1 município encontrado');
    expect(countLabel(22)).toBe('22 municípios encontrados');
  });

  it('monta a atribuição com fonte, data-base e licença do servidor', () => {
    expect(
      attributionLabel({
        id: 'dataset-1',
        source: 'IBGE — API de Malhas',
        sourceUrl: 'https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{code}',
        license: 'CC BY 4.0',
        attribution: 'IBGE',
        referenceDate: '2026-10-24',
        obtainedAt: '2026-10-24T13:00:00Z',
        checksum: 'a'.repeat(64),
        limitations: 'Recorte simplificado.',
      }),
    ).toBe('Fonte: IBGE — API de Malhas, data-base 2026-10-24 · CC BY 4.0');
    expect(attributionLabel(null)).toBe('');
  });
});
