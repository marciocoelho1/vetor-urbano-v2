import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { Session } from '../auth/session';
import {
  createManagedSource,
  fetchManagedSources,
  fetchSourceHistory,
  updateManagedSource,
  SourceApiError,
  type ManagedSource,
  type SourceAccessMethod,
  type SourceDraft,
  type SourceHistory,
  type SourcePillar,
} from '../data/source-api';

type SourceForm = Omit<SourceDraft, 'territories' | 'rating'> & {
  territories: string;
  rating: string;
};

const EMPTY_FORM: SourceForm = {
  name: '',
  channel: '',
  url: '',
  territories: 'Rio de Janeiro',
  pillars: ['TRANSITO'],
  accessMethod: 'MANUAL',
  rating: '',
  ratingJustification: '',
};
const PILLARS: { id: SourcePillar; label: string }[] = [
  { id: 'TRANSITO', label: 'Trânsito' },
  { id: 'SEGURANCA', label: 'Segurança' },
  { id: 'CONTINGENCIA', label: 'Contingência' },
];

@Component({
  selector: 'app-source-management',
  imports: [CommonModule],
  templateUrl: './source-management.html',
  styleUrl: './source-management.scss',
})
export class SourceManagement {
  protected readonly session = inject(Session);
  protected readonly sources = signal<ManagedSource[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly editing = signal<ManagedSource | null>(null);
  protected readonly form = signal<SourceForm>({ ...EMPTY_FORM });
  /** Baseline do formulário: a MESMA derivação que `edit()` aplica — sem isso o
   *  baseline seria outro objeto e o guarda de descarte dispararia sempre. */
  private formOf(source: ManagedSource | null): SourceForm {
    return source
      ? { ...source, territories: source.territories.join('\n'), rating: String(source.rating) }
      : { ...EMPTY_FORM };
  }
  /** "Sujo" é derivado, não marcado: digitar e apagar até o original volta a limpo. */
  protected readonly dirty = computed(() => {
    const atual = this.form();
    const base = this.formOf(this.editing());
    const pilares = (lista: SourcePillar[]): string => [...lista].sort().join(',');
    return (
      atual.name !== base.name ||
      atual.channel !== base.channel ||
      atual.url !== base.url ||
      atual.territories !== base.territories ||
      atual.rating !== base.rating ||
      atual.ratingJustification !== base.ratingJustification ||
      atual.accessMethod !== base.accessMethod ||
      pilares(atual.pillars) !== pilares(base.pillars)
    );
  });
  /** Emitido no init também: o `@if`+`@defer` destrói o componente, e sem a primeira
   *  emissão o pai guardaria `true` de um descarte anterior. */
  readonly dirtyChange = output<boolean>();

  protected readonly history = signal<SourceHistory | null>(null);
  protected readonly historySourceId = signal<string | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly pillars = PILLARS;
  protected readonly methods: { id: SourceAccessMethod; label: string }[] = [
    { id: 'MANUAL', label: 'Registro manual' },
    { id: 'PUBLIC_PAGE', label: 'Página pública' },
    { id: 'RSS', label: 'Feed RSS' },
    { id: 'PUBLIC_API', label: 'API pública' },
    { id: 'OTHER', label: 'Outro método' },
  ];
  @ViewChild('sourceName') private readonly sourceName?: ElementRef<HTMLInputElement>;
  @ViewChild('statusMessage') private readonly statusMessage?: ElementRef<HTMLElement>;

  constructor() {
    void this.reload();
    effect(() => this.dirtyChange.emit(this.dirty()));
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.sources.set(await fetchManagedSources());
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected setText(
    field: 'name' | 'channel' | 'url' | 'territories' | 'rating' | 'ratingJustification',
    value: string,
  ): void {
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  protected setMethod(value: string): void {
    if (this.methods.some((method) => method.id === value))
      this.form.update((form) => ({ ...form, accessMethod: value as SourceAccessMethod }));
  }

  protected togglePillar(id: SourcePillar, checked: boolean): void {
    this.form.update((form) => ({
      ...form,
      pillars: checked ? [...form.pillars, id] : form.pillars.filter((pillar) => pillar !== id),
    }));
  }

  protected startCreate(): void {
    this.editing.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.status.set('Novo cadastro de fonte.');
    this.focusName();
  }

  protected edit(source: ManagedSource): void {
    this.editing.set(source);
    this.form.set(this.formOf(source));
    this.status.set(`Editando ${source.name}, versão ${source.version}.`);
    this.focusName();
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.status.set('Edição cancelada.');
    this.focusStatus();
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const form = this.form();
    const draft: SourceDraft = {
      name: form.name.trim(),
      channel: form.channel.trim(),
      url: form.url?.trim() || null,
      territories: form.territories
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      pillars: form.pillars,
      accessMethod: form.accessMethod,
      rating: Number(form.rating),
      ratingJustification: form.ratingJustification.trim(),
    };
    const csrf = this.session.state()?.csrfToken;
    if (!csrf) {
      this.error.set('Sessão ausente ou expirada. Entre novamente.');
      this.focusStatus();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.status.set('Salvando versão…');
    try {
      const previous = this.editing();
      const result = previous
        ? await this.update(previous, draft, csrf)
        : await createManagedSource(draft, csrf);
      this.editing.set(null);
      this.history.set(null);
      this.historySourceId.set(null);
      this.form.set({ ...EMPTY_FORM });
      this.status.set(`${result.name} salva na versão ${result.version}.`);
      await this.reload();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
      this.focusStatus();
    }
  }

  private update(source: ManagedSource, draft: SourceDraft, csrf: string): Promise<ManagedSource> {
    const id = source.id;
    return updateManagedSource(id, draft, source.version, csrf);
  }

  protected async toggleHistory(source: ManagedSource): Promise<void> {
    if (this.history()?.sourceId === source.id) {
      this.history.set(null);
      this.historySourceId.set(null);
      return;
    }
    this.history.set(null);
    this.historySourceId.set(source.id);
    this.historyError.set('');
    this.historyLoading.set(true);
    try {
      this.history.set(await fetchSourceHistory(source.id));
    } catch (error: unknown) {
      this.historyError.set(this.errorMessage(error));
    } finally {
      this.historyLoading.set(false);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof SourceApiError && error.status === 409)
      return 'Esta fonte mudou em outra edição. Atualize a lista e tente novamente.';
    return error instanceof Error ? error.message : 'Não foi possível carregar as fontes.';
  }

  private focusName(): void {
    setTimeout(() => this.sourceName?.nativeElement.focus());
  }

  private focusStatus(): void {
    setTimeout(() => this.statusMessage?.nativeElement.focus());
  }
}
