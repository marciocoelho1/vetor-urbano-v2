import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { Session } from '../auth/session';
import {
  collectionStateTone,
  collectionStatusLabel,
  errorClassLabel,
  fetchCollectionRuns,
  fetchCollectionStatus,
  formatCollectionInstant,
  pauseCollectionRun,
  pauseTarget,
  resumeCollectionRun,
  resumeTarget,
  startCollectionRun,
  type CollectionRun,
  type CollectionStatus,
} from '../data/collection-api';

const APPROVED_WINDOW_START = '2026-06-01';

function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/**
 * Seção administrativa «Coleta» (ticket 20) dentro da área de administração existente.
 * Estados distintos: carregando, erro com retry, configurada sem execução, «não configurada» e
 * falha nunca se fundem. Falha de comando preserva o último estado lido; 401/403 viram sessão
 * inválida no transporte. O crédito exigido pela fonte acompanha o estado, nunca uma credencial.
 */
@Component({
  selector: 'app-collection-panel',
  imports: [CommonModule],
  templateUrl: './collection-panel.html',
  styleUrl: './collection-panel.scss',
})
export class CollectionPanel {
  protected readonly session = inject(Session);
  protected readonly status = signal<CollectionStatus | null>(null);
  protected readonly runs = signal<CollectionRun[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly busy = signal(false);
  protected readonly notice = signal('');
  protected readonly confirming = signal<'' | 'pause' | 'resume'>('');
  protected readonly backfillFrom = signal(APPROVED_WINDOW_START);
  protected readonly today = todayInSaoPaulo();
  protected readonly backfillTo = signal(this.today);
  protected readonly windowStart = APPROVED_WINDOW_START;
  protected readonly stateLabel = collectionStatusLabel;
  protected readonly stateTone = collectionStateTone;
  protected readonly errorLabel = errorClassLabel;
  protected readonly instant = formatCollectionInstant;
  /** Frases longas ficam em constantes para não dependerem da quebra de linha do template. */
  protected readonly noRunHint = 'Nenhuma execução em andamento para pausar ou retomar.';
  protected readonly coverageCompleteHint = 'A fonte cobre todos os municípios da lista aprovada.';
  protected readonly awaitingRunHint =
    'Nenhuma execução registrada ainda para esta fonte. Não é falha nem ausência de ocorrências: nada foi tentado ou o agendador ainda não rodou.';
  protected readonly credentialHint =
    'Configure a credencial privada fora do repositório para habilitar o disparo. A interface não guarda nem exibe segredo.';
  protected readonly creditMissingHint = 'Crédito da fonte não registrado na ficha de procedência.';
  protected readonly notConfiguredHint =
    'Não configurada: sem credencial privada ou coleta desligada. Não é falha nem ausência de ocorrências; nenhum contador se aplica enquanto a credencial estiver fora do repositório.';
  protected readonly notConfigured = computed(() => this.status()?.state === 'NOT_CONFIGURED');
  /** Configurada e ainda sem execução: vazio próprio, nunca falha nem zero. */
  protected readonly awaitingRun = computed(
    () => this.status() !== null && this.status()?.state === null,
  );
  protected readonly credit = computed(() => this.status()?.ficha.credit ?? null);
  protected readonly pauseRun = computed(() => {
    const view = this.status();
    return view ? pauseTarget(view, this.runs()) : null;
  });
  protected readonly resumeRun = computed(() => {
    const view = this.status();
    return view ? resumeTarget(view, this.runs()) : null;
  });
  protected readonly hasOpenRun = computed(() => Boolean(this.pauseRun() || this.resumeRun()));
  protected readonly backfillFromInvalid = computed(() => {
    const from = this.backfillFrom();
    return from < this.windowStart || from > this.today;
  });
  protected readonly backfillToInvalid = computed(() => {
    const to = this.backfillTo();
    return to < this.windowStart || to > this.today || to < this.backfillFrom();
  });
  protected readonly backfillRangeValid = computed(
    () => !this.backfillFromInvalid() && !this.backfillToInvalid(),
  );
  @ViewChild('triggerControl') private triggerControl?: ElementRef<HTMLButtonElement>;
  @ViewChild('backfillTriggerControl')
  private backfillTriggerControl?: ElementRef<HTMLButtonElement>;
  @ViewChild('backfillFromControl')
  private backfillFromControl?: ElementRef<HTMLInputElement>;
  @ViewChild('backfillToControl') private backfillToControl?: ElementRef<HTMLInputElement>;
  @ViewChild('pauseControl') private pauseControl?: ElementRef<HTMLButtonElement>;
  @ViewChild('resumeControl') private resumeControl?: ElementRef<HTMLButtonElement>;
  @ViewChild('confirmControl') private confirmControl?: ElementRef<HTMLButtonElement>;
  @ViewChild('sectionHeading') private sectionHeading?: ElementRef<HTMLElement>;

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [view, runs] = await Promise.all([fetchCollectionStatus(), fetchCollectionRuns()]);
      this.status.set(view);
      this.runs.set(runs);
    } catch (failure) {
      // O estado anterior permanece visível: falha de leitura não vira zero nem apaga o último sucesso.
      this.error.set(this.message(failure));
    } finally {
      this.loading.set(false);
    }
  }

  protected async startRecent(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      const started = await startCollectionRun('RECENT', this.session.csrfToken());
      this.notice.set(
        `Coleta recente disparada: execução ${started.id} (${collectionStatusLabel(started.state)}).`,
      );
      await this.reload();
    } catch (failure) {
      this.actionError.set(this.message(failure));
    } finally {
      this.busy.set(false);
      this.focus(() => this.triggerControl);
    }
  }

  protected async startBackfill(): Promise<void> {
    if (this.busy() || this.notConfigured() || this.hasOpenRun()) return;
    if (!this.backfillRangeValid()) {
      this.actionError.set('Informe um período válido dentro do recorte autorizado.');
      this.focus(() =>
        this.backfillFromInvalid() ? this.backfillFromControl : this.backfillToControl,
      );
      return;
    }
    const from = this.backfillFrom();
    const to = this.backfillTo();
    this.busy.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      const started = await startCollectionRun('BACKFILL', this.session.csrfToken(), { from, to });
      this.notice.set(`Carga retroativa disparada: execução ${started.id}, ${from} a ${to}.`);
      await this.reload();
    } catch (failure) {
      this.actionError.set(this.message(failure));
    } finally {
      this.busy.set(false);
      this.focus(() => this.backfillTriggerControl);
    }
  }

  protected setBackfillFrom(event: Event): void {
    this.backfillFrom.set((event.target as HTMLInputElement).value);
    this.actionError.set('');
  }

  protected setBackfillTo(event: Event): void {
    this.backfillTo.set((event.target as HTMLInputElement).value);
    this.actionError.set('');
  }

  protected progressLabel(run: CollectionRun): string {
    const kind = run.kind === 'BACKFILL' ? 'Carga retroativa' : 'Coleta recente';
    const limit = run.maxPages ?? 20;
    const cursor = run.nextPage === null ? '' : ` Próxima página: ${run.nextPage}.`;
    return `${kind}: ${run.counters.pagesDone} página(s) concluída(s); limite de ${limit} por etapa.${cursor}`;
  }

  /** Crédito exigido pela fonte: acompanha o estado, nunca uma credencial. */
  protected creditLabel(): string {
    const credit = this.credit();
    return credit ? `Fonte: ${credit}` : this.creditMissingHint;
  }

  /** Motivo distinto de «não configurada»: credencial ausente ≠ coleta desligada no servidor. */
  protected notConfiguredReason(): string {
    return this.status()?.reason === 'COLLECTION_DISABLED'
      ? 'Coleta desligada no servidor (vetor.collection.enabled=false).'
      : 'Sem arquivo de credencial privada legível.';
  }

  /** Municípios que a fonte não cobre são relatados, nunca silenciados. */
  protected missingLabel(missing: string[]): string {
    return `A fonte não cobre, e isto é relatado em vez de silenciado: ${missing.join(', ')}.`;
  }

  protected ask(action: 'pause' | 'resume'): void {
    this.actionError.set('');
    this.notice.set('');
    this.confirming.set(action);
    this.focus(() => this.confirmControl);
  }

  protected cancel(): void {
    const action = this.confirming();
    this.confirming.set('');
    this.notice.set('Comando cancelado; nenhuma mudança foi enviada.');
    this.focus(() => (action === 'resume' ? this.resumeControl : this.pauseControl));
  }

  protected async confirm(): Promise<void> {
    const action = this.confirming();
    const id = action === 'resume' ? this.resumeRun() : this.pauseRun();
    if (!action || !id || this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      const result =
        action === 'pause'
          ? await pauseCollectionRun(id, this.session.csrfToken())
          : await resumeCollectionRun(id, this.session.csrfToken());
      this.notice.set(
        action === 'pause'
          ? `Coleta pausada: execução ${result.id} (${collectionStatusLabel(result.state)}).`
          : `Coleta retomada: execução ${result.id} (${collectionStatusLabel(result.state)}).`,
      );
      await this.reload();
    } catch (failure) {
      this.actionError.set(this.message(failure));
    } finally {
      this.busy.set(false);
      this.confirming.set('');
      this.focus(() => (action === 'resume' ? this.resumeControl : this.pauseControl));
    }
  }

  private message(failure: unknown): string {
    return failure instanceof Error
      ? failure.message
      : 'A coleta não respondeu. Nenhum estado foi alterado. Tente novamente.';
  }

  /**
   * Devolve o foco ao controle que iniciou a ação, sem reposicionar a página. A consulta do
   * controle é tardia porque a confirmação pode ainda não existir no instante do clique.
   *
   * <p>Concluir pausa/retomada troca o estado e pode desabilitar o próprio controle iniciador; o
   * navegador ignora `focus()` em elemento desabilitado e o foco cairia no corpo do documento. Nesse
   * caso o foco vai para o título estável da seção (alcançável por teclado, `tabindex="-1"`), nunca
   * para lugar nenhum.
   */
  private focus<T extends HTMLButtonElement | HTMLInputElement>(
    control: () => ElementRef<T> | undefined,
  ): void {
    setTimeout(() => {
      const target = control()?.nativeElement;
      if (target && !target.disabled) {
        target.focus({ preventScroll: true });
        return;
      }
      this.sectionHeading?.nativeElement.focus({ preventScroll: true });
    });
  }
}
