import { describe, expect, it, vi } from 'vitest';
import { mountOccurrenceHeatmap } from './occurrence-heatmap-overlay';

describe('overlay portátil da mancha térmica', () => {
  it('reports canvas failure and recovery without losing the portable overlay', () => {
    const container = document.createElement('div');
    Object.defineProperties(container, { clientWidth: { value: 2 }, clientHeight: { value: 2 } });
    let pending: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      pending = fn;
      return 1;
    });
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onError = vi.fn();
    const onReady = vi.fn();
    const overlay = mountOccurrenceHeatmap({
      container,
      project: () => [0, 0],
      subscribe: () => () => {},
      onError,
      onReady,
    });
    try {
      overlay.update([], true);
      pending!(0);
      expect(onError).toHaveBeenCalledOnce();
      expect(container.querySelector('canvas')!.hidden).toBe(true);
      context.mockReturnValue({
        createImageData: () => ({ data: new Uint8ClampedArray(16) }),
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
      overlay.update([], true);
      pending!(0);
      expect(onReady).toHaveBeenCalledOnce();
      expect(container.querySelector('canvas')!.hidden).toBe(false);
    } finally {
      overlay.destroy();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it('redesenha por movimento, oculta no modo inativo e libera os recursos', () => {
    const container = document.createElement('div');
    Object.defineProperties(container, { clientWidth: { value: 80 }, clientHeight: { value: 60 } });
    document.body.append(container);
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData,
    } as unknown as CanvasRenderingContext2D);
    let pending: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending = callback;
      return 1;
    });
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    let redraw = () => {};
    const unsubscribe = vi.fn();
    const project = vi.fn(() => [30, 30] as const);
    const overlay = mountOccurrenceHeatmap({
      onError: vi.fn(),
      container,
      project,
      subscribe: (fn) => {
        redraw = fn;
        return unsubscribe;
      },
    });
    try {
      const canvas = container.querySelector('canvas')!;
      expect(canvas.hidden).toBe(true);
      expect(canvas.style.pointerEvents).toBe('none');
      overlay.update([{ id: 'sintetica', kind: 'occurrence', coordinates: [-43, -23] }], true);
      pending!(0);
      expect(project).toHaveBeenCalledWith([-43, -23]);
      expect(putImageData).toHaveBeenCalledOnce();
      redraw();
      pending!(0);
      expect(putImageData).toHaveBeenCalledTimes(2);
      overlay.update([], false);
      expect(canvas.hidden).toBe(true);
      overlay.update([], true);
      overlay.destroy();
      expect(cancel).toHaveBeenCalledWith(1);
      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(container.querySelector('canvas')).toBeNull();
    } finally {
      overlay.destroy();
      container.remove();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
