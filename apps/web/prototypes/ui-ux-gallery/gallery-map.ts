import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import { loadLeafletStyles } from '../../src/app/maps/leaflet-style-loader';
import type { Coordinates } from '../../src/app/domain/occurrences';
import type * as Leaflet from 'leaflet';
import { GALLERY_CATEGORIES, type GalleryCamera, type GalleryRecord } from './gallery-data';

@Component({
  selector: 'vu-gallery-map',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="gallery-map-surface" [class.is-picking]="pickCenter">
      <div
        #canvas
        class="gallery-map-canvas"
        role="region"
        aria-label="Mapa de ocorrências fictícias. Use a lista para consultar todos os resultados."
      ></div>
      @if (status() === 'loading') {
        <div class="gallery-map-message" role="status">Carregando a base do mapa…</div>
      }
      @if (status() === 'error') {
        <div class="gallery-map-message" role="status">
          <strong>O mapa-base não carregou.</strong
          ><span>A consulta e a lista continuam disponíveis.</span>
          <button type="button" (click)="retry()">Tentar novamente</button>
        </div>
      }
      @if (pickCenter) {
        <div class="gallery-pick-message" role="status">
          Clique no mapa para escolher o centro da consulta.
        </div>
      }
    </div>
  `,
})
export class GalleryMap implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLElement>;
  @Input() records: GalleryRecord[] = [];
  @Input() center: Coordinates | null = null;
  @Input() radius = 5000;
  @Input() selectedId: string | null = null;
  @Input() camera: GalleryCamera = { center: [-43.19156, -22.90332], zoom: 12 };
  @Input() pickCenter = false;
  @Output() selected = new EventEmitter<string>();
  @Output() centerPicked = new EventEmitter<Coordinates>();
  @Output() cameraChanged = new EventEmitter<GalleryCamera>();
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private tiles?: Leaflet.TileLayer;
  private markers?: Leaflet.LayerGroup;
  private circle?: Leaflet.Circle;
  private resize?: ResizeObserver;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;

  async ngAfterViewInit(): Promise<void> {
    try {
      const [leaflet, , response] = await Promise.all([
        import('leaflet/dist/leaflet-src.esm.js'),
        loadLeafletStyles(),
        fetch('maps/raster-provider.json'),
      ]);
      if (!response.ok) throw new Error('Mapa indisponível');
      const provider = await response.json();
      if (this.disposed) return;
      this.leaflet = leaflet;
      this.map = leaflet.map(this.canvas.nativeElement, {
        zoomControl: false,
        scrollWheelZoom: false,
      });
      this.map.setView([this.camera.center[1], this.camera.center[0]], this.camera.zoom);
      leaflet.control
        .zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' })
        .addTo(this.map);
      leaflet.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
      this.map.attributionControl.setPrefix(false);
      this.tiles = leaflet
        .tileLayer(provider.tileUrl, {
          maxZoom: provider.maxZoom,
          attribution: provider.attribution,
        })
        .addTo(this.map);
      this.tiles.on('tileload', () => {
        this.status.set('ready');
        clearTimeout(this.timer);
      });
      this.tiles.on('tileerror', () => {
        if (this.status() !== 'ready') this.status.set('error');
      });
      this.timer = setTimeout(() => {
        if (this.status() === 'loading') this.status.set('error');
      }, 8000);
      this.markers = leaflet.layerGroup().addTo(this.map);
      this.map.on('moveend', () => {
        if (
          this.disposed ||
          !this.map ||
          !this.canvas.nativeElement.clientWidth ||
          !this.canvas.nativeElement.clientHeight
        )
          return;
        const position = this.map.getCenter();
        this.cameraChanged.emit({ center: [position.lng, position.lat], zoom: this.map.getZoom() });
      });
      this.map.on('click', (event: Leaflet.LeafletMouseEvent) => {
        if (this.pickCenter) this.centerPicked.emit([event.latlng.lng, event.latlng.lat]);
      });
      this.resize = new ResizeObserver(() => {
        if (this.canvas.nativeElement.clientWidth && this.canvas.nativeElement.clientHeight)
          this.map?.invalidateSize({ animate: false });
      });
      this.resize.observe(this.canvas.nativeElement);
      this.render();
    } catch {
      if (!this.disposed) this.status.set('error');
    }
  }

  ngOnChanges(): void {
    this.render();
  }

  private render(): void {
    if (!this.map || !this.leaflet || !this.markers) return;
    const position = this.map.getCenter();
    if (
      Math.abs(position.lng - this.camera.center[0]) > 0.00001 ||
      Math.abs(position.lat - this.camera.center[1]) > 0.00001 ||
      this.map.getZoom() !== this.camera.zoom
    ) {
      this.map.setView([this.camera.center[1], this.camera.center[0]], this.camera.zoom, {
        animate: false,
      });
    }
    this.markers.clearLayers();
    for (const record of this.records) {
      const category = GALLERY_CATEGORIES.find((item) => item.id === record.category)!;
      const selected = record.id === this.selectedId;
      const marker = this.leaflet.marker([record.coordinates[1], record.coordinates[0]], {
        title: `${record.typeLabel} · ${record.location} · fictícia`,
        icon: this.leaflet.divIcon({
          className: `gallery-marker ${selected ? 'is-selected' : ''}`,
          html: `<span style="--marker-color:${category.color}">${category.letter}</span>`,
          iconSize: [32, 38],
          iconAnchor: [16, 34],
        }),
        zIndexOffset: selected ? 1000 : 0,
      });
      marker.on('click', () => {
        if (this.pickCenter) this.centerPicked.emit(record.coordinates);
        else this.selected.emit(record.id);
      });
      marker.addTo(this.markers);
    }
    this.circle?.remove();
    if (this.center) {
      this.circle = this.leaflet
        .circle([this.center[1], this.center[0]], {
          radius: this.radius,
          color: '#475f61',
          weight: 1.5,
          dashArray: '5 6',
          fillColor: '#76a8a0',
          fillOpacity: 0.08,
          interactive: false,
        })
        .addTo(this.map);
    }
  }

  protected retry(): void {
    if (!this.tiles) {
      location.reload();
      return;
    }
    this.status.set('loading');
    this.tiles.redraw();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.status() === 'loading') this.status.set('error');
    }, 8000);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    clearTimeout(this.timer);
    this.resize?.disconnect();
    this.map?.off();
    this.map?.remove();
    this.map = undefined;
  }
}
