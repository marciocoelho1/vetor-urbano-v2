import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPage } from './account-page';

let fixture: ComponentFixture<AccountPage>;
const reply = (code: string, status: number) =>
  new Response(
    JSON.stringify({
      code,
      message:
        code === 'CONFIRMATION_PENDING' ? 'Confirmação pendente de teste.' : 'Mensagem de teste.',
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
function fill(id: string, value: string) {
  const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}
function submit(index: number) {
  (fixture.nativeElement.querySelectorAll('form')[index] as HTMLFormElement).dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
  fixture.detectChanges();
}

describe('Conta local — fronteira do formulário', () => {
  beforeEach(async () => {
    history.replaceState(null, '', '/?conta=local');
    await TestBed.configureTestingModule({ imports: [AccountPage] }).compileComponents();
  });
  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
    history.replaceState(null, '', '/');
  });
  it('envia somente os três campos, limpa a senha e anuncia a espera até a resposta', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fill('account-name', 'Pessoa sintética');
    fill('account-email', 'unit@example.test');
    fill('account-password', 'Frase de teste com espaços');
    submit(0);
    const request = fetch.mock.calls[0]!;
    expect(request[0]).toBe('http://127.0.0.1:8080/api/v1/accounts/registrations');
    expect(Object.keys(JSON.parse(request[1]!.body as string)).sort()).toEqual([
      'displayName',
      'email',
      'password',
    ]);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        (fixture.nativeElement.querySelector('#account-password') as HTMLInputElement).value === '',
      ).toBe(true);
    });
    expect(fixture.nativeElement.querySelector('[data-testid="account-loading"]')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
    finish(reply('CONFIRMATION_PENDING', 202));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#account-result')?.textContent).toContain(
        'Confirmação pendente',
      );
    });
  });
  it('remove token do fragmento sem consumir link automaticamente e só o envia no POST explícito', async () => {
    history.replaceState(null, '', '/?conta=local#confirmar=synthetic-unit-token');
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply('ACCOUNT_CONFIRMED', 200));
    fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(location.hash).toBe('');
    expect(fetch).not.toHaveBeenCalled();
    submit(1);
    expect(fetch.mock.calls[0]![0]).toBe('http://127.0.0.1:8080/api/v1/accounts/confirmations');
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      token: 'synthetic-unit-token',
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        (fixture.nativeElement.querySelector('#account-token') as HTMLInputElement).value === '',
      ).toBe(true);
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#account-result')?.textContent).toContain(
        'E-mail confirmado',
      );
    });
  });
  it('falha de conexão aparece como erro com foco e não confirma a conta', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network unavailable'));
    fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fill('account-resend-email', 'unit@example.test');
    submit(2);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#account-result')?.getAttribute('role')).toBe(
        'alert',
      );
    });
    await vi.waitFor(() => expect(document.activeElement?.id).toBe('account-result'));
    expect(fixture.nativeElement.textContent).toContain('conectar');
    expect(fixture.nativeElement.textContent).not.toContain('E-mail confirmado');
  });
});
