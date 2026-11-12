import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * UXH-04 / UXH-05 — catálogo territorial de bairros (Lote B).
 *
 * A régua lê **do banco**, não do relatório da ingestão: contagem por município,
 * lacunas nomeadas, publicação (`approved_version`), proveniência e o **teste de
 * partição** — soma da área dos bairros contra a área do município.
 *
 * Contêiner sintético: `vetor-spec-postgis` (55436, base `vetor_spec_test`).
 * Nada aqui escreve: são consultas de leitura.
 *
 * Mutações por caso:
 *   1 cobertura   → ingerir sem `--approve` (linhas visíveis mas não publicadas)
 *   2 lacunas     → inventar BAIRRO para um dos 9 municípios sem malha IBGE
 *   3 partição    → extrair com `--simplificar` (área muda e a soma não fecha)
 *   4 proveniência→ registrar OSM sob a mesma origem do IBGE
 */

const CONTAINER = process.env['VETOR_E2E_TERRITORIAL_CONTAINER'] ?? 'vetor-spec-postgis';

/** Inventário de leitura do IBGE (22 municípios da RMRJ), base da expectativa. */
const ESPERADO: Record<string, number> = {
  'Rio de Janeiro': 162,
  'São Gonçalo': 110,
  Itaboraí: 72,
  'Nova Iguaçu': 67,
  Niterói: 52,
  'Duque de Caxias': 41,
  'Cachoeiras de Macacu': 36,
  'Belford Roxo': 30,
  Japeri: 30,
  Mesquita: 17,
  'São João de Meriti': 16,
  Nilópolis: 15,
  Tanguá: 10,
};

/** Municípios sem malha oficial de bairro no IBGE — lacuna declarada, não silêncio. */
const SEM_MALHA = [
  'Maricá',
  'Seropédica',
  'Guapimirim',
  'Itaguaí',
  'Magé',
  'Queimados',
  'Petrópolis',
  'Paracambi',
  'Rio Bonito',
];

/**
 * Leitura por `psql` no contêiner sintético. Guarda explícita: recusa a base real
 * (`vu-fogo-cruzado-db` / `vetor_urbano`) antes de abrir conexão, como o resto do repo.
 */
const PERMITIDOS = ['vetor-spec-postgis', 'vu-uxh01-five-db', 'vu-selected-db', 'vu-ticket30-db'];

function consultar(sql: string): string {
  if (!PERMITIDOS.includes(CONTAINER)) {
    throw new Error(`Contêiner não permitido para régua: ${CONTAINER}`);
  }
  const base = process.env['VETOR_E2E_TERRITORIAL_DB'] ?? 'vetor_spec_test';
  if (base === 'vetor_urbano') throw new Error('Régua não pode medir a base real.');
  const usuario = execFileSync('podman', ['exec', CONTAINER, 'printenv', 'POSTGRES_USER'])
    .toString()
    .trim();
  return execFileSync('podman', [
    'exec',
    CONTAINER,
    'psql',
    '-U',
    usuario,
    '-d',
    base,
    '-t',
    '-A',
    '-c',
    sql,
  ]).toString();
}

test('UXH-05: cobertura de bairros por município confere com o inventário', async () => {
  const saida = consultar(`
    SELECT p.name || '|' || count(*)::text || '|' || count(*) FILTER (WHERE t.approved_version IS NOT NULL)::text
    FROM catalog_territories t
    JOIN catalog_territories p ON p.id = t.parent_id
    WHERE t.level = 'BAIRRO'
    GROUP BY p.name
    ORDER BY count(*) DESC;`);
  const linhas = saida
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|'))
    .map((l) => {
      const [municipio, total, publicados] = l.split('|');
      return { municipio: municipio ?? '', total: Number(total), publicados: Number(publicados) };
    });
  console.log(`municípios com BAIRRO: ${linhas.length}`);
  for (const linha of linhas) {
    console.log(`  ${linha.municipio}: ${linha.total} (publicados ${linha.publicados})`);
  }
  expect(linhas.length, `esperava 13 municípios com bairros, achei ${linhas.length}`).toBe(
    Object.keys(ESPERADO).length,
  );
  const total = linhas.reduce((soma, l) => soma + l.total, 0);
  console.log(`total de bairros: ${total}`);
  expect(total, 'total de bairros diferente do inventário (658)').toBe(658);
  for (const [municipio, esperado] of Object.entries(ESPERADO)) {
    const linha = linhas.find((l) => l.municipio === municipio);
    expect(
      linha?.total ?? 0,
      `${municipio}: ${linha?.total ?? 0} bairros, esperado ${esperado}`,
    ).toBe(esperado);
  }
});

test('UXH-05: os 9 municípios sem malha oficial aparecem como lacuna, não como zero silencioso', async () => {
  const saida = consultar(`
    SELECT p.name || '|' || count(*)::text
    FROM catalog_territories t
    JOIN catalog_territories p ON p.id = t.parent_id
    WHERE t.level = 'BAIRRO'
    GROUP BY p.name;`);
  const comBairro = new Set(
    saida
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.includes('|'))
      .map((l) => l.split('|')[0] ?? ''),
  );
  const apareceram = SEM_MALHA.filter((nome) => comBairro.has(nome));
  console.log(`sem malha que apareceram com bairro: ${JSON.stringify(apareceram)}`);
  expect(apareceram, 'município sem malha IBGE recebeu bairros (vocabulário inventado)').toEqual(
    [],
  );
});

/** Cobertura medida na ingestão de 28/10 (vetor_spec_test) — baseline de estabilidade. */
const COBERTURA_BASELINE: Record<string, number> = {
  'Rio de Janeiro': 100.1,
  'São João de Meriti': 100.1,
  Niterói: 100.1,
  'Belford Roxo': 98.5,
  'São Gonçalo': 84.9,
  Japeri: 83.9,
  Mesquita: 74.6,
  'Nova Iguaçu': 59.4,
  'Duque de Caxias': 56.8,
  Itaboraí: 49.9,
  Nilópolis: 49.6,
  Tanguá: 18.4,
  'Cachoeiras de Macacu': 9.3,
};

/** Municípios onde os bairros fecham a área: aí o desvio mede geometria, não cobertura. */
const PARTICAO_PLENA = ['Rio de Janeiro', 'São João de Meriti', 'Niterói'];

function medirCobertura(): {
  municipio: string;
  cobertura: number;
  areaBairros: number;
  areaMunicipio: number;
}[] {
  const saida = consultar(`
    WITH bairros AS (
      SELECT p.id AS municipio_id, sum(ST_Area(v.boundary::geography)) AS area_bairros
      FROM catalog_territories t
      JOIN catalog_territories p ON p.id = t.parent_id
      JOIN catalog_territory_versions v ON v.territory_id = t.id AND v.version = t.approved_version
      WHERE t.level = 'BAIRRO'
      GROUP BY p.id
    )
    SELECT p.name || '|' ||
           round(b.area_bairros / 1000000)::text || '|' ||
           round(ST_Area(pv.boundary::geography) / 1000000)::text || '|' ||
           round((100 * b.area_bairros / ST_Area(pv.boundary::geography))::numeric, 1)::text
    FROM bairros b
    JOIN catalog_territories p ON p.id = b.municipio_id
    JOIN catalog_territory_versions pv ON pv.territory_id = p.id AND pv.version = p.approved_version
    ORDER BY 1;`);
  return saida
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|'))
    .map((l) => {
      const [municipio, areaBairros, areaMunicipio, cobertura] = l.split('|');
      return {
        municipio: municipio ?? '',
        areaBairros: Number(areaBairros),
        areaMunicipio: Number(areaMunicipio),
        cobertura: Number(cobertura),
      };
    });
}

test('UXH-05: partição plena fecha ≤2% onde os bairros cobrem o município', async () => {
  const linhas = medirCobertura();
  console.log(`partição plena em ${PARTICAO_PLENA.length} municípios`);
  for (const nome of PARTICAO_PLENA) {
    const linha = linhas.find((l) => l.municipio === nome);
    expect(linha, `${nome} ausente da medição`).toBeTruthy();
    const desvio = Math.abs((linha?.cobertura ?? 0) - 100);
    console.log(`  ${nome}: cobertura ${linha?.cobertura}% · desvio ${desvio.toFixed(1)} pp`);
    expect(
      desvio,
      `${nome}: desvio de ${desvio.toFixed(1)} pp acima de 2 — extração errada onde a cobertura é plena`,
    ).toBeLessThanOrEqual(2);
  }
});

test('UXH-05: matriz de cobertura estável e sem 100% onde a fonte não fecha', async () => {
  const linhas = medirCobertura();
  expect(linhas.length, 'matriz não mediu os 13 municípios').toBe(13);
  const desvios: string[] = [];
  for (const linha of linhas) {
    const base = COBERTURA_BASELINE[linha.municipio];
    console.log(`  ${linha.municipio}: ${linha.cobertura}% (baseline ${base ?? '—'})`);
    expect(base, `${linha.municipio} sem baseline declarada`).toBeTruthy();
    const delta = Math.abs(linha.cobertura - (base ?? 0));
    if (delta > 1) desvios.push(`${linha.municipio} ${linha.cobertura}% vs ${base}%`);
    if (!PARTICAO_PLENA.includes(linha.municipio)) {
      expect(
        linha.cobertura,
        `${linha.municipio} declara ${linha.cobertura}% de cobertura sem fechar a área (≤99,5)`,
      ).toBeLessThanOrEqual(99.5);
    }
  }
  expect(desvios, `cobertura mudou mais de 1 pp: ${JSON.stringify(desvios)}`).toEqual([]);
});

test('UXH-04: proveniência e publicação do catálogo', async () => {
  const datasets = consultar(`
    SELECT source || '|' || license || '|' || reference_date::text || '|' || checksum
    FROM catalog_datasets ORDER BY source;`);
  console.log(`catalog_datasets:\n${datasets.trim()}`);
  expect(datasets.toLowerCase(), 'proveniência sem licença CC BY do IBGE').toContain('cc by');
  expect(datasets.toLowerCase(), 'proveniência sem data-base').not.toContain('|-|');
  expect(/([a-f0-9]{64})/i.test(datasets), 'proveniência sem sha256').toBe(true);

  const naoPublicados = consultar(`
    SELECT count(*) FROM catalog_territories
    WHERE level = 'BAIRRO' AND approved_version IS NULL;`);
  const restantes = Number(naoPublicados.trim().split('\n').pop() ?? '0');
  console.log(`bairros não publicados: ${restantes}`);
  expect(restantes, 'há bairro ingerido e não publicado (sem --approve)').toBe(0);

  const normalizado = consultar(`
    SELECT string_agg(DISTINCT normalized_name, ',' ORDER BY normalized_name)
    FROM catalog_territories WHERE level = 'BAIRRO' AND name LIKE 'Icaraí';`);
  console.log(`normalized_name de Icaraí: ${normalizado.trim()}`);
  expect(normalizado, 'normalized_name não derivado pelo gatilho').toContain('ICARAI');
});
