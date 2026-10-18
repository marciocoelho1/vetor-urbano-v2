import { Session } from './auth/session';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { Theme } from './core/theme/theme';
import type { SpreadsheetSheet } from './data-exchange/xlsx-export';
import type { Coordinates, DemoRecord } from './domain/occurrences';

const territorialFixture = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      properties: { n: 'Morro do Amor', f: 'CV' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-43.2, -22.9],
            [-43.1, -22.9],
            [-43.1, -22.8],
            [-43.2, -22.8],
            [-43.2, -22.9],
          ],
        ],
      },
    },
  ],
};

const maplibreWorkerMock = vi.hoisted(() => {
  const calls: string[] = [];
  const callbacks = new Map<string, (...args: unknown[]) => void>();
  const map = {
    configuration: undefined as Record<string, unknown> | undefined,
    addControl: vi.fn(() => undefined),
    addLayer: vi.fn((_layer: unknown, _beforeId?: string) => undefined),
    addSource: vi.fn((_id: string, _source: unknown) => undefined),
    fitBounds: vi.fn(() => undefined),
    flyTo: vi.fn(() => undefined),
    getCenter: vi.fn(() => ({ lng: -43.19156448029434, lat: -22.903318808380494 })),
    getZoom: vi.fn(() => 12.2),
    getContainer: vi.fn(() => document.createElement('div')),
    off: vi.fn(),
    getLayer: vi.fn(() => ({ id: 'layer' })),
    getSource: vi.fn((_id: string): unknown => undefined),
    getStyle: vi.fn(() => ({ layers: [{ id: 'place-labels', type: 'symbol' }] })),
    isStyleLoaded: vi.fn(() => true),
    on: vi.fn((...args: unknown[]) => {
      const callback = args.at(-1);
      if (args.length === 2 && typeof callback === 'function') {
        callbacks.set(String(args[0]), callback as (...values: unknown[]) => void);
      }
      return undefined;
    }),
    remove: vi.fn(() => undefined),
    removeFeatureState: vi.fn((_target: unknown, _key?: string) => undefined),
    resize: vi.fn(() => undefined),
    setFeatureState: vi.fn((_target: unknown, _state: unknown) => undefined),
    setFilter: vi.fn(() => undefined),
    setLayoutProperty: vi.fn(() => undefined),
  };
  return {
    callbacks,
    calls,
    map,
    Map: vi.fn(function MockMap(configuration: Record<string, unknown>) {
      calls.push('map');
      map.configuration = configuration;
      return map;
    }),
    NavigationControl: vi.fn(),
    setWorkerUrl: vi.fn((url: string) => calls.push(`worker:${url}`)),
  };
});

vi.mock('maplibre-gl', () => maplibreWorkerMock);

function stubWebGL2Context(available = true) {
  const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'WebGL2RenderingContext');
  Object.defineProperty(window, 'WebGL2RenderingContext', {
    configurable: true,
    value: class WebGL2RenderingContext {},
  });
  const contextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(available ? ({} as WebGL2RenderingContext) : null);
  return {
    contextSpy,
    restore: () => {
      contextSpy.mockRestore();
      if (previousDescriptor) {
        Object.defineProperty(window, 'WebGL2RenderingContext', previousDescriptor);
      } else {
        Reflect.deleteProperty(window, 'WebGL2RenderingContext');
      }
    },
  };
}

describe('Vetor Urbano', () => {
  let fixture: ComponentFixture<App>;
  let mapLibreStyleAppendSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    vi.useRealTimers();
    mapLibreStyleAppendSpy?.mockRestore();
    mapLibreStyleAppendSpy = undefined;
    vi.unstubAllGlobals();
    sessionStorage.clear();
    localStorage.clear();
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
    sessionStorage.clear();
    localStorage.clear();
    const append = document.head.append.bind(document.head);
    mapLibreStyleAppendSpy = vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      append(...nodes);
      for (const node of nodes) {
        if (
          typeof node !== 'string' &&
          node instanceof HTMLLinkElement &&
          (node.hasAttribute('data-maplibre-style') || node.hasAttribute('data-leaflet-style'))
        ) {
          queueMicrotask(() => node.dispatchEvent(new Event('load')));
        }
      }
    });
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    // Estes testes exercitam a UI demonstrativa já autenticada; autorização real está nos HTTP/E2E do 14.
    const session = TestBed.inject(Session);
    const access = {
      code: 'AUTHENTICATED',
      message: 'Sessão sintética',
      role: 'ADMIN' as const,
      authenticated: true,
      csrfToken: 'synthetic',
    };
    session.state.set(access);
    vi.spyOn(session, 'refresh').mockResolvedValue();
    vi.spyOn(session, 'request').mockResolvedValue(access);
    fixture = TestBed.createComponent(App);
    vi.spyOn(
      fixture.componentInstance as unknown as { loadUrbanStyle: () => Promise<unknown> },
      'loadUrbanStyle',
    ).mockResolvedValue({
      version: 8,
      name: 'Vetor Urbano',
      sources: {},
      layers: [],
      sprite: 'maps/occurrence-pins',
    });
    fixture.detectChanges();
  });

  it('explains unique eligible occurrences and a fixed color scale when heat is enabled', () => {
    fixture.nativeElement.querySelector('.heatmap-button').click();
    fixture.detectChanges();
    const legend = fixture.nativeElement.querySelector('[data-testid="heatmap-legend"]');
    expect(legend).not.toBeNull();
    expect(legend.textContent).toContain('ocorrências elegíveis');
    expect(legend.textContent).toContain('sem pesos');
    expect(legend.textContent).toContain('POIs e locais apenas territoriais não contribuem');
    expect(legend.textContent).not.toContain('Densidades de ocorrências e POIs');
  });

  it('starts both maps in the page theme, including a map opened later', async () => {
    fixture.destroy();
    TestBed.inject(Theme).dark.set(true);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const publicToggle = fixture.nativeElement.querySelector('[data-testid="map-theme-toggle"]');
    expect(publicToggle.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.map-frame').classList).toContain('map-dark');
    publicToggle.click();
    fixture.detectChanges();
    expect(publicToggle.getAttribute('aria-pressed')).toBe('false');
    fixture.nativeElement.querySelector('button.nav-register').click();
    await Promise.resolve();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.category-option[data-category="TRANSITO"]').click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="report-map-theme-toggle"]')
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(TestBed.inject(Theme).dark()).toBe(true);
  });

  it('keeps local map choices independent until the next page theme change', async () => {
    const theme = TestBed.inject(Theme);
    const publicToggle = fixture.nativeElement.querySelector('[data-testid="map-theme-toggle"]');
    publicToggle.click();
    fixture.detectChanges();
    expect(theme.dark()).toBe(false);
    expect(localStorage.getItem('vu2.theme')).toBeNull();
    fixture.nativeElement.querySelector('button.nav-register').click();
    await Promise.resolve();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.category-option[data-category="TRANSITO"]').click();
    fixture.detectChanges();
    const reportToggle = fixture.nativeElement.querySelector(
      '[data-testid="report-map-theme-toggle"]',
    );
    expect(publicToggle.getAttribute('aria-pressed')).toBe('true');
    expect(reportToggle.getAttribute('aria-pressed')).toBe('false');
    theme.dark.set(true);
    fixture.detectChanges();
    expect(publicToggle.getAttribute('aria-pressed')).toBe('true');
    expect(reportToggle.getAttribute('aria-pressed')).toBe('true');
    reportToggle.click();
    fixture.detectChanges();
    expect(publicToggle.getAttribute('aria-pressed')).toBe('true');
    expect(reportToggle.getAttribute('aria-pressed')).toBe('false');
    expect(theme.dark()).toBe(true);
    theme.dark.set(false);
    fixture.detectChanges();
    expect(publicToggle.getAttribute('aria-pressed')).toBe('false');
    expect(reportToggle.getAttribute('aria-pressed')).toBe('false');
    theme.dark.set(true);
    fixture.detectChanges();
    expect(publicToggle.getAttribute('aria-pressed')).toBe('true');
    expect(reportToggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('updates the existing vector maps when the page theme changes and preserves local independence', () => {
    const createMap = () => ({
      getLayer: () => ({ id: 'background' }),
      isStyleLoaded: () => true,
      remove: vi.fn(),
      setPaintProperty: vi.fn(),
    });
    const publicMap = createMap();
    const reportMap = createMap();
    const app = fixture.componentInstance as unknown as {
      map: typeof publicMap;
      reportMap: typeof reportMap;
      urbanMapStyle: unknown;
    };
    app.map = publicMap;
    app.reportMap = reportMap;
    app.urbanMapStyle = {
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eaed' } }],
    };
    const theme = TestBed.inject(Theme);
    theme.dark.set(true);
    fixture.detectChanges();
    for (const map of [publicMap, reportMap]) {
      expect(map.setPaintProperty).toHaveBeenLastCalledWith(
        'background',
        'background-color',
        '#202832',
      );
    }
    fixture.nativeElement.querySelector('[data-testid="map-theme-toggle"]').click();
    fixture.detectChanges();
    expect(publicMap.setPaintProperty).toHaveBeenLastCalledWith(
      'background',
      'background-color',
      '#e8eaed',
    );
    expect(reportMap.setPaintProperty).toHaveBeenLastCalledWith(
      'background',
      'background-color',
      '#202832',
    );
    theme.dark.set(false);
    fixture.detectChanges();
    for (const map of [publicMap, reportMap]) {
      expect(map.setPaintProperty).toHaveBeenLastCalledWith(
        'background',
        'background-color',
        '#e8eaed',
      );
    }
    expect(app.map).toBe(publicMap);
    expect(app.reportMap).toBe(reportMap);
  });

  it('lets visitors hide filters and enter an expanded map mode with a keyboard exit', () => {
    const filterToggle = fixture.nativeElement.querySelector('[data-testid="filter-panel-toggle"]');
    filterToggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.map-layout').classList).toContain(
      'filters-collapsed',
    );
    expect(localStorage.getItem('vu2.filtersCollapsed')).toBe('true');

    const expandToggle = fixture.nativeElement.querySelector('[data-testid="map-expand-toggle"]');
    expandToggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.map-frame').classList).toContain('map-expanded');
    expect(expandToggle.getAttribute('aria-pressed')).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.map-frame').classList).not.toContain(
      'map-expanded',
    );
  });

  it('searches visible occurrences and lets a search result focus the matching marker', () => {
    const app = fixture.componentInstance as unknown as {
      map: typeof maplibreWorkerMock.map;
      allPoints: () => { id: string; coordinates: [number, number] }[];
    };
    app.map = maplibreWorkerMock.map;

    const search = fixture.nativeElement.querySelector(
      '[data-testid="map-search"]',
    ) as HTMLInputElement;
    search.value = 'Sinalizacao sem funcionamento';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const result = fixture.nativeElement.querySelector(
      '[data-search-result="occurrence:demo-001"]',
    ) as HTMLButtonElement;
    expect(result).not.toBeNull();
    result.click();
    expect(maplibreWorkerMock.map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: app.allPoints().find((point) => point.id === 'demo-001')!.coordinates,
      }),
    );
  });

  it('searches source areas lazily and fits the selected polygon on the map', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => territorialFixture,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const app = fixture.componentInstance as unknown as {
      map: typeof maplibreWorkerMock.map;
      mapReady: { set: (ready: boolean) => void };
      installTerritoryLayer: () => void;
      setSearchQuery: (query: string) => void;
      activeFilters: () => string[];
      territoryStatus: () => string;
    };
    app.map = maplibreWorkerMock.map;
    app.setSearchQuery('Morro do Amor');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(app.territoryStatus()).toBe('loaded'));
    fixture.detectChanges();
    const result = fixture.nativeElement.querySelector(
      '[data-search-result="territory:1"]',
    ) as HTMLButtonElement;
    expect(result).not.toBeNull();
    result.click();
    fixture.detectChanges();

    expect(app.activeFilters()).toContain('territory:CV');
    expect(maplibreWorkerMock.map.fitBounds).toHaveBeenCalledWith(
      [
        [-43.2, -22.9],
        [-43.1, -22.8],
      ],
      expect.objectContaining({ maxZoom: 15 }),
    );
    app.mapReady.set(true);
    app.installTerritoryLayer();
    expect(maplibreWorkerMock.map.addSource).toHaveBeenCalledWith(
      'territory-source',
      expect.objectContaining({ type: 'geojson' }),
    );
    expect(maplibreWorkerMock.map.addLayer).toHaveBeenCalledTimes(2);
    expect(maplibreWorkerMock.map.addLayer.mock.calls[0]?.[1]).toBe('place-labels');
    expect(maplibreWorkerMock.map.setFilter).toHaveBeenCalledWith('territory-polygons-fill', [
      'in',
      ['get', 'f'],
      ['literal', ['CV']],
    ]);
    expect(maplibreWorkerMock.map.setFeatureState).toHaveBeenCalledWith(
      { source: 'territory-source', id: 1 },
      { selected: true },
    );
  });

  it('keeps the report form hidden until one category is chosen', async () => {
    fixture.nativeElement.querySelector('button.nav-register').click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="report-details"]')).toBeNull();

    fixture.nativeElement.querySelector('.category-option[data-category="SEGURANCA"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="report-details"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="security-fields"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="traffic-fields"]')).toBeNull();
  });

  it('allows only one module to expand without clearing another module’s active filters', () => {
    const intelligence = fixture.nativeElement.querySelector('[data-module="intelligence"]');
    const information = fixture.nativeElement.querySelector('[data-module="information"]');

    if (intelligence.getAttribute('aria-expanded') !== 'true') {
      intelligence.click();
      fixture.detectChanges();
    }
    fixture.nativeElement.querySelector('[data-filter="period-1m"]').click();
    fixture.detectChanges();
    information.click();
    fixture.detectChanges();

    expect(intelligence.getAttribute('aria-expanded')).toBe('false');
    expect(information.getAttribute('aria-expanded')).toBe('true');
    intelligence.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-filter="period-1m"]').checked).toBe(true);
  });

  it('labels territorial polygons as source-attributed and lets the visitor filter by group', () => {
    expect(fixture.nativeElement.textContent).toContain('ocorrências fictícias');
    fixture.nativeElement.querySelector('[data-module="territory"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('segundo a fonte');
    expect(fixture.nativeElement.textContent).toContain('julho de 2026');
    expect(fixture.nativeElement.textContent).toContain('não confirma a situação atual');
    expect(fixture.nativeElement.querySelector('[data-filter="territory:CV"]')).not.toBeNull();
  });

  it('stacks an information layer with the active occurrence layer without mixing their counts', () => {
    fixture.nativeElement.querySelector('[data-module="information"]').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('input[data-filter="poi:HOSPITAL_PUBLICO"]')?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.result-total strong').textContent).toBe('17');
    expect(fixture.nativeElement.textContent).toContain('18 itens');
    expect(fixture.nativeElement.textContent).toContain('Unidade de saúde demonstrativa');
  });

  it('refines broad category results with the selected approved type', () => {
    const app = fixture.componentInstance as unknown as {
      activeFilters: { set: (filters: string[]) => void };
      visiblePoints: () => { id: string }[];
    };
    app.activeFilters.set(['category:SEGURANCA', 'type:FURTO']);

    expect(app.visiblePoints().map((point) => point.id)).toContain('demo-seguranca-002');
  });

  it('does not treat collective information points as client-exclusive points', () => {
    const app = fixture.componentInstance as unknown as {
      activeFilters: { set: (filters: string[]) => void };
      visiblePoints: () => { id: string; kind: string }[];
    };
    app.activeFilters.set(['poi:EXCLUSIVO']);

    expect(app.visiblePoints().filter((point) => point.kind === 'poi')).toEqual([]);
  });

  it('preserves common report fields when the category changes and clears category-specific fields', () => {
    const app = fixture.componentInstance as unknown as {
      reportFields: { set: (fields: Record<string, string>) => void; (): Record<string, string> };
      chooseCategory: (category: 'TRANSITO' | 'SEGURANCA' | 'CONTINGENCIA') => void;
    };
    app.reportFields.set({
      nome: 'Interdição demonstrativa',
      descricao: 'Texto de teste',
      local: 'Centro do Rio',
      ocorridoEm: '2026-10-10T10:00',
      severidade: 'MODERADA',
      tipoTransito: 'INTERDICAO',
      impactoVia: 'PARCIAL',
      grupo: 'ALERTA',
    });

    app.chooseCategory('CONTINGENCIA');

    expect(app.reportFields()).toEqual({
      nome: 'Interdição demonstrativa',
      descricao: 'Texto de teste',
      local: 'Centro do Rio',
      ocorridoEm: '2026-10-10T10:00',
      severidade: 'MODERADA',
    });
  });

  it('rejects empty coordinates and makes clear that the demonstration never sends a report', async () => {
    fixture.nativeElement.querySelector('button.nav-register').click();
    await Promise.resolve();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.category-option[data-category="TRANSITO"]').click();
    fixture.detectChanges();

    const app = fixture.componentInstance as unknown as {
      setCoordinate: (axis: 'longitude' | 'latitude', value: string) => void;
      confirmPoint: () => void;
    };
    app.setCoordinate('longitude', '');
    app.setCoordinate('latitude', '');
    app.confirmPoint();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Informe longitude entre');
    expect(fixture.nativeElement.querySelector('.submit-note').textContent).toContain(
      'Nenhum dado será enviado',
    );
    expect(fixture.nativeElement.querySelector('.submit-button').textContent).toContain(
      'Verificar cadastro',
    );
    expect(fixture.nativeElement.querySelector('.account-badge').textContent).toContain(
      'Demonstração sem envio',
    );
    expect(fixture.nativeElement.textContent).not.toContain('aprovação por operador');
  });

  it('loads the 2D map when the vector basemap fails before loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          maxZoom: 19,
          attribution: 'OpenStreetMap contributors',
        }),
      })),
    );
    const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'WebGLRenderingContext');
    const webGL2 = stubWebGL2Context();
    webGL2.contextSpy.mockImplementation((type) =>
      type === 'webgl2' ? ({} as WebGL2RenderingContext) : null,
    );
    Object.defineProperty(window, 'WebGLRenderingContext', {
      configurable: true,
      value: class WebGLRenderingContext {},
    });

    try {
      const app = fixture.componentInstance as unknown as {
        initializeMap: () => Promise<void>;
        mapError: () => boolean;
      };
      await app.initializeMap();
      const errorHandler = maplibreWorkerMock.callbacks.get('error');
      expect(errorHandler).toBeTypeOf('function');
      errorHandler?.({ error: new Error('tile service unavailable') });
      await vi.waitFor(() => {
        expect(document.querySelector('#map-canvas.leaflet-container')).not.toBeNull();
      });
      fixture.detectChanges();

      expect(app.mapError()).toBe(false);
      expect(fixture.nativeElement.querySelector('.map-fallback')).toBeNull();
    } finally {
      webGL2.restore();
      if (previousDescriptor) {
        Object.defineProperty(window, 'WebGLRenderingContext', previousDescriptor);
      } else {
        Reflect.deleteProperty(window, 'WebGLRenderingContext');
      }
    }
  });

  it('prefers 2D for software graphics and preserves vector for accelerated or private GPUs', () => {
    const webGL2 = stubWebGL2Context();
    const app = fixture.componentInstance as unknown as { supportsWebGL2: () => boolean };
    try {
      for (const [renderer, expected] of [
        ['ANGLE (Vulkan, SwiftShader Device)', false],
        ['llvmpipe (LLVM 15.0.7, 256 bits)', false],
        ['Software Rasterizer', false],
        ['ANGLE (NVIDIA GeForce, OpenGL)', true],
        ['', true],
      ] as const) {
        webGL2.contextSpy.mockReturnValue({
          getExtension: () => (renderer ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null),
          getParameter: () => renderer,
        } as unknown as WebGL2RenderingContext);
        expect(app.supportsWebGL2(), renderer || 'renderer hidden by privacy').toBe(expected);
      }
    } finally {
      webGL2.restore();
    }
  });

  it('uses the 2D fallback when WebGL2 is unavailable', async () => {
    const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'WebGLRenderingContext');
    const webGL2 = stubWebGL2Context(false);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maxZoom: 19,
        attribution: 'OpenStreetMap contributors',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'WebGLRenderingContext', {
      configurable: true,
      value: class WebGLRenderingContext {},
    });
    try {
      const app = fixture.componentInstance as unknown as {
        initializeMap: () => Promise<void>;
        mapError: { (): boolean; set: (error: boolean) => void };
        fallbackMap?: { getContainer: () => HTMLElement };
      };
      maplibreWorkerMock.Map.mockClear();
      app.mapError.set(false);
      await app.initializeMap();

      expect(webGL2.contextSpy).toHaveBeenCalledWith('webgl2');
      expect(app.mapError()).toBe(false);
      expect(app.fallbackMap?.getContainer()).toBe(
        fixture.nativeElement.querySelector('#map-canvas'),
      );
      expect(document.querySelector('#map-canvas.leaflet-container')).not.toBeNull();
      expect(maplibreWorkerMock.Map).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      webGL2.restore();
      if (previousDescriptor) {
        Object.defineProperty(window, 'WebGLRenderingContext', previousDescriptor);
      } else {
        Reflect.deleteProperty(window, 'WebGLRenderingContext');
      }
    }
  });

  it('exposes the cause of a MapLibre initialization error in the fallback state', async () => {
    const webGL2 = stubWebGL2Context();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    maplibreWorkerMock.callbacks.clear();
    try {
      const app = fixture.componentInstance as unknown as {
        initializeMap: () => Promise<void>;
        mapErrorDetails: () => string;
      };
      await app.initializeMap();
      maplibreWorkerMock.callbacks.get('error')?.({ error: new Error('Failed to fetch style') });

      expect(app.mapErrorDetails()).toContain('Failed to fetch style');
      await vi.waitFor(() => expect(app.mapErrorDetails()).toContain('503'));
    } finally {
      webGL2.restore();
    }
  });

  it('bounds a stalled vector map initialization and cancels its watchdog on disposal', () => {
    vi.useFakeTimers();
    try {
      const app = fixture.componentInstance as unknown as {
        monitorMap: (
          map: unknown,
          ready: () => void,
          failed: (error: unknown) => void,
        ) => () => void;
      };
      const failed = vi.fn();
      const stop = app.monitorMap(maplibreWorkerMock.map, vi.fn(), failed);
      vi.advanceTimersByTime(7999);
      expect(failed).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(failed).toHaveBeenCalledOnce();
      stop();
      failed.mockClear();
      const dispose = app.monitorMap(maplibreWorkerMock.map, vi.fn(), failed);
      dispose();
      vi.advanceTimersByTime(8000);
      expect(failed).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a loaded vector map usable after an isolated tile error', () => {
    const app = fixture.componentInstance as unknown as {
      monitorMap: (map: unknown, ready: () => void, failed: (error: unknown) => void) => () => void;
    };
    const ready = vi.fn();
    const failed = vi.fn();
    const stop = app.monitorMap(maplibreWorkerMock.map, ready, failed);
    maplibreWorkerMock.callbacks.get('idle')?.();
    maplibreWorkerMock.callbacks.get('error')?.({ error: new Error('isolated tile failure') });
    expect(ready).toHaveBeenCalledOnce();
    expect(failed).not.toHaveBeenCalled();
    stop();
  });

  it('sets the self-hosted MapLibre worker URL before creating the map', async () => {
    const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'WebGLRenderingContext');
    const webGL2 = stubWebGL2Context();
    Object.defineProperty(window, 'WebGLRenderingContext', {
      configurable: true,
      value: class WebGLRenderingContext {},
    });
    maplibreWorkerMock.calls.length = 0;
    maplibreWorkerMock.setWorkerUrl.mockClear();
    maplibreWorkerMock.Map.mockClear();

    try {
      const app = fixture.componentInstance as unknown as {
        initializeMap: () => Promise<void>;
      };
      await app.initializeMap();

      const expectedUrl = new URL('assets/maplibre/maplibre-gl-worker.mjs', document.baseURI).href;
      expect(document.querySelector('link[data-maplibre-style]')).not.toBeNull();
      expect(maplibreWorkerMock.setWorkerUrl).toHaveBeenCalledWith(expectedUrl);
      expect(maplibreWorkerMock.map.configuration?.['style']).toMatchObject({
        name: 'Vetor Urbano',
      });
      const attribution = maplibreWorkerMock.map.configuration?.['attributionControl'] as {
        compact: boolean;
        customAttribution?: string;
      };
      expect(maplibreWorkerMock.map.configuration?.['center']).toEqual([
        -43.19156448029434, -22.903318808380494,
      ]);
      expect(attribution.compact).toBe(false);
      // The style's source already supplies attribution; avoid duplicate credits.
      expect(attribution.customAttribution).toBeUndefined();
      expect(maplibreWorkerMock.calls).toEqual([`worker:${expectedUrl}`, 'map']);
    } finally {
      webGL2.restore();
      if (previousDescriptor) {
        Object.defineProperty(window, 'WebGLRenderingContext', previousDescriptor);
      } else {
        Reflect.deleteProperty(window, 'WebGLRenderingContext');
      }
    }
  });

  it('consulta confirmações vigentes e preserva expiração como situação desconhecida', () => {
    const app = fixture.componentInstance as unknown as {
      activeRecords: () => { id: string; situation?: string; isOngoing?: boolean }[];
      historyRecords: () => { id: string; situation?: string }[];
      queryReferenceDate: { set: (date: Date) => void };
      allPoints: () => { id: string; coordinates?: Coordinates; expiresAt?: string }[];
      setInformesCoordinate: (axis: 'longitude' | 'latitude', value: string) => void;
    };
    const demo002 = app.allPoints().find((record) => record.id === 'demo-002');
    expect(demo002).toBeTruthy();
    if (demo002?.coordinates) {
      app.setInformesCoordinate('longitude', String(demo002.coordinates[0]));
      app.setInformesCoordinate('latitude', String(demo002.coordinates[1]));
    }

    const initialRecord = app.activeRecords().find((record) => record.id === 'demo-002');
    expect(initialRecord?.situation).toBe('ONGOING');
    expect(initialRecord?.isOngoing).toBe(true);

    const expiresAt = demo002?.expiresAt;
    expect(expiresAt).toBeTruthy();

    app.queryReferenceDate.set(new Date(Date.parse(expiresAt!) + 1000));

    const expiredRecord = app.activeRecords().find((record) => record.id === 'demo-002');
    expect(expiredRecord?.situation).toBe('UNKNOWN');
    expect(expiredRecord?.isOngoing).toBe(false);
    expect(app.historyRecords().find((record) => record.id === 'demo-002')?.situation).toBe(
      'UNKNOWN',
    );
  });

  it('limita o raio dos informes ao teto de 5 km e atualiza o centro por escolha manual', () => {
    const app = fixture.componentInstance as unknown as {
      informesRadiusMeters: () => number;
      informesCenter: () => { longitude: string; latitude: string };
      setInformesRadius: (value: number | string) => void;
      setInformesCoordinate: (axis: 'longitude' | 'latitude', value: string) => void;
      beginMapPick: (purpose: 'active') => void;
      acceptMapPick: (lng: number, lat: number) => void;
      activeView: () => string;
      mapPickPurpose: () => string | null;
      activeRecords: () => { id: string; distanceMeters?: number }[];
    };

    expect(app.informesRadiusMeters()).toBe(5000);
    // Tenta ultrapassar o limite de 5 km
    app.setInformesRadius(15000);
    expect(app.informesRadiusMeters()).toBe(5000);

    // Ajusta raio para 2 km
    app.setInformesRadius(2000);
    expect(app.informesRadiusMeters()).toBe(2000);

    // Escolha manual via mapa
    app.beginMapPick('active');
    expect(app.mapPickPurpose()).toBe('active');
    expect(app.activeView()).toBe('map');

    // Clica no mapa em Engenho de Dentro [-43.3, -22.891]
    app.acceptMapPick(-43.3, -22.891);
    expect(app.mapPickPurpose()).toBeNull();
    expect(app.activeView()).toBe('active');
    expect(app.informesCenter()).toEqual({ longitude: '-43.3', latitude: '-22.891' });
  });

  it('accepts a map-picked radius center without sending a request', () => {
    const app = fixture.componentInstance as unknown as {
      beginMapPick: (purpose: 'report' | 'radius') => void;
      acceptMapPick: (longitude: number, latitude: number) => void;
      useRadius: () => boolean;
      searchCenter: () => { longitude: string; latitude: string };
      mapPickPurpose: () => string | null;
    };
    app.beginMapPick('radius');
    app.acceptMapPick(-43.205, -22.91);

    expect(app.useRadius()).toBe(true);
    expect(app.searchCenter()).toEqual({ longitude: '-43.205', latitude: '-22.91' });
    expect(app.mapPickPurpose()).toBeNull();
  });

  it('changes the center on repeated left clicks only while radius filtering is enabled', () => {
    const app = fixture.componentInstance as unknown as {
      toggleRadius: (enabled: boolean) => void;
      handleMapClick: (longitude: number, latitude: number, button?: number) => void;
      searchCenter: () => { longitude: string; latitude: string };
    };
    const initial = app.searchCenter();
    app.handleMapClick(-43.3, -22.8);
    expect(app.searchCenter()).toEqual(initial);
    app.toggleRadius(true);
    app.handleMapClick(-43.3, -22.8, 2);
    expect(app.searchCenter()).toEqual(initial);
    app.handleMapClick(-43.3, -22.8);
    app.handleMapClick(-43.4, -22.7);
    expect(app.searchCenter()).toEqual({ longitude: '-43.4', latitude: '-22.7' });
    app.toggleRadius(false);
    app.handleMapClick(-43.2, -22.9);
    expect(app.searchCenter()).toEqual({ longitude: '-43.4', latitude: '-22.7' });
  });

  it('coalesces rapid filter changes and submits each GeoJSON source only once per frame', () => {
    const app = fixture.componentInstance as unknown as {
      map: unknown;
      refreshMapData: () => void;
      setRadiusMeters: (value: string) => void;
      mapRefreshFrame?: number;
    };
    const frames: FrameRequestCallback[] = [];
    const schedule = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    const sources = new Map(
      ['demo-points', 'demo-pois', 'search-radius-source'].map((id) => [id, { setData: vi.fn() }]),
    );
    maplibreWorkerMock.map.getSource.mockImplementation((id?: string) => sources.get(id!));
    app.map = maplibreWorkerMock.map;
    try {
      for (let index = 0; index < 100; index++) app.setRadiusMeters(String(100 + index * 100));
      for (const source of sources.values()) expect(source.setData).not.toHaveBeenCalled();
      // Angular also schedules a frame for signal-driven DOM rendering.
      for (const callback of frames.splice(0)) callback(0);
      for (const source of sources.values()) expect(source.setData).toHaveBeenCalledOnce();
      app.refreshMapData();
      for (const callback of frames.splice(0)) callback(16);
      for (const source of sources.values()) expect(source.setData).toHaveBeenCalledTimes(2);
    } finally {
      schedule.mockRestore();
      maplibreWorkerMock.map.getSource.mockReturnValue(undefined);
      app.map = undefined;
    }
  });

  it('saves and restores the full filter state only in this browser', () => {
    const app = fixture.componentInstance as unknown as {
      activeFilters: { (): string[]; set: (filters: string[]) => void };
      period: { set: (period: string) => void };
      customRangeStart: { set: (value: string) => void };
      customRangeEnd: { set: (value: string) => void };
      timeStart: { set: (value: string) => void };
      timeEnd: { set: (value: string) => void };
      useRadius: { set: (value: boolean) => void };
      radiusMeters: { set: (value: number) => void };
      searchCenter: { set: (value: { longitude: string; latitude: string }) => void };
      savedSearchName: { set: (value: string) => void };
      saveCurrentSearchFromInsights: () => void;
      savedSearches: () => { id: string; name: string }[];
      applySavedSearch: (search: Record<string, unknown>) => void;
      resolvedDateRange: () => { start: Date; end: Date } | null;
    };
    app.activeFilters.set(['category:SEGURANCA', 'type:FURTO']);
    app.period.set('custom');
    app.customRangeStart.set('2026-10-10T09:00');
    app.customRangeEnd.set('2026-10-10T12:00');
    app.timeStart.set('09:00');
    app.timeEnd.set('12:00');
    app.useRadius.set(true);
    app.radiusMeters.set(1200);
    app.searchCenter.set({ longitude: '-43.2', latitude: '-22.9' });
    app.savedSearchName.set('Manhã no Centro');
    app.saveCurrentSearchFromInsights();

    const saved = JSON.parse(localStorage.getItem('vu2.savedSearches') ?? '[]') as Record<
      string,
      unknown
    >[];
    expect(saved[0]).toMatchObject({
      name: 'Manhã no Centro',
      customRangeStart: '2026-10-10T09:00',
      customRangeEnd: '2026-10-10T12:00',
      timeStart: '09:00',
      timeEnd: '12:00',
      useRadius: true,
      radiusMeters: 1200,
      center: { longitude: '-43.2', latitude: '-22.9' },
    });
    app.activeFilters.set([]);
    app.applySavedSearch(saved[0]!);
    expect(app.activeFilters()).toEqual(['category:SEGURANCA', 'type:FURTO']);
    expect(app.resolvedDateRange()).not.toBeNull();
  });

  it('triages a manually added publication reference without fetching its page', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const app = fixture.componentInstance as unknown as {
      clipDraft: {
        set: (draft: { title: string; publisher: string; referenceUrl: string }) => void;
      };
      addClipReference: () => void;
      clips: () => {
        id: string;
        title: string;
        publisher: string;
        referenceUrl?: string;
        status: string;
      }[];
      clipTarget: { set: (targets: Record<string, string>) => void };
      linkClip: (id: string) => void;
      sourceImportStatus: () => string;
    };
    app.clipDraft.set({
      title: 'Boletim público de teste',
      publisher: 'Canal demonstrativo',
      referenceUrl: 'https://example.org/boletim',
    });
    app.addClipReference();
    const added = app.clips()[0]!;
    app.clipTarget.set({ [added.id]: 'demo-002' });
    app.linkClip(added.id);

    expect(app.clips()[0]).toMatchObject({
      status: 'LINKED',
      eventId: 'demo-002',
      referenceUrl: 'https://example.org/boletim',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(app.sourceImportStatus()).toContain('nenhum conteúdo foi baixado');
  });

  it('keeps source imports in memory and clears them without network or storage writes', () => {
    const app = fixture.componentInstance as unknown as {
      applyImportedDataset: (dataset: {
        records: {
          id: string;
          kind: 'occurrence';
          name: string;
          description: string;
          location: string;
          category: string;
          group: string;
          occurredAt: string;
          coordinates: [number, number];
          sourceId: string;
          operationalStatus: 'EXPIRED';
        }[];
        aggregates: never[];
        source: {
          id: string;
          name: string;
          url: string;
          license: string;
          referenceDate: string;
          limitations: string;
        };
      }) => void;
      historyRecords: () => { id: string; sourceId?: string }[];
      sourceImports: () => { records: number }[];
      isDemonstrationOnly: () => boolean;
      clearImportedSources: () => void;
    };
    app.applyImportedDataset({
      records: [
        {
          id: 'feed-001',
          kind: 'occurrence',
          name: 'Evento importado de teste',
          description: 'Sem dados pessoais.',
          location: 'Centro',
          category: 'TRANSITO',
          group: 'ALERTA',
          occurredAt: new Date().toISOString(),
          coordinates: [-43.2, -22.9],
          sourceId: 'fixture-feed',
          operationalStatus: 'EXPIRED',
        },
      ],
      aggregates: [],
      source: {
        id: 'fixture-feed',
        name: 'Fonte sintética',
        url: 'https://example.org/data',
        license: 'Teste',
        referenceDate: '2026-10',
        limitations: 'Apenas fixture.',
      },
    });

    expect(app.historyRecords().some((record) => record.id === 'fixture-feed:feed-001')).toBe(true);
    expect(app.sourceImports()).toHaveLength(1);
    expect(app.isDemonstrationOnly()).toBe(false);
    app.clearImportedSources();
    expect(app.sourceImports()).toEqual([]);
    expect(app.isDemonstrationOnly()).toBe(true);
  });

  it('imports a standardized aggregate CSV locally with provenance and no fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const app = fixture.componentInstance as unknown as {
      sourceMetadataForm: {
        set: (metadata: {
          id: string;
          name: string;
          url: string;
          license: string;
          referenceDate: string;
          limitations: string;
        }) => void;
      };
      importSourceFile: (file: File) => Promise<void>;
      importedAggregates: () => {
        territory: string;
        period: string;
        value: number;
        sourceId: string;
      }[];
      sourceImportStatus: () => string;
    };
    app.sourceMetadataForm.set({
      id: 'ignored-id',
      name: 'Série sintética de teste',
      url: 'https://example.org/series.csv',
      license: 'Autorização de teste',
      referenceDate: '2026-09',
      limitations: 'Dados fictícios.',
    });
    const file = {
      size: 100,
      text: async () =>
        'territorio,periodo,indicador,valor,unidade\nCentro,2026-09,Trânsito,4,registros',
    } as File;

    await app.importSourceFile(file);

    expect(app.importedAggregates()).toHaveLength(1);
    expect(app.importedAggregates()[0]).toMatchObject({
      territory: 'Centro',
      period: '2026-09',
      value: 4,
    });
    expect(app.sourceImportStatus()).toContain('1 estatística(s) agregada(s)');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports relative comparison only when both comparable series have a nonzero baseline', () => {
    const app = fixture.componentInstance as unknown as {
      comparisonMetrics: () => {
        comparable: boolean;
        a: number | null;
        relativeDifference?: number | null;
      };
      importedAggregates: {
        set: (
          values: {
            territory: string;
            period: string;
            indicator: string;
            value: number;
            unit: string;
            sourceId: string;
          }[],
        ) => void;
      };
      analyticsTerritoryA: { set: (value: string) => void };
      analyticsTerritoryB: { set: (value: string) => void };
      comparisonPeriodA: { set: (value: string) => void };
      comparisonPeriodB: { set: (value: string) => void };
      analyticsIndicator: { set: (value: string) => void };
    };
    app.importedAggregates.set([
      {
        territory: 'Território A',
        period: '2026-09',
        indicator: 'Casos',
        value: 8,
        unit: 'casos',
        sourceId: 'fixture',
      },
      {
        territory: 'Território B',
        period: '2026-10',
        indicator: 'Casos',
        value: 9,
        unit: 'casos',
        sourceId: 'fixture',
      },
    ]);
    app.analyticsTerritoryA.set('Território A');
    app.analyticsTerritoryB.set('Território B');
    app.comparisonPeriodA.set('2026-09');
    app.comparisonPeriodB.set('2026-10');
    app.analyticsIndicator.set('Casos');
    expect(app.comparisonMetrics()).toMatchObject({
      comparable: true,
      a: 8,
      relativeDifference: 12.5,
    });

    app.importedAggregates.set([
      {
        territory: 'Território A',
        period: '2026-09',
        indicator: 'Casos',
        value: 0,
        unit: 'casos',
        sourceId: 'fixture',
      },
      {
        territory: 'Território B',
        period: '2026-10',
        indicator: 'Casos',
        value: 4,
        unit: 'casos',
        sourceId: 'fixture',
      },
    ]);
    app.analyticsTerritoryA.set('Território A');
    app.analyticsTerritoryB.set('Território B');
    app.comparisonPeriodA.set('2026-09');
    app.comparisonPeriodB.set('2026-10');
    app.analyticsIndicator.set('Casos');

    expect(app.comparisonMetrics()).toMatchObject({
      comparable: true,
      a: 0,
      relativeDifference: null,
    });
  });

  it('keeps the period filter in the existing panel and places the custom radius inside the map', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.query-advanced')).toBeNull();
    expect(root.querySelector('.period-group legend')?.textContent).toContain('Filtro por período');
    expect(root.querySelector('.map-radius-panel')).not.toBeNull();
  });

  it('hides the radius controls while the map is waiting for a center pick', () => {
    const app = fixture.componentInstance as unknown as {
      beginMapPick: (purpose: 'radius') => void;
      cancelMapPick: () => void;
    };
    const root = fixture.nativeElement as HTMLElement;
    app.beginMapPick('radius');
    fixture.detectChanges();

    expect(root.querySelector('.map-pick-prompt')?.textContent).toContain(
      'definir o centro da busca',
    );
    expect(root.querySelector('.map-radius-panel')).toBeNull();

    app.cancelMapPick();
    fixture.detectChanges();
    expect(root.querySelector('.map-radius-panel')).not.toBeNull();
  });

  it('toggles each result detail beside its record instead of below the full list', () => {
    const root = fixture.nativeElement as HTMLElement;
    const row = root.querySelector('.result-list > li');
    const button = row?.querySelector<HTMLButtonElement>('.record-detail-button');
    expect(row).not.toBeNull();
    expect(button).not.toBeNull();

    button!.click();
    fixture.detectChanges();
    expect(row?.querySelector('.result-inline-detail')).not.toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.textContent).toContain('Fechar detalhes');
    expect(root.querySelector('.results-panel ~ .workspace-detail')).toBeNull();

    button!.click();
    fixture.detectChanges();
    expect(row?.querySelector('.result-inline-detail')).toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.textContent).toContain('Detalhes');
  });

  it('allows at most five result details to remain open at once', () => {
    const app = fixture.componentInstance as unknown as {
      activeFilters: { set: (filters: string[]) => void };
    };
    app.activeFilters.set([
      'category:TRANSITO',
      'category:SEGURANCA',
      'category:CONTINGENCIA',
      'poi:HOSPITAL_PUBLICO',
      'poi:ESTADIO',
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const rows = [...root.querySelectorAll<HTMLLIElement>('.result-list > li')];
    const buttons = rows.map((row) =>
      row.querySelector<HTMLButtonElement>('.record-detail-button'),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(6);

    for (const button of buttons.slice(0, 5)) {
      button!.click();
      fixture.detectChanges();
    }
    expect(root.querySelectorAll('.result-inline-detail')).toHaveLength(5);
    expect(buttons[5]?.disabled).toBe(true);
    expect(root.querySelector('.results-detail-limit')?.textContent?.toLowerCase()).toContain(
      'até 5 detalhes',
    );

    buttons[0]!.click();
    fixture.detectChanges();
    expect(buttons[5]?.disabled).toBe(false);
    buttons[5]!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.result-inline-detail')).toHaveLength(5);
  });

  it('closes details hidden by filters before another result is opened', () => {
    const allFilters = [
      'category:TRANSITO',
      'category:SEGURANCA',
      'category:CONTINGENCIA',
      'poi:HOSPITAL_PUBLICO',
      'poi:ESTADIO',
    ];
    const app = fixture.componentInstance as unknown as {
      activeFilters: { set: (filters: string[]) => void };
      refreshMapData: () => void;
    };
    app.activeFilters.set(allFilters);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.record-detail-button')];
    expect(buttons.length).toBeGreaterThanOrEqual(6);
    for (const button of buttons.slice(0, 5)) {
      button.click();
      fixture.detectChanges();
    }

    app.activeFilters.set(['poi:ESTADIO']);
    app.refreshMapData();
    fixture.detectChanges();
    const remaining = root.querySelector<HTMLButtonElement>('.record-detail-button')!;
    expect(remaining.disabled).toBe(false);
    remaining.click();
    fixture.detectChanges();

    app.activeFilters.set(allFilters);
    app.refreshMapData();
    fixture.detectChanges();
    expect(root.querySelectorAll('.result-inline-detail').length).toBeLessThanOrEqual(5);
  });

  it('starts the map radius at 1 km and adjusts it by mouse wheel within 100–25,000 m', () => {
    const app = fixture.componentInstance as unknown as {
      radiusMeters: () => number;
      useRadius: { set: (enabled: boolean) => void };
      adjustRadiusWithWheel: (event: {
        deltaY: number;
        preventDefault: () => void;
        stopPropagation: () => void;
      }) => void;
    };
    const wheel = (deltaY: number) => ({
      deltaY,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });

    expect(app.radiusMeters()).toBe(1000);
    app.useRadius.set(true);
    const zoomIn = wheel(-1);
    app.adjustRadiusWithWheel(zoomIn);
    expect(app.radiusMeters()).toBe(1100);
    expect(zoomIn.preventDefault).toHaveBeenCalledOnce();

    for (let index = 0; index < 260; index += 1) app.adjustRadiusWithWheel(wheel(-1));
    expect(app.radiusMeters()).toBe(25000);

    const zoomOut = wheel(1);
    app.adjustRadiusWithWheel(zoomOut);
    expect(app.radiusMeters()).toBe(24900);
  });

  it('uses Central do Brasil as the initial map, search-radius, and report coordinate', () => {
    const app = fixture.componentInstance as unknown as {
      searchCenter: () => { longitude: string; latitude: string };
      coordinates: () => { longitude: string; latitude: string };
    };
    const expected = {
      longitude: '-43.19156448029434',
      latitude: '-22.903318808380494',
    };

    expect(app.searchCenter()).toEqual(expected);
    expect(app.coordinates()).toEqual({ longitude: '', latitude: '' });
  });

  it('keeps the report map in loading state until MapLibre becomes idle', async () => {
    const webGL2 = stubWebGL2Context();
    const app = fixture.componentInstance as unknown as {
      activeView: { set: (view: 'report') => void };
      selectedCategory: { set: (category: 'TRANSITO') => void };
      initializeReportMap: () => Promise<void>;
      reportMapStatus: () => 'idle' | 'loading' | 'ready' | 'error';
    };

    try {
      app.activeView.set('report');
      app.selectedCategory.set('TRANSITO');
      fixture.detectChanges();
      await app.initializeReportMap();

      expect(app.reportMapStatus()).toBe('loading');
      maplibreWorkerMock.callbacks.get('load')?.();
      expect(app.reportMapStatus()).toBe('loading');
      maplibreWorkerMock.callbacks.get('idle')?.();
      expect(app.reportMapStatus()).toBe('ready');
    } finally {
      webGL2.restore();
    }
  });

  it('shows an inline location map and coordinate fields for each report category', async () => {
    const app = fixture.componentInstance as unknown as {
      openView: (view: 'report') => void;
      chooseCategory: (category: 'TRANSITO' | 'SEGURANCA' | 'CONTINGENCIA') => void;
    };
    app.openView('report');
    await Promise.resolve();

    for (const category of ['TRANSITO', 'SEGURANCA', 'CONTINGENCIA'] as const) {
      app.chooseCategory(category);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.report-map-canvas')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('input[name="longitude"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('input[name="latitude"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.coordinate-help')?.textContent).toContain(
        'clique no mapa ou digite',
      );
      expect(fixture.nativeElement.querySelector('.coordinate-help')?.textContent).not.toContain(
        'exemplo inicial',
      );
      expect(fixture.nativeElement.querySelector('.report-map-pick')).toBeNull();
    }
  });

  it('exports report labels and values in Brazilian Portuguese', () => {
    const app = fixture.componentInstance as unknown as {
      buildReportSheets: () => SpreadsheetSheet[];
    };
    const sheets = app.buildReportSheets();
    const [summary, records] = sheets;
    const sample = records?.rows.slice(1).find((row) => row.includes('Semáforos desligados'));

    expect(summary?.rows[1]?.[0]).toBe('Gerado em (horário de Brasília)');
    expect(summary?.rows[3]?.[0]).toBe('Início do período (horário de Brasília)');
    expect(summary?.rows[5]?.[1]).toBe(
      'Categoria: Trânsito · Categoria: Segurança · Categoria: Contingência',
    );
    expect(records?.rows[0]).toEqual([
      'ID do registro',
      'Título do registro',
      'Categoria',
      'Grupo',
      'Tipo de informação',
      'Gravidade informada',
      'Situação operacional',
      'Data e hora do fato (horário de Brasília)',
      'Data de inclusão (horário de Brasília)',
      'Local de referência',
      'Longitude (WGS84)',
      'Latitude (WGS84)',
      'Fonte de dados',
    ]);
    expect(sample?.slice(2, 7)).toEqual([
      'Trânsito',
      'Outros registros',
      'Semáforos desligados',
      'Baixa',
      'Encerrada',
    ]);
    expect(JSON.stringify(sheets)).not.toContain('TRANSITO');
  });

  it('does not claim the local demonstration export was registered on the server', async () => {
    const app = fixture.componentInstance as unknown as {
      exportXlsx: () => Promise<void>;
      reportExportStatus: () => string;
    };
    const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const originalAnchorClick = Object.getOwnPropertyDescriptor(
      HTMLAnchorElement.prototype,
      'click',
    );
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:local-report'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
      configurable: true,
      value: vi.fn(),
    });

    try {
      await app.exportXlsx();
      expect(app.reportExportStatus()).toContain('demonstração local');
      expect(app.reportExportStatus()).not.toContain('registrada no servidor');
    } finally {
      if (originalCreateObjectUrl) {
        Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }
      if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
      if (originalAnchorClick) {
        Object.defineProperty(HTMLAnchorElement.prototype, 'click', originalAnchorClick);
      } else {
        Reflect.deleteProperty(HTMLAnchorElement.prototype, 'click');
      }
    }
  });

  it('draws the selected search radius as a translucent light-purple polygon', async () => {
    const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'WebGLRenderingContext');
    const webGL2 = stubWebGL2Context();
    Object.defineProperty(window, 'WebGLRenderingContext', {
      configurable: true,
      value: class WebGLRenderingContext {},
    });

    try {
      const app = fixture.componentInstance as unknown as {
        initializeMap: () => Promise<void>;
        useRadius: { set: (enabled: boolean) => void };
        mapReady: () => boolean;
      };
      app.useRadius.set(true);
      await app.initializeMap();
      expect(app.mapReady()).toBe(false);
      maplibreWorkerMock.callbacks.get('load')?.();
      expect(app.mapReady()).toBe(false);
      maplibreWorkerMock.callbacks.get('idle')?.();
      expect(app.mapReady()).toBe(true);

      const radiusSourceCall = [...maplibreWorkerMock.map.addSource.mock.calls]
        .reverse()
        .find(([id]) => id === 'search-radius-source');
      const radiusSource = radiusSourceCall?.[1] as
        { data: { features: { geometry: { type: string } }[] } } | undefined;
      const layers = maplibreWorkerMock.map.addLayer.mock.calls.map(
        ([layer]) =>
          layer as {
            id: string;
            paint: Record<string, unknown>;
            layout?: Record<string, unknown>;
          },
      );
      const fill = layers.find((layer) => layer.id === 'search-radius-fill');
      const outline = layers.find((layer) => layer.id === 'search-radius-outline');
      const pointCodes = layers.find((layer) => layer.id === 'demo-points-code');

      expect(radiusSource?.data.features[0]?.geometry.type).toBe('Polygon');
      expect(fill?.paint).toMatchObject({ 'fill-color': '#C4B5FD', 'fill-opacity': 0.18 });
      expect(outline?.paint).toMatchObject({ 'line-color': '#C4B5FD', 'line-opacity': 0.82 });
      expect(pointCodes?.layout).toMatchObject({ 'text-font': ['Noto Sans Regular'] });
    } finally {
      webGL2.restore();
      if (previousDescriptor) {
        Object.defineProperty(window, 'WebGLRenderingContext', previousDescriptor);
      } else {
        Reflect.deleteProperty(window, 'WebGLRenderingContext');
      }
    }
  });

  it('alternates between simple and advanced modes, suspending and reconciling filters', () => {
    localStorage.clear();
    const app = fixture.componentInstance as unknown as {
      consultationMode: { (): string; set: (val: string) => void };
      modeNotice: { (): string };
      toggleConsultationMode: () => void;
      toggleFilter: (filter: string) => void;
      selectQueryMunicipality: (municipality: string) => void;
      selectedMunicipality: { (): string };
      activeFilters: { (): string[] };
    };

    expect(app.consultationMode()).toBe('simple');

    // Switch to advanced mode
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('advanced');
    expect(localStorage.getItem('vetor-consultation-mode')).toBe('advanced');

    // Select type and subtype in advanced mode
    app.toggleFilter('type:FURTO');
    app.toggleFilter('subtype:FURTO:De veículo');
    expect(app.activeFilters()).toContain('subtype:FURTO:De veículo');

    // Switch back to simple mode: advanced filters suspended
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('simple');
    expect(app.activeFilters()).not.toContain('subtype:FURTO:De veículo');
    expect(app.modeNotice()).toBe('Filtros avançados suspensos no Modo simples.');

    // In simple mode, change type to ROUBO and change municipality to Niterói
    app.toggleFilter('type:FURTO');
    app.toggleFilter('type:ROUBO');
    app.selectQueryMunicipality('Niterói');
    expect(app.selectedMunicipality()).toBe('Niterói');

    // Switch to advanced mode: incompatible subtype removed, new municipality preserved
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('advanced');
    expect(app.selectedMunicipality()).toBe('Niterói');
    expect(app.activeFilters()).not.toContain('subtype:FURTO:De veículo');
    expect(app.modeNotice()).toBe('Subtipo incompatível com o tipo selecionado foi removido.');

    // Now select compatible subtype for ROUBO
    app.toggleFilter('subtype:ROUBO:A pedestre');
    expect(app.activeFilters()).toContain('subtype:ROUBO:A pedestre');

    // Switch to simple mode
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('simple');
    expect(app.modeNotice()).toBe('Filtros avançados suspensos no Modo simples.');

    // Switch back to advanced with compatible type retained
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('advanced');
    expect(app.activeFilters()).toContain('subtype:ROUBO:A pedestre');
    expect(app.modeNotice()).toBe('Filtros avançados reaplicados.');
  });

  it('ticket 06: modo avançado inclui busca por texto, fontes, faixa de nota fictícia e situação, com validação de nota', () => {
    localStorage.clear();
    const app = fixture.componentInstance as unknown as {
      consultationMode: { (): string };
      toggleConsultationMode: () => void;
      setAdvancedTextFilter: (query: string) => void;
      advancedTextFilter: { (): string };
      setMinScore: (val: string) => void;
      setMaxScore: (val: string) => void;
      minScore: { (): number | null };
      maxScore: { (): number | null };
      scoreRangeInvalid: { (): boolean };
      toggleFilter: (filter: string) => void;
      activeFilters: { (): string[] };
      visiblePoints: {
        (): Array<{ id: string; name: string; reliabilityScore?: number; situation?: string }>;
      };
    };

    // No modo simples, grupos avançados não aparecem no template
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="advanced-text-group"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="advanced-source-group"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="advanced-score-group"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="advanced-situation-group"]'),
    ).toBeNull();

    // Alterna para modo avançado
    app.toggleConsultationMode();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="advanced-text-group"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="advanced-source-group"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="advanced-score-group"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="advanced-situation-group"]'),
    ).not.toBeNull();

    // Filtro textual
    app.setAdvancedTextFilter('Semáforo');
    expect(app.advancedTextFilter()).toBe('Semáforo');
    const textPoints = app.visiblePoints();
    expect(textPoints.every((p) => p.name.toLowerCase().includes('semáforo') || false)).toBe(true);

    // Limpa filtro textual
    app.setAdvancedTextFilter('');
    expect(app.advancedTextFilter()).toBe('');

    // Faixa de nota válida
    app.setMinScore('3');
    app.setMaxScore('5');
    expect(app.scoreRangeInvalid()).toBe(false);
    const scorePoints = app.visiblePoints();
    expect(scorePoints.length).toBeGreaterThan(0);
    expect(
      scorePoints.every((p) => (p.reliabilityScore ?? 0) >= 3 && (p.reliabilityScore ?? 0) <= 5),
    ).toBe(true);

    // Faixa de nota inválida (min > max)
    app.setMinScore('5');
    app.setMaxScore('2');
    expect(app.scoreRangeInvalid()).toBe(true);
    expect(app.visiblePoints().length).toBe(0);
    fixture.detectChanges();
    const errorEl = fixture.nativeElement.querySelector(
      '[data-testid="advanced-score-group"] .query-error',
    );
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('A nota mínima não pode ser superior à nota máxima.');

    // Restaura faixa
    app.setMinScore('');
    app.setMaxScore('');
    expect(app.scoreRangeInvalid()).toBe(false);

    // Situação
    app.toggleFilter('situation:ONGOING');
    expect(app.activeFilters()).toContain('situation:ONGOING');
    const ongoingPoints = app.visiblePoints();
    expect(ongoingPoints.every((p) => p.situation === 'ONGOING')).toBe(true);
    app.toggleFilter('situation:ONGOING');
  });

  it('ticket 06: preserva escolhas explícitas de filtros comuns na jornada personalizado -> simples -> semana -> 24h -> avançado', () => {
    localStorage.clear();
    const app = fixture.componentInstance as unknown as {
      consultationMode: { (): string };
      toggleConsultationMode: () => void;
      period: { (): string; set: (p: string) => void };
      selectPeriod: (p: string) => void;
      setCustomRange: (part: 'start' | 'end', val: string) => void;
      customRangeStart: { (): string };
      customRangeEnd: { (): string };
      modeNotice: { (): string };
    };

    // 1. Inicia em avançado e define período personalizado
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('advanced');
    app.selectPeriod('custom');
    app.setCustomRange('start', '2026-07-01T00:00');
    app.setCustomRange('end', '2026-07-31T23:59');
    expect(app.period()).toBe('custom');

    // 2. Alterna para simples: período personalizado é suspenso, recai para 24h
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('simple');
    expect(app.period()).toBe('24h');
    expect(app.modeNotice()).toBe('Filtros avançados suspensos no Modo simples.');

    // 3. No simples, seleciona 7 dias (semana)
    app.selectPeriod('1w');
    expect(app.period()).toBe('1w');

    // 4. No simples, seleciona 24 horas explicitamente
    app.selectPeriod('24h');
    expect(app.period()).toBe('24h');

    // 5. Retorna para avançado: escolha explícita de 24h é PRESERVADA, NÃO restaura personalizado
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('advanced');
    expect(app.period()).toBe('24h');
  });

  it('ticket 06: restaura período personalizado quando o período NÃO foi alterado no modo simples', () => {
    localStorage.clear();
    const app = fixture.componentInstance as unknown as {
      consultationMode: { (): string };
      toggleConsultationMode: () => void;
      period: { (): string };
      selectPeriod: (p: string) => void;
      setCustomRange: (part: 'start' | 'end', val: string) => void;
      customRangeStart: { (): string };
      customRangeEnd: { (): string };
      modeNotice: { (): string };
    };

    // 1. Inicia em avançado e define período personalizado
    app.toggleConsultationMode();
    app.selectPeriod('custom');
    app.setCustomRange('start', '2026-06-01T00:00');
    app.setCustomRange('end', '2026-06-30T23:59');
    expect(app.period()).toBe('custom');

    // 2. Alterna para simples: personalizado é suspenso
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('simple');
    expect(app.period()).toBe('24h');

    // 3. Retorna para avançado sem ter tocado no período em simples: restaura custom
    app.toggleConsultationMode();
    expect(app.consultationMode()).toBe('advanced');
    expect(app.period()).toBe('custom');
    expect(app.customRangeStart()).toBe('2026-06-01T00:00');
    expect(app.customRangeEnd()).toBe('2026-06-30T23:59');
  });

  it('ticket 10: exibe aviso de atualizacao disponivel na sessao aberta e atualiza mantendo filtros', () => {
    const app = fixture.componentInstance as unknown as {
      pendingUpdateAvailable: () => boolean;
      simulatePendingUpdate: () => void;
      dismissPendingUpdate: () => void;
      refreshLocalQuery: () => void;
      activeFilters: () => string[];
      toggleFilter: (id: string) => void;
      period: () => string;
      queryReferenceDate: () => Date;
    };

    app.toggleFilter('category:SEGURANCA');
    const initialFilters = [...app.activeFilters()];
    expect(app.pendingUpdateAvailable()).toBe(false);

    app.simulatePendingUpdate();
    expect(app.pendingUpdateAvailable()).toBe(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="query-update-notice"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain(
      'Existem novas publicações disponíveis para esta consulta',
    );

    vi.setSystemTime(new Date('2026-10-15T15:30:00Z'));
    app.refreshLocalQuery();
    fixture.detectChanges();

    expect(app.pendingUpdateAvailable()).toBe(false);
    expect(app.activeFilters()).toEqual(initialFilters);
    expect(app.queryReferenceDate().toISOString()).toBe('2026-10-15T15:30:00.000Z');
  });

  it('ticket 10: lida com consulta vazia oferecendo ampliacao de periodo, territorio e limpeza de filtros', () => {
    const app = fixture.componentInstance as unknown as {
      visiblePoints: () => unknown[];
      period: () => string;
      expandQueryPeriod: () => void;
      expandQueryTerritory: () => void;
      clearQueryFilters: () => void;
      activeFilters: () => string[];
      useRadius: () => boolean;
      radiusMeters: () => number;
      setRadiusMeters: (val: string) => void;
      selectQueryMunicipality: (m: string) => void;
      selectedMunicipality: () => string | null;
      setTimeRange: (axis: 'start' | 'end', val: string) => void;
    };

    app.setTimeRange('start', '03:00');
    app.setTimeRange('end', '03:01');
    fixture.detectChanges();

    const emptyElement = fixture.nativeElement.querySelector('[data-testid="consultation-empty"]');
    expect(emptyElement).not.toBeNull();
    expect(emptyElement.textContent).toContain(
      'Não encontramos ocorrências publicadas para estes filtros',
    );

    expect(app.period()).toBe('24h');
    app.expandQueryPeriod();
    expect(app.period()).toBe('1w');

    app.selectQueryMunicipality('Niterói');
    expect(app.selectedMunicipality()).toBe('Niterói');
    app.expandQueryTerritory();
    expect(app.selectedMunicipality()).toBe('');

    app.clearQueryFilters();
    expect(app.period()).toBe('24h');
  });

  it('ticket 10: erro na consulta nao exibe zero valido nem afirmacao de seguranca e permite tentar novamente', () => {
    const app = fixture.componentInstance as unknown as {
      queryError: () => boolean;
      queryErrorMessage: () => string;
      simulateQueryError: (msg?: string) => void;
      retryQuery: () => void;
      eventCount: () => number;
    };

    expect(app.queryError()).toBe(false);
    app.simulateQueryError('Falha no serviço de dados simulados.');
    fixture.detectChanges();

    expect(app.queryError()).toBe(true);

    const errorState = fixture.nativeElement.querySelector('[data-testid="query-error-state"]');
    expect(errorState).not.toBeNull();
    expect(errorState.textContent).toContain('Consulta indisponível');

    const errorBanner = fixture.nativeElement.querySelector('[data-testid="query-error-banner"]');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner.textContent).toContain(
      'Esta falha não indica ausência de ocorrências nem comprovação de segurança',
    );

    app.retryQuery();
    fixture.detectChanges();
    expect(app.queryError()).toBe(false);
  });

  it('ticket 07: toGeoJson calcula contagem coincidente sem incluir POIs e preserva coordenadas', () => {
    const app = fixture.componentInstance as unknown as {
      toGeoJson: (kind?: string) => {
        type: string;
        features: Array<{
          id: string;
          geometry: { type: string; coordinates: Coordinates };
          properties: Record<string, unknown>;
        }>;
      };
      allPoints: () => DemoRecord[];
    };

    const occurrenceGeoJson = app.toGeoJson('occurrence');
    const poiGeoJson = app.toGeoJson('poi');

    // POIs não entram no GeoJSON de ocorrências
    expect(occurrenceGeoJson.features.some((f) => f.properties['kind'] === 'poi')).toBe(false);
    expect(poiGeoJson.features.every((f) => f.properties['kind'] === 'poi')).toBe(true);

    // Par coincidente em Glória (demo-002 e demo-contingencia-004)
    const demo002 = occurrenceGeoJson.features.find((f) => f.id === 'demo-002');
    const demoContingencia = occurrenceGeoJson.features.find(
      (f) => f.id === 'demo-contingencia-004',
    );
    expect(demo002).toBeDefined();
    expect(demoContingencia).toBeDefined();
    expect(demo002?.geometry.coordinates).toEqual(demoContingencia?.geometry.coordinates);
    expect(demo002?.properties['coincidentCount']).toBe(2);
    expect(demoContingencia?.properties['coincidentCount']).toBe(2);

    // Registros não coincidentes têm coincidentCount 1
    const nonCoincident = occurrenceGeoJson.features.find(
      (f) => f.id !== 'demo-002' && f.id !== 'demo-contingencia-004',
    );
    expect(nonCoincident?.properties['coincidentCount']).toBe(1);
  });

  it('ticket 07: createCoincidentPointsPopup gera painel acessível de seleção individual e foca detalhe sem alterar modelo', () => {
    const app = fixture.componentInstance as unknown as {
      allPoints: () => Array<DemoRecord & { coordinates?: Coordinates }>;
      visiblePoints: () => Array<DemoRecord & { coordinates?: Coordinates }>;
      createCoincidentPointsPopup: (points: unknown[]) => HTMLElement;
      selectAndFocusRecordDetail: (pointId: string) => void;
      isResultDetailOpen: (pointId: string) => boolean;
      selectedPointId: () => string | null;
    };

    const coincidents = app
      .allPoints()
      .filter((p) => p.id === 'demo-002' || p.id === 'demo-contingencia-004');
    expect(coincidents).toHaveLength(2);

    const coordsBefore = coincidents.map((p) => (p.coordinates ? [...p.coordinates] : null));
    expect(coordsBefore[0]).toEqual(coordsBefore[1]);

    const popup = app.createCoincidentPointsPopup(coincidents);
    expect(popup.getAttribute('data-testid')).toBe('coincident-pins-expansion');
    expect(popup.querySelector('.coincident-title')?.textContent).toContain(
      'Ocorrências sobrepostas (2)',
    );

    const btnDemo002 = popup.querySelector<HTMLButtonElement>(
      '[data-coincident-select="demo-002"]',
    );
    const btnContingencia = popup.querySelector<HTMLButtonElement>(
      '[data-coincident-select="demo-contingencia-004"]',
    );
    expect(btnDemo002).not.toBeNull();
    expect(btnContingencia).not.toBeNull();

    // Dispara seleção de demo-contingencia-004
    btnContingencia?.click();
    expect(app.selectedPointId()).toBe('demo-contingencia-004');
    expect(app.isResultDetailOpen('demo-contingencia-004')).toBe(true);

    // Dispara seleção de demo-002
    btnDemo002?.click();
    expect(app.selectedPointId()).toBe('demo-002');
    expect(app.isResultDetailOpen('demo-002')).toBe(true);

    // Coordenadas reais permanecem absolutamente inalteradas no modelo
    const coordsAfter = coincidents.map((p) => (p.coordinates ? [...p.coordinates] : null));
    expect(coordsAfter).toEqual(coordsBefore);
    expect(coordsAfter[0]).toEqual(coordsBefore[0]);
    expect(coordsAfter[1]).toEqual(coordsBefore[1]);
  });

  it('ticket 07: inicialização MapLibre registra camadas de cluster e sobreposição com badge de coincidentes', async () => {
    const webGL2 = stubWebGL2Context(true);
    const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'WebGLRenderingContext');
    Object.defineProperty(window, 'WebGLRenderingContext', {
      configurable: true,
      value: class WebGLRenderingContext {},
    });

    try {
      const app = fixture.componentInstance as unknown as {
        initializeMap: () => Promise<void>;
        mapReady: () => boolean;
      };
      await app.initializeMap();
      maplibreWorkerMock.callbacks.get('load')?.();
      maplibreWorkerMock.callbacks.get('idle')?.();

      const demoPointsSource = maplibreWorkerMock.map.addSource.mock.calls.find(
        ([id]) => id === 'demo-points',
      );
      expect(demoPointsSource?.[1]).toMatchObject({
        cluster: true,
        clusterMaxZoom: 11,
      });

      const demoPoisSource = maplibreWorkerMock.map.addSource.mock.calls.find(
        ([id]) => id === 'demo-pois',
      );
      expect(demoPoisSource?.[1]).toMatchObject({
        cluster: false,
      });

      const layers = maplibreWorkerMock.map.addLayer.mock.calls.map(
        ([layer]) => layer as { id: string; filter?: unknown[]; type: string },
      );

      const clusterCircle = layers.find((l) => l.id === 'demo-occurrence-clusters');
      const clusterCount = layers.find((l) => l.id === 'demo-occurrence-cluster-count');
      const pinsLayer = layers.find((l) => l.id === 'demo-occurrence-pins');
      const coincidentBadge = layers.find((l) => l.id === 'demo-occurrence-coincident-badge');
      const coincidentCount = layers.find((l) => l.id === 'demo-occurrence-coincident-count');

      expect(clusterCircle).toBeDefined();
      expect(clusterCount).toBeDefined();
      expect(pinsLayer).toBeDefined();
      expect(coincidentBadge).toBeDefined();
      expect(coincidentCount).toBeDefined();

      expect(coincidentBadge?.filter).toEqual([
        'all',
        ['==', ['get', 'kind'], 'occurrence'],
        ['!', ['has', 'point_count']],
        ['>', ['get', 'coincidentCount'], 1],
      ]);
    } finally {
      webGL2.restore();
      if (previousDescriptor) {
        Object.defineProperty(window, 'WebGLRenderingContext', previousDescriptor);
      } else {
        Reflect.deleteProperty(window, 'WebGLRenderingContext');
      }
    }
  });

  it('preserva o recorte de relatório gerado enquanto os filtros do mapa mudam', async () => {
    const navButton = (label: string): HTMLButtonElement => {
      const button = [...fixture.nativeElement.querySelectorAll('nav button')].find(
        (candidate) => candidate.textContent?.trim() === label,
      );
      if (!button) throw new Error(`Navegação ausente: ${label}`);
      return button;
    };

    navButton('Relatórios').click();
    await Promise.resolve();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-testid="report-generate-from-map"]')?.click();
    await Promise.resolve();
    fixture.detectChanges();

    const counts = fixture.nativeElement.querySelector(
      '[data-testid="report-snapshot-counts"]',
    ) as HTMLElement | null;
    expect(counts).not.toBeNull();
    const generatedCounts = counts?.textContent;

    navButton('Mapa público').click();
    await Promise.resolve();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-quick-category="CONTINGENCIA"]')?.click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[data-quick-category="SEGURANCA"]')?.click();
    fixture.detectChanges();
    navButton('Relatórios').click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="report-snapshot-counts"]')?.textContent,
    ).toBe(generatedCounts);
  });
});
