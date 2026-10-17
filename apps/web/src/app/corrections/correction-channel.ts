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
  private sequence = 0;
  @ViewChild('notice') private notice?: ElementRef<HTMLElement>;
  constructor() {
    effect(() => {
      const state = this.session.state();
      this.sequence++;
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
      if (seq === this.sequence) this.items.set(data.items);
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
