import { describe, expect, it } from 'vitest';
import type { DemoRecord } from '../domain/occurrences';
import {
  createHeatmapSnapshot,
  sampleHeatDensity,
  rasterizeHeatmap,
  heatColor,
} from './occurrence-heatmap';

const point = (id: string, extra: Partial<DemoRecord> = {}): DemoRecord => ({
  id,
  kind: 'occurrence',
  coordinates: [-43, -23],
  locationPrecision: 'POINT',
  publicationStatus: 'PUBLISHED',
  ...extra,
});

describe('concentração de ocorrências consolidadas (ticket 32)', () => {
  it('mantém duas concentrações equivalentes e o pan sem normalização local', () => {
    const points = [
      [30, 30],
      [30, 30],
      [90, 30],
      [90, 30],
    ] as const;
    const pixels = rasterizeHeatmap(points, 120, 60);
    const at = (x: number, y: number) => [
      ...pixels.slice((y * 120 + x) * 4, (y * 120 + x) * 4 + 4),
    ];
    expect(at(30, 30)).toEqual([250, 204, 21, 210]);
    expect(at(90, 30)).toEqual(at(30, 30));
    const moved = rasterizeHeatmap(
      points.map(([x, y]) => [x - 60, y]),
      60,
      60,
    );
    expect([...moved.slice((30 * 60 + 30) * 4, (30 * 60 + 30) * 4 + 4)]).toEqual(at(90, 30));
    expect(sampleHeatDensity(points, [30, 42])).toBe(1.125);
    expect(sampleHeatDensity(points, [30, 54])).toBe(0);
  });

  it('remove contribuição pelo conjunto e não pelo número de referências', () => {
    const records = [
      point('a', { references: [{ id: 'r', sourceName: 'Sintética', title: 'Exemplo' }] }),
      point('b'),
    ];
    const original = createHeatmapSnapshot(records);
    records[0]!.references!.push({ id: 'r2', sourceName: 'Sintética', title: 'Repetida' });
    expect(createHeatmapSnapshot(records)).toEqual(original);
    expect(createHeatmapSnapshot(records.slice(1)).eligibleCount).toBe(1);
    records[0]!.coordinates![0] = -44;
    expect(original.points[0]!.coordinates).toEqual([-43, -23]);
  });

  it('preserva contribuição fora da janela, vazio transparente e saturação fixa', () => {
    expect(rasterizeHeatmap([[-1, 10]], 20, 20)[10 * 20 * 4 + 3]).toBeGreaterThan(0);
    expect([...rasterizeHeatmap([], 2, 2)]).toEqual(Array(16).fill(0));
    expect(heatColor(4)).toEqual([220, 38, 38, 210]);
    expect(heatColor(400)).toEqual(heatColor(4));
    expect(() => rasterizeHeatmap([], -1, 1)).toThrow(RangeError);
    expect(() => rasterizeHeatmap([], 4000, 4000)).toThrow(RangeError);
  });

  it('conta a ocorrência uma vez sem pesos, excluindo POI, território e não publicadas', () => {
    const snapshot = createHeatmapSnapshot([
      point('a', { reliabilityScore: 1, severity: 'ALTA' }),
      point('a', { sourceId: 'outra-publicacao' }),
      point('b', { reliabilityScore: 5 }),
      point('poi', { kind: 'poi' }),
      point('bairro', { locationPrecision: 'TERRITORY' }),
      point('pendente', { publicationStatus: 'PENDING' }),
      point('retirada', { publicationStatus: 'WITHDRAWN' }),
      point('sem-local', { coordinates: null }),
      point('invalida', { coordinates: [-181, -23] }),
    ]);
    expect(snapshot.points.map((p) => p.id)).toEqual(['a', 'b']);
    expect(snapshot.eligibleCount).toBe(2);
    expect(
      sampleHeatDensity(
        snapshot.points.map(() => [50, 50]),
        [50, 50],
      ),
    ).toBe(2);
  });
});
