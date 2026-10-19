import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Session } from '../auth/session';
import { VerificationSelection } from './verification-selection';

interface ExpiredOccurrence {
  id: string;
  title: string;
  revision: number;
  verification_version: number;
  expires_at: string;
}
interface Verification {
  id: string;
  title: string;
  revision: number;
  situation: string;
  verificationVersion: number;
  validityDurationSeconds: number | null;
  history: {
    effect_version: number;
    verification_version: number;
    confirmed_at: string;
    expires_at: string | null;
    situation: string;
  }[];
}

@Component({
  selector: 'app-verification-panel',
  imports: [FormsModule, DatePipe],
  templateUrl: './verification-panel.html',
  styles: `
    :host {
      display: block;
    }
    .notice {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 1200;
      max-width: calc(100vw - 2rem);
      padding: 1rem;
      background: var(--surface, #fff);
      color: var(--text, #18232e);
      border: 2px solid #89671b;
      border-radius: 12px;
      box-shadow: 0 4px 20px #0003;
    }
    section {
      padding: 1rem;
      margin-block: 1rem;
      border: 1px solid #8a949e;
      border-radius: 12px;
      overflow-wrap: anywhere;
    }
    label {
      display: grid;
      gap: 0.4rem;
      margin-block: 1rem;
    }
    input,
    textarea,
    select {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: 0.6rem;
    }
    button {
      margin: 0.3rem;
      padding: 0.6rem;
    }
    li {
      margin-block: 0.7rem;
    }
  `,
})
export class VerificationPanel {
  readonly enabled = input(false);
  readonly active = input(false);
  readonly openActive = output<void>();
  readonly changed = output<void>();
  protected readonly session = inject(Session);
  protected readonly selection = inject(VerificationSelection);
  protected readonly expired = signal<ExpiredOccurrence[]>([]);
  protected readonly listing = signal(false);
  protected readonly loaded = signal(false);
  protected readonly listError = signal('');
  protected readonly editor = signal<Verification | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected evidence = '';
  protected confirmedAt = '';
  protected situation = 'ONGOING';
  private sequence = 0;
  private sessionGeneration = 0;
  private sessionAbort?: AbortController;

  constructor() {
    effect((onCleanup) => {
      const authenticated = this.session.state()?.authenticated;
      const enabled = this.enabled();
      if (!enabled || !authenticated) {
        untracked(() => {
          this.expired.set([]);
          this.loaded.set(false);
          this.editor.set(null);
          this.selection.id.set(null);
          this.message.set('');
          this.error.set('');
          this.loading.set(false);
        });
        return;
      }
      untracked(() => {
        this.expired.set([]);
        this.loaded.set(false);
        this.listing.set(false);
      });
      const abort = new AbortController();
      this.sessionAbort = abort;
      const refresh = () => void this.refresh(abort.signal);
      untracked(refresh);
      const timer = setInterval(refresh, 5000);
      onCleanup(() => {
        abort.abort();
        clearInterval(timer);
        this.sequence++;
        this.sessionGeneration++;
      });
    });
    effect(() => {
      const id = this.selection.id();
      untracked(() => {
        if (id) void this.open(id);
      });
    });
  }
  private async request<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`http://127.0.0.1:8080/api/v1/active-reports/${path}`, {
      credentials: 'include',
      signal,
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.session.csrfToken() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? 'Outra confirmação ou edição alterou a ocorrência. Recarregue antes de decidir; sua evidência não foi salva.'
          : response.status === 403
            ? 'Somente o autor ou Administrador com MFA pode confirmar.'
            : response.status === 400
              ? 'Informe nova evidência humana, situação e instante UTC não futuro.'
              : 'Verificação indisponível. A falha não significa ausência de ocorrências expiradas.',
      );
    return response.json() as Promise<T>;
  }
  protected async refresh(signal?: AbortSignal): Promise<void> {
    signal ??= this.sessionAbort?.signal;
    const generation = this.sessionGeneration;
    if (this.listing() || !signal || signal.aborted) return;
    this.listing.set(true);
    try {
      const rows = await this.request<ExpiredOccurrence[]>('expired', undefined, signal);
      if (signal.aborted || generation !== this.sessionGeneration) return;
      this.expired.set(rows);
      this.loaded.set(true);
      this.listError.set('');
    } catch (error) {
      if (!signal.aborted && generation === this.sessionGeneration)
        this.listError.set(error instanceof Error ? error.message : 'Falha de conexão.');
    } finally {
      if (generation === this.sessionGeneration) this.listing.set(false);
    }
  }
  protected async open(id: string): Promise<void> {
    const sequence = ++this.sequence;
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    this.editor.set(null);
    this.evidence = '';
    try {
      const item = await this.request<Verification>(`${encodeURIComponent(id)}/verification`);
      if (sequence !== this.sequence) return;
      this.editor.set(item);
      this.situation = item.situation;
      this.confirmedAt = new Date().toISOString();
      setTimeout(() => document.getElementById('verification-heading')?.focus());
    } catch (error) {
      if (sequence === this.sequence)
        this.error.set(error instanceof Error ? error.message : 'Falha de conexão.');
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  protected cancel(): void {
    const id = this.editor()?.id;
    this.sequence++;
    this.editor.set(null);
    this.selection.id.set(null);
    this.error.set('');
    setTimeout(() =>
      document
        .querySelector<HTMLElement>(`[data-verification-id="${CSS.escape(id ?? '')}"]`)
        ?.focus(),
    );
  }
  protected async save(): Promise<void> {
    const item = this.editor();
    if (!item || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const sequence = this.sequence;
    try {
      await this.request(`${encodeURIComponent(item.id)}/verification`, {
        effectVersion: item.revision,
        verificationVersion: item.verificationVersion,
        situation: this.situation,
        confirmedAt: this.confirmedAt,
        evidence: this.evidence,
      });
      if (sequence !== this.sequence) return;
      this.editor.set(null);
      this.selection.id.set(null);
      this.evidence = '';
      this.message.set(
        'Nova confirmação salva. O prazo padrão depende do tipo e não garante atualidade factual.',
      );
      await this.refresh();
      this.changed.emit();
      setTimeout(() => document.getElementById('verification-status')?.focus());
    } catch (error) {
      if (sequence === this.sequence)
        this.error.set(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      this.saving.set(false);
    }
  }
}
