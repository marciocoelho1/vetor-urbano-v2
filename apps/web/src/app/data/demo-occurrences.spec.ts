import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app';
import { DEMO_LAND_AREAS, disperseDemoOccurrences } from './demo-occurrences';
import {
  distanceMeters,
  filterRecords,
  isMappedRecord,
  type DemoRecord,
} from '../domain/occurrences';

const approvedSecurityCoordinates = [
  [-43.1817, -22.9264],
  [-43.173199999999994, -22.9178],
  [-43.2016, -22.9081],
  [-43.21939999999999, -22.8964],
  [-43.22839999999999, -22.9104],
  [-43.237399999999994, -22.9224],
  [-43.2484, -22.9134],
  [-43.2774, -22.9004],
  [-43.298399999999994, -22.8894],
  [-43.3394, -22.8714],
  [-43.322399999999995, -22.8364],
  [-43.307399999999994, -22.8074],
  [-43.310399999999994, -22.7844],
  [-43.3704, -22.8034],
  [-43.4124, -22.8054],
  [-43.4274, -22.7814],
  [-43.3974, -22.7624],
  [-43.4494, -22.7574],
  [-43.118399999999994, -22.8934],
  [-43.105399999999996, -22.9044],
  [-43.0924, -22.8984],
  [-43.0924, -22.8744],
  [-43.102399999999996, -22.8594],
  [-43.087399999999995, -22.8484],
  [-43.044399999999996, -22.8244],
];

describe('metropolitan demonstration dataset', () => {
  let fixture: ComponentFixture<App>;
  let records: DemoRecord[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    records = (
      fixture.componentInstance as unknown as { allPoints: () => DemoRecord[] }
    ).allPoints();
  });

  it('has 25 distinct fictional occurrences per category, separate from POIs', () => {
    const occurrences = records.filter((point) => point.kind === 'occurrence');
    expect(occurrences).toHaveLength(75);
    expect(records.filter((point) => point.kind === 'poi')).toHaveLength(2);
    expect(new Set(occurrences.map((point) => point.id)).size).toBe(75);
    expect(
      new Set(occurrences.filter(isMappedRecord).map((point) => point.coordinates.join(','))).size,
    ).toBe(72);
    const coincidents = occurrences.filter(
      (point) => point.id === 'demo-002' || point.id === 'demo-contingencia-004',
    );
    expect(coincidents).toHaveLength(2);
    expect(coincidents[0].coordinates).toEqual(coincidents[1].coordinates);
    expect(occurrences.filter((point) => !isMappedRecord(point))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'demo-transito-008',
          coordinates: null,
          locationPrecision: 'TERRITORY',
        }),
        expect.objectContaining({
          id: 'demo-contingencia-008',
          coordinates: null,
          locationPrecision: 'TERRITORY',
        }),
      ]),
    );
    for (const category of ['TRANSITO', 'SEGURANCA', 'CONTINGENCIA']) {
      const points = filterRecords(records, { categories: [category] });
      expect(points).toHaveLength(25);
      expect(points.every((point) => point.sourceId === 'demo')).toBe(true);
      expect(points.every((point) => /fictíci|sintétic/.test(point.description!))).toBe(true);
      expect(new Set(points.map((point) => point.location!.split(', ')[1])).size).toBe(9);
    }
  });

  it('spans the urban metropolitan area without isolated fixtures', () => {
    const municipalities = new Set([
      'Rio de Janeiro',
      'Duque de Caxias',
      'São João de Meriti',
      'Nilópolis',
      'Mesquita',
      'Belford Roxo',
      'Nova Iguaçu',
      'Niterói',
      'São Gonçalo',
    ]);
    for (const category of ['TRANSITO', 'SEGURANCA', 'CONTINGENCIA']) {
      const points = records.filter(isMappedRecord).filter((point) => point.category === category);
      let maximumDistance = 0;
      for (const point of points) {
        expect(municipalities.has(point.location!.split(', ')[1]!)).toBe(true);
        const distances = points
          .filter((other) => other.id !== point.id)
          .map((other) => distanceMeters(point.coordinates, other.coordinates));
        expect(Math.min(...distances)).toBeLessThan(8000);
        maximumDistance = Math.max(maximumDistance, ...distances);
      }
      expect(maximumDistance).toBeGreaterThan(40_000);
      expect(maximumDistance).toBeLessThan(50_000);
    }
  });

  it('preserves every security position while varying the other categories on inland areas', () => {
    expect(
      records.filter((point) => point.category === 'SEGURANCA').map((point) => point.coordinates),
    ).toEqual(approvedSecurityCoordinates);
    const randomized = records
      .filter(isMappedRecord)
      .filter((point) => ['TRANSITO', 'CONTINGENCIA'].includes(point.category ?? ''));
    expect(randomized).toHaveLength(48);
    for (const point of randomized) {
      const [longitude, latitude] = point.coordinates;
      expect(
        DEMO_LAND_AREAS.some(
          (area) =>
            longitude >= area.bounds[0] &&
            longitude <= area.bounds[2] &&
            latitude >= area.bounds[1] &&
            latitude <= area.bounds[3],
        ),
      ).toBe(true);
      for (const other of records
        .filter(isMappedRecord)
        .filter(
          (other) =>
            other.kind === 'occurrence' &&
            other.id !== point.id &&
            !(
              (point.id === 'demo-contingencia-004' && other.id === 'demo-002') ||
              (point.id === 'demo-002' && other.id === 'demo-contingencia-004')
            ),
        )) {
        expect(distanceMeters(point.coordinates, other.coordinates)).toBeGreaterThanOrEqual(900);
      }
    }
    expect(randomized.find((point) => point.id === 'demo-001')!.coordinates).not.toEqual([
      -43.1812, -22.9035,
    ]);
    expect(disperseDemoOccurrences(records).map((point) => point.coordinates)).toEqual(
      records.map((point) => point.coordinates),
    );
  });

  it('makes the expanded 25 km radius observable in map/list filters', () => {
    const center: [number, number] = [-43.19156448029434, -22.903318808380494];
    const small = filterRecords(records, { categories: ['TRANSITO'], center, radiusMeters: 5000 });
    const large = filterRecords(records, { categories: ['TRANSITO'], center, radiusMeters: 25000 });
    expect(large.length).toBeGreaterThan(small.length);
    expect(large.some((point) => point.location!.endsWith('Duque de Caxias'))).toBe(true);
    expect(
      large.every(
        (point) => isMappedRecord(point) && distanceMeters(center, point.coordinates) <= 25000,
      ),
    ).toBe(true);
  });
});
