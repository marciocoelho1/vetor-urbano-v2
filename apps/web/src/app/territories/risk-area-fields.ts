import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
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

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.abort.abort();
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
          justification:
            form['justification']?.trim() ||
            'Edição de campos da área sem alterar a geometria vigente',
        },
        csrf,
      );
      this.notice.set(
        `«${form['name']}» salva em nova versão; o polígono foi preservado e a consulta continua na versão aprovada até a aprovação.`,
      );
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
