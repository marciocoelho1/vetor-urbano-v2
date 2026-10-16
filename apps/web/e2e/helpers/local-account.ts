import { expect, type APIRequestContext } from '@playwright/test';

export const api = 'http://127.0.0.1:8080/api/v1';
export const testPassword = 'Frase sintética de autenticação 14';
export async function confirmedUser(request: APIRequestContext, prefix = 'session14') {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  expect(
    (
      await request.post(`${api}/accounts/registrations`, {
        data: { displayName: 'Pessoa sintética 14', email, password: testPassword },
      })
    ).status(),
  ).toBe(202);
  const mailbox = await request.get('http://127.0.0.1:8025/messages');
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
