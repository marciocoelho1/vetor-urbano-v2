/** Animate a single palette change without cloning the application's DOM or map. */
export class ThemeMotion {
  private transition?: ViewTransition;
  private timer?: ReturnType<typeof setTimeout>;
  private source?: HTMLElement;
  private pending?: { theme: 'light' | 'dark'; update: () => void; source?: HTMLElement };
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

  change(theme: 'light' | 'dark', update: () => void, source?: HTMLElement): void {
    if (this.transition || this.timer) {
      // Replacing an active snapshot exposes the already updated DOM in full.
      // Finish the current reveal, then apply only the latest requested palette.
      this.pending = { theme, update, source };
      return;
    }
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
    root.style.setProperty('--theme-reveal-x', `${x}px`);
    root.style.setProperty('--theme-reveal-y', `${y}px`);
    root.style.setProperty('--theme-reveal-radius', `${radius}px`);
    root.dataset['themeMotion'] = 'reveal';
    const transition = this.document.startViewTransition(() => {
      if (revision === this.revision) update();
    });
    this.transition = transition;
    // CSS owns the mask from the first snapshot frame, even when JS is delayed.
    void transition.ready.catch(() => {
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
    if (this.timer) clearTimeout(this.timer);
    this.transition = undefined;
    this.timer = undefined;
    this.source = undefined;
    this.pending = undefined;
    this.clearStyles();
  }

  destroy(): void {
    this.cancel();
    this.document.removeEventListener('click', this.snapshotClick, true);
  }

  private cleanup(revision: number): void {
    if (revision !== this.revision) return;
    const pending = this.pending;
    this.pending = undefined;
    this.transition = undefined;
    this.timer = undefined;
    this.source = undefined;
    this.clearStyles();
    if (pending && this.document.documentElement.dataset['theme'] !== pending.theme)
      this.change(pending.theme, pending.update, pending.source);
  }

  private clearStyles(): void {
    const root = this.document.documentElement;
    delete root.dataset['themeMotion'];
    root.style.removeProperty('--theme-reveal-x');
    root.style.removeProperty('--theme-reveal-y');
    root.style.removeProperty('--theme-reveal-radius');
  }
}
