import { describe, expect, it } from 'vitest';
import { MINIMUM_POINTS, polygonFrom, polygonProblem } from './polygon-drawing';

describe('desenho de polígono', () => {
  it('exige ao menos três pontos distintos', () => {
    expect(polygonProblem([])).toContain(String(MINIMUM_POINTS));
    expect(
      polygonProblem([
        [-43.2, -22.9],
        [-43.1, -22.8],
      ]),
    ).toContain('ao menos 3 pontos');
    expect(
      polygonProblem([
        [-43.2, -22.9],
        [-43.2, -22.9],
        [-43.1, -22.8],
      ]),
    ).toContain('distintos');
  });

  it('recusa coordenada fora do intervalo WGS 84', () => {
    expect(
      polygonProblem([
        [-43.2, -22.9],
        [-43.1, -22.8],
        [200, -22.7],
      ]),
    ).toContain('WGS 84');
  });

  it('fecha o anel repetindo o primeiro ponto e mantém [longitude, latitude]', () => {
    const points: Array<[number, number]> = [
      [-43.2, -22.9],
      [-43.1, -22.8],
      [-43.3, -22.7],
    ];
    const polygon = polygonFrom(points);
    expect(polygon.type).toBe('Polygon');
    expect(polygon.coordinates).toHaveLength(1);
    expect(polygon.coordinates[0]).toHaveLength(4);
    expect(polygon.coordinates[0][0]).toEqual([-43.2, -22.9]);
    expect(polygon.coordinates[0][3]).toEqual([-43.2, -22.9]);
  });

  it('não simplifica nem corrige pontos ao formar o polígono', () => {
    const points: Array<[number, number]> = [
      [-43.201234, -22.901234],
      [-43.101234, -22.801234],
      [-43.301234, -22.701234],
    ];
    expect(polygonFrom(points).coordinates[0].slice(0, 3)).toEqual(points);
    expect(() => polygonFrom(points.slice(0, 2))).toThrow();
  });
});
