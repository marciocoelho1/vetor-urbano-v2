import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type AccountReply = { code: string; message: string };

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
})
export class AccountPage implements OnInit, OnDestroy {
  protected displayName = '';
  protected email = '';
  protected password = '';
  protected resendEmail = '';
  protected token = '';
  protected readonly busy = signal(false);
  protected readonly result = signal<AccountReply | null>(null);
  protected readonly failed = signal(false);
  private abort?: AbortController;

  ngOnInit(): void {
    const token = new URLSearchParams(location.hash.slice(1)).get('confirmar');
    if (token) {
      this.token = token;
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => document.getElementById('confirmation-heading')?.focus());
    }
  }
  ngOnDestroy(): void {
    this.abort?.abort();
    this.password = '';
    this.token = '';
  }
  protected register(): void {
    const body = { displayName: this.displayName, email: this.email, password: this.password };
    this.resendEmail = this.email;
    this.password = '';
    void this.submit('registrations', body);
  }
  protected resend(): void {
    void this.submit('confirmation-requests', { email: this.resendEmail });
  }
  protected confirm(): void {
    const token = this.token;
    this.token = '';
    void this.submit('confirmations', { token });
  }
  private async submit(path: string, body: Record<string, string>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.result.set(null);
    this.failed.set(false);
    this.abort = new AbortController();
    try {
      const response = await fetch(`http://127.0.0.1:8080/api/v1/accounts/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: this.abort.signal,
      });
      if (response.status === 404 || response.status >= 500) {
        throw new Error(
          'O serviço local de contas está indisponível. Tente novamente; a operação não foi confirmada.',
        );
      }
      const reply = (await response.json()) as AccountReply;
      if (typeof reply.code !== 'string' || typeof reply.message !== 'string') {
        throw new Error('Resposta inesperada do serviço local. A operação não foi confirmada.');
      }
      this.failed.set(!response.ok);
      this.result.set(reply);
    } catch (error: unknown) {
      if (this.abort.signal.aborted) return;
      this.failed.set(true);
      this.result.set({
        code: 'CONNECTION_FAILED',
        message:
          error instanceof TypeError
            ? 'Não foi possível conectar ao serviço local. Verifique a API e tente novamente.'
            : error instanceof Error
              ? error.message
              : 'A operação não foi confirmada. Tente novamente.',
      });
    } finally {
      this.busy.set(false);
      if (!this.abort.signal.aborted)
        setTimeout(() => document.getElementById('account-result')?.focus());
    }
  }
}
