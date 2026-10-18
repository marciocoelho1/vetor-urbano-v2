import type { Coordinates, DemoRecord } from '../domain/occurrences';
import { createHeatmapSnapshot, rasterizeHeatmap, type ScreenPoint } from './occurrence-heatmap';

/** Adapter: MapLibre project([lng,lat]); Leaflet latLngToContainerPoint([lat,lng]). */
export interface HeatmapViewport {
  container: HTMLElement;
  project: (coordinates: Readonly<Coordinates>) => ScreenPoint;
  subscribe: (redraw: () => void) => () => void;
  onError: (message: string) => void;
  onReady?: () => void;
}

/** One renderer for both engines. The owner enforces authenticated advanced mode.
 * The canvas never captures input or replaces accessible results/legend.
 */
export function mountOccurrenceHeatmap(viewport: HeatmapViewport): {
  update: (records: readonly DemoRecord[], enabled: boolean) => void;
  destroy: () => void;
} {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset['testid'] = 'occurrence-heatmap';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '450',
  });
  viewport.container.append(canvas);
  let snapshot = createHeatmapSnapshot([]);
  let enabled = false;
  let frame: number | undefined;
  let destroyed = false;
  const draw = (): void => {
    frame = undefined;
    if (!enabled || destroyed) return;
    const width = Math.floor(viewport.container.clientWidth);
    const height = Math.floor(viewport.container.clientHeight);
    try {
      if (!width || !height) return;
      const pixels = rasterizeHeatmap(
        snapshot.points.map((p) => viewport.project(p.coordinates)),
        width,
        height,
      );
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D indisponível.');
      const image = context.createImageData(width, height);
      image.data.set(pixels);
      context.putImageData(image, 0, 0);
      canvas.hidden = false;
      viewport.onReady?.();
    } catch {
      canvas.hidden = true;
      viewport.onError('Mancha térmica indisponível. O recorte e a lista permanecem disponíveis.');
    }
  };
  const schedule = (): void => {
    if (frame === undefined && enabled && !destroyed) frame = requestAnimationFrame(draw);
  };
  const unsubscribe = viewport.subscribe(schedule);
  const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
  resize?.observe(viewport.container);
  canvas.hidden = true;
  return {
    update(records, active) {
      if (destroyed) return;
      snapshot = createHeatmapSnapshot(records);
      enabled = active;
      canvas.hidden = !enabled;
      schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      unsubscribe();
      resize?.disconnect();
      canvas.remove();
    },
  };
}
