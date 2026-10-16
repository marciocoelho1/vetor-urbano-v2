import { Injectable, signal } from '@angular/core';

export type AccessReply = {
  code: string;
  message: string;
  role?: 'USER' | 'ADMIN';
  authenticated?: boolean;
  mfaEnrolled?: boolean;
  csrfToken?: string;
  secret?: string;
};

@Injectable({ providedIn: 'root' })
export class Session {
  readonly state = signal<AccessReply | null>(null);
  readonly busy = signal(false);
  readonly message = signal('Entre para acessar os módulos.');
  readonly failed = signal(false);
  readonly secret = signal('');
  private csrf = '';
  private sequence = 0;

  async request(path: string, body?: Record<string, string>): Promise<AccessReply> {
    const response = await fetch(`http://127.0.0.1:8080/api/v1/auth/${path}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status >= 500 || response.status === 404)
      throw new Error(
        'Serviço de acesso indisponível. O acesso não foi concedido. Tente novamente.',
      );
    const reply = (await response.json()) as AccessReply;
    if (!response.ok) {
      if (reply.code === 'SESSION_REQUIRED') this.clear();
      throw new Error(reply.message || 'Acesso não concedido.');
    }
    return reply;
  }
  async refresh(): Promise<void> {
    await this.perform('session');
  }
  async perform(path: string, body?: Record<string, string>): Promise<void> {
    if (this.busy()) return;
    const sequence = ++this.sequence;
    this.busy.set(true);
    this.failed.set(false);
    this.secret.set('');
    try {
      const reply = await this.request(path, body);
      if (sequence !== this.sequence) return;
      if (reply.csrfToken) {
        this.csrf = reply.csrfToken;
        this.state.set(reply);
      }
      if (path === 'logout') this.clear();
      if (reply.secret) this.secret.set(reply.secret);
      this.message.set(reply.message);
    } catch (error) {
      if (sequence !== this.sequence) return;
      if (path === 'session') this.clear();
      this.failed.set(true);
      this.message.set(
        error instanceof Error ? error.message : 'Falha de conexão. Tente novamente.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  clear(): void {
    this.state.set(null);
    this.csrf = '';
    this.secret.set('');
  }
}
