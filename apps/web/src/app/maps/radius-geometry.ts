import type { Feature, Polygon } from 'geojson';
import {
  MAXIMUM_RADIUS_METERS,
  MINIMUM_RADIUS_METERS,
  type Coordinates,
} from '../domain/occurrences';

const EARTH_RADIUS_METERS = 6_371_008.8;

export function createRadiusCircle(
  center: Coordinates,
  radiusMeters: number,
  steps = 64,
): Feature<Polygon, { radiusMeters: number }> {
  const [longitude, latitude] = center;
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error('O centro do raio precisa estar dentro dos limites WGS84.');
  }
  if (
    !Number.isFinite(radiusMeters) ||
    radiusMeters < MINIMUM_RADIUS_METERS ||
    radiusMeters > MAXIMUM_RADIUS_METERS
  ) {
    throw new Error(
      `O raio precisa estar entre ${MINIMUM_RADIUS_METERS} e ${MAXIMUM_RADIUS_METERS} metros.`,
    );
  }
  if (!Number.isInteger(steps) || steps < 12 || steps > 256) {
    throw new Error('A resolução do círculo precisa estar entre 12 e 256 segmentos.');
  }

  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const ring: Coordinates[] = [];
  for (let index = 0; index < steps; index += 1) {
    const bearing = (2 * Math.PI * index) / steps;
    const pointLatitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance) +
        Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude =
      longitudeRadians +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
        Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(pointLatitude),
      );
    const normalizedLongitude = (((pointLongitude * 180) / Math.PI + 540) % 360) - 180;
    ring.push([normalizedLongitude, (pointLatitude * 180) / Math.PI]);
  }
  ring.push([...ring[0]!]);

  return {
    type: 'Feature',
    properties: { radiusMeters },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}
