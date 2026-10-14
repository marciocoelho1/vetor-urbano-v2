import { AfterViewInit, Directive, ElementRef, inject, Input, OnDestroy } from '@angular/core';
import type { gsap as Gsap } from 'gsap';

/** One small entrance per view. The content stays usable while GSAP loads. */
@Directive({ selector: '[appViewMotion]' })
export class ViewMotion implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private gsap?: typeof Gsap;
  private media?: ReturnType<typeof Gsap.matchMedia>;
  private context?: ReturnType<typeof Gsap.context>;
  private destroyed = false;
  private motionAllowed = false;
  private currentView = 'map';

  @Input() set appViewMotion(view: string) {
    if (view === this.currentView) return;
    this.currentView = view;
    // Angular completes the new view before the scoped animation queries its DOM.
    queueMicrotask(() => this.animate());
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    void this.loadMotion();
  }

  private async loadMotion(): Promise<void> {
    try {
      const { gsap } = await import('gsap');
      if (this.destroyed) return;
      this.gsap = gsap;
      this.media = gsap.matchMedia();
      this.media.add('(prefers-reduced-motion: no-preference)', () => {
        this.motionAllowed = true;
        this.animate();
        return () => {
          this.motionAllowed = false;
          this.context?.revert();
        };
      });
    } catch {
      // An optional motion chunk must never prevent navigation or hide content.
    }
  }

  private animate(): void {
    if (!this.gsap || !this.motionAllowed || this.destroyed) return;
    this.context?.revert();
    const gsap = this.gsap;
    this.context = gsap.context(() => {
      const root = this.element.nativeElement;
      const heading = root.querySelector<HTMLElement>(`[data-view-title="${this.currentView}"]`);
      if (!heading) return;
      const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
      timeline.from(heading, {
        y: 10,
        opacity: 0.35,
        duration: 0.5,
        clearProps: 'transform,opacity',
      });
      if (this.currentView === 'map') {
        timeline.from(
          root.querySelector('.map-search-wrap'),
          { y: 5, opacity: 0.6, duration: 0.4, clearProps: 'transform,opacity' },
          0.08,
        );
        timeline.from(
          root.querySelector('.map-frame'),
          { opacity: 0.6, duration: 0.6, clearProps: 'opacity' },
          0.12,
        );
      }
    }, this.element.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.media?.revert();
    this.context?.revert();
  }
}
