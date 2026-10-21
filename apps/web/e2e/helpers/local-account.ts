import { expect, type APIRequestContext, type Page } from '@playwright/test';

const configuredApi = process.env['VETOR_E2E_API_BASE'] || 'http://127.0.0.1:8080/api/v1';
const apiUrl = new URL(configuredApi);
if (
  apiUrl.protocol !== 'http:' ||
  apiUrl.hostname !== '127.0.0.1' ||
  !['8080', '8081'].includes(apiUrl.port) ||
  apiUrl.pathname !== '/api/v1' ||
  apiUrl.search ||
  apiUrl.hash ||
  apiUrl.username ||
  apiUrl.password
) {
  throw new Error('VETOR_E2E_API_BASE deve apontar para a API sintética em 127.0.0.1:8080/8081.');
}

export const api = apiUrl.toString().replace(/\/$/, '');
const mailboxPort = process.env['VETOR_E2E_MAILBOX_PORT'] || '8025';
if (!['8025', '8026'].includes(mailboxPort)) {
  throw new Error('VETOR_E2E_MAILBOX_PORT deve ser 8025 ou 8026.');
}
export const testPassword = 'Frase sintética de autenticação 14';

/** Redireciona apenas chamadas da aplicação Angular, que mantém 8080 como URL local. */
export async function routeApplicationApi(page: Page): Promise<void> {
  if (apiUrl.port === '8080') return;
  await page.route('http://127.0.0.1:8080/**', async (route) => {
    const target = new URL(route.request().url());
    target.host = apiUrl.host;
    await route.continue({ url: target.toString() });
  });
}

export async function confirmedUser(request: APIRequestContext, prefix = 'session14') {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  expect(
    (
      await request.post(`${api}/accounts/registrations`, {
        data: { displayName: 'Pessoa sintética 14', email, password: testPassword },
      })
    ).status(),
  ).toBe(202);
  const mailbox = await request.get(`http://127.0.0.1:${mailboxPort}/messages`);
  const messages = (await mailbox.json()) as { recipient: string; token: string }[];
  const message = messages.findLast((item) => item.recipient === email);
  expect(Boolean(message)).toBe(true);
  expect(
    (
      await request.post(`${api}/accounts/confirmations`, { data: { token: message!.token } })
    ).status(),
  ).toBe(200);
  return email;
}
export async function loginUser(request: APIRequestContext) {
  const email = await confirmedUser(request);
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: testPassword } })).status(),
  ).toBe(200);
  return email;
}
