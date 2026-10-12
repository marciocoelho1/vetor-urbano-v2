/** Animate a single palette change without cloning the application's DOM or map. */
export class ThemeMotion {
  private transition?: ViewTransition;
  private animation?: Animation;
  private timer?: ReturnType<typeof setTimeout>;
  private source?: HTMLElement;
  private revision = 0;
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly snapshotClick = (event: MouseEvent) => {
    const source = this.source;
    if (!this.transition || !source?.isConnected || event.target !== this.document.documentElement)
      return;
    // Captured content is excluded from hit-testing. Keep the visible toggle usable
    // by forwarding only clicks within its actual bounds, never other page controls.
    const bounds = source.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      return;
    event.preventDefault();
    source.focus({ preventScroll: true });
    source.click();
  };

  constructor(private readonly document: Document) {
    document.addEventListener('click', this.snapshotClick, true);
  }

  change(update: () => void, source?: HTMLElement): void {
    this.cancel();
    const revision = this.revision;
    if (this.reduced.matches) {
      update();
      return;
    }
    const root = this.document.documentElement;
    if (typeof this.document.startViewTransition !== 'function') {
      root.dataset['themeMotion'] = 'fade';
      // Commit the old styles before switching, so CSS can interpolate the palette.
      void root.offsetWidth;
      update();
      this.timer = setTimeout(() => this.cleanup(revision), 500);
      return;
    }

    const bounds = source?.getBoundingClientRect();
    const x = bounds ? bounds.left + bounds.width / 2 : innerWidth / 2;
    const y = bounds ? bounds.top + bounds.height / 2 : 32;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    this.source = source;
    root.dataset['themeMotion'] = 'reveal';
    const transition = this.document.startViewTransition(() => {
      if (revision === this.revision) update();
    });
    this.transition = transition;
    void transition.ready
      .then(() => {
        if (revision !== this.revision || this.reduced.matches) return;
        this.animation = root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: 640,
            easing: 'cubic-bezier(.4, 0, .2, 1)',
            fill: 'both',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => {
        // A skipped/unsupported snapshot never prevents the final palette change.
      });
    void transition.finished.then(
      () => this.cleanup(revision),
      () => this.cleanup(revision),
    );
  }

  cancel(): void {
    this.revision++;
    this.transition?.skipTransition();
    this.animation?.cancel();
    if (this.timer) clearTimeout(this.timer);
    this.transition = undefined;
    this.animation = undefined;
    this.timer = undefined;
    this.source = undefined;
    delete this.document.documentElement.dataset['themeMotion'];
  }

  destroy(): void {
    this.cancel();
    this.document.removeEventListener('click', this.snapshotClick, true);
  }

  private cleanup(revision: number): void {
    if (revision !== this.revision) return;
    this.animation?.cancel();
    this.transition = undefined;
    this.animation = undefined;
    this.timer = undefined;
    this.source = undefined;
    delete this.document.documentElement.dataset['themeMotion'];
  }
}
