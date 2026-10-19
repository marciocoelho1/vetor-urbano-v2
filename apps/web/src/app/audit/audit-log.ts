import { Component, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { Session } from '../auth/session';

type AuditEvent = {
  id: string;
  actor: string | null;
  historicalActor: string | null;
  occurredAt: string;
  eventClass: string;
  module: string;
  action: string;
  outcome: string;
  parameters: Record<string, unknown>;
};
type AuditPage = {
  items: AuditEvent[];
  hasMore: boolean;
  nextCursor: string;
  maintenanceFailed: boolean;
};

@Component({
  selector: 'app-audit-log',
  imports: [DatePipe, JsonPipe],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
})
export class AuditLog {
  private readonly session = inject(Session);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly events = signal<AuditEvent[]>([]);
  protected readonly nextCursor = signal('');
  protected readonly maintenanceFailed = signal(false);
  protected eventClass = '';

  constructor() {
    void this.reload();
  }

  protected changeClass(value: string): void {
    this.eventClass = value;
    this.nextCursor.set('');
  }

  protected async reload(append = false): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const parameters = new URLSearchParams();
    if (this.eventClass) parameters.set('eventClass', this.eventClass);
    if (append && this.nextCursor()) parameters.set('cursor', this.nextCursor());
    try {
      const response = await fetch(`http://127.0.0.1:8080/api/v1/admin/logs?${parameters}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401 || response.status === 403) {
        this.session.clear();
        throw new Error(
          'Acesso aos registros exige Administrador com segundo fator. Entre novamente.',
        );
      }
      if (!response.ok) throw new Error('Registros indisponíveis. Tente atualizar novamente.');
      const page = (await response.json()) as AuditPage;
      this.events.set(append ? [...this.events(), ...page.items] : page.items);
      this.nextCursor.set(page.hasMore ? page.nextCursor : '');
      this.maintenanceFailed.set(page.maintenanceFailed);
    } catch (failure) {
      this.error.set(
        failure instanceof Error ? failure.message : 'Falha de conexão. Tente novamente.',
      );
      setTimeout(() => document.getElementById('audit-error')?.focus());
    } finally {
      this.loading.set(false);
    }
  }
}
