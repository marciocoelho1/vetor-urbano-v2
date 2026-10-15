import {
  isMappedRecord,
  type Coordinates,
  type DemoRecord,
  type QueryBounds,
} from '../domain/occurrences';

export interface DemoLocationReference {
  id: string;
  label: string;
  coordinates: Coordinates;
  withinCoverage: boolean;
}

/** Authored references, without a geocoder or official coverage polygons. */
export const DEMO_LOCATION_REFERENCES: DemoLocationReference[] = [
  {
    id: 'central',
    label: 'Central do Brasil · referência fictícia',
    coordinates: [-43.19156448029434, -22.903318808380494],
    withinCoverage: true,
  },
  {
    id: 'outside',
    label: 'Fora do recorte · referência fictícia',
    coordinates: [-46.63, -23.55],
    withinCoverage: false,
  },
];

/** Enframes fixtures only. These bounds are never municipal or neighborhood boundaries. */
export function demoRecordBounds(records: DemoRecord[]): QueryBounds | null {
  const mapped = records.filter(isMappedRecord);
  if (!mapped.length) return null;
  const longitudes = mapped.map((record) => record.coordinates[0]);
  const latitudes = mapped.map((record) => record.coordinates[1]);
  return [
    Math.min(...longitudes) - 0.004,
    Math.min(...latitudes) - 0.004,
    Math.max(...longitudes) + 0.004,
    Math.max(...latitudes) + 0.004,
  ];
}
