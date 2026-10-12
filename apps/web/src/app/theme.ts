import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

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

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.media = window.matchMedia('(prefers-color-scheme: dark)');
    try {
      this.preference = this.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      // A blocked storage area still allows changing the theme for this tab.
    }
    this.apply(this.preference ?? (this.media.matches ? 'dark' : 'light'));

    const systemChanged = () => {
      if (!this.preference) this.apply(this.media!.matches ? 'dark' : 'light');
    };
    const preferenceChanged = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      this.preference = this.parse(event.newValue);
      this.apply(this.preference ?? (this.media!.matches ? 'dark' : 'light'));
    };
    this.media.addEventListener('change', systemChanged);
    window.addEventListener('storage', preferenceChanged);
    this.destroyRef.onDestroy(() => {
      this.media?.removeEventListener('change', systemChanged);
      window.removeEventListener('storage', preferenceChanged);
    });
  }

  toggle(): void {
    this.preference = this.dark() ? 'light' : 'dark';
    this.apply(this.preference);
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
