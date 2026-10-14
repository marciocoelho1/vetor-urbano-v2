import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  ViewEncapsulation,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { distanceMeters, filterRecords, type Coordinates } from '../../src/app/domain/occurrences';
import { GalleryMap } from './gallery-map';
import {
  GALLERY_RECORDS,
  GALLERY_CATEGORIES,
  GALLERY_PLACES,
  GALLERY_VARIANTS,
  REFERENCE_TIME,
  normalizeGallerySearch,
  type GalleryCamera,
  type GalleryPlace,
  type GalleryRecord,
} from './gallery-data';

@Component({
  selector: 'app-root',
  imports: [CommonModule, GalleryMap],
  templateUrl: './ui-ux-gallery.html',
  encapsulation: ViewEncapsulation.None,
})
export class UiUxGallery {
  @ViewChild('dialog') private dialog!: ElementRef<HTMLDialogElement>;
  protected readonly variants = GALLERY_VARIANTS;
  protected readonly categoryOptions = GALLERY_CATEGORIES;
  protected readonly variant = signal(this.variantFromUrl());
  protected readonly design = computed(() => this.variants[this.variant() - 1]!);
  protected readonly place = signal<GalleryPlace | null>(GALLERY_PLACES[0]!);
  protected readonly query = signal(GALLERY_PLACES[0]!.label);
  protected readonly suggestionsOpen = signal(false);
  protected readonly suggestionIndex = signal(0);
  protected readonly categories = signal(this.categoryOptions.map((category) => category.id));
  protected readonly days = signal(7);
  protected readonly radius = signal(5000);
  protected readonly sort = signal('recent');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly mobileView = signal<'map' | 'list'>('map');
  protected readonly pickCenter = signal(false);
  protected readonly filtersOpen = signal(false);
  protected readonly camera = signal<GalleryCamera>({
    center: GALLERY_PLACES[0]!.coordinates,
    zoom: 12,
  });
  protected readonly modal = signal<'compare' | 'data' | 'help'>('compare');
  protected readonly suggestions = computed(() => {
    const search = this.query() === this.place()?.label ? '' : normalizeGallerySearch(this.query());
    return GALLERY_PLACES.filter((place) =>
      normalizeGallerySearch(`${place.label} ${place.hint}`).includes(search),
    );
  });
  protected readonly records = computed(() => {
    const center = this.place()?.coordinates;
    const start = new Date(REFERENCE_TIME.getTime() - this.days() * 86_400_000);
    return filterRecords(GALLERY_RECORDS, {
      categories: this.categories(),
      start,
      end: REFERENCE_TIME,
      center,
      radiusMeters: center ? this.radius() : undefined,
    }).sort((a, b) => {
      if (this.sort() === 'distance' && center)
        return distanceMeters(a.coordinates, center) - distanceMeters(b.coordinates, center);
      return Date.parse(b.occurredAt!) - Date.parse(a.occurredAt!) || a.id.localeCompare(b.id);
    });
  });
  protected readonly selected = computed(() =>
    this.records().find((record) => record.id === this.selectedId()),
  );
  protected readonly querySummary = computed(() => {
    const categoryNames =
      this.categoryOptions
        .filter((category) => this.categories().includes(category.id))
        .map((category) => category.label)
        .join(', ') || 'nenhuma categoria';
    return `${this.place()?.label ?? 'Todos os exemplos'}${this.place() ? ` · raio ${this.radiusLabel()}` : ''} · ${this.days() === 1 ? '24 horas' : `${this.days()} dias`} · ${categoryNames} · ${this.records().length} resultados fictícios`;
  });
  protected readonly radiusLabel = computed(
    () =>
      `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(this.radius() / 1000)} km`,
  );
  protected readonly filtered = computed(
    () => this.categories().length !== 3 || this.days() !== 7 || !!this.place(),
  );
  protected readonly total = GALLERY_RECORDS.length;

  private variantFromUrl(): number {
    const value = Number(new URL(location.href).searchParams.get('variant'));
    return value >= 1 && value <= this.variants.length && Number.isInteger(value) ? value : 1;
  }

  protected switchVariant(value: number): void {
    const count = this.variants.length;
    const next = ((((value - 1) % count) + count) % count) + 1;
    this.variant.set(next);
    this.suggestionsOpen.set(false);
    const url = new URL(location.href);
    url.searchParams.set('variant', String(next));
    history.pushState(null, '', url);
  }

  @HostListener('window:popstate') protected restoreVariant(): void {
    this.variant.set(this.variantFromUrl());
  }

  @HostListener('document:keydown', ['$event']) protected cycleWithKeyboard(
    event: KeyboardEvent,
  ): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (
      !(event.target instanceof Element) ||
      event.target.closest(
        'input, select, textarea, button, a, [contenteditable], .leaflet-container, dialog',
      )
    )
      return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.switchVariant(this.variant() + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }

  protected setQuery(value: string): void {
    this.query.set(value);
    this.suggestionIndex.set(0);
    this.suggestionsOpen.set(true);
  }

  protected searchKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.suggestionsOpen.set(false);
      event.stopPropagation();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const count = this.suggestions().length;
      if (!this.suggestionsOpen()) {
        this.suggestionsOpen.set(true);
        this.suggestionIndex.set(0);
      } else if (count)
        this.suggestionIndex.set(
          (this.suggestionIndex() + (event.key === 'ArrowDown' ? 1 : -1) + count) % count,
        );
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const place = this.suggestions()[this.suggestionIndex()];
      if (place) this.choosePlace(place);
      else this.suggestionsOpen.set(true);
    }
  }

  protected closeSuggestions(): void {
    setTimeout(() => this.suggestionsOpen.set(false), 120);
  }

  protected choosePlace(place: GalleryPlace): void {
    this.place.set(place);
    this.query.set(place.label);
    this.suggestionsOpen.set(false);
    this.pickCenter.set(false);
    this.selectedId.set(null);
    this.camera.set({ center: place.coordinates, zoom: this.zoomForRadius() });
  }

  protected clearPlace(): void {
    this.place.set(null);
    this.query.set('');
    this.suggestionsOpen.set(false);
    this.pickCenter.set(false);
    this.selectedId.set(null);
    this.sort.set('recent');
    this.camera.set({ center: [-43.28, -22.84], zoom: 10 });
  }

  protected chooseMapCenter(coordinates: Coordinates): void {
    this.choosePlace({
      id: 'map-point',
      label: 'Ponto escolhido no mapa',
      hint: 'Centro definido por você nesta demonstração',
      coordinates,
    });
  }

  protected beginMapPick(): void {
    this.pickCenter.update((value) => !value);
    this.mobileView.set('map');
    this.suggestionsOpen.set(false);
  }

  protected toggleCategory(id: string): void {
    this.categories.update((values) =>
      values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    );
    this.selectedId.set(null);
  }

  protected setDays(value: string): void {
    this.days.set(Number(value));
    this.selectedId.set(null);
  }
  protected setRadius(value: string): void {
    this.radius.set(Math.min(25000, Math.max(100, Number(value))));
    this.selectedId.set(null);
    const center = this.place()?.coordinates;
    if (center) this.camera.set({ center, zoom: this.zoomForRadius() });
  }
  private zoomForRadius(): number {
    return this.radius() <= 1000
      ? 14
      : this.radius() <= 5000
        ? 12
        : this.radius() <= 10000
          ? 11
          : 10;
  }

  protected resetFilters(): void {
    this.categories.set(this.categoryOptions.map((category) => category.id));
    this.days.set(7);
    this.radius.set(5000);
    this.clearPlace();
  }

  protected selectRecord(id: string, focusList = false): void {
    const record = this.records().find((item) => item.id === id);
    if (!record) return;
    this.selectedId.set(this.selectedId() === id && !focusList ? null : id);
    if (!focusList)
      this.camera.set({ center: record.coordinates, zoom: Math.max(this.camera().zoom, 13) });
    if (focusList) {
      this.mobileView.set('list');
      setTimeout(() => document.getElementById(`result-${id}`)?.focus({ preventScroll: false }), 0);
    }
  }

  protected category(record: GalleryRecord) {
    return this.categoryOptions.find((category) => category.id === record.category)!;
  }
  protected severity(record: GalleryRecord): string {
    return (
      ({ BAIXA: 'Baixa', MODERADA: 'Moderada', ALTA: 'Alta' } as Record<string, string>)[
        record.severity ?? ''
      ] ??
      record.severity ??
      'Não informada'
    );
  }
  protected recordDate(record: GalleryRecord): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(record.occurredAt!));
  }
  protected distance(record: GalleryRecord): string {
    const center = this.place()?.coordinates;
    return center
      ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(distanceMeters(record.coordinates, center) / 1000)} km do centro`
      : '';
  }

  protected openModal(kind: 'compare' | 'data' | 'help'): void {
    this.modal.set(kind);
    this.dialog.nativeElement.showModal();
  }
  protected closeModal(): void {
    this.dialog.nativeElement.close();
  }
  protected chooseFromModal(value: number): void {
    this.switchVariant(value);
    this.closeModal();
  }
}
