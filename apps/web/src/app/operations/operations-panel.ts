import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, signal } from '@angular/core';
import {
  fetchOperationsPanel,
  formatWait,
  operationTone,
  type OperationSource,
  type OperationsPanel as OperationsView,
} from '../data/operations-api';
import { formatCollectionInstant } from '../data/collection-api';

/**
 * Ticket 22: painel de leitura do estado de operação (fontes de coleta e espera da fila).
 *
 * Não executa ação sobre a coleta nem sobre a revisão: apenas lê e navega. Por isso não usa CSRF e
 * não altera estado. Falha de leitura preserva o último estado exibido; 401/403 viram sessão
 * inválida no transporte, nunca vazio. Estados de sucesso sem novidades, falha de alimentação,
 * fonte pausada, fila vazia e antecedência não configurada têm textos próprios.
 */
@Component({
  selector: 'app-operations-panel',
  imports: [CommonModule],
  templateUrl: './operations-panel.html',
  styleUrl: './operations-panel.scss',
})
export class OperationsPanel implements OnDestroy {
  protected readonly view = signal<OperationsView | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly tone = operationTone;
  protected readonly wait = formatWait;
  protected readonly instant = formatCollectionInstant;
  protected readonly panelLimitations = computed(() => this.view()?.limitations ?? '');
  protected readonly sourcesNotConfigured = computed(
    () => this.view()?.sources.state === 'NOT_CONFIGURED',
  );
  protected readonly confirmationsNotConfigured = computed(
    () => this.view()?.confirmations.state === 'NOT_CONFIGURED',
  );
  protected readonly queueEmpty = computed(() => this.view()?.queue.state === 'EMPTY');
  private readonly abort = new AbortController();

  constructor() {
    void this.reload();
  }

  ngOnDestroy(): void {
    this.abort.abort();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.view.set(await fetchOperationsPanel(this.abort.signal));
    } catch (failure) {
      if (this.abort.signal.aborted) return;
      // O último estado lido permanece visível: falha de leitura não vira zero nem estado saudável.
      this.error.set(
        failure instanceof Error
          ? failure.message
          : 'Não foi possível ler o painel de operação. Tente novamente.',
      );
    } finally {
      if (!this.abort.signal.aborted) this.loading.set(false);
    }
  }

  protected sourceTitle(source: OperationSource): string {
    return source.name ?? source.id;
  }

  protected sourceCredit(source: OperationSource): string {
    return (
      source.attribution ?? (source.credit ? `Fonte: ${source.credit}` : 'Crédito não registrado')
    );
  }

  /** Navegação dentro da área administrativa já aberta; não muda dados, só move o foco. */
  protected goTo(targetId: string, label: string): void {
    const target = document.getElementById(targetId);
    if (!target) {
      this.notice.set(`Seção ${label} não está visível nesta tela.`);
      return;
    }
    try {
      target.scrollIntoView({ block: 'start' });
    } catch {
      // Ambiente sem rolagem (teste/jsdom): o foco segue sendo o efeito observável.
    }
    target.focus({ preventScroll: true });
    this.notice.set(`Foco movido para ${label}.`);
  }
}
