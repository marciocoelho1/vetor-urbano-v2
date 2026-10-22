import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Session } from '../auth/session';
import {
  ACTION_LABELS,
  STATUS_LABELS,
  OccurrenceAdminError,
  bulkOccurrences,
  createOccurrence,
  fetchAdminOccurrences,
  saveOccurrence,
  updateLabel,
  type AdminOccurrence,
  type AdministrativeStatus,
  type BulkAction,
  type OccurrenceFilter,
  type OccurrenceSort,
} from '../data/occurrence-admin-api';

/**
 * Administração de ocorrências (pedido do responsável em 22/10/2026).
 *
 * Lista ordenada por última atualização (ou alfabética) com filtro de estado; seleção múltipla e
 * ações em lote — ativo, inativo, concluído e excluir. A exclusão abre confirmação e pede a senha do
 * administrador **uma única vez** para o lote inteiro, nunca por item. A edição cobre todos os campos
 * do núcleo factual com controle de versão.
 */
@Component({
  selector: 'app-occurrences-admin-panel',
  imports: [CommonModule],
  templateUrl: './occurrences-admin-panel.html',
  styleUrl: './occurrences-admin-panel.scss',
})
export class OccurrencesAdminPanel implements OnDestroy {
  private readonly session = inject(Session);
  private readonly injector = inject(Injector);
  private readonly abort = new AbortController();

  @ViewChild('listHeading') private listHeading?: ElementRef<HTMLElement>;
  /**
   * Foco do campo de senha: o setter do ViewChild roda exatamente quando o diálogo entra no DOM,
   * sem depender do ciclo de render nem de timers frágeis.
   */
  @ViewChild('passwordInput')
  set passwordInput(ref: ElementRef<HTMLInputElement> | undefined) {
    if (!ref) return;
    setTimeout(() => {
      try {
        ref.nativeElement.focus();
      } catch {
        // Ambiente sem foco (jsdom).
      }
    }, 0);
  }
  @ViewChild('deleteButton') private deleteButton?: ElementRef<HTMLButtonElement>;

  protected readonly items = signal<AdminOccurrence[]>([]);
  protected readonly counts = signal<Record<AdministrativeStatus, number>>({
    ACTIVE: 0,
    INACTIVE: 0,
    CONCLUDED: 0,
  });
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly sort = signal<OccurrenceSort>('last_update');
  protected readonly filter = signal<OccurrenceFilter>('ALL');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly confirmingDelete = signal(false);
  protected readonly password = signal('');
  protected readonly flashing = signal<AdminOccurrence | null>(null);
  protected readonly draft = signal<Record<string, string> | null>(null);
  protected readonly creating = signal(false);
  protected readonly newDraft = signal<Record<string, string> | null>(null);

  protected readonly labels = STATUS_LABELS;
  protected readonly actionLabels = ACTION_LABELS;
  protected readonly updated = updateLabel;
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly allSelected = computed(() => {
    const all = this.items();
    return all.length > 0 && all.every((item) => this.selected().has(item.id));
  });

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.abort.abort();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = await fetchAdminOccurrences(this.sort(), this.filter(), this.abort.signal);
      this.items.set(list.items);
      this.counts.set(list.counts);
      this.pruneSelection(list.items);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async changeSort(event: Event): Promise<void> {
    this.sort.set((event.target as HTMLSelectElement).value as OccurrenceSort);
    await this.load();
  }

  protected async changeFilter(event: Event): Promise<void> {
    this.filter.set((event.target as HTMLSelectElement).value as OccurrenceFilter);
    await this.load();
  }

  protected toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
  }

  protected toggleAll(): void {
    this.selected.set(
      this.allSelected() ? new Set() : new Set(this.items().map((item) => item.id)),
    );
  }

  protected isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  protected async applyAction(action: BulkAction): Promise<void> {
    const ids = [...this.selected()];
    if (ids.length === 0) return;
    if (action === 'DELETE') {
      this.confirmingDelete.set(true);
      this.password.set('');
      this.notice.set('');
      return;
    }
    await this.send(ids, action);
  }

  /** Uma única requisição para o lote inteiro: a senha é conferida uma vez, não por ocorrência. */
  protected async confirmDelete(): Promise<void> {
    const ids = [...this.selected()];
    if (ids.length === 0) {
      this.confirmingDelete.set(false);
      return;
    }
    await this.send(ids, 'DELETE', this.password());
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
    this.password.set('');
    setTimeout(() => this.focus(this.deleteButton), 0);
  }

  protected onPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected async send(ids: string[], action: BulkAction, password?: string): Promise<boolean> {
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.error.set('Sessão sem token de segurança; entre novamente para administrar.');
      return false;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await bulkOccurrences(csrf, ids, action, password);
      this.notice.set(`${result.message} ${result.affected} ocorrência(s).`);
      this.selected.set(new Set());
      this.confirmingDelete.set(false);
      this.password.set('');
      await this.load();
      this.focus(this.listHeading);
      return true;
    } catch (error) {
      if (action === 'DELETE') {
        this.error.set(this.message(error));
        this.confirmingDelete.set(true);
      } else {
        this.error.set(this.message(error));
      }
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /** Formulário vazio para registrar um fato em tempo real, sem clipping. */
  protected openCreate(): void {
    this.creating.set(true);
    this.flashing.set(null);
    this.draft.set(null);
    this.notice.set('');
    this.newDraft.set({
      title: '',
      description: '',
      category: 'TRANSITO',
      type: '',
      subtype: 'NAO_INFORMADO',
      situation: 'ONGOING',
      reliability: '3',
      municipality: 'Rio de Janeiro',
      neighborhood: '',
      locationPrecision: 'TERRITORY',
      occurredAt: '',
      happeningTitle: '',
    });
  }

  protected closeCreate(): void {
    this.creating.set(false);
    this.newDraft.set(null);
  }

  protected onNewField(field: string, event: Event): void {
    this.newDraft.set({
      ...(this.newDraft() ?? {}),
      [field]: (event.target as HTMLInputElement | HTMLSelectElement).value,
    });
  }

  protected async saveNew(): Promise<void> {
    const form = this.newDraft();
    if (!form) return;
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.error.set('Sessão sem token de segurança; entre novamente para cadastrar.');
      return;
    }
    const reliability = Number(form['reliability']);
    if (!Number.isInteger(reliability) || reliability < 1 || reliability > 5) {
      this.error.set('Nota deve ser um número inteiro de 1 a 5.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await createOccurrence(csrf, {
        ...form,
        subtype: form['subtype'] || 'NAO_INFORMADO',
        neighborhood: form['neighborhood'] || undefined,
        reliability,
        happeningTitle: form['happeningTitle']?.trim() || undefined,
      });
      this.notice.set(`«${form['title']}» cadastrada como ocorrência ativa.`);
      this.closeCreate();
      await this.load();
      this.focus(this.listHeading);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected openEditor(item: AdminOccurrence): void {
    this.flashing.set(item);
    this.draft.set({
      title: item.title,
      description: '',
      category: item.category,
      type: item.occurrence_type,
      subtype: 'NAO_INFORMADO',
      situation: item.situation,
      reliability: String(item.reliability),
      municipality: item.municipality,
      neighborhood: item.neighborhood,
      locationPrecision: 'TERRITORY',
      occurredAt: item.occurred_at ?? '',
    });
    this.notice.set(
      `Editando «${item.title}». Preencha todos os campos do núcleo factual e salve para gerar nova versão.`,
    );
  }

  protected closeEditor(): void {
    this.flashing.set(null);
    this.draft.set(null);
  }

  protected onDraft(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.draft.set({ ...(this.draft() ?? {}), [field]: value });
  }

  protected async saveEditor(): Promise<void> {
    const item = this.flashing();
    const draft = this.draft();
    if (!item || !draft) return;
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.error.set('Sessão sem token de segurança; entre novamente para editar.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      // A nota é numérica no servidor: enviar texto reprovaria a validação do núcleo factual.
      const reliability = Number(draft['reliability']);
      if (!Number.isInteger(reliability) || reliability < 1 || reliability > 5) {
        this.error.set('Nota deve ser um número inteiro de 1 a 5.');
        return;
      }
      await saveOccurrence(item.id, csrf, { ...draft, reliability }, item.revision);
      this.notice.set(`«${draft['title']}» salva em nova versão.`);
      this.closeEditor();
      await this.load();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  private pruneSelection(items: AdminOccurrence[]): void {
    const ids = new Set(items.map((item) => item.id));
    this.selected.set(new Set([...this.selected()].filter((id) => ids.has(id))));
  }

  private message(error: unknown): string {
    if (error instanceof OccurrenceAdminError) return error.message;
    return 'Falha inesperada ao administrar ocorrências; a falha não significa lista vazia.';
  }

  /**
   * O elemento só existe depois do próximo render. Agenda o foco em uma tarefa macia (fora do ciclo
   * de render) para o diálogo já estar no DOM quando o foco for aplicado.
   */
  private focusAfterRender(element?: ElementRef<HTMLElement>): void {
    const run = (): void => {
      try {
        element?.nativeElement?.focus();
      } catch {
        // Ambiente sem foco (jsdom).
      }
    };
    afterNextRender(() => setTimeout(run, 0), { injector: this.injector });
  }

  private focus(element?: ElementRef<HTMLElement>): void {
    try {
      element?.nativeElement?.focus();
    } catch {
      // Ambiente sem foco (jsdom).
    }
  }
}
