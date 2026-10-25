import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TerritoryCenterSelector,
  type TerritoryCenterSelection,
} from './territory-center-selector';

const CATALOG = {
  dataset: {
    id: 'dataset-1',
    source: 'IBGE — API de Malhas',
    sourceUrl: 'https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{code}',
    license: 'CC BY 4.0',
    attribution: 'IBGE',
    referenceDate: '2026-10-24',
    obtainedAt: '2026-10-24T13:00:00Z',
    checksum: 'a'.repeat(64),
    limitations: 'Recorte simplificado.',
  },
  coverage: {
    level: 'MUNICIPALITY',
    expected: 22,
    available: 1,
    pending: 21,
    expectedSource: 'LEGAL_RECORTE',
  },
  items: [
    {
      id: 'rio',
      officialCode: '3304557',
      level: 'MUNICIPALITY',
      name: 'Rio de Janeiro',
      version: 1,
      validated: true,
      internalPoint: [-43.2, -22.91],
      referenceDate: '2026-10-24',
    },
    {
      id: 'niteroi',
      officialCode: '3303302',
      level: 'MUNICIPALITY',
      name: 'Niterói',
      version: null,
      validated: false,
      internalPoint: null,
      referenceDate: null,
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('TerritoryCenterSelector', () => {
  let fixture: ComponentFixture<TerritoryCenterSelector>;
  let emitted: TerritoryCenterSelection[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerritoryCenterSelector],
    }).compileComponents();
    fixture = TestBed.createComponent(TerritoryCenterSelector);
    // Foco só é observável com o host no documento: jsdom ignora focus() de nó solto.
    document.body.appendChild(fixture.nativeElement);
    emitted = [];
    fixture.componentInstance.territorySelected.subscribe((selection) => emitted.push(selection));
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const open = async () => {
    (root().querySelector('.territory-disclosure') as HTMLButtonElement).click();
    await fixture.whenStable();
  };
  const input = () => root().querySelector('#map-locality-search') as HTMLInputElement;
  const options = () => Array.from(root().querySelectorAll('[role="option"]')) as HTMLElement[];
  const key = (name: string) =>
    input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  /** jsdom não implementa `matchMedia`: o componente decide por ela se rola ao abrir. */
  const stubCompact = (matches: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));

  /**
   * Move o componente para dentro de um painel rolável de mentira — o `#map-radius-options` real, que
   * recorta a lista. Devolve o painel e o disclosure para medir a rolagem de entrada.
   */
  const scrollableHost = (anchorTop: number) => {
    const panel = document.createElement('div');
    panel.style.overflowY = 'auto';
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 300 });
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 800 });
    panel.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    document.body.appendChild(panel);
    panel.appendChild(root());
    const disclosure = root().querySelector('.territory-disclosure') as HTMLButtonElement;
    disclosure.getBoundingClientRect = () => ({ top: anchorTop }) as DOMRect;
    return { panel, disclosure };
  };

  it('carrega uma vez e mostra nome, código IBGE, marcador de geometria e atribuição', async () => {
    const fetch = vi.fn().mockResolvedValue(json(CATALOG));
    vi.stubGlobal('fetch', fetch);

    await open();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Rio de Janeiro');
    expect(text()).toContain('IBGE 3304557');
    expect(text()).toContain('Geometria validada');
    expect(text()).toContain('Sem geometria validada');
    expect(text()).toContain('Cobertura parcial: 1 de 22 municípios com geometria validada.');
    expect(text()).toContain('CC BY 4.0');
    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().getAttribute('aria-autocomplete')).toBe('list');
  });

  it('marca a opção sem geometria como indisponível e as setas a pulam', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    await open();

    const unavailable = options().find((option) => option.textContent?.includes('Niterói'))!;
    expect(unavailable.getAttribute('aria-disabled')).toBe('true');

    key('ArrowDown');
    await fixture.whenStable();
    const active = input().getAttribute('aria-activedescendant');
    expect(active).toContain('3304557');
  });

  it('seleciona pelo teclado e entrega o ponto interno do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    await open();

    key('ArrowDown');
    key('Enter');
    await fixture.whenStable();

    expect(emitted).toEqual([
      {
        id: 'rio',
        officialCode: '3304557',
        name: 'Rio de Janeiro',
        version: 1,
        longitude: -43.2,
        latitude: -22.91,
      },
    ]);
  });

  it('filtra sem acento e informa o vazio com o termo entre aspas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    await open();

    input().value = 'niteroi';
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(options()).toHaveLength(1);
    expect(text()).toContain('1 município encontrado');

    input().value = 'xyz';
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(options()).toHaveLength(0);
    expect(text()).toContain('Nenhum município corresponde a “xyz”.');
  });

  it('mostra falha de carregamento e refaz a requisição na nova tentativa', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ code: 'TERRITORY_CATALOG_UNAVAILABLE' }, 503))
      .mockResolvedValueOnce(json(CATALOG));
    vi.stubGlobal('fetch', fetch);

    await open();

    expect(root().querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar o catálogo territorial.',
    );
    // 503 nunca vira lista vazia silenciosa.
    expect(options()).toHaveLength(0);

    (root().querySelector('.territory-action') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(options()).toHaveLength(2);
  });

  it('declara catálogo ainda não publicado e aponta o caminho que funciona', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          dataset: null,
          coverage: { ...CATALOG.coverage, available: 0, pending: 22 },
          items: [],
        }),
      ),
    );

    await open();

    expect(text()).toContain('Catálogo territorial ainda não publicado.');
    expect(text()).toContain('Use «Escolher centro no mapa» ou as coordenadas.');
  });

  it('traz o bloco ao topo do painel rolável quando a lista abre no móvel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    stubCompact(true);
    const { panel } = scrollableHost(250);

    await open();
    await nextFrame();

    // 250 (topo do bloco) − 100 (topo da área visível) − 8 px de folga.
    expect(panel.scrollTop).toBe(142);
  });

  it('não mexe na rolagem no desktop: lá o painel abre com o slider de distância à vista', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    stubCompact(false);
    const { panel } = scrollableHost(250);

    await open();
    await nextFrame();

    expect(panel.scrollTop).toBe(0);
  });

  it('reposiciona de novo ao reabrir com o catálogo já carregado, e não sem painel rolável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    stubCompact(true);
    const { panel, disclosure } = scrollableHost(250);

    await open();
    await nextFrame();
    expect(panel.scrollTop).toBe(142);

    // Fecha o bloco, zera a rolagem e reabre: o caminho "catálogo pronto" também posiciona.
    disclosure.click();
    await fixture.whenStable();
    panel.scrollTop = 0;
    disclosure.click();
    await fixture.whenStable();
    await nextFrame();
    expect(panel.scrollTop).toBe(142);

    // Sem ancestral rolável o componente não inventa rolagem nem quebra.
    panel.remove();
    document.body.appendChild(root());
    await open();
    await nextFrame();
    expect(text()).toContain('Rio de Janeiro');
  });

  it('leva o foco ao campo de busca ao abrir o bloco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    await open();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(document.activeElement).toBe(input());
  });

  it('nomeia a opção indisponível com o motivo, e não só visualmente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    await open();

    const unavailable = options().find((option) => option.textContent?.includes('Niterói'))!;
    expect(unavailable.getAttribute('aria-label')).toBe(
      'Niterói, IBGE 3303302, sem geometria validada',
    );
    const available = options().find((option) => option.textContent?.includes('Rio de Janeiro'))!;
    expect(available.getAttribute('aria-label')).toBe('Rio de Janeiro, IBGE 3304557');
  });

  it('Escape fecha um nível por vez e não deixa o evento subir ao app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(CATALOG)));
    await open();
    const reachedDocument = vi.fn();
    document.addEventListener('keydown', reachedDocument);

    input().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    // Lista fechada, bloco do seletor ainda aberto, e o app não recebeu o Escape.
    expect(root().querySelector('#map-locality-listbox')?.hasAttribute('hidden')).toBe(true);
    expect(root().querySelector('.territory-panel')?.hasAttribute('hidden')).toBe(false);
    expect(reachedDocument).not.toHaveBeenCalled();

    // Segundo Escape fecha o bloco e devolve o foco ao disclosure, sem estado interno pendente.
    input().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(root().querySelector('.territory-panel')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(root().querySelector('.territory-disclosure'));
    expect(reachedDocument).not.toHaveBeenCalled();
    document.removeEventListener('keydown', reachedDocument);
  });
});
