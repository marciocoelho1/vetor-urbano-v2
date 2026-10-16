import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { SOURCE_PLACEHOLDER } from '../data/demo-sources';
import { fetchPublicSources, type PublicSource } from '../data/source-api';

@Component({
  selector: 'app-public-source-list',
  imports: [CommonModule],
  templateUrl: './public-source-list.html',
  styleUrl: './public-source-list.scss',
})
export class PublicSourceList {
  protected readonly placeholder = SOURCE_PLACEHOLDER;
  protected readonly sources = signal<PublicSource[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.sources.set(await fetchPublicSources());
    } catch (failure: unknown) {
      this.error.set(
        failure instanceof Error ? failure.message : 'Não foi possível carregar as fontes.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
