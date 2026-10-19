import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../auth/session';
import { ReviewQueue, collectionOrigin } from './review-queue';

const CSRF = 'csrf-secret-token-123';

const synthetic = (id: string) => ({
  clipping_id: id,
  clipping_title: `Clipping ${id}`,
  original_text: `Original sintético ${id}`,
  reference: `fixture:${id}`,
  extracted: {
    title: `Efeito ${id}`,
    description: 'Interrupção sintética sustentada no original',
    category: 'CONTINGENCIA',
    type: 'ENERGIA',
    subtype: 'NAO_INFORMADO',
    situation: 'UNKNOWN',
    reliability: 3,
    municipality: 'Rio de Janeiro',
    neighborhood: 'Centro',
    locationPrecision: 'TERRITORY',
    occurredAt: '2026-10-15T12:00:00Z',
  },
  priority: 'NORMAL',
  waiting_seconds: 120,
  revision: 1,
  essential_conflict: false,
  reason: '',
});

const collected = (id: string) => ({
  ...synthetic(id),
  reference: 'vu-demo-source-001:FC-2',
  extracted: {
    category: 'SEGURANCA',
    type: 'DISPAROS',
    subtype: null,
    municipality: 'Rio de Janeiro',
    neighborhood: 'Complexo do Alemão',
    locality: 'Rua sintética',
    sourceState: 'RJ',
    coordinates: [-43.27, -22.86],
    locationPrecision: 'POINT',
    occurredAt: '2026-10-19T09:00:00Z',
    documentNumber: 'FC-2',
    massacre: false,
    victims: { total: 1 },
    sourceId: 'vu-demo-source-001',
    sourceReference: 'FC-2',
    sourceCredit: 'Instituto Fogo Cruzado',
    sourceDocumentationUrl: 'https://api.fogocruzado.org.br/docs',
    title: 'Disparos notificados em FC-2',
    description: 'Resumo factual da fonte, sem atributo por vítima.',
  },
  priority: 'HIGH',
});

describe('procedência da coleta na fila de revisão', () => {
  let fixture: ComponentFixture<ReviewQueue>;
  let posts: Array<Record<string, unknown>>;

  beforeEach(async () => {
    posts = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.method === 'POST') {
          posts.push(JSON.parse(String(options.body)) as Record<string, unknown>);
          return Response.json({ clipping_id: 'coletado', revision: 2 });
        }
        if (url.includes('/options'))
          return Response.json({
            occurrences: [],
            happenings: [{ id: 'vu-demo-happening-001', title: 'Contexto sintético' }],
          });
        return Response.json({ items: [collected('coletado'), synthetic('sintetico')] });
      }),
    );
    await TestBed.configureTestingModule({
      imports: [ReviewQueue],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const session = TestBed.inject(Session);
    session.state.set({
      code: 'AUTHENTICATED',
      message: 'Sessão sintética',
      role: 'ADMIN',
      authenticated: true,
      csrfToken: CSRF,
    });
    vi.spyOn(session, 'csrfToken').mockReturnValue(CSRF);
    fixture = TestBed.createComponent(ReviewQueue);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    [...root().querySelectorAll<HTMLButtonElement>('button')].find((entry) =>
      entry.textContent?.startsWith(name),
    );
  const until = async (assertion: () => void): Promise<void> => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      assertion();
    });
  };
  const fill = (label: string, value: string): void => {
    const field = [
      ...root().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'),
    ].find((entry) => entry.closest('label')?.textContent?.includes(label));
    field!.value = value;
    field!.dispatchEvent(new Event('input'));
  };

  it('identifica o crédito e a referência da fonte sem inventar dados para clippings sintéticos', () => {
    expect(collectionOrigin(synthetic('sintetico'))).toBeNull();
    expect(collectionOrigin(collected('coletado'))).toEqual({
      credit: 'Instituto Fogo Cruzado',
      reference: 'FC-2',
    });
    expect(collectionOrigin({ extracted: { sourceCredit: 'Instituto Fogo Cruzado' } })).toEqual({
      credit: 'Instituto Fogo Cruzado',
      reference: null,
    });
    expect(collectionOrigin({ extracted: { sourceReference: 'FC-9' } })).toEqual({
      credit: null,
      reference: 'FC-9',
    });
    expect(collectionOrigin({})).toBeNull();
  });

  it('exibe «Fonte: Instituto Fogo Cruzado» e a referência apenas no item vindo da coleta', async () => {
    await until(() =>
      expect(root().querySelectorAll('[data-testid="review-item"]')).toHaveLength(2),
    );
    const origins = [...root().querySelectorAll<HTMLElement>('[data-testid="review-origin"]')];
    expect(origins).toHaveLength(1);
    expect(origins[0]!.textContent).toContain('Fonte: Instituto Fogo Cruzado');
    expect(origins[0]!.textContent).toContain('referência da fonte: FC-2');
    const items = [...root().querySelectorAll<HTMLElement>('[data-testid="review-item"]')];
    expect(
      items
        .find((item) => item.textContent?.includes('sintetico'))
        ?.querySelector('[data-testid="review-origin"]'),
    ).toBeNull();
    // O fluxo de decisão humana do ticket 17 continua disponível para os dois itens.
    expect(button('Revisar coletado')).toBeTruthy();
    expect(button('Revisar sintetico')).toBeTruthy();
    expect(root().textContent).not.toContain(CSRF);
  });

  it('mostra o crédito no editor e envia só o núcleo factual sustentado na criação', async () => {
    await until(() =>
      expect(root().querySelectorAll('[data-testid="review-item"]')).toHaveLength(2),
    );
    button('Revisar coletado')!.click();
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="review-origin-editor"]')?.textContent).toContain(
      'Fonte: Instituto Fogo Cruzado',
    );
    fill('Justificativa da decisão', 'Original da fonte conferido pelo revisor');
    fill('Título factual', 'Disparos sustentados em FC-2');
    const happening = [...root().querySelectorAll<HTMLSelectElement>('select')].find((entry) =>
      entry.closest('label')?.textContent?.includes('Acontecimento existente'),
    )!;
    happening.value = 'vu-demo-happening-001';
    happening.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const publish = [...root().querySelectorAll<HTMLButtonElement>('button')].find((entry) =>
      entry.textContent?.includes('Publicar novo efeito'),
    )!;
    expect(publish.disabled).toBe(false);
    publish.click();
    fixture.detectChanges();
    await until(() => expect(posts.length).toBe(1));
    const draft = posts[0]!['draft'] as Record<string, unknown>;
    expect(Object.keys(draft).sort()).toEqual(
      [
        'category',
        'description',
        'latitude',
        'locationPrecision',
        'longitude',
        'municipality',
        'neighborhood',
        'occurredAt',
        'reliability',
        'situation',
        'subtype',
        'title',
        'type',
      ].sort(),
    );
    expect(draft).not.toHaveProperty('sourceCredit');
    expect(draft).not.toHaveProperty('victims');
    expect(draft).not.toHaveProperty('documentNumber');
    expect(draft['subtype']).toBe('NAO_INFORMADO');
    expect(draft['longitude']).toBe(-43.27);
    expect(draft['latitude']).toBe(-22.86);
    expect(root().textContent).not.toContain(CSRF);
  });
});
