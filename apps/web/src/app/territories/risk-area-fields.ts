import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { MINIMUM_POINTS, polygonFrom, polygonProblem, type MapPoint } from './polygon-drawing';
import { Session } from '../auth/session';
import { RiskAreaApiError, riskAreaRequest } from '../data/risk-area-api';

interface AdminArea {
  territoryId: string;
  version: number;
  approvedVersion: number | null;
  name: string;
  indicatedGroup: string | null;
  sourceId: string | null;
  evidenceReference: string | null;
  referenceDate: string | null;
  limitations: string | null;
}

/**
 * Edição dos campos das Áreas de Risco (pedido do responsável em 22/10/2026).
 *
 * Os polígonos permanecem como estão: o formulário envia apenas os campos, e o servidor herda a
 * geometria da versão vigente. Cada salvamento gera nova versão, e a consulta pública continua na
 * versão aprovada até a aprovação explícita — grupo informado é o que mais muda, então a edição é
 * rápida mas nunca publica sozinha.
 */
@Component({
  selector: 'app-risk-area-fields',
  imports: [CommonModule],
  templateUrl: './risk-area-fields.html',
  styleUrl: './risk-area-fields.scss',
})
export class RiskAreaFields implements OnDestroy {
  private readonly session = inject(Session);
  private readonly abort = new AbortController();

  protected readonly areas = signal<AdminArea[]>([]);
  protected readonly selected = signal('');
  protected readonly draft = signal<Record<string, string>>({});
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly drawing = signal(false);
  protected readonly points = signal<MapPoint[]>([]);
  protected readonly drawingError = signal('');
  protected readonly polygonReady = signal<Array<Array<[number, number]>> | null>(null);
  private leaflet?: typeof import('leaflet');
  private map?: import('leaflet').Map;
  private shapes: Array<import('leaflet').Layer> = [];
  /**
   * O canvas só existe quando o modo de desenho entra no DOM: o setter do ViewChild é o gatilho
   * correto para inicializar o mapa, sem depender de microtasks ou timers.
   */
  @ViewChild('drawSurface')
  set drawSurface(ref: ElementRef<HTMLElement> | undefined) {
    this.drawSurfaceRef = ref;
  }
  private drawSurfaceRef?: ElementRef<HTMLElement>;
  protected readonly minimumPoints = MINIMUM_POINTS;

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.abort.abort();
    this.map?.remove();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const body = await riskAreaRequest<{ items: AdminArea[] }>(
        '/admin/risk-areas',
        undefined,
        undefined,
        this.abort.signal,
      );
      this.areas.set(body.items ?? []);
      if (this.selected() && !this.areas().some((area) => area.territoryId === this.selected())) {
        this.selected.set('');
        this.draft.set({});
      }
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected choose(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selected.set(id);
    const area = this.areas().find((item) => item.territoryId === id);
    this.notice.set('');
    this.draft.set(
      area
        ? {
            name: area.name,
            indicatedGroup: area.indicatedGroup ?? '',
            evidenceReference: area.evidenceReference ?? '',
            referenceDate: area.referenceDate ?? '',
            limitations: area.limitations ?? '',
            justification: '',
          }
        : {},
    );
  }

  protected current(): AdminArea | undefined {
    return this.areas().find((area) => area.territoryId === this.selected());
  }

  protected onField(field: string, event: Event): void {
    this.draft.set({ ...this.draft(), [field]: (event.target as HTMLInputElement).value });
  }

  /** Abre a superfície de desenho: os cliques marcam os pontos que definirão o polígono. */
  protected async startDrawing(): Promise<void> {
    this.drawing.set(true);
    this.points.set([]);
    this.polygonReady.set(null);
    this.drawingError.set('');
    // O contêiner já existe, mas só ganha tamanho quando o modo de desenho fica visível:
    // o mapa precisa ser criado (ou remedido) depois dessa troca de layout.
    setTimeout(() => {
      const element = this.drawSurfaceRef?.nativeElement;
      if (!element) return;
      if (!this.map) void this.buildMap([-22.9, -43.2], element);
      else this.map.invalidateSize();
    }, 40);
  }

  private async buildMap(center: [number, number], element: HTMLElement): Promise<void> {
    try {
      // O CSS do Leaflet já entra pelo angular.json (bundleName "leaflet"); carregar de novo dá 404.
      const leaflet = this.leaflet ?? (await import('leaflet'));
      this.leaflet = leaflet;
      this.map?.remove();
      this.shapes = [];
      // O contêiner precisa de altura explícita no instante da inicialização; sem isso o Leaflet
      // calcula área zero e os cliques não chegam ao mapa.
      element.style.height = element.style.height || '18rem';
      element.style.width = '100%';
      this.map = leaflet
        .map(element, { zoomControl: true, attributionControl: false })
        .setView(center, 11);
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 })
        .addTo(this.map);
      this.map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
        this.addPoint([Number(event.latlng.lng.toFixed(6)), Number(event.latlng.lat.toFixed(6))]);
      });
      this.map.invalidateSize();
      setTimeout(() => this.map?.invalidateSize(), 60);
    } catch {
      this.drawingError.set('Não foi possível carregar o mapa de desenho; tente novamente.');
    }
  }

  /** Cada clique entra como [longitude, latitude]; a prévia é redesenhada a cada ponto. */
  protected addPoint(point: MapPoint): void {
    const next = [...this.points(), point];
    this.points.set(next);
    this.drawingError.set('');
    this.redraw(next);
  }

  private redraw(points: MapPoint[]): void {
    const leaflet = this.leaflet;
    const map = this.map;
    if (!leaflet || !map) return;
    this.shapes.forEach((shape) => shape.remove());
    this.shapes = points.map(([longitude, latitude]) =>
      leaflet.circleMarker([latitude, longitude], { radius: 5, color: '#0b57d0' }).addTo(map),
    );
    if (points.length > 1) {
      this.shapes.push(
        leaflet
          .polyline(
            points.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
            { color: '#0b57d0' },
          )
          .addTo(map),
      );
    }
    if (points.length >= MINIMUM_POINTS) {
      try {
        const polygon = polygonFrom(points);
        this.shapes.push(
          leaflet
            .polygon(
              polygon.coordinates[0].map(
                ([longitude, latitude]) => [latitude, longitude] as [number, number],
              ),
              { color: '#0b57d0', fillOpacity: 0.15 },
            )
            .addTo(map),
        );
        this.polygonReady.set(polygon.coordinates);
        this.drawingError.set('');
      } catch (error) {
        this.drawingError.set(error instanceof Error ? error.message : 'Área inválida.');
      }
    } else {
      this.polygonReady.set(null);
    }
  }

  protected undoPoint(): void {
    const next = this.points().slice(0, -1);
    this.points.set(next);
    this.redraw(next);
  }

  protected closeDrawing(): void {
    const problem = polygonProblem(this.points());
    if (problem) {
      this.drawingError.set(problem);
      return;
    }
    this.polygonReady.set(polygonFrom(this.points()).coordinates);
    this.notice.set(
      `Polígono definido com ${this.points().length} pontos. Salve a versão para gravar a area desenhada.`,
    );
    this.stopDrawing();
  }

  protected stopDrawing(): void {
    this.drawing.set(false);
    this.map?.remove();
    this.map = undefined;
    this.shapes = [];
  }

  protected async save(): Promise<void> {
    const area = this.current();
    if (!area) return;
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.error.set('Sessão sem token de segurança; entre novamente para editar áreas.');
      return;
    }
    const form = this.draft();
    this.busy.set(true);
    this.error.set('');
    try {
      await riskAreaRequest(
        `/admin/risk-areas/${encodeURIComponent(area.territoryId)}/versions`,
        {
          expectedVersion: area.version,
          name: form['name']?.trim(),
          indicatedGroup: blank(form['indicatedGroup']),
          sourceId: area.sourceId,
          evidenceReference: blank(form['evidenceReference']),
          referenceDate: blank(form['referenceDate']),
          limitations: blank(form['limitations']),
          // Sem desenho novo, o corpo vai sem geometria e o servidor herda o polígono vigente.
          ...(this.polygonReady()
            ? { geometry: { type: 'Polygon', coordinates: this.polygonReady() } }
            : {}),
          justification:
            form['justification']?.trim() ||
            'Edição de campos da área sem alterar a geometria vigente',
        },
        csrf,
      );
      this.notice.set(
        this.polygonReady()
          ? `«${form['name']}» salva em nova versão com o polígono desenhado (${this.points().length} pontos).`
          : `«${form['name']}» salva em nova versão; o polígono foi preservado e a consulta continua na versão aprovada até a aprovação.`,
      );
      this.polygonReady.set(null);
      this.points.set([]);
      await this.load();
      this.draft.set({ ...this.draft(), justification: '' });
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async approve(): Promise<void> {
    const area = this.current();
    if (!area) return;
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.error.set('Sessão sem token de segurança; entre novamente para aprovar.');
      return;
    }
    const justification = this.draft()['justification']?.trim();
    if (!justification || justification.length < 20) {
      this.error.set('Aprovação exige justificativa de pelo menos 20 caracteres.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await riskAreaRequest(
        `/admin/risk-areas/${encodeURIComponent(area.territoryId)}/approvals`,
        { expectedVersion: area.version, justification },
        csrf,
      );
      this.notice.set(`Versão ${area.version} aprovada e publicada para consulta.`);
      await this.load();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  private message(error: unknown): string {
    return error instanceof RiskAreaApiError
      ? error.message
      : 'Falha inesperada ao editar Áreas de Risco; a falha não significa ausência de áreas.';
  }
}

function blank(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  return text.length === 0 ? null : text;
}
