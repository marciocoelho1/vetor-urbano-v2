import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Session } from '../auth/session';
import { riskAreaRequest } from '../data/risk-area-api';
import { fetchManagedSources, type ManagedSource } from '../data/source-api';
import { territorialInstantLabel, type RiskAreaSnapshot } from '../domain/persisted-risk-areas';

type AreaForm = {
  name: string;
  indicatedGroup: string;
  sourceId: string;
  evidenceReference: string;
  referenceDate: string;
  limitations: string;
  geometry: string;
  justification: string;
};
const emptyForm = (): AreaForm => ({
  name: '',
  indicatedGroup: '',
  sourceId: '',
  evidenceReference: '',
  referenceDate: '',
  limitations: '',
  geometry: '',
  justification: '',
});
@Component({
  selector: 'app-risk-area-management',
  imports: [CommonModule],
  templateUrl: './risk-area-management.html',
  styleUrl: './risk-area-management.scss',
})
export class RiskAreaManagement {
  protected readonly session = inject(Session);
  readonly approved = output<void>();
  readonly territoryId = input('');
  protected readonly items = signal<RiskAreaSnapshot[]>([]);
  protected readonly history = signal<RiskAreaSnapshot[]>([]);
  protected readonly sources = signal<ManagedSource[]>([]);
  protected readonly id = signal('');
  protected readonly form = signal<AreaForm>(emptyForm());
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly approvalReason = signal('');
  protected readonly latest = computed(() => this.history().at(-1));
  protected readonly before = computed(() =>
    this.history().find((item) => item.version === this.latest()?.approvedVersion),
  );
  constructor() {
    void this.reload();
    effect(() => {
      const id = this.territoryId();
      if (id) untracked(() => void this.select(id));
    });
  }

  protected set(field: keyof AreaForm, value: string): void {
    this.form.update((form) => ({ ...form, [field]: value }));
  }
  protected async reload(): Promise<void> {
    if (this.saving()) return;
    const selectedId = this.id();
    this.loading.set(true);
    this.error.set('');
    try {
      const [areas, sources] = await Promise.all([
        riskAreaRequest<{ items: RiskAreaSnapshot[] }>('/admin/risk-areas'),
        fetchManagedSources(),
      ]);
      this.items.set(areas.items);
      this.sources.set(sources);
      this.loaded.set(true);
      if (selectedId) await this.select(selectedId);
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
    }
  }
  protected create(): void {
    this.id.set(crypto.randomUUID());
    this.history.set([]);
    this.form.set(emptyForm());
    this.approvalReason.set('');
    this.error.set('');
    this.status.set('Nova identidade; ainda não publicada.');
    this.focus('area-name');
  }
  protected async select(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.history.set([]);
    this.id.set('');
    try {
      const result = await riskAreaRequest<{ items: RiskAreaSnapshot[] }>(
        `/admin/risk-areas/${encodeURIComponent(id)}`,
      );
      this.id.set(id);
      this.history.set(result.items);
      const item = result.items.at(-1);
      if (!item) throw new Error('Histórico territorial indisponível.');
      this.fill(item);
      this.approvalReason.set('');
      this.focus('area-name');
    } catch (error) {
      this.fail(error);
    } finally {
      this.loading.set(false);
    }
  }
  private fill(item: RiskAreaSnapshot): void {
    this.form.set({
      name: item.name,
      indicatedGroup: item.indicatedGroup || '',
      sourceId: item.sourceId || '',
      evidenceReference: item.evidenceReference || '',
      referenceDate: item.referenceDate || '',
      limitations: item.limitations || '',
      geometry: JSON.stringify(item.geometry, null, 2),
      justification: '',
    });
  }
  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving() || this.loading() || !this.id()) return;
    this.saving.set(true);
    this.error.set('');
    this.status.set('');
    try {
      const form = this.form();
      let geometry: unknown;
      try {
        geometry = JSON.parse(form.geometry);
      } catch {
        throw new Error('Geometria GeoJSON inválida. Informe um objeto Polygon ou MultiPolygon.');
      }
      const item = await riskAreaRequest<RiskAreaSnapshot>(
        `/admin/risk-areas/${this.id()}/versions`,
        {
          expectedVersion: this.latest()?.version ?? 0,
          ...form,
          geometry,
          indicatedGroup: form.indicatedGroup.trim() || null,
          sourceId: form.sourceId || null,
          evidenceReference: form.evidenceReference.trim() || null,
          limitations: form.limitations.trim() || null,
          referenceDate: form.referenceDate || null,
        },
        this.session.csrfToken(),
      );
      await this.readBack(item.territoryId);
      this.status.set(
        `Revisão ${item.version} salva sem publicar. A versão aprovada permanece na consulta.`,
      );
    } catch (error) {
      this.fail(error);
    } finally {
      this.saving.set(false);
      this.focus('area-status');
    }
  }
  protected async approve(): Promise<void> {
    const latest = this.latest();
    if (!latest || this.saving() || this.loading() || !this.approvalReason().trim()) return;
    this.saving.set(true);
    this.error.set('');
    this.status.set('');
    try {
      await riskAreaRequest<RiskAreaSnapshot>(
        `/admin/risk-areas/${this.id()}/approvals`,
        { expectedVersion: latest.version, justification: this.approvalReason().trim() },
        this.session.csrfToken(),
      );
      await this.readBack(this.id());
      if (this.latest()?.approvedVersion !== latest.version)
        throw new Error('A aprovação não foi confirmada. Atualize a lista.');
      this.approved.emit();
      this.approvalReason.set('');
      this.status.set(`Versão ${latest.version} aprovada explicitamente.`);
    } catch (error) {
      this.fail(error);
    } finally {
      this.saving.set(false);
      this.focus('area-status');
    }
  }
  private async readBack(id: string): Promise<void> {
    const [history, list] = await Promise.all([
      riskAreaRequest<{ items: RiskAreaSnapshot[] }>(`/admin/risk-areas/${id}`),
      riskAreaRequest<{ items: RiskAreaSnapshot[] }>('/admin/risk-areas'),
    ]);
    this.history.set(history.items);
    this.items.set(list.items);
    const latest = history.items.at(-1);
    if (latest) this.fill(latest);
  }
  protected readonly instantLabel = territorialInstantLabel;
  protected json(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
  private fail(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : 'Falha na operação territorial.');
  }
  private focus(id: string): void {
    setTimeout(() => document.getElementById(id)?.focus());
  }
}
