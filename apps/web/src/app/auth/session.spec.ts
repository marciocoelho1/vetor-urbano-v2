import { describe, it, expect, vi, afterEach } from 'vitest';
import { Session } from './session';

afterEach(() => vi.unstubAllGlobals());
describe('Sessão do navegador', () => {
  it('envia cookie e CSRF, mantém somente estado em memória e limpa no logout', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'AUTHENTICATED',
            message: 'Entrou',
            authenticated: true,
            role: 'USER',
            csrfToken: 'synthetic-csrf',
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'LOGGED_OUT', message: 'Saiu' })));
    vi.stubGlobal('fetch', fetcher);
    const session = new Session();
    await session.perform('login', { email: 'synthetic@example.test', password: 'synthetic only' });
    expect(session.state()?.authenticated).toBe(true);
    await session.perform('logout', {});
    expect(fetcher.mock.calls[1]![1]).toMatchObject({
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'synthetic-csrf' },
    });
    expect(session.state()).toBeNull();
    expect(session.secret()).toBe('');
  });
  it('falha de conexão ao restaurar sessão não concede acesso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const session = new Session();
    await session.refresh();
    expect(session.state()).toBeNull();
    expect(session.failed()).toBe(true);
    expect(session.busy()).toBe(false);
  });
  it('sessão parcial não é autenticação completa e segredo desaparece na próxima ação', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'MFA_REQUIRED',
            message: 'MFA',
            authenticated: false,
            role: 'ADMIN',
            csrfToken: 'partial',
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'MFA_ENROLLMENT',
            message: 'Ative',
            secret: 'synthetic enrollment',
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'INVALID_MFA', message: 'Inválido' }), { status: 401 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const session = new Session();
    await session.perform('login', { email: 'admin@example.test', password: 'synthetic only' });
    expect(session.state()?.authenticated).toBe(false);
    await session.perform('mfa/enrollment', {});
    expect(Boolean(session.secret())).toBe(true);
    await session.perform('mfa/verification', { code: '000000' });
    expect(session.secret()).toBe('');
    expect(session.state()?.authenticated).toBe(false);
  });
});
