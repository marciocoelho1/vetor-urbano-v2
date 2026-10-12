import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { ThemeMotion } from './theme-motion';

type ThemePreference = 'light' | 'dark' | null;
const STORAGE_KEY = 'vu2.theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly dark = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private preference: ThemePreference = null;
  private media?: MediaQueryList;
  private motion?: ThemeMotion;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.motion = new ThemeMotion(this.document);
    this.media = window.matchMedia('(prefers-color-scheme: dark)');
    try {
      this.preference = this.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      // A blocked storage area still allows changing the theme for this tab.
    }
    this.apply(this.preference ?? (this.media.matches ? 'dark' : 'light'));

    const systemChanged = () => {
      if (!this.preference) {
        this.motion?.cancel();
        this.apply(this.media!.matches ? 'dark' : 'light');
      }
    };
    const preferenceChanged = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      this.motion?.cancel();
      this.preference = this.parse(event.newValue);
      this.apply(this.preference ?? (this.media!.matches ? 'dark' : 'light'));
    };
    this.media.addEventListener('change', systemChanged);
    window.addEventListener('storage', preferenceChanged);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedChanged = () => {
      if (!reduced.matches) return;
      this.motion?.cancel();
      this.apply(this.preference ?? (this.media!.matches ? 'dark' : 'light'));
    };
    reduced.addEventListener('change', reducedChanged);
    this.destroyRef.onDestroy(() => {
      this.motion?.destroy();
      reduced.removeEventListener('change', reducedChanged);
      this.media?.removeEventListener('change', systemChanged);
      window.removeEventListener('storage', preferenceChanged);
    });
  }

  toggle(event?: Event): void {
    const current = this.preference ?? (this.dark() ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    this.preference = next;
    if (this.motion) {
      const source = event?.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
      this.motion.change(() => this.apply(next), source);
    } else this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, this.preference);
    } catch {
      // Keep the explicit choice in memory when storage is unavailable.
    }
  }

  private parse(value: string | null): ThemePreference {
    return value === 'dark' || value === 'light' ? value : null;
  }

  private apply(theme: 'light' | 'dark'): void {
    this.dark.set(theme === 'dark');
    this.document.documentElement.dataset['theme'] = theme;
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#10151b' : '#f7f8fa');
  }
}
