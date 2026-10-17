import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Session } from '../auth/session';

type ProfileReply = {
  code: string;
  message: string;
  displayName: string;
  email: string;
  role: 'USER' | 'ADMIN';
  pendingEmail?: string;
  pendingEmailExpiresAt?: string;
};
type AccountReply = { code: string; message: string };

/**
 * E02/E14: autoatendimento da própria conta (ticket 15B). O identificador vem da sessão no
 * servidor; a interface só envia os campos declarados. Senha e e-mail exigem a senha atual e,
 * para Gestor, um código novo do autenticador.
 */
@Component({
  selector: 'app-self-account',
  imports: [FormsModule],
  templateUrl: './self-account.html',
  styleUrl: './self-account.scss',
})
export class SelfAccount implements OnDestroy {
  private readonly session = inject(Session);
  protected readonly loading = signal(true);
  protected readonly serviceError = signal('');
  protected readonly profile = signal<ProfileReply | null>(null);
  protected readonly busy = signal(false);
  protected readonly result = signal<AccountReply | null>(null);
  protected readonly failed = signal(false);
  protected readonly manager = computed(() => this.profile()?.role === 'ADMIN');
  protected readonly roleLabel = computed(() =>
    this.manager() ? 'Administrador' : 'Pessoa usuária',
  );
  /** Expiração da pendência no fuso acordado para exibição local (America/Sao_Paulo). */
  protected readonly pendingExpiry = (iso: string): string =>
    new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));
  protected readonly heading = computed(() => {
    switch (this.result()?.code) {
      case 'DISPLAY_NAME_CHANGED':
        return 'Nome de exibição atualizado';
      case 'EMAIL_CHANGE_PENDING':
        return 'Confirmação pendente no novo endereço';
      case 'INVALID_CURRENT_PASSWORD':
        return 'Senha atual incorreta';
      case 'INVALID_NEW_PASSWORD':
        return 'Nova senha fora do exigido';
      case 'INVALID_DISPLAY_NAME':
        return 'Nome de exibição fora do exigido';
      case 'INVALID_EMAIL_CHANGE':
        return 'Troca de e-mail não iniciada';
      case 'INVALID_MFA':
        return 'Código do autenticador inválido';
      case 'REQUEST_LIMIT':
      case 'ACCESS_LIMITED':
        return 'Limite local atingido';
      case 'INVALID_REQUEST':
        return 'Revise os campos enviados';
      default:
        return 'Solicitação não concluída';
    }
  });
  protected displayName = '';
  protected currentPassword = '';
  protected newPassword = '';
  protected passwordCode = '';
  protected newEmail = '';
  protected emailPassword = '';
  protected emailCode = '';
  private abort?: AbortController;

  constructor() {
    void this.load();
  }

  /** Pedido em voo é abortado quando a view sai; nada é processado num componente destruído. */
  ngOnDestroy(): void {
    this.abort?.abort();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.serviceError.set('');
    try {
      const response = await fetch('http://127.0.0.1:8080/api/v1/account', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401) {
        this.expire('Sessão ausente ou expirada. Entre novamente.');
        return;
      }
      if (response.status === 404 || response.status >= 500)
        throw new Error('Serviço local de conta indisponível.');
      const reply = (await response.json()) as ProfileReply;
      if (typeof reply.email !== 'string' || typeof reply.displayName !== 'string')
        throw new Error('Resposta inesperada do serviço local de conta.');
      this.profile.set(reply);
      this.displayName = reply.displayName;
    } catch (error: unknown) {
      this.serviceError.set(
        error instanceof Error
          ? `${error.message} Nada foi alterado.`
          : 'Não foi possível carregar os dados da conta. Nada foi alterado.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected saveName(): void {
    void this.submit('display-name', { displayName: this.displayName });
  }
  protected savePassword(): void {
    void this.submit('password', {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
      ...(this.manager() ? { mfaCode: this.passwordCode } : {}),
    });
    this.currentPassword = '';
    this.newPassword = '';
    this.passwordCode = '';
  }
  protected requestEmailChange(): void {
    void this.submit('email-changes', {
      currentPassword: this.emailPassword,
      newEmail: this.newEmail,
      ...(this.manager() ? { mfaCode: this.emailCode } : {}),
    });
    this.emailPassword = '';
    this.emailCode = '';
  }

  private async submit(path: string, body: Record<string, string>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.result.set(null);
    this.failed.set(false);
    this.abort = new AbortController();
    try {
      const response = await fetch(`http://127.0.0.1:8080/api/v1/account/${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-Token': this.session.csrfToken(),
        },
        body: JSON.stringify(body),
        signal: this.abort.signal,
      });
      if (response.status === 401 || response.status === 403) {
        const reply = (await response.json().catch(() => null)) as AccountReply | null;
        if (reply?.code === 'SESSION_REQUIRED' || reply?.code === 'CSRF_REQUIRED') {
          this.expire('Sessão ausente ou expirada. Entre novamente.');
          return;
        }
        this.failed.set(true);
        this.result.set(
          reply ?? { code: 'SESSION_REQUIRED', message: 'Acesso não concedido pela sessão atual.' },
        );
        return;
      }
      if (response.status === 404 || response.status >= 500)
        throw new Error('O serviço local de conta está indisponível.');
      const reply = (await response.json()) as AccountReply;
      if (typeof reply.code !== 'string' || typeof reply.message !== 'string')
        throw new Error('Resposta inesperada do serviço local de conta.');
      // A troca de senha e a troca de e-mail encerram todas as sessões no servidor.
      if (reply.code === 'PASSWORD_CHANGED' || reply.code === 'EMAIL_CHANGED') {
        this.expire(reply.message);
        return;
      }
      this.failed.set(!response.ok);
      this.result.set(reply);
      if (reply.code === 'DISPLAY_NAME_CHANGED')
        this.profile.update((data) => ({
          ...(data as ProfileReply),
          displayName: this.displayName,
        }));
      if (reply.code === 'EMAIL_CHANGE_PENDING') await this.load();
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
        setTimeout(() =>
          document.querySelector<HTMLElement>('[data-testid="self-account-result"]')?.focus(),
        );
    }
  }

  /** A sessão deixou de valer no servidor: a interface volta ao acesso e nada mais é exibido. */
  private expire(message: string): void {
    this.session.message.set(message);
    this.session.failed.set(false);
    this.session.clear();
    this.profile.set(null);
    this.currentPassword = '';
    this.newPassword = '';
    this.passwordCode = '';
    this.emailPassword = '';
    this.emailCode = '';
    setTimeout(() => document.getElementById('access-result')?.focus());
  }
}
