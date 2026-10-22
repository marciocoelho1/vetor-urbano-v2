import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../auth/session';
import { ReliabilityPanel } from './reliability-panel';

const EVALUATION = {
  occurrenceId: 'occ-1',
  evaluationVersion: 1,
  ruleVersion: 1,
  note: 4,
  state: 'RECORDED',
  evaluatedAt: '2026-10-22T12:00:00Z',
  blocking: [] as string[],
  factors: {
    quality: { status: 'INFORMED', value: 4, neutralBaseUsed: false },
    corroboration: { status: 'INFORMED', count: 1, capped: 1, bonus: 0 },
    divergence: { status: 'NOT_INFORMED', penalty: 0, effect: 'BLOCKING', reason: 'interno' },
    completeness: {
      status: 'INFORMED',
      blocking: [],
      fieldStatus: { description: 'INFORMED', neighborhood: 'NOT_APPLICABLE' },
    },
    rounding: 'HALF_UP',
    formula: 'clamp(noteRange, HALF_UP(base + bonus))',
  },
  context: {
    ruleVersion: 1,
    occurrenceRevision: 2,
    sources: [
      {
        clippingId: 'clip-1',
        sourceId: 'src-1',
        sourceName: 'Fonte sintética',
        rating: 4,
        traceableReference: true,
        referenceSource: true,
      },
    ],
    reproductions: [{ clippingId: 'clip-2', sourceId: 'src-2', reproductionOf: 'clip-1' }],
    publicExposure: 'Somente a nota é pública.',
  },
};

const RECOMMENDATION = {
  sourceId: 'src-1',
  currentRating: 4,
  windowDays: 90,
  windowStart: '2026-07-24T00:00:00Z',
  windowEnd: '2026-10-22T00:00:00Z',
  sample: {
    applicable: 10,
    confirmed: 5,
    disproven: 4,
    inconclusive: 1,
    correctedBySource: 0,
    systemErrors: 1,
    minimum: 10,
  },
  recommendation: 'DOWNGRADE',
  justification: '4 de 10 afirmações demonstradas incorretas (40%).',
  canChange: true,
  limitations: 'Erro do sistema fica fora da amostra e não rebaixa a fonte.',
};

const RULES = {
  currentVersion: 1,
  items: [
    {
      version: 1,
      summary: 'Regra v1',
      provenance: 'SEEDED_APPROVED',
      createdAt: '2026-10-22T00:00:00Z',
    },
  ],
};
const OPTIONS = {
  occurrences: [{ id: 'occ-1', title: 'Ocorrência sintética', happening_id: 'h-1', revision: 2 }],
  happenings: [{ id: 'h-1', title: 'Acontecimento sintético' }],
};
const SOURCES = [
  {
    id: 'src-1',
    name: 'Fonte sintética',
    channel: 'Canal sintético',
    url: 'https://example.test',
    territories: ['Rio de Janeiro'],
    pillars: ['TRANSITO'],
    accessMethod: 'MANUAL',
    rating: 4,
    version: 1,
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ReliabilityPanel', () => {
  let fixture: ComponentFixture<ReliabilityPanel>;
  let calls: Array<{ url: string; method: string; body?: string }>;

  beforeEach(async () => {
    calls = [];
    await TestBed.configureTestingModule({
      imports: [ReliabilityPanel],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: Session,
          useValue: { state: () => ({ csrfToken: 'csrf-teste', role: 'ADMIN' }) },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function create(router: (url: string) => Response | Promise<Response>): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
        return router(url);
      }),
    );
    fixture = TestBed.createComponent(ReliabilityPanel);
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const query = (testId: string) => root().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const button = (testId: string) =>
    root().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  const until = async (assertion: () => void): Promise<void> => {
    await vi.waitFor(() => {
      fixture.detectChanges();
      assertion();
    });
  };

  const baseRouter =
    (extra: Record<string, () => Response> = {}) =>
    (url: string) => {
      for (const [fragment, handler] of Object.entries(extra)) {
        if (url.includes(fragment)) return handler();
      }
      if (url.includes('/reliability/rules')) return json(RULES);
      if (url.includes('/review-clippings/options')) return json(OPTIONS);
      if (url.includes('/admin/sources')) return json({ items: SOURCES });
      if (url.includes('/evaluations/latest')) return json(EVALUATION);
      if (url.includes('/source-ratings/') && url.includes('/recommendation'))
        return json(RECOMMENDATION);
      if (url.includes('/source-ratings/') && url.includes('/flags')) return json({ items: [] });
      return json({}, 404);
    };

  it('mostra a nota registrada com fatores internos e publica a nota 1–5', async () => {
    create(
      baseRouter({
        '/publication': () =>
          json({ note: 4, message: 'Nota 1–5 publicada; fatores permanecem restritos.' }),
      }),
    );
    await until(() => expect(query('reliability-note')).not.toBeNull());
    expect(query('reliability-note')?.textContent?.trim()).toBe('4');
    expect(query('reliability-state')?.textContent).toContain('nota não publicada');
    expect(query('reliability-factors')?.textContent).toContain('Corroboração: 1');
    expect(query('reliability-field-status')?.textContent).toContain(
      'neighborhood: NOT_APPLICABLE',
    );
    expect(query('reliability-reproductions')?.textContent).toContain('1 reprodução(ões)');
    expect(button('reliability-publish')?.disabled).toBe(false);

    button('reliability-publish')?.click();
    await until(() => expect(query('reliability-published')).not.toBeNull());
    expect(query('reliability-notice')?.textContent).toContain('Nota 4 publicada');
    const post = calls.find((call) => call.url.includes('/publication'));
    expect(post?.method).toBe('POST');
  });

  it('bloqueia a publicação com essencial ausente e explica o motivo', async () => {
    create(
      baseRouter({
        '/evaluations/latest': () =>
          json({
            ...EVALUATION,
            note: 5,
            blocking: ['ESSENTIAL_NOT_INFORMED:description'],
          }),
      }),
    );
    await until(() => expect(query('reliability-blocking')).not.toBeNull());
    expect(query('reliability-blocking')?.textContent).toContain(
      'Campo essencial não informado: description',
    );
    expect(button('reliability-publish')?.disabled).toBe(true);
  });

  it('falha de leitura aparece como erro com repetição, nunca como vazio', async () => {
    create(
      baseRouter({
        '/evaluations/latest': () =>
          json({ code: 'QUERY_UNAVAILABLE', message: 'Consulta indisponível.' }, 503),
      }),
    );
    await until(() => expect(query('reliability-evaluation-error')).not.toBeNull());
    expect(query('reliability-evaluation-error')?.textContent).toContain('Consulta indisponível');
    expect(query('reliability-evaluation-empty')).toBeNull();
    expect(query('reliability-evaluation-retry')).not.toBeNull();
  });

  it('ocorrência sem avaliação mostra vazio explícito e permite avaliar', async () => {
    create(
      baseRouter({
        '/evaluations/latest': () => json({ code: 'NOT_FOUND', message: 'não avaliada' }, 404),
        '/evaluations': () => json({ ...EVALUATION, evaluationVersion: 1 }),
      }),
    );
    await until(() => expect(query('reliability-evaluation-empty')).not.toBeNull());
    button('reliability-evaluate')?.click();
    await until(() => expect(query('reliability-note')).not.toBeNull());
    expect(query('reliability-notice')?.textContent).toContain(
      'Avaliação v1 registrada com nota 4',
    );
    expect(document.activeElement?.getAttribute('data-testid')).toBe(
      'reliability-evaluation-heading',
    );
  });

  it('reproduz a mesma versão e mostra diferenças quando os dados mudaram', async () => {
    create(
      baseRouter({
        '/reproduction': () =>
          json({
            occurrenceId: 'occ-1',
            evaluationVersion: 1,
            ruleVersion: 1,
            reproduced: false,
            storedNote: 4,
            recomputedNote: 3,
            differences: ['nota: registrada 4, recalculada 3'],
            message: 'Os dados mudaram desde o registro.',
          }),
      }),
    );
    await until(() => expect(query('reliability-reproduce')).not.toBeNull());
    button('reliability-reproduce')?.click();
    await until(() => expect(query('reliability-reproduction')).not.toBeNull());
    expect(query('reliability-reproduction')?.textContent).toContain(
      'Dados mudaram desde o registro',
    );
    expect(query('reliability-reproduction')?.textContent).toContain('nota: registrada 4');
  });

  it('recomendação com amostra suficiente exige justificativa e registra a decisão', async () => {
    create(
      baseRouter({
        '/decisions': () =>
          json({
            sourceId: 'src-1',
            decisionId: 7,
            decision: 'APPROVED',
            recommendation: 'DOWNGRADE',
            previousRating: 4,
            appliedRating: 3,
            appliedSourceVersion: 2,
            flaggedOccurrences: 2,
            message: 'Nova versão da fonte registrada; notas antigas preservadas e sinalizadas.',
          }),
      }),
    );
    await until(() => expect(query('reliability-recommendation')).not.toBeNull());
    expect(query('reliability-recommendation-state')?.textContent).toContain('Descer nota');
    expect(query('reliability-sample')?.textContent).toContain('Demonstradas incorretas: 4');
    expect(button('reliability-approve')?.disabled).toBe(true);

    const textarea = query('reliability-justification') as HTMLTextAreaElement;
    textarea.value = 'Quatro de dez afirmações demonstraram-se incorretas na janela.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button('reliability-approve')?.disabled).toBe(false);

    button('reliability-approve')?.click();
    await until(() => expect(query('reliability-decision')).not.toBeNull());
    expect(query('reliability-decision')?.textContent).toContain('nota 4 → 3');
    expect(query('reliability-decision')?.textContent).toContain('2 ocorrência(s)');
  });

  it('amostra insuficiente não oferece aprovação de mudança', async () => {
    create(
      baseRouter({
        '/recommendation': () =>
          json({
            ...RECOMMENDATION,
            recommendation: 'INSUFFICIENT_SAMPLE',
            canChange: false,
            sample: { ...RECOMMENDATION.sample, applicable: 3, disproven: 3 },
            justification: 'Amostra de 3 afirmações, abaixo do mínimo de 10.',
          }),
      }),
    );
    await until(() => expect(query('reliability-recommendation')).not.toBeNull());
    expect(query('reliability-recommendation-state')?.textContent).toContain(
      'Amostra insuficiente',
    );
    expect(button('reliability-approve')?.disabled).toBe(true);
    expect(query('reliability-no-change')?.textContent).toContain(
      'não há mudança de nota a aprovar',
    );
  });

  it('mostra ocorrências sinalizadas para reavaliação sem trocar a nota', async () => {
    create(
      baseRouter({
        '/flags': () =>
          json({
            sourceId: 'src-1',
            items: [
              {
                id: 1,
                occurrence_id: 'occ-9',
                reason: 'Nota da fonte mudou de 4 para 3.',
                created_at: '2026-10-22T12:00:00Z',
                resolved_at: null,
                current_note: 4,
              },
            ],
          }),
      }),
    );
    await until(() => expect(query('reliability-flags')).not.toBeNull());
    expect(query('reliability-flags')?.textContent).toContain('occ-9');
    expect(query('reliability-flags')?.textContent).toContain('nota atual 4');
  });
});
