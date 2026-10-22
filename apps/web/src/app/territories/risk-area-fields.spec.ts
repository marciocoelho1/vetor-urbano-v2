import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../auth/session';
import { RiskAreaFields } from './risk-area-fields';

const AREAS = {
  items: [
    {
      territoryId: 'area-1',
      version: 2,
      approvedVersion: 1,
      name: 'Área sintética',
      indicatedGroup: 'CV',
      sourceId: 'fonte-1',
      evidenceReference: 'Ofício sintético',
      referenceDate: '2026-09-30',
      limitations: 'Grupo pode mudar sem aviso',
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('RiskAreaFields', () => {
  let fixture: ComponentFixture<RiskAreaFields>;
  let calls: Array<{ url: string; method: string; body?: string }>;

  beforeEach(async () => {
    calls = [];
    await TestBed.configureTestingModule({
      imports: [RiskAreaFields],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: Session, useValue: { state: () => ({ csrfToken: 'csrf-teste' }) } },
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
    fixture = TestBed.createComponent(RiskAreaFields);
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

  it('lista as áreas e abre os campos da área escolhida', async () => {
    create(() => json(AREAS));
    await until(() => expect(query('risk-area-select')).not.toBeNull());
    const select = query('risk-area-select') as HTMLSelectElement;
    select.value = 'area-1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect((query('risk-area-name') as HTMLInputElement).value).toBe('Área sintética');
    expect((query('risk-area-group') as HTMLInputElement).value).toBe('CV');
    expect(query('risk-area-summary')?.textContent).toContain('aprovada: 1');
  });

  it('salva apenas os campos, sem reenviar geometria, e preserva a versão aprovada', async () => {
    create((url) => (url.includes('/versions') ? json({ version: 3 }) : json(AREAS)));
    await until(() => expect(query('risk-area-select')).not.toBeNull());
    const select = query('risk-area-select') as HTMLSelectElement;
    select.value = 'area-1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const group = query('risk-area-group') as HTMLInputElement;
    group.value = 'Milícia';
    group.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('risk-area-save')?.click();
    await until(() => expect(query('risk-area-notice')?.textContent).toContain('nova versão'));

    const post = calls.find((call) => call.url.includes('/versions'));
    const body = JSON.parse(post!.body!);
    expect(body.expectedVersion).toBe(2);
    expect(body.indicatedGroup).toBe('Milícia');
    expect(body.geometry).toBeUndefined();
    expect(post!.body).not.toContain('geometry');
  });

  it('aprovação exige justificativa de 20 caracteres', async () => {
    create(() => json(AREAS));
    await until(() => expect(query('risk-area-select')).not.toBeNull());
    const select = query('risk-area-select') as HTMLSelectElement;
    select.value = 'area-1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    button('risk-area-approve')?.click();
    await until(() => expect(query('risk-area-error')?.textContent).toContain('justificativa'));
    expect(calls.some((call) => call.url.includes('/approvals'))).toBe(false);

    const justification = query('risk-area-justification') as HTMLInputElement;
    justification.value = 'Aprovação conferida na revisão administrativa';
    justification.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  });

  it('falha de leitura aparece como erro com repetição, nunca como ausência de áreas', async () => {
    create(() => json({ message: 'indisponível' }, 503));
    await until(() => expect(query('risk-area-error')).not.toBeNull());
    expect(query('risk-area-empty')).toBeNull();
    expect(query('risk-area-retry')).not.toBeNull();
  });
});
