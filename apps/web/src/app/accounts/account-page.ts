import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
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
  protected recoveryEmail = '';
  protected recoveryToken = '';
  protected newPassword = '';
  protected changeToken = '';
  protected readonly busy = signal(false);
  protected readonly result = signal<AccountReply | null>(null);
  protected readonly failed = signal(false);
  protected readonly heading = computed(() => {
    switch (this.result()?.code) {
      case 'ACCOUNT_CONFIRMED':
        return 'E-mail confirmado';
      case 'CONFIRMATION_PENDING':
        return 'Confirmação pendente';
      case 'RECOVERY_PENDING':
        return 'Recuperação solicitada';
      case 'PASSWORD_RECOVERED':
        return 'Senha redefinida';
      case 'EMAIL_CHANGED':
        return 'E-mail da conta alterado';
      case 'EMAIL_TAKEN':
        return 'Troca de e-mail não concluída';
      case 'USED_EMAIL_CHANGE':
        return 'Link de troca já utilizado';
      case 'EXPIRED_EMAIL_CHANGE':
      case 'REPLACED_EMAIL_CHANGE':
        return 'Link de troca de e-mail indisponível';
      case 'INVALID_EMAIL_CHANGE':
        return 'Troca de e-mail não concluída';
      case 'USED_RECOVERY':
        return 'Link de recuperação já utilizado';
      case 'EXPIRED_RECOVERY':
      case 'REPLACED_RECOVERY':
        return 'Link de recuperação indisponível';
      case 'INVALID_RECOVERY':
        // O servidor distingue link inválido de senha fora do exigido na própria mensagem.
        return 'Recuperação não concluída';
      case 'INVALID_REQUEST':
        return 'Revise os campos enviados';
      case 'REQUEST_LIMIT':
        return 'Limite local atingido';
      default:
        return 'Solicitação não concluída';
    }
  });
  private abort?: AbortController;

  ngOnInit(): void {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const token = fragment.get('confirmar');
    const recovery = fragment.get('recuperar');
    const change = fragment.get('trocar-email');
    if (token) {
      this.token = token;
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => document.getElementById('confirmation-heading')?.focus());
    }
    if (recovery) {
      this.recoveryToken = recovery;
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => document.getElementById('recovery-heading')?.focus());
    }
    if (change) {
      this.changeToken = change;
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => document.getElementById('email-change-heading')?.focus());
    }
  }
  ngOnDestroy(): void {
    this.abort?.abort();
    this.password = '';
    this.token = '';
    this.recoveryToken = '';
    this.newPassword = '';
    this.changeToken = '';
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
  protected requestRecovery(): void {
    void this.submit('recovery-requests', { email: this.recoveryEmail });
  }
  protected recover(): void {
    const token = this.recoveryToken;
    const password = this.newPassword;
    this.newPassword = '';
    void this.submit('recoveries', { token, password });
  }
  /** E14: confirmação do novo e-mail, acionada pelo link enviado ao endereço novo. */
  protected confirmEmailChange(): void {
    const token = this.changeToken;
    this.changeToken = '';
    void this.submit('email-changes/confirmations', { token });
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
