import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Session } from '../auth/session';
import { OCCURRENCE_CATALOGUE } from '../domain/catalogue';

type Fact = {
  title: string;
  description: string;
  category: string;
  type: string;
  subtype: string;
  situation: string;
  reliability: number;
  municipality: string;
  neighborhood: string;
  locationPrecision: string;
  longitude?: number | null;
  latitude?: number | null;
  occurredAt?: string;
  occurredFrom?: string;
  occurredUntil?: string;
};
/** Metadados da coleta autorizada que acompanham a extração sem virar núcleo factual. */
export interface CollectionExtracted {
  sourceCredit?: string | null;
  sourceReference?: string | null;
  sourceId?: string | null;
  sourceDocumentationUrl?: string | null;
  coordinates?: unknown;
  [field: string]: unknown;
}
const FACT_KEYS = [
  'title',
  'description',
  'category',
  'type',
  'subtype',
  'situation',
  'reliability',
  'municipality',
  'neighborhood',
  'locationPrecision',
  'occurredAt',
  'occurredFrom',
  'occurredUntil',
] as const;
type Review = {
  clipping_id: string;
  clipping_title: string;
  original_text: string;
  reference: string;
  extracted: Partial<Fact> & CollectionExtracted;
  priority: string;
  waiting_seconds: number;
  revision: number;
  essential_conflict: boolean;
  reason: string;
};
export type CollectionProvenance = { credit: string | null; reference: string | null };
function provenanceText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
/**
 * Crédito e referência da fonte quando o item veio da coleta autorizada
 * (`extracted.sourceCredit` e `extracted.sourceReference`). Sem sinal de procedência o resultado é
 * nulo — clippings sintéticos do ticket 17 não recebem rótulo de fonte nem crédito inventado.
 */
export function collectionOrigin(item: { extracted?: unknown }): CollectionProvenance | null {
  const source = item.extracted;
  const extracted =
    typeof source === 'object' && source !== null ? (source as CollectionExtracted) : {};
  const credit = provenanceText(extracted.sourceCredit);
  const reference = provenanceText(extracted.sourceReference);
  return credit || reference ? { credit, reference } : null;
}
/**
 * Semeia o editor apenas com o núcleo factual sustentado. Os metadados da coleta (crédito,
 * documento, contagens por vítima) ficam fora do `draft`: o servidor recusa campo não declarado e
 * nada disso é núcleo factual. As coordenadas `[longitude, latitude]` da fonte entram quando a
 * precisão é `POINT`, para o revisor confirmar o ponto sustentado.
 */
export function factualSeed(extracted: Partial<Fact> & CollectionExtracted): Partial<Fact> {
  const source = extracted as Record<string, unknown>;
  const seed: Record<string, unknown> = {};
  for (const key of FACT_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) seed[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) seed[key] = value;
  }
  const coordinates = source['coordinates'];
  if (
    source['locationPrecision'] === 'POINT' &&
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((value) => typeof value === 'number' && Number.isFinite(value))
  ) {
    seed['longitude'] = coordinates[0];
    seed['latitude'] = coordinates[1];
  }
  return seed as Partial<Fact>;
}
type Options = {
  occurrences: { id: string; title: string; revision: number }[];
  happenings: { id: string; title: string }[];
};
@Component({
  selector: 'app-review-queue',
  imports: [CommonModule, FormsModule],
  templateUrl: './review-queue.html',
  styleUrl: './review-queue.scss',
})
export class ReviewQueue {
  protected readonly session = inject(Session);
  protected readonly items = signal<Review[]>([]);
  protected readonly options = signal<Options>({ occurrences: [], happenings: [] });
  protected readonly selected = signal<Review | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly history = signal('');
  protected readonly effects = signal<Fact[]>([]);
  protected readonly catalogue = OCCURRENCE_CATALOGUE;
  protected priority = '';
  protected order = 'priority';
  protected association = '';
  protected happening = '';
  protected happeningTitle = '';
  protected reason = '';
  protected resolution = '';
  protected temporal = 'instant';
  protected fact: Fact = this.empty();
  private decisionKey = '';
  @ViewChild('notice') private notice?: ElementRef<HTMLElement>;
  constructor() {
    void this.reload();
  }
  private empty(): Fact {
    return {
      title: '',
      description: '',
      category: 'CONTINGENCIA',
      type: 'ENERGIA',
      subtype: 'NAO_INFORMADO',
      situation: 'UNKNOWN',
      reliability: 3,
      municipality: '',
      neighborhood: '',
      locationPrecision: 'TERRITORY',
      occurredAt: '',
    };
  }
  private async request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`http://127.0.0.1:8080/api/v1/admin/review-clippings${path}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.session.csrfToken() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      if (response.status === 401) this.session.clear();
      throw new Error(
        response.status === 409
          ? 'Conflito: decisão já registrada ou versão mudou. Preserve seus campos e recarregue a fila.'
          : response.status === 400
            ? 'Publicação recusada: confira núcleo obrigatório, referência e resolução do conflito.'
            : 'Fila indisponível. Confira a sessão ADMIN/MFA e tente novamente.',
      );
    }
    return response.json();
  }
  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [queue, options] = await Promise.all([
        this.request(`?order=${this.order}${this.priority ? `&priority=${this.priority}` : ''}`),
        this.request('/options'),
      ]);
      this.items.set((queue as { items: Review[] }).items);
      this.options.set(options as Options);
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
  protected edit(item: Review): void {
    this.selected.set(item);
    this.fact = { ...this.empty(), ...factualSeed(item.extracted) };
    this.temporal = this.fact.occurredFrom ? 'interval' : 'instant';
    this.reason = '';
    this.resolution = '';
    this.association = '';
    this.happening = '';
    this.happeningTitle = '';
    this.decisionKey = crypto.randomUUID();
    this.history.set('');
    this.effects.set([]);
  }
  protected typeChanged(): void {
    const entry = this.catalogue.find((item) => item.id === this.fact.type);
    if (entry) this.fact.category = entry.category;
    this.fact.subtype = 'NAO_INFORMADO';
  }
  protected subtypes(): readonly string[] {
    return this.catalogue.find((item) => item.id === this.fact.type)?.subtypes ?? [];
  }
  protected code(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
  }
  /** Linha de procedência exibida na fila e no editor; vazia para clippings sintéticos. */
  protected originLabel(item: Review): string {
    const provenance = collectionOrigin(item);
    if (!provenance) return '';
    const parts: string[] = [];
    if (provenance.credit) parts.push(`Fonte: ${provenance.credit}`);
    if (provenance.reference) parts.push(`referência da fonte: ${provenance.reference}`);
    return parts.join(' · ');
  }
  protected removeEffect(index: number): void {
    this.effects.update((items) => items.filter((_, position) => position !== index));
  }
  protected prepareEffect(): void {
    this.effects.update((items) => [...items, this.currentFact()]);
    this.fact = { ...this.fact, title: '', description: '' };
  }
  private currentFact(): Fact {
    const draft = { ...this.fact };
    if (draft.locationPrecision === 'TERRITORY') {
      delete draft.longitude;
      delete draft.latitude;
    }
    if (this.temporal === 'instant') {
      delete draft.occurredFrom;
      delete draft.occurredUntil;
    } else delete draft.occurredAt;
    return draft;
  }
  protected async decide(action: string): Promise<void> {
    const item = this.selected();
    if (!item || this.saving()) return;
    const body: Record<string, unknown> = {
      decisionKey: this.decisionKey,
      expectedVersion: item.revision,
      action,
      reason: this.reason,
    };
    if (action === 'CREATE') {
      const draft = this.currentFact();
      body['draft'] = draft;
      if (this.effects().length) body['additionalEffects'] = this.effects();
      if (this.happening) body['happeningId'] = this.happening;
      else body['happeningTitle'] = this.happeningTitle;
    }
    if (action === 'ASSOCIATE') {
      const occurrence = this.options().occurrences.find((value) => value.id === this.association);
      body['occurrenceId'] = this.association;
      body['expectedOccurrenceVersion'] = occurrence?.revision;
    }
    if (this.resolution.trim()) body['conflictResolution'] = this.resolution;
    this.saving.set(true);
    this.error.set('');
    this.status.set('');
    try {
      await this.request(`/${encodeURIComponent(item.clipping_id)}/decisions`, body);
      this.status.set(
        'Decisão registrada com autoria e histórico. Atualize a consulta para ler a publicação.',
      );
      this.selected.set(null);
      await this.reload();
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
      setTimeout(() => this.notice?.nativeElement.focus());
    }
  }
  protected async showHistory(item: Review): Promise<void> {
    try {
      this.history.set(
        JSON.stringify(
          await this.request(`/${encodeURIComponent(item.clipping_id)}/history`),
          null,
          2,
        ),
      );
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }
}
