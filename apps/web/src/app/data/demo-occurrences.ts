import type { FactTime } from '../domain/temporal';
import { OCCURRENCE_CATALOGUE, UNKNOWN_SUBTYPE } from '../domain/catalogue';
import {
  distanceMeters,
  isMappedRecord,
  type Coordinates,
  type DemoRecord,
} from '../domain/occurrences';

type DemoOccurrence = DemoRecord & {
  name: string;
  description: string;
  location: string;
  insertedAt: string;
};

// Synthetic urban anchors, deliberately avoiding random points over Guanabara Bay.
// This subset of the RMRJ is a visualization fixture, not an operational coverage boundary.
const ANCHORS: { location: string; coordinates: Coordinates }[] = [
  { location: 'Centro, Rio de Janeiro', coordinates: [-43.1812, -22.9035] },
  { location: 'Glória, Rio de Janeiro', coordinates: [-43.1748, -22.9194] },
  { location: 'Cidade Nova, Rio de Janeiro', coordinates: [-43.2032, -22.9097] },
  { location: 'São Cristóvão, Rio de Janeiro', coordinates: [-43.221, -22.898] },
  { location: 'Maracanã, Rio de Janeiro', coordinates: [-43.23, -22.912] },
  { location: 'Tijuca, Rio de Janeiro', coordinates: [-43.239, -22.924] },
  { location: 'Vila Isabel, Rio de Janeiro', coordinates: [-43.25, -22.915] },
  { location: 'Méier, Rio de Janeiro', coordinates: [-43.279, -22.902] },
  { location: 'Engenho de Dentro, Rio de Janeiro', coordinates: [-43.3, -22.891] },
  { location: 'Madureira, Rio de Janeiro', coordinates: [-43.341, -22.873] },
  { location: 'Irajá, Rio de Janeiro', coordinates: [-43.324, -22.838] },
  { location: 'Vigário Geral, Rio de Janeiro', coordinates: [-43.309, -22.809] },
  { location: 'Centro, Duque de Caxias', coordinates: [-43.312, -22.786] },
  { location: 'Centro, São João de Meriti', coordinates: [-43.372, -22.805] },
  { location: 'Centro, Nilópolis', coordinates: [-43.414, -22.807] },
  { location: 'Centro, Mesquita', coordinates: [-43.429, -22.783] },
  { location: 'Centro, Belford Roxo', coordinates: [-43.399, -22.764] },
  { location: 'Centro, Nova Iguaçu', coordinates: [-43.451, -22.759] },
  { location: 'Centro, Niterói', coordinates: [-43.12, -22.895] },
  { location: 'Icaraí, Niterói', coordinates: [-43.107, -22.906] },
  { location: 'Santa Rosa, Niterói', coordinates: [-43.094, -22.9] },
  { location: 'Fonseca, Niterói', coordinates: [-43.094, -22.876] },
  { location: 'Barreto, Niterói', coordinates: [-43.104, -22.861] },
  { location: 'Neves, São Gonçalo', coordinates: [-43.089, -22.85] },
  { location: 'Centro, São Gonçalo', coordinates: [-43.046, -22.826] },
];

// Authored, conservative inland rectangles, not official municipal boundaries.
// Never sample the RMRJ's bounding box: it includes Guanabara Bay.
export const DEMO_LAND_AREAS: { municipality: string; bounds: [number, number, number, number] }[] =
  [
    { municipality: 'Rio de Janeiro', bounds: [-43.22, -22.92, -43.185, -22.902] },
    { municipality: 'Rio de Janeiro', bounds: [-43.36, -22.915, -43.26, -22.865] },
    { municipality: 'Duque de Caxias', bounds: [-43.34, -22.795, -43.3, -22.765] },
    { municipality: 'São João de Meriti', bounds: [-43.39, -22.815, -43.36, -22.79] },
    { municipality: 'Nilópolis', bounds: [-43.425, -22.821, -43.402, -22.803] },
    { municipality: 'Mesquita', bounds: [-43.45, -22.798, -43.423, -22.773] },
    { municipality: 'Belford Roxo', bounds: [-43.418, -22.765, -43.385, -22.73] },
    { municipality: 'Nova Iguaçu', bounds: [-43.48, -22.775, -43.436, -22.745] },
    { municipality: 'Niterói', bounds: [-43.108, -22.907, -43.078, -22.857] },
    { municipality: 'São Gonçalo', bounds: [-43.085, -22.858, -43.025, -22.817] },
  ];

function seededRandom(id: string): () => number {
  let state = 2166136261;
  for (const character of id) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Keeps security coordinates intact and separates other fixtures by at least 900 m. */
export function disperseDemoOccurrences<T extends DemoRecord>(records: T[]): T[] {
  const occupied = records
    .filter(isMappedRecord)
    .filter((point) => point.category === 'SEGURANCA')
    .map((point) => point.coordinates);
  return records.map((point) => {
    if (
      !isMappedRecord(point) ||
      point.kind !== 'occurrence' ||
      !['TRANSITO', 'CONTINGENCIA'].includes(point.category ?? '')
    )
      return point;
    const municipality = point.location!.split(', ')[1]!;
    const areas = DEMO_LAND_AREAS.filter((area) => area.municipality === municipality);
    const random = seededRandom(point.id);
    for (let attempt = 0; attempt < 4096; attempt++) {
      const [west, south, east, north] = areas[Math.floor(random() * areas.length)]!.bounds;
      const coordinates: Coordinates = [
        west + random() * (east - west),
        south + random() * (north - south),
      ];
      if (occupied.some((other) => distanceMeters(coordinates, other) < 900)) continue;
      occupied.push(coordinates);
      const location = `Recorte urbano demonstrativo, ${municipality}`;
      return {
        ...point,
        coordinates,
        location,
        name: `${point.name!.split(' · ')[0]} · ${municipality}`,
      };
    }
    throw new Error(
      `Não foi possível distribuir a fixture ${point.id} em terra firme com espaçamento mínimo.`,
    );
  });
}

/** Completes the four existing occurrences to exactly 25 per category (75 total). */
export function createMetropolitanDemoOccurrences(reference: Date): DemoOccurrence[] {
  const hoursAgo = (hours: number) =>
    new Date(reference.getTime() - hours * 3_600_000).toISOString();
  return (['TRANSITO', 'SEGURANCA', 'CONTINGENCIA'] as const).flatMap((category, categoryIndex) =>
    ANCHORS.slice(category === 'TRANSITO' ? 2 : 1).map((anchor, index) => {
      const types = OCCURRENCE_CATALOGUE.filter((type) => type.category === category);
      const type = types[index % types.length]!;
      const typeLabel = type.label;
      // Small distinct offsets keep categories close enough for density visualization.
      const offset = (categoryIndex + 1) * 0.0008;
      // Explicit authored scenario: one old road closure has recent confirmation.
      // The remaining generated records lack evidence of their current situation.
      const confirmedOldClosure = category === 'TRANSITO' && index === 6;
      let factTime: FactTime | undefined;
      if (category === 'TRANSITO' && index === 8) {
        factTime = {
          precision: 'DAY',
          date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(
            new Date(hoursAgo(38)),
          ),
        };
      }
      if (category === 'TRANSITO' && index === 7) {
        factTime = { precision: 'INTERVAL', start: hoursAgo(36), end: hoursAgo(32) };
      }
      if (category === 'TRANSITO' && index === 20) {
        const previousMonth = new Date(reference);
        previousMonth.setUTCDate(1);
        previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
        factTime = { precision: 'MONTH', month: previousMonth.toISOString().slice(0, 7) };
      }
      return {
        id: `demo-${category.toLowerCase()}-${String(index + 1).padStart(3, '0')}`,
        kind: 'occurrence',
        category,
        name: `Simulação de ${typeLabel.toLowerCase()} · ${anchor.location}`,
        description:
          'Ocorrência inteiramente fictícia para testar filtros e mancha térmica; não representa evento real nem risco do local.',
        location: anchor.location,
        group:
          category === 'SEGURANCA'
            ? 'CRIMES'
            : category === 'CONTINGENCIA'
              ? 'CALAMIDADE_PUBLICA'
              : 'OUTROS_REGISTROS',
        crime: type.id === 'FURTO' ? 'FURTO' : undefined,
        occurrenceType: type.id,
        subtype: type.subtypes.length && index % 2 === 0 ? type.subtypes[0] : UNKNOWN_SUBTYPE,
        publicationStatus: 'PUBLISHED',
        reliabilityScore: 3,
        typeLabel,
        severity: ['BAIXA', 'MODERADA', 'ALTA'][index % 3],
        operationalStatus: index % 4 === 0 ? 'EXPIRED' : 'RESOLVED',
        occurredAt: factTime ? undefined : hoursAgo(6 + index * 4 + categoryIndex),
        factTime,
        situation: confirmedOldClosure ? 'ONGOING' : 'UNKNOWN',
        lastCheckedAt: confirmedOldClosure ? hoursAgo(1) : undefined,
        situationHistory: confirmedOldClosure
          ? [
              {
                situation: 'ONGOING',
                at: hoursAgo(1),
                reason:
                  'Confirmação fictícia de bloqueio antigo; validade sintética local de 4 horas.',
              },
            ]
          : [],
        sourcePublishedAt: hoursAgo(1),
        collectedAt: hoursAgo(0.75),
        reviewedAt: hoursAgo(0.5),
        systemPublishedAt: hoursAgo(0.25),
        insertedAt: hoursAgo(5 + index * 4 + categoryIndex),
        sourceId: 'demo',
        coordinates: [
          anchor.coordinates[0] + offset,
          anchor.coordinates[1] + offset,
        ] as Coordinates,
        properties: { demonstracao: 'true', municipio: anchor.location.split(', ')[1]! },
      } satisfies DemoOccurrence;
    }),
  );
}

/** Enriches existing fixtures without increasing occurrence or publication counts. */
export function relateDemoOccurrences<T extends DemoRecord>(records: T[]): T[] {
  return records.map((record) => {
    if (record.kind !== 'occurrence') return record;
    const reference = (suffix: string) => ({
      id: `${record.id}-${suffix}`,
      sourceName:
        suffix === 'B' ? 'Canal fictício sem URL pública' : 'Fonte fictícia — Demonstração local',
      title: `Publicação fictícia ${suffix}`,
      identifier: `DEMO:${record.id}:${suffix}`,
      url: `https://example.invalid/publicacoes/${record.id}/${suffix}`,
    });
    const common = {
      ...record,
      happeningId: record.id,
      references: [reference('A')],
    };
    if (record.id === 'demo-002')
      return {
        ...common,
        happeningId: 'demo-acontecimento-arvore',
        references: [reference('A'), reference('B')],
        description:
          'Bloqueio parcial fictício causado pela queda de uma árvore no recorte demonstrativo. Duas publicações descrevem o mesmo efeito.',
        specificFields: [
          { label: 'Pessoas afetadas', value: null },
          { label: 'Veículos envolvidos', value: null, applicability: 'NOT_APPLICABLE' as const },
          { label: 'Faixas bloqueadas', value: 1 },
          { label: 'Via / trecho', value: 'Via fictícia do recorte urbano demonstrativo' },
        ],
      };
    if (record.id === 'demo-contingencia-004' || record.id === 'demo-contingencia-001') {
      const tree = record.id === 'demo-contingencia-004';
      return {
        ...common,
        happeningId: 'demo-acontecimento-arvore',
        name: `${tree ? 'Queda de árvore' : 'Interrupção de energia'} · demonstração fictícia`,
        description: tree
          ? 'Queda de árvore fictícia; retirada concluída. O bloqueio e a interrupção de energia têm situações independentes.'
          : 'Interrupção fictícia de energia após queda de árvore; restabelecimento não informado.',
        occurrenceType: tree ? 'ARVORE' : 'ENERGIA',
        typeLabel: tree ? 'Queda de árvore' : 'Interrupção de energia',
        operationalStatus: tree ? ('RESOLVED' as const) : ('EXPIRED' as const),
        situation: tree ? ('CLOSED' as const) : ('UNKNOWN' as const),
        situationHistory: tree
          ? [
              {
                situation: 'CLOSED' as const,
                at: record.occurredAt!,
                reason:
                  'Retirada concluída explicitamente nesta simulação de árvore; efeitos relacionados têm situações independentes.',
              },
            ]
          : record.situationHistory,
        specificFields: [{ label: tree ? 'Pessoas afetadas' : 'Imóveis afetados', value: null }],
      };
    }
    if (record.occurrenceType === 'ACIDENTE' && record.id === 'demo-transito-001')
      return {
        ...common,
        specificFields: [
          {
            label: 'Característica adicional',
            value: 'Capotamento após colisão; mesma ocorrência',
          },
          { label: 'Feridos', value: null },
        ],
      };
    return common;
  });
}
