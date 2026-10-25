import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  attributionLabel,
  countLabel,
  coverageLabel,
  fetchTerritoryCatalog,
  filterTerritories,
  territoryOptionLabel,
  type TerritoryCatalog,
  type TerritoryItem,
} from '../data/territory-catalog-api';

/** Centro escolhido no catálogo: sempre o ponto interno da versão publicada, nada calculado aqui. */
export interface TerritoryCenterSelection {
  id: string;
  officialCode: string;
  name: string;
  version: number;
  longitude: number;
  latitude: number;
}

type Status = 'idle' | 'loading' | 'error' | 'ready';

/** Folga entre o topo do bloco e o topo da área visível do painel ao abrir a lista. */
const REVEAL_OFFSET = 8;

/** Mesmo breakpoint que troca os alvos de toque para 44 px; acima dele o painel cabe sem rolar. */
const COMPACT_QUERY = '(max-width: 560px)';

/**
 * «Definir centro por local» (UXH-03, critérios UXH-CA09/UXH-CA10).
 *
 * O catálogo é carregado na primeira abertura do bloco e mantido enquanto esta instância vive; o
 * painel que hospeda o bloco pode ser remontado quando fecha, e por isso o componente reabre sempre
 * colapsado. O campo de busca filtra a lista em memória — não há requisição por tecla. Município sem
 * geometria validada aparece na lista, é anunciado, mas não é selecionável: não existe centro
 * inventado. O componente não dispara consulta ao escolher: só entrega o ponto interno ao mapa.
 */
@Component({
  selector: 'app-territory-center-selector',
  imports: [CommonModule],
  templateUrl: './territory-center-selector.html',
  styleUrl: './territory-center-selector.scss',
})
export class TerritoryCenterSelector {
  /** Seleção vigente vinda do pai: desfaz o destaque quando o centro é trocado no mapa. */
  readonly selection = input<TerritoryCenterSelection | null>(null);
  readonly territorySelected = output<TerritoryCenterSelection>();

  protected readonly open = signal(false);
  protected readonly status = signal<Status>('idle');
  protected readonly term = signal('');
  protected readonly listOpen = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly catalog = signal<TerritoryCatalog | null>(null);
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly injector = inject(Injector);
  private readonly disclosure = viewChild<ElementRef<HTMLButtonElement>>('disclosure');
  private readonly abort = new AbortController();

  protected readonly options = computed(() =>
    filterTerritories(this.catalog()?.items ?? [], this.term()),
  );
  protected readonly coverage = computed(() => {
    const catalog = this.catalog();
    return catalog ? coverageLabel(catalog.coverage) : '';
  });
  protected readonly attribution = computed(() =>
    attributionLabel(this.catalog()?.dataset ?? null),
  );
  protected readonly catalogEmpty = computed(
    () => this.status() === 'ready' && (this.catalog()?.items.length ?? 0) === 0,
  );
  protected readonly noMatch = computed(
    () => this.status() === 'ready' && !this.catalogEmpty() && this.options().length === 0,
  );
  protected readonly announcement = computed(() =>
    this.status() === 'ready' && !this.catalogEmpty() ? countLabel(this.options().length) : '',
  );

  /** Abre o bloco e carrega o catálogo na primeira vez desta instância; o componente reabre colapsado. */
  protected toggle(): void {
    const opening = !this.open();
    this.open.set(opening);
    if (!opening) {
      this.listOpen.set(false);
      this.activeIndex.set(-1);
      return;
    }
    if (this.status() === 'idle' || this.status() === 'error') void this.load();
    // Reabrir com catálogo pronto mostra a lista: o bloco não abre sem opções já visíveis.
    else if (this.status() === 'ready') {
      this.listOpen.set(true);
      this.focusSearch();
      this.reveal();
    }
  }

  /**
   * Foco vai ao campo ao abrir: o disclosure abriu uma busca, não uma lista de botões. O campo só
   * existe depois do render, então o foco espera o próximo ciclo em vez de correr com ele.
   */
  private focusSearch(): void {
    afterNextRender(
      () => {
        if (this.open()) this.search()?.nativeElement.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /**
   * Traz o bloco para o topo da área visível do painel que o hospeda — só no móvel.
   *
   * Ao abrir, o cabeçalho do painel de raio empurrava a lista para baixo da borda recortada pelo
   * `overflow-y`: no móvel a lista abria com zero opção à vista. No desktop o painel já cabe e a
   * mesma rolagem esconderia o controle de distância, então lá o painel abre como sempre abriu.
   * A âncora é o disclosure, não o campo — alinhar o campo esconderia o controle de fechar. O foco
   * do campo usa `preventScroll`, então os dois mecanismos não disputam a rolagem.
   */
  private reveal(): void {
    afterNextRender(
      () => {
        if (!this.listOpen()) return;
        // Sem `matchMedia` (SSR, ambiente sem layout) não há o que posicionar.
        if (!window.matchMedia?.(COMPACT_QUERY).matches) return;
        const anchor = this.disclosure()?.nativeElement;
        const scroller = anchor ? this.scrollableAncestor(anchor) : null;
        if (!anchor || !scroller) return;
        const offset = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += offset - REVEAL_OFFSET;
      },
      { injector: this.injector },
    );
  }

  /** Ancestral rolável mais próximo do bloco — o painel do mapa, nunca a página. */
  private scrollableAncestor(element: HTMLElement): HTMLElement | null {
    let node = element.parentElement;
    while (node && node !== document.body) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  protected async load(): Promise<void> {
    this.status.set('loading');
    try {
      const catalog = await fetchTerritoryCatalog(this.abort.signal);
      this.catalog.set(catalog);
      this.status.set('ready');
      this.activeIndex.set(-1);
      this.listOpen.set((catalog.items ?? []).length > 0);
      if (this.open()) {
        this.focusSearch();
        this.reveal();
      }
    } catch {
      // Falha real de carregamento: painel aberto, foco preservado e nova tentativa explícita.
      this.status.set('error');
    }
  }

  protected onInput(value: string): void {
    this.term.set(value);
    this.listOpen.set(true);
    this.activeIndex.set(-1);
  }

  protected clearSearch(): void {
    this.term.set('');
    this.activeIndex.set(-1);
  }

  protected optionId(item: TerritoryItem): string {
    return `map-locality-option-${item.officialCode}`;
  }

  protected optionLabel(item: TerritoryItem): string {
    return territoryOptionLabel(item);
  }

  protected selectable(item: TerritoryItem): boolean {
    return item.validated && item.internalPoint !== null;
  }

  protected selected(item: TerritoryItem): boolean {
    return this.selection()?.id === item.id;
  }

  protected activeDescendant(): string | null {
    if (!this.listOpen()) return null;
    const item = this.options()[this.activeIndex()];
    return item ? this.optionId(item) : null;
  }

  protected choose(item: TerritoryItem): void {
    if (!this.selectable(item) || item.internalPoint === null) return;
    const [longitude, latitude] = item.internalPoint;
    this.territorySelected.emit({
      id: item.id,
      officialCode: item.officialCode,
      name: item.name,
      version: item.version ?? 0,
      longitude,
      latitude,
    });
    this.listOpen.set(false);
    this.activeIndex.set(-1);
    // Foco volta ao botão do bloco: quem usa teclado continua de onde estava.
    this.disclosure()?.nativeElement.focus();
  }

  /** Setas pulam opções sem geometria: nunca param em item que não pode ser escolhido. */
  protected move(direction: 1 | -1): void {
    const options = this.options();
    if (!options.length) return;
    if (!this.listOpen()) this.listOpen.set(true);
    let index = this.activeIndex();
    for (let step = 0; step < options.length; step += 1) {
      index = (index + direction + options.length) % options.length;
      if (this.selectable(options[index])) {
        this.activeIndex.set(index);
        this.announceActive(index);
        return;
      }
    }
  }

  protected edge(first: boolean): void {
    const options = this.options();
    const ordered = first ? options : [...options].reverse();
    const index = ordered.findIndex((item) => this.selectable(item));
    if (index < 0) return;
    const target = first ? index : options.length - 1 - index;
    this.activeIndex.set(target);
    this.listOpen.set(true);
    this.announceActive(target);
  }

  protected confirm(): void {
    const item = this.options()[this.activeIndex()];
    if (item) this.choose(item);
  }

  /**
   * Escape em dois níveis, um efeito por tecla: fecha a lista e, quando ela já está fechada, fecha o
   * próprio bloco. A propagação para no componente — o app não pode fechar o painel de raio junto.
   */
  protected escape(event?: Event): void {
    event?.stopPropagation();
    if (this.listOpen()) {
      this.listOpen.set(false);
      this.activeIndex.set(-1);
      return;
    }
    this.open.set(false);
    this.listOpen.set(false);
    this.activeIndex.set(-1);
    this.disclosure()?.nativeElement.focus();
  }

  private announceActive(index: number): void {
    const id = this.optionId(this.options()[index]);
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' }),
    );
  }
}
