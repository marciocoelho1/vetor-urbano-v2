/**
 * Geometria do desenho de área no mapa (pedido do responsável em 22/10/2026).
 *
 * O administrador clica pontos no mapa; as coordenadas desses pontos definem o polígono. Regras
 * explícitas para não inventar área: são necessários ao menos três pontos distintos, o anel é fechado
 * repetindo o primeiro ponto e as coordenadas saem em [longitude, latitude] (WGS 84), como o resto do
 * projeto. Nada é simplificado nem corrigido em silêncio.
 */
export type MapPoint = [number, number];

export const MINIMUM_POINTS = 3;

/** Motivo legível para recusar o desenho, ou null quando está válido. */
export function polygonProblem(points: MapPoint[]): string | null {
  if (points.length < MINIMUM_POINTS) {
    return `Marque ao menos ${MINIMUM_POINTS} pontos no mapa para fechar a área.`;
  }
  const distinct = new Set(points.map(([longitude, latitude]) => `${longitude},${latitude}`));
  if (distinct.size < MINIMUM_POINTS) {
    return 'Os pontos marcados precisam ser distintos para formar uma área.';
  }
  const invalid = points.some(
    ([longitude, latitude]) =>
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > 90,
  );
  if (invalid) return 'Coordenada fora do intervalo válido (WGS 84).';
  return null;
}

/** GeoJSON Polygon a partir dos pontos marcados; o anel fecha repetindo o primeiro ponto. */
export function polygonFrom(points: MapPoint[]): {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
} {
  const problem = polygonProblem(points);
  if (problem) throw new Error(problem);
  const ring: Array<[number, number]> = points.map(([longitude, latitude]) => [
    longitude,
    latitude,
  ]);
  const [firstLongitude, firstLatitude] = ring[0];
  ring.push([firstLongitude, firstLatitude]);
  return { type: 'Polygon', coordinates: [ring] };
}
