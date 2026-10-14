import { Directive, ElementRef, inject, OnDestroy } from '@angular/core';

type ResizeAxis = 'width' | 'height' | 'both';

@Directive({
  selector: '[appPanelResize]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'finish($event)',
    '(pointercancel)': 'finish($event)',
    '(lostpointercapture)': 'finish($event)',
    '(keydown)': 'resizeWithKeyboard($event)',
  },
})
export class PanelResize implements OnDestroy {
  private readonly panel = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private drag?: {
    pointerId: number;
    axis: ResizeAxis;
    x: number;
    y: number;
    width: number;
    height: number;
  };

  private axis(target: EventTarget | null): ResizeAxis | undefined {
    if (!(target instanceof Element)) return undefined;
    const handle = target.closest<HTMLElement>('[data-panel-resize]');
    if (!handle || !this.panel.contains(handle)) return undefined;
    return handle.dataset['panelResize'] as ResizeAxis;
  }

  protected start(event: PointerEvent): void {
    const axis = this.axis(event.target);
    if (!axis || event.button !== 0 || !event.isPrimary || this.drag) return;
    event.preventDefault();
    event.stopPropagation();
    const box = this.panel.getBoundingClientRect();
    this.drag = {
      pointerId: event.pointerId,
      axis,
      x: event.clientX,
      y: event.clientY,
      width: box.width,
      height: box.height,
    };
    (event.target as HTMLElement).focus({ preventScroll: true });
    this.panel.setPointerCapture(event.pointerId);
    this.panel.classList.add('is-resizing');
  }

  protected move(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.applySize(
      drag.axis,
      drag.width + event.clientX - drag.x,
      drag.height + event.clientY - drag.y,
    );
    const box = this.panel.getBoundingClientRect();
    Object.assign(drag, {
      x: event.clientX,
      y: event.clientY,
      width: box.width,
      height: box.height,
    });
  }

  protected finish(event: PointerEvent): void {
    if (event.pointerId !== this.drag?.pointerId) return;
    event.stopPropagation();
    this.stop();
  }

  protected resizeWithKeyboard(event: KeyboardEvent): void {
    const axis = this.axis(event.target);
    if (!axis) return;
    if (event.key === 'Home') {
      event.preventDefault();
      this.panel.style.removeProperty('--filter-panel-width');
      this.panel.style.removeProperty('--filter-panel-height');
      return;
    }
    const horizontal = axis !== 'height' && ['ArrowLeft', 'ArrowRight'].includes(event.key);
    const vertical = axis !== 'width' && ['ArrowUp', 'ArrowDown'].includes(event.key);
    if (!horizontal && !vertical) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 48 : 24;
    const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -step : step;
    const box = this.panel.getBoundingClientRect();
    this.applySize(horizontal ? 'width' : 'height', box.width + delta, box.height + delta);
  }

  private applySize(axis: ResizeAxis, width: number, height: number): void {
    // Clamp the stored values too: after an overshoot, reversing the drag responds immediately.
    const frame = this.panel.parentElement!;
    const style = getComputedStyle(this.panel);
    const maxWidth = frame.clientWidth - parseFloat(style.left) - 12;
    const maxHeight =
      frame.clientHeight -
      parseFloat(style.top) -
      parseFloat(style.getPropertyValue('--filter-panel-bottom'));
    if (axis !== 'height')
      this.panel.style.setProperty(
        '--filter-panel-width',
        `${Math.max(Math.min(260, maxWidth), Math.min(width, maxWidth))}px`,
      );
    if (axis !== 'width')
      this.panel.style.setProperty(
        '--filter-panel-height',
        `${Math.max(Math.min(220, maxHeight), Math.min(height, maxHeight))}px`,
      );
  }

  private stop(): void {
    const pointerId = this.drag?.pointerId;
    this.drag = undefined;
    this.panel.classList.remove('is-resizing');
    if (pointerId !== undefined && this.panel.hasPointerCapture(pointerId))
      this.panel.releasePointerCapture(pointerId);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
