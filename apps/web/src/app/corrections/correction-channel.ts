import { CommonModule } from '@angular/common';
import { Component, effect, ElementRef, inject, signal, untracked, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Session } from '../auth/session';

type Correction = {
  id: string;
  target_kind: string;
  target_id: string;
  problem_type: string;
  explanation: string;
  private_references: string;
  state: string;
  version: number;
  reason: string;
  applied_version: number | null;
  created_at: string;
  privacy_review_required: boolean;
};
type Preparation = {
  preparation_action: string | null;
  preparation_state: string | null;
  preparation_reason: string | null;
  preparation_evidence: string | null;
  target_revision: number | null;
  changes: Record<string, unknown> | null;
  essential_reason: string | null;
  prepared_at: string | null;
  applied_version: number | null;
};
@Component({
  selector: 'app-correction-channel',
  imports: [CommonModule, FormsModule],
  templateUrl: './correction-channel.html',
  styleUrl: './correction-channel.scss',
})
export class CorrectionChannel {
  protected readonly session = inject(Session);
  protected readonly items = signal<Correction[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly admin = signal(false);
  protected readonly labels: Record<string, string> = {
    RECEIVED: 'Recebida',
    IN_REVIEW: 'Em análise',
    COMPLETED: 'Concluída',
    NOT_APPLICABLE: 'Não procedente',
  };
  protected targetKind = 'OCCURRENCE';
  protected targetId = '';
  protected problemType = 'LOCAL';
  protected explanation = '';
  protected references = '';
  protected summaries: Record<string, string> = {};
  protected factualReferences: Record<string, string> = {};
  protected reasons: Record<string, string> = {};
  protected versions: Record<string, string> = {};
  protected readonly preparation = signal<Preparation | null>(null);
  protected readonly preparationLoading = signal(false);
  protected readonly essentialReasons = signal<{ code: string; label: string }[]>([]);
  protected readonly preparationAction = signal('CORRECTION');
  protected preparationTitle = '';
  protected preparationDescription = '';
  protected preparationEssential = 'FATO_INCORRETO';
  protected preparationReason = '';
  protected preparationEvidence = '';
  protected decisionReason = '';
  protected lookupId = '';
  protected readonly lookup = signal<{ status: string; message: string } | null>(null);
  private sequence = 0;
  private publicationSequence = 0;
  /** Última identidade aplicada; a fila só é limpa quando a sessão realmente muda. */
  private appliedSession = '';
  /** Item selecionado para edição; os demais itens não renderizam controles de publicação. */
  protected openItemId = '';
  @ViewChild('notice') private notice?: ElementRef<HTMLElement>;
  constructor() {
    effect(() => {
      const state = this.session.state();
      // O token CSRF rotaciona a cada requisição; só a identidade autenticada justifica reiniciar a fila.
      const identity = `${state?.authenticated ?? false}|${state?.role ?? ''}|${state?.mfaEnrolled ?? false}`;
      if (identity === this.appliedSession) return;
      this.appliedSession = identity;
      this.sequence++;
      this.publicationSequence++;
      this.preparationLoading.set(false);
      this.preparation.set(null);
      this.openItemId = '';
      this.items.set([]);
      this.admin.set(false);
      this.error.set('');
      this.message.set('');
      this.explanation = '';
      this.references = '';
      this.reasons = {};
      this.versions = {};
      if (state?.authenticated) untracked(() => void this.reload());
    });
  }
  private async request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`http://127.0.0.1:8080/api/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.session.csrfToken() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      if (response.status === 401) this.session.clear();
      throw new Error(
        response.status === 409
          ? 'Solicitação mudou. Recarregue antes de decidir.'
          : response.status === 400
            ? 'Revise o alvo validado, os campos e a versão aplicada. Nenhuma alteração foi feita.'
            : 'Não foi possível acessar o canal. Confira a sessão e tente novamente.',
      );
    }
    return response.json();
  }
  protected async reload(): Promise<void> {
    const seq = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = (await this.request(this.admin() ? 'admin/corrections' : 'corrections')) as {
        items: Correction[];
      };
      if (seq !== this.sequence) return;
      this.items.set(data.items);
      if (this.admin()) {
        const queue = (await this.request('admin/corrections/publication-queue')) as {
          essentialReasons: { code: string; label: string }[];
        };
        if (seq === this.sequence) this.essentialReasons.set(queue.essentialReasons);
      }
    } catch (error) {
      if (seq === this.sequence) this.error.set((error as Error).message);
    } finally {
      if (seq === this.sequence) this.loading.set(false);
    }
  }
  protected toggleQueue(): void {
    this.admin.update((value) => !value);
    void this.reload();
  }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    await this.write('corrections', {
      targetKind: this.targetKind,
      targetId: this.targetId,
      problemType: this.problemType,
      explanation: this.explanation,
      references: this.references,
    });
  }
  protected async minimize(item: Correction): Promise<void> {
    await this.write(`admin/corrections/${item.id}/minimization`, {
      expectedVersion: item.version,
      factualSummary: this.summaries[item.id] || '',
      factualReferences: this.factualReferences[item.id] || '',
    });
  }
  protected async decide(item: Correction, state: string): Promise<void> {
    const version = this.versions[item.id]?.trim();
    await this.write(`admin/corrections/${item.id}/decisions`, {
      expectedVersion: item.version,
      state,
      reason: this.reasons[item.id] || '',
      ...(version ? { appliedVersion: Number(version) } : {}),
    });
  }
  protected async openPublication(item: Correction): Promise<void> {
    if (!this.admin() || item.target_kind !== 'OCCURRENCE') return;
    const sequence = ++this.publicationSequence;
    if (this.openItemId !== item.id) {
      this.openItemId = item.id;
      this.preparationTitle = '';
      this.preparationDescription = '';
      this.preparationAction.set('CORRECTION');
      this.preparationEssential = 'FATO_INCORRETO';
    }
    this.decisionReason = '';
    this.preparationReason = '';
    this.preparationEvidence = '';
    this.preparation.set(null);
    this.preparationLoading.set(true);
    this.error.set('');
    try {
      const detail = (await this.request(
        `admin/corrections/${item.id}/publication`,
      )) as Preparation;
      if (sequence !== this.publicationSequence) return;
      // A revisão de referência vem do próprio registro publicado quando ainda não existe preparação.
      if (detail.target_revision == null) {
        const target = (await this.request(
          `admin/corrections/publication-targets/${encodeURIComponent(item.target_id)}`,
        )) as { revision: number };
        if (sequence !== this.publicationSequence) return;
        detail.target_revision = target.revision;
      }
      this.preparation.set(detail);
      const changes = (detail.changes ?? {}) as { title?: string; description?: string };
      this.preparationAction.set(detail.preparation_action ?? 'CORRECTION');
      this.preparationTitle = changes.title ?? '';
      this.preparationDescription = changes.description ?? '';
      this.preparationEssential = detail.essential_reason ?? 'FATO_INCORRETO';
      this.preparationReason = detail.preparation_reason ?? '';
      this.preparationEvidence = detail.preparation_evidence ?? '';
    } catch (error) {
      if (sequence !== this.publicationSequence) return;
      this.preparation.set(null);
      this.error.set((error as Error).message);
    } finally {
      if (sequence === this.publicationSequence) this.preparationLoading.set(false);
    }
  }
  protected async prepare(item: Correction): Promise<void> {
    // O servidor revalida os campos essenciais; o cliente não repete a decisão de vazio.
    const changes =
      this.preparationAction() === 'RETRACTION'
        ? {}
        : {
            ...(this.preparationTitle.trim() ? { title: this.preparationTitle.trim() } : {}),
            ...(this.preparationDescription.trim()
              ? { description: this.preparationDescription.trim() }
              : {}),
          };
    await this.write(`admin/corrections/${item.id}/publication/preparations`, {
      action: this.preparationAction(),
      changes,
      reason: this.preparationReason,
      evidence: this.preparationEvidence,
      essentialReason: this.preparationAction() === 'RETRACTION' ? this.preparationEssential : null,
      expectedVersion: this.preparation()?.target_revision ?? 0,
    });
    await this.openPublication(item);
  }
  protected async decidePreparation(item: Correction, decision: string): Promise<void> {
    await this.write(`admin/corrections/${item.id}/publication/decisions`, {
      decision,
      reason: this.decisionReason,
      expectedVersion: item.version,
    });
    this.decisionReason = '';
  }
  /** Consulta o endereço do registro: retirado responde indisponibilidade, nunca o conteúdo retirado. */
  protected async lookupOccurrence(): Promise<void> {
    if (!this.lookupId.trim()) return;
    try {
      const result = (await this.request(
        `occurrences/${encodeURIComponent(this.lookupId.trim())}`,
      )) as { status: string; message?: string; unavailable?: boolean };
      this.lookup.set({
        status: result.status,
        message: result.unavailable
          ? (result.message ?? 'Registro indisponível após revisão administrativa.')
          : 'Registro publicado e vigente nesta versão.',
      });
    } catch (error) {
      this.lookup.set({ status: 'UNKNOWN', message: (error as Error).message });
    }
  }
  private async write(path: string, body: Record<string, unknown>): Promise<void> {
    if (this.saving()) return;
    const seq = this.sequence;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await this.request(path, body);
      if (seq !== this.sequence) return;
      this.message.set(
        'Solicitação registrada. O registro público não foi alterado por este pedido.',
      );
      this.explanation = '';
      this.references = '';
      await this.reload();
    } catch (error) {
      if (seq === this.sequence) this.error.set((error as Error).message);
    } finally {
      this.saving.set(false);
      setTimeout(() => this.notice?.nativeElement.focus());
    }
  }
}
