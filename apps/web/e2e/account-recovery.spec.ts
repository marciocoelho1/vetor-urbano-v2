import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API/caixa local e PostgreSQL reais.');
// Do not retain credentials or recovery secrets in traces or failure screenshots.
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15_000 });

type Mail = {
  kind: string;
  recipient: string;
  subject: string;
  token: string | null;
  expiresAt: string | null;
  link: string | null;
  body: string | null;
};
const api = 'http://127.0.0.1:8080/api/v1';
const secret = 'Uma frase de teste sintética longa 13';
const renewed = 'Frase redefinida sintética longa 15';
const syntheticEmail = (kind: string) =>
  `rec-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

async function messages(request: APIRequestContext, email: string): Promise<Mail[]> {
  const response = await request.get('http://127.0.0.1:8025/messages');
  expect(response.status()).toBe(200);
  return ((await response.json()) as Mail[]).filter((message) => message.recipient === email);
}
async function latest(request: APIRequestContext, email: string, kind: string): Promise<Mail> {
  const mail = (await messages(request, email)).filter((message) => message.kind === kind);
  expect(mail.length).toBeGreaterThan(0);
  return mail[mail.length - 1]!;
}
/** Confirma uma conta sintética pela API real e devolve o e-mail usado. */
async function confirmed(request: APIRequestContext, email: string): Promise<string> {
  expect(
    (
      await request.post(`${api}/accounts/registrations`, {
        data: { displayName: 'Pessoa sintética 15', email, password: secret },
      })
    ).status(),
  ).toBe(202);
  const mail = await latest(request, email, 'CONFIRMATION');
  expect(
    (await request.post(`${api}/accounts/confirmations`, { data: { token: mail.token } })).status(),
  ).toBe(200);
  return email;
}
async function requestRecovery(page: Page, email: string): Promise<void> {
  await page.getByLabel('E-mail da conta confirmada', { exact: true }).fill(email);
  const button = page.getByRole('button', { name: 'Solicitar link de recuperação', exact: true });
  const response = page.waitForResponse(
    (reply) =>
      reply.request().method() === 'POST' && reply.url().endsWith('/accounts/recovery-requests'),
  );
  await button.click();
  expect((await response).status()).toBe(202);
  await expect(page.getByTestId('account-result')).toContainText('Recuperação solicitada');
}
async function submitRecovery(page: Page, password: string): Promise<number> {
  const button = page.getByRole('button', { name: 'Redefinir senha', exact: true });
  await expect(button).toBeEnabled();
  const response = page.waitForResponse(
    (reply) => reply.request().method() === 'POST' && reply.url().endsWith('/accounts/recoveries'),
  );
  await page.getByLabel('Nova senha', { exact: true }).fill(password);
  await button.focus();
  await page.keyboard.press('Enter');
  const status = (await response).status();
  await expect(page.getByTestId('account-loading')).toBeHidden();
  return status;
}

test.beforeEach(async ({ page, request }) => {
  const mailbox = await request.get('http://127.0.0.1:8025/messages');
  expect(mailbox.status(), 'Caixa local real deve estar disponível').toBe(200);
  await page.goto('/?conta=local');
});

test('recuperação pede só o e-mail e se apresenta no móvel, com foco e sem transbordo', async ({
  page,
}, info) => {
  await expect(page.getByRole('heading', { name: 'Recuperar acesso', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Definir nova senha', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('E-mail da conta confirmada', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Endereço residencial/)).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('E-mail da conta confirmada', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Solicitar link de recuperação', exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('account-recovery-mobile.png'),
    fullPage: true,
    mask: [page.locator('input[type="password"]')],
  });
});

test('HTTP real: pedido indistinguível, link do e-mail, nova senha encerra sessões e exige login', async ({
  page,
  request,
}, info) => {
  const email = await confirmed(request, syntheticEmail('journey'));
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: secret } })).status(),
  ).toBe(200);
  expect((await request.get(`${api}/auth/session`)).status()).toBe(200);

  await requestRecovery(page, email);
  const mail = await latest(request, email, 'RECOVERY');
  expect(mail.kind).toBe('RECOVERY');
  expect(mail.subject).toContain('senha');
  expect(new URL(mail.link!).hash).toBe(`#recuperar=${mail.token}`);

  // O link da própria mensagem é seguido; o fragmento não confirma nada por si só.
  await page.goto('http://127.0.0.1:8025/');
  const article = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: email, exact: true }) })
    .filter({ hasText: 'RECOVERY' });
  await article.getByRole('link', { name: 'Abrir link de recuperação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar acesso', exact: true })).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
  expect((await request.get(`${api}/auth/session`)).status()).toBe(200);

  expect(await submitRecovery(page, renewed)).toBe(200);
  await expect(page.getByTestId('account-result')).toContainText('Senha redefinida');
  await expect(page.getByTestId('account-result')).toBeFocused();
  await expect
    .poll(async () => (await page.getByLabel('Nova senha', { exact: true }).inputValue()) === '', {
      timeout: 10_000,
    })
    .toBe(true);

  // E01: a sessão anterior morreu, a senha antiga não entra e a nova entra.
  expect((await request.get(`${api}/auth/session`)).status()).toBe(401);
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: secret } })).status(),
  ).toBe(401);
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: renewed } })).status(),
  ).toBe(200);
  // E14: aviso de conclusão sem token nem senha.
  const notice = await latest(request, email, 'RECOVERY_COMPLETED');
  expect(notice.token).toBeNull();
  expect(notice.body).toContain('sessões anteriores');
  await page.screenshot({
    path: info.outputPath('account-recovery-done.png'),
    fullPage: true,
    mask: [page.locator('input[type="password"]')],
  });
});

test('HTTP real: pedido não revela conta e link inválido, fraco e usado são recusados', async ({
  page,
  request,
}) => {
  const unknown = syntheticEmail('unknown');
  await requestRecovery(page, unknown);
  expect(await messages(request, unknown)).toHaveLength(0);

  await page.goto('/?conta=local');
  await page.getByLabel('Token do link de recuperação', { exact: true }).fill('a'.repeat(43));
  expect(await submitRecovery(page, renewed)).toBe(400);
  await expect(page.getByTestId('account-result')).toContainText('inválido');
  await expect(page.getByTestId('account-result')).toHaveAttribute('role', 'alert');

  const email = await confirmed(request, syntheticEmail('reject'));
  await requestRecovery(page, email);
  const mail = await latest(request, email, 'RECOVERY');
  await page.getByLabel('Token do link de recuperação', { exact: true }).fill(mail.token!);
  // Senha fora do exigido: recusa sem efeito e o link continua utilizável.
  expect(await submitRecovery(page, 'curta')).toBe(400);
  await expect(page.getByTestId('account-result')).toContainText('15 a 128');
  expect(await submitRecovery(page, renewed)).toBe(200);
  await expect(page.getByTestId('account-result')).toContainText('Senha redefinida');
  // Uso único: repetir o mesmo link não reabre a conta.
  expect(await submitRecovery(page, renewed)).toBe(409);
  await expect(page.getByTestId('account-result')).toContainText('já foi utilizado');
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: renewed } })).status(),
  ).toBe(200);
});

test('HTTP real: indisponibilidade aparece como erro e o pedido volta a funcionar depois', async ({
  page,
  request,
}, info) => {
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  expect(Boolean(database), 'Informe somente o contêiner sintético local').toBe(true);
  const email = await confirmed(request, syntheticEmail('outage'));
  execFileSync('podman', ['pause', database!]);
  try {
    await page.getByLabel('E-mail da conta confirmada', { exact: true }).fill(email);
    const button = page.getByRole('button', {
      name: 'Solicitar link de recuperação',
      exact: true,
    });
    await button.click();
    await expect(page.getByTestId('account-loading')).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page.getByTestId('account-result')).toContainText('indisponível');
    await expect(page.getByTestId('account-result')).toHaveAttribute('role', 'alert');
    await page.screenshot({
      path: info.outputPath('account-recovery-unavailable.png'),
      fullPage: true,
      mask: [page.locator('input[type="password"]')],
    });
  } finally {
    execFileSync('podman', ['unpause', database!]);
  }
  // A falha de infraestrutura não deixa estado intermediário: o pedido volta a funcionar.
  await requestRecovery(page, email);
  expect(await latest(request, email, 'RECOVERY')).toBeDefined();
});

test('HTTP real: link de recuperação expirado não altera a senha', async ({ page, request }) => {
  const email = await confirmed(request, syntheticEmail('expired'));
  await requestRecovery(page, email);
  const mail = await latest(request, email, 'RECOVERY');
  await expect
    .poll(() => Date.now(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(Date.parse(mail.expiresAt!));
  await page.getByLabel('Token do link de recuperação', { exact: true }).fill(mail.token!);
  expect(await submitRecovery(page, renewed)).toBe(410);
  await expect(page.getByTestId('account-result')).toContainText('expirou');
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: secret } })).status(),
  ).toBe(200);
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: renewed } })).status(),
  ).toBe(401);
});
