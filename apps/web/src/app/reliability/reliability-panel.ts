import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Session } from '../auth/session';
import {
  ReliabilityApiError,
  blockingLabel,
  decideSourceRating,
  evaluateOccurrence,
  fetchLatestEvaluation,
  fetchOccurrenceOptions,
  fetchRecommendation,
  fetchReevaluationFlags,
  fetchReliabilityRules,
  publishNote,
  recommendationLabel,
  recommendationTone,
  reproduceEvaluation,
  type OccurrenceOption,
  type ReliabilityEvaluation,
  type ReliabilityReproduction,
  type ReliabilityRules,
  type SourceRatingDecision,
  type SourceReevaluationFlag,
  type SourceRecommendation,
} from '../data/reliability-api';
import { fetchManagedSources, type ManagedSource } from '../data/source-api';

/**
 * Tickets 23 e 24: conferência administrativa da confiabilidade.
 *
 * O painel não calcula nada: mostra a avaliação que a API produziu (fatores internos), permite
 * reproduzir a mesma versão, publicar a nota 1–5 quando não há bloqueio, e decidir a nota da fonte a
 * partir da recomendação do servidor. Nenhuma nota é trocada aqui sem decisão explícita e
 * justificada. Estados de carregamento, erro e vazio são distintos: falha de leitura nunca aparece
 * como «sem dados».
 */
@Component({
  selector: 'app-reliability-panel',
  imports: [CommonModule],
  templateUrl: './reliability-panel.html',
  styleUrl: './reliability-panel.scss',
})
export class ReliabilityPanel implements OnDestroy {
  private readonly session = inject(Session);
  private readonly abort = new AbortController();

  @ViewChild('evaluationHeading') private evaluationHeading?: ElementRef<HTMLElement>;
  @ViewChild('sourceHeading') private sourceHeading?: ElementRef<HTMLElement>;

  protected readonly rules = signal<ReliabilityRules | null>(null);
  protected readonly occurrences = signal<OccurrenceOption[]>([]);
  protected readonly sources = signal<ManagedSource[]>([]);
  protected readonly selectedOccurrence = signal('');
  protected readonly selectedSource = signal('');
  protected readonly evaluation = signal<ReliabilityEvaluation | null>(null);
  protected readonly reproduction = signal<ReliabilityReproduction | null>(null);
  protected readonly recommendation = signal<SourceRecommendation | null>(null);
  protected readonly flags = signal<SourceReevaluationFlag[]>([]);
  protected readonly decision = signal<SourceRatingDecision | null>(null);
  protected readonly justification = signal('');

  protected readonly loadingEvaluation = signal(false);
  protected readonly loadingSource = signal(false);
  protected readonly busy = signal(false);
  protected readonly evaluationError = signal('');
  protected readonly sourceError = signal('');
  protected readonly notice = signal('');

  protected readonly label = recommendationLabel;
  protected readonly tone = recommendationTone;
  protected readonly blocking = blockingLabel;

  protected readonly ruleSummary = computed(() => this.rules()?.currentVersion ?? 0);
  protected readonly canPublish = computed(() => {
    const evaluation = this.evaluation();
    return !!evaluation && evaluation.state === 'RECORDED' && evaluation.blocking.length === 0;
  });
  protected readonly isPublished = computed(() => this.evaluation()?.state === 'PUBLISHED');
  protected readonly canApproveChange = computed(() => this.recommendation()?.canChange === true);
  protected readonly justificationTooShort = computed(
    () => this.justification().trim().length < 20,
  );
  protected readonly openFlags = computed(() => this.flags().filter((flag) => !flag.resolved_at));

  constructor() {
    void this.loadContext();
  }

  ngOnDestroy(): void {
    this.abort.abort();
  }

  protected async loadContext(): Promise<void> {
    this.loadingEvaluation.set(true);
    this.loadingSource.set(true);
    this.evaluationError.set('');
    this.sourceError.set('');
    try {
      const [rules, occurrences, sources] = await Promise.all([
        fetchReliabilityRules(this.abort.signal),
        fetchOccurrenceOptions(this.abort.signal),
        fetchManagedSources(this.abort.signal),
      ]);
      this.rules.set(rules);
      this.occurrences.set(occurrences);
      this.sources.set(sources);
      if (!this.selectedOccurrence() && occurrences.length > 0) {
        this.selectedOccurrence.set(occurrences[0].id);
        await this.loadEvaluation();
      }
      if (!this.selectedSource() && sources.length > 0) {
        this.selectedSource.set(sources[0].id);
        await this.loadRecommendation();
      }
    } catch (error) {
      this.handleContextError(error);
    } finally {
      this.loadingEvaluation.set(false);
      this.loadingSource.set(false);
    }
  }

  protected async pickOccurrence(event: Event): Promise<void> {
    this.selectedOccurrence.set((event.target as HTMLSelectElement).value);
    this.evaluation.set(null);
    this.reproduction.set(null);
    this.notice.set('');
    await this.loadEvaluation();
  }

  protected async pickSource(event: Event): Promise<void> {
    this.selectedSource.set((event.target as HTMLSelectElement).value);
    this.recommendation.set(null);
    this.flags.set([]);
    this.decision.set(null);
    this.notice.set('');
    await this.loadRecommendation();
  }

  protected async loadEvaluation(): Promise<void> {
    const occurrence = this.selectedOccurrence();
    if (!occurrence) {
      return;
    }
    this.loadingEvaluation.set(true);
    this.evaluationError.set('');
    try {
      this.evaluation.set(await fetchLatestEvaluation(occurrence, this.abort.signal));
    } catch (error) {
      if (error instanceof ReliabilityApiError && error.status === 404) {
        this.evaluation.set(null);
      } else {
        this.evaluationError.set(this.message(error));
      }
    } finally {
      this.loadingEvaluation.set(false);
    }
  }

  protected async evaluate(): Promise<void> {
    const occurrence = this.selectedOccurrence();
    if (!occurrence) {
      return;
    }
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.evaluationError.set('Sessão sem token de segurança; entre novamente para avaliar.');
      return;
    }
    this.busy.set(true);
    this.evaluationError.set('');
    this.notice.set('');
    try {
      const evaluation = await evaluateOccurrence(occurrence, csrf, crypto.randomUUID());
      this.evaluation.set(evaluation);
      this.reproduction.set(null);
      this.notice.set(
        evaluation.blocking.length === 0
          ? `Avaliação v${evaluation.evaluationVersion} registrada com nota ${evaluation.note}.`
          : `Avaliação v${evaluation.evaluationVersion} registrada com bloqueio; a nota não pode ser publicada.`,
      );
      this.focus(this.evaluationHeading);
    } catch (error) {
      this.evaluationError.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async reproduce(): Promise<void> {
    const evaluation = this.evaluation();
    if (!evaluation) {
      return;
    }
    this.busy.set(true);
    this.evaluationError.set('');
    try {
      const reproduction = await reproduceEvaluation(
        evaluation.occurrenceId,
        evaluation.evaluationVersion,
        this.abort.signal,
      );
      this.reproduction.set(reproduction);
      this.notice.set(reproduction.message);
    } catch (error) {
      this.evaluationError.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async publish(): Promise<void> {
    const evaluation = this.evaluation();
    if (!evaluation) {
      return;
    }
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.evaluationError.set('Sessão sem token de segurança; entre novamente para publicar.');
      return;
    }
    this.busy.set(true);
    this.evaluationError.set('');
    try {
      const published = await publishNote(
        evaluation.occurrenceId,
        evaluation.evaluationVersion,
        csrf,
      );
      this.evaluation.set({ ...evaluation, state: 'PUBLISHED' });
      this.notice.set(`Nota ${published.note} publicada. Fórmula e fatores continuam internos.`);
    } catch (error) {
      this.evaluationError.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected async loadRecommendation(): Promise<void> {
    const source = this.selectedSource();
    if (!source) {
      return;
    }
    this.loadingSource.set(true);
    this.sourceError.set('');
    try {
      const [recommendation, flags] = await Promise.all([
        fetchRecommendation(source, this.abort.signal),
        fetchReevaluationFlags(source, this.abort.signal),
      ]);
      this.recommendation.set(recommendation);
      this.flags.set(flags);
    } catch (error) {
      this.sourceError.set(this.message(error));
    } finally {
      this.loadingSource.set(false);
    }
  }

  protected async decide(approved: boolean): Promise<void> {
    const source = this.selectedSource();
    if (!source) {
      return;
    }
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.sourceError.set('Sessão sem token de segurança; entre novamente para decidir.');
      return;
    }
    if (approved && this.justificationTooShort()) {
      this.sourceError.set('Justificativa da decisão precisa de pelo menos 20 caracteres.');
      return;
    }
    this.busy.set(true);
    this.sourceError.set('');
    this.notice.set('');
    try {
      const decision = await decideSourceRating(
        source,
        csrf,
        approved ? 'APPROVED' : 'REJECTED',
        this.justification().trim() ||
          'Decisão de manter a nota registrada pelo painel de confiabilidade.',
      );
      this.decision.set(decision);
      this.notice.set(decision.message);
      await this.loadRecommendation();
      this.focus(this.sourceHeading);
    } catch (error) {
      this.sourceError.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected updateJustification(event: Event): void {
    this.justification.set((event.target as HTMLTextAreaElement).value);
  }

  private handleContextError(error: unknown): void {
    const message = this.message(error);
    this.evaluationError.set(message);
    this.sourceError.set(message);
  }

  private message(error: unknown): string {
    if (error instanceof ReliabilityApiError) {
      return error.message;
    }
    return 'Falha inesperada ao ler a confiabilidade; a falha não significa ausência de dados.';
  }

  private focus(element?: ElementRef<HTMLElement>): void {
    try {
      element?.nativeElement.focus();
    } catch {
      // Ambiente sem foco (jsdom) — o cabeçalho continua focável por teclado.
    }
  }
}
