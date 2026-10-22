import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from '../auth/session';
import { OccurrencesAdminPanel } from './occurrences-admin-panel';

const occurrence = (
  id: string,
  title: string,
  status: 'ACTIVE' | 'INACTIVE' | 'CONCLUDED',
  updatedAt: string | null,
) => ({
  id,
  title,
  category: 'TRANSITO',
  occurrence_type: 'ACIDENTE',
  situation: 'ONGOING',
  administrative_status: status,
  municipality: 'Rio de Janeiro',
  neighborhood: 'Centro',
  revision: 1,
  occurred_at: '2026-10-10T12:00:00Z',
  updated_at: updatedAt,
  reliability: 3,
});

const LIST = {
  items: [
    occurrence('occ-1', 'Alfa ocorrência', 'ACTIVE', '2026-10-22T10:00:00Z'),
    occurrence('occ-2', 'Bravo ocorrência', 'INACTIVE', null),
    occurrence('occ-3', 'Zulu ocorrência', 'CONCLUDED', '2026-10-21T10:00:00Z'),
  ],
  sort: 'last_update',
  status: 'ALL',
  counts: { ACTIVE: 1, INACTIVE: 1, CONCLUDED: 1 },
  rule: 'Ordem padrão por última atualização.',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('OccurrencesAdminPanel', () => {
  let fixture: ComponentFixture<OccurrencesAdminPanel>;
  let calls: Array<{ url: string; method: string; body?: string }>;

  beforeEach(async () => {
    calls = [];
    await TestBed.configureTestingModule({
      imports: [OccurrencesAdminPanel],
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
    fixture = TestBed.createComponent(OccurrencesAdminPanel);
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
  const base =
    (extra: Record<string, () => Response> = {}) =>
    (url: string) => {
      for (const [fragment, handler] of Object.entries(extra)) {
        // Endpoint sem query é o POST de cadastro; com query é a lista.
        if (fragment === '/admin/occurrences' && url.includes('?')) continue;
        if (url.includes(fragment)) return handler();
      }
      return json(LIST);
    };

  it('lista por última atualização com estados e contagens e declara atualização ausente', async () => {
    create(base());
    await until(() => expect(query('occurrences-table')).not.toBeNull());
    expect(query('occurrences-row-occ-1')?.textContent).toContain('Alfa ocorrência');
    expect(query('occurrences-status-occ-2')?.textContent?.trim()).toBe('Inativo');
    expect(query('occurrences-updated-occ-2')?.textContent).toContain('Atualização não registrada');
    expect(query('occurrences-filter')?.textContent).toContain('Concluído (1)');
    expect(calls[0]?.url).toContain('sort=last_update');
  });

  it('ordena alfabeticamente e filtra por estado recarregando a lista', async () => {
    create((url) =>
      json({ ...LIST, sort: url.includes('alphabetical') ? 'alphabetical' : 'last_update' }),
    );
    await until(() => expect(query('occurrences-table')).not.toBeNull());
    const sort = query('occurrences-sort') as HTMLSelectElement;
    sort.value = 'alphabetical';
    sort.dispatchEvent(new Event('change'));
    await until(() =>
      expect(calls.some((call) => call.url.includes('sort=alphabetical'))).toBe(true),
    );

    const filter = query('occurrences-filter') as HTMLSelectElement;
    filter.value = 'CONCLUDED';
    filter.dispatchEvent(new Event('change'));
    await until(() =>
      expect(calls.some((call) => call.url.includes('status=CONCLUDED'))).toBe(true),
    );
  });

  it('ações em lote sem senha atualizam o estado das selecionadas', async () => {
    create(
      base({
        '/bulk': () =>
          json({ action: 'INACTIVE', affected: 2, ids: [], message: 'Estado atualizado.' }),
      }),
    );
    await until(() => expect(query('occurrences-table')).not.toBeNull());
    (query('occurrences-select-occ-1') as HTMLInputElement).click();
    (query('occurrences-select-occ-2') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(query('occurrences-selected-count')?.textContent).toContain('2');

    button('occurrences-mark-inactive')?.click();
    await until(() =>
      expect(query('occurrences-notice')?.textContent).toContain('2 ocorrência(s)'),
    );
    const post = calls.find((call) => call.url.includes('/bulk'));
    expect(post?.method).toBe('POST');
    expect(post?.body).toContain('"action":"INACTIVE"');
    expect(post?.body).not.toContain('password');
  });

  it('exclusão pede confirmação e senha uma única vez para o lote', async () => {
    create(
      base({
        '/bulk': () =>
          json({ action: 'DELETE', affected: 2, ids: [], message: 'Exclusão lógica registrada.' }),
      }),
    );
    await until(() => expect(query('occurrences-table')).not.toBeNull());
    (query('occurrences-select-all') as HTMLInputElement).click();
    (query('occurrences-select-occ-3') as HTMLInputElement).click();
    fixture.detectChanges();

    button('occurrences-delete')?.click();
    await until(() => expect(query('occurrences-delete-dialog')).not.toBeNull());
    expect(query('occurrences-delete-summary')?.textContent).toContain('2 ocorrência(s)?');
    // O foco do campo de senha é verificado no navegador real (e2e); no jsdom o ciclo de render
    // após `afterNextRender` não é determinístico.
    expect(button('occurrences-confirm-delete')?.disabled).toBe(true);

    const password = query('occurrences-password') as HTMLInputElement;
    password.value = 'Frase Sintética de admin';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('occurrences-confirm-delete')?.click();

    await until(() =>
      expect(query('occurrences-notice')?.textContent).toContain('2 ocorrência(s)'),
    );
    const posts = calls.filter((call) => call.url.includes('/bulk') && call.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toContain('"password"');
    expect(JSON.parse(posts[0]!.body!).ids).toHaveLength(2);
    expect(query('occurrences-delete-dialog')).toBeNull();
  });

  it('senha recusada mantém o diálogo e não exclui nada', async () => {
    create(
      base({
        '/bulk': () =>
          json(
            { code: 'FORBIDDEN', message: 'Senha do administrador incorreta; nada foi excluído.' },
            403,
          ),
      }),
    );
    await until(() => expect(query('occurrences-table')).not.toBeNull());
    (query('occurrences-select-all') as HTMLInputElement).click();
    fixture.detectChanges();
    button('occurrences-delete')?.click();
    await until(() => expect(query('occurrences-password')).not.toBeNull());
    const password = query('occurrences-password') as HTMLInputElement;
    password.value = 'senha errada';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('occurrences-confirm-delete')?.click();
    await until(() =>
      expect(query('occurrences-error')?.textContent).toContain('Senha do administrador incorreta'),
    );
    expect(query('occurrences-delete-dialog')).not.toBeNull();
  });

  it('erro de leitura aparece como erro com repetição, nunca como lista vazia', async () => {
    create(() => json({ code: 'UNAVAILABLE', message: 'Consulta indisponível.' }, 503));
    await until(() => expect(query('occurrences-error')).not.toBeNull());
    expect(query('occurrences-empty')).toBeNull();
    expect(query('occurrences-retry')).not.toBeNull();
  });

  it('filtro sem resultados mostra vazio explícito', async () => {
    create(() => json({ ...LIST, items: [], counts: { ACTIVE: 0, INACTIVE: 0, CONCLUDED: 0 } }));
    await until(() => expect(query('occurrences-empty')).not.toBeNull());
    expect(query('occurrences-empty')?.textContent).toContain('As fictícias continuam disponíveis');
  });

  it('edita todos os campos e gera nova versão', async () => {
    create(
      base({
        '/occurrences/occ-1': () => json({ id: 'occ-1', title: 'Alfa revisada', revision: 2 }),
      }),
    );
    await until(() => expect(query('occurrences-table')).not.toBeNull());
    button('occurrences-edit-occ-1')?.click();
    await until(() => expect(query('occurrences-editor')).not.toBeNull());

    const title = query('occurrence-field-title') as HTMLInputElement;
    title.value = 'Alfa revisada';
    title.dispatchEvent(new Event('input'));
    const description = query('occurrence-field-description') as HTMLTextAreaElement;
    description.value = 'Descrição revisada e sustentada';
    description.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    button('occurrences-save')?.click();
    await until(() =>
      expect(query('occurrences-notice')?.textContent).toContain('salva em nova versão'),
    );
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.url).toContain('/admin/occurrences/occ-1');
    const body = JSON.parse(put!.body!);
    expect(body.expectedVersion).toBe(1);
    expect(body.title).toBe('Alfa revisada');
    expect(body.reliability).toBe(3);
    expect(body.description).toBe('Descrição revisada e sustentada');
  });

  it('cadastra ocorrência em tempo real sem clipping', async () => {
    create(
      base({
        '/admin/occurrences': () =>
          json({ id: 'occ-new', title: 'Fato presenciado', revision: 1 }, 201),
      }),
    );
    await until(() =>
      expect(query('occurrences-table'), root().innerHTML.slice(0, 600)).not.toBeNull(),
    );
    button('occurrences-new')?.click();
    await until(() => expect(query('occurrences-create')).not.toBeNull());

    const fields: Array<[string, string]> = [
      ['new-field-title', 'Fato presenciado no centro'],
      ['new-field-description', 'Descrição sustentada do fato presenciado'],
      ['new-field-happening', 'Acontecimento do fato presenciado'],
      ['new-field-type', 'ACIDENTE'],
      ['new-field-subtype', 'COLISAO'],
      ['new-field-municipality', 'Rio de Janeiro'],
      ['new-field-neighborhood', 'Centro'],
      ['new-field-occurred-at', '2026-10-10T12:00:00Z'],
    ];
    for (const [testId, value] of fields) {
      const input = query(testId) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    button('occurrences-create-save')?.click();

    await until(() =>
      expect(query('occurrences-notice')?.textContent).toContain(
        'cadastrada como ocorrência ativa',
      ),
    );
    const post = calls.find(
      (call) => call.url.endsWith('/admin/occurrences') && call.method === 'POST',
    );
    const body = JSON.parse(post!.body!);
    expect(body.reliability).toBe(3);
    expect(body.happeningTitle).toBe('Acontecimento do fato presenciado');
    expect(body.clippingId).toBeUndefined();
  });
});
