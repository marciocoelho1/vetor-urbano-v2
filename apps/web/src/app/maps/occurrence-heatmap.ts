import type { Coordinates, DemoRecord } from '../domain/occurrences';

/** CSS pixels, not meters. Zoom changes the geographic footprint, never the legend. */
export const HEAT_RADIUS_PX = 24;
export const HEAT_SATURATION = 4;
export const HEAT_LEGEND =
  'Concentração de ocorrências disponíveis, sem pesos. Azul: baixa; amarelo: intermediária; vermelho: alta (saturação em 4 ocorrências equivalentes no centro). Não é índice de risco. Filtros alteram o conjunto; zoom altera a área geográfica de influência de 24 px. Arrastar não altera a escala de cores. POIs e locais apenas territoriais não contribuem.';
export type ScreenPoint = readonly [x: number, y: number];
export interface HeatPoint {
  readonly id: string;
  readonly coordinates: Readonly<Coordinates>;
}
export interface HeatmapSnapshot {
  readonly points: readonly HeatPoint[];
  readonly eligibleCount: number;
}

/** Receives the complete filtered query, never a viewport subset or clipping list. */
export function createHeatmapSnapshot(records: readonly DemoRecord[]): HeatmapSnapshot {
  const seen = new Set<string>();
  const points: HeatPoint[] = [];
  for (const record of records) {
    const coordinates = record.coordinates;
    if (
      record.kind !== 'occurrence' ||
      (record.publicationStatus !== undefined && record.publicationStatus !== 'PUBLISHED') ||
      record.locationPrecision === 'TERRITORY' ||
      !coordinates ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite) ||
      Math.abs(coordinates[0]) > 180 ||
      Math.abs(coordinates[1]) > 90 ||
      seen.has(record.id)
    )
      continue;
    seen.add(record.id);
    points.push(
      Object.freeze({ id: record.id, coordinates: Object.freeze([...coordinates] as Coordinates) }),
    );
  }
  return Object.freeze({ points: Object.freeze(points), eligibleCount: points.length });
}

function kernel(dx: number, dy: number): number {
  const distanceSquared = (dx * dx + dy * dy) / (HEAT_RADIUS_PX * HEAT_RADIUS_PX);
  return distanceSquared >= 1 ? 0 : (1 - distanceSquared) ** 2;
}

export function sampleHeatDensity(points: readonly ScreenPoint[], at: ScreenPoint): number {
  return points.reduce((sum, point) => sum + kernel(point[0] - at[0], point[1] - at[1]), 0);
}

/** Fixed transfer function shared by both map engines; never uses viewport maximum. */
export function heatColor(density: number): readonly [number, number, number, number] {
  if (!Number.isFinite(density) || density <= 0) return [0, 0, 0, 0];
  const value = Math.min(density / HEAT_SATURATION, 1);
  const low = value <= 0.5 ? [37, 99, 235] : [250, 204, 21];
  const high = value <= 0.5 ? [250, 204, 21] : [220, 38, 38];
  const fraction = value <= 0.5 ? value * 2 : (value - 0.5) * 2;
  return [
    Math.round(low[0]! + (high[0]! - low[0]!) * fraction),
    Math.round(low[1]! + (high[1]! - low[1]!) * fraction),
    Math.round(low[2]! + (high[2]! - low[2]!) * fraction),
    Math.round(210 * Math.min(density, 1)),
  ];
}

/** CPU raster shared by MapLibre/Leaflet overlays. Project into CSS pixels first.
 * Keep offscreen points: kernels can cross the canvas boundary. No network or DOM.
 */
export function rasterizeHeatmap(
  points: readonly ScreenPoint[],
  width: number,
  height: number,
): Uint8ClampedArray {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 0 ||
    height < 0 ||
    width * height > 4_000_000
  ) {
    throw new RangeError('Dimensões inválidas ou maiores que 4 milhões de pixels CSS.');
  }
  const density = new Float64Array(width * height);
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const left = Math.max(0, Math.ceil(x - HEAT_RADIUS_PX));
    const right = Math.min(width - 1, Math.floor(x + HEAT_RADIUS_PX));
    const top = Math.max(0, Math.ceil(y - HEAT_RADIUS_PX));
    const bottom = Math.min(height - 1, Math.floor(y + HEAT_RADIUS_PX));
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++) {
        density[row * width + column]! += kernel(column - x, row - y);
      }
    }
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < density.length; index++) {
    pixels.set(heatColor(density[index]!), index * 4);
  }
  return pixels;
}
