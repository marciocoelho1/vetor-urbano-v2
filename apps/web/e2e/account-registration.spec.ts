import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API/caixa local e PostgreSQL reais.');
// Do not retain credentials or confirmation secrets in traces or failure screenshots.
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15_000 });

type Mail = { recipient: string; token: string; expiresAt: string; link: string };
const secret = 'Uma frase de teste sintética longa 13';
const syntheticEmail = (kind: string) =>
  `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

async function messages(request: APIRequestContext, email: string): Promise<Mail[]> {
  const response = await request.get('http://127.0.0.1:8025/messages');
  expect(response.status()).toBe(200);
  return ((await response.json()) as Mail[]).filter((message) => message.recipient === email);
}
async function latest(request: APIRequestContext, email: string): Promise<Mail> {
  const mail = await messages(request, email);
  expect(mail.length).toBeGreaterThan(0);
  return mail[mail.length - 1]!;
}
async function fillRegistration(page: Page, email: string, password = secret) {
  await page.getByLabel('Nome de exibição', { exact: true }).fill('Pessoa de teste');
  await page.getByLabel('E-mail do cadastro', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
}
async function register(page: Page, email: string) {
  await fillRegistration(page, email);
  const button = page.getByRole('button', { name: 'Cadastrar conta de teste', exact: true });
  await expect(button).toBeEnabled();
  const response = page.waitForResponse(
    (reply) =>
      reply.request().method() === 'POST' && reply.url().endsWith('/accounts/registrations'),
  );
  await button.focus();
  await page.keyboard.press('Enter');
  expect((await response).status()).toBe(202);
  await expect(page.getByTestId('account-result')).toContainText('Confirmação pendente');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
}
async function confirm(page: Page, token: string) {
  const button = page.getByRole('button', { name: 'Confirmar e-mail', exact: true });
  await expect(button).toBeEnabled();
  const response = page.waitForResponse(
    (reply) =>
      reply.request().method() === 'POST' && reply.url().endsWith('/accounts/confirmations'),
  );
  await page.getByLabel('Token de confirmação', { exact: true }).fill(token);
  await button.focus();
  await page.keyboard.press('Enter');
  await response;
  await expect(page.getByTestId('account-loading')).toBeHidden();
  await expect(page.getByTestId('account-result')).toBeVisible();
  await expect
    .poll(
      async () =>
        (await page.getByLabel('Token de confirmação', { exact: true }).inputValue()) === '',
    )
    .toBe(true);
}
async function resend(page: Page) {
  const response = page.waitForResponse(
    (reply) =>
      reply.request().method() === 'POST' &&
      reply.url().endsWith('/accounts/confirmation-requests'),
  );
  await page.getByRole('button', { name: 'Solicitar reenvio', exact: true }).click();
  expect((await response).status()).toBe(202);
  await expect(page.getByTestId('account-loading')).toBeHidden();
  await expect(page.getByTestId('account-result')).toContainText('Confirmação pendente');
}

test.beforeEach(async ({ page, request }) => {
  const mailbox = await request.get('http://127.0.0.1:8025/messages');
  expect(mailbox.status(), 'Caixa local real deve estar disponível').toBe(200);
  await page.goto('/?conta=local');
});

test('cadastro local oferece somente nome, e-mail e senha, inclusive móvel', async ({
  page,
}, info) => {
  await expect(page.getByRole('heading', { name: 'Crie sua conta de teste' })).toBeVisible();
  await expect(page.getByLabel('Nome de exibição', { exact: true })).toBeVisible();
  await expect(page.getByLabel('E-mail do cadastro', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Endereço residencial/)).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Nome de exibição', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('E-mail do cadastro', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('account-mobile.png'),
    fullPage: true,
    mask: [page.locator('input[type="password"]')],
  });
});

test('HTTP real: erro de senha, mensagem local, confirmação válida, inválida e usada', async ({
  page,
  request,
}, info) => {
  const email = syntheticEmail('account');
  await fillRegistration(page, email, 'curta');
  await page.getByRole('button', { name: 'Cadastrar conta de teste', exact: true }).click();
  await expect(page.getByTestId('account-result')).toContainText('15 a 128');
  await expect(page.getByTestId('account-result')).toHaveAttribute('role', 'alert');
  await expect(page.getByTestId('account-result')).toBeFocused();
  await register(page, email);
  const mail = await latest(request, email);
  // Exercise the actual local message's link; do not print or retain the bearer token.
  await page.goto('http://127.0.0.1:8025/');
  const article = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: email, exact: true }) });
  await article.getByRole('link', { name: 'Abrir confirmação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar e-mail', exact: true })).toBeFocused();
  expect(new URL(page.url()).hash === '').toBe(true);
  await page.getByRole('button', { name: 'Confirmar e-mail', exact: true }).click();
  await expect(page.getByTestId('account-result')).toContainText('E-mail confirmado');
  await expect(page.getByTestId('account-result')).toBeFocused();
  await expect
    .poll(
      async () =>
        (await page.getByLabel('Token de confirmação', { exact: true }).inputValue()) === '',
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath('account-confirmed.png'),
    fullPage: true,
    mask: [page.locator('input[type="password"]')],
  });
  await confirm(page, mail.token);
  await expect(page.getByTestId('account-result')).toContainText('já foi utilizada');
  await confirm(page, 'invalid-token');
  await expect(page.getByTestId('account-result')).toContainText('inválido');
});

test('HTTP real: expiração, reenvio, substituição, cooldown e limite por conta', async ({
  page,
  request,
}) => {
  const email = syntheticEmail('resend');
  await register(page, email);
  const first = await latest(request, email);
  await expect
    .poll(() => Date.now(), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(Date.parse(first.expiresAt));
  await confirm(page, first.token);
  await expect(page.getByTestId('account-result')).toContainText('expirou');
  await resend(page);
  const second = await latest(request, email);
  expect(second.token === first.token).toBe(false);
  await resend(page);
  expect((await messages(request, email)).length).toBe(2);
  await confirm(page, first.token);
  await expect(page.getByTestId('account-result')).toContainText('substituído');
  await expect.poll(() => Date.now()).toBeGreaterThan(Date.parse(second.expiresAt) - 5000 + 1100);
  await resend(page);
  const third = await latest(request, email);
  expect(third.token === second.token).toBe(false);
  await expect.poll(() => Date.now()).toBeGreaterThan(Date.parse(third.expiresAt) - 5000 + 1100);
  await resend(page);
  expect((await messages(request, email)).length).toBe(3);
  await confirm(page, third.token);
  await expect(page.getByTestId('account-result')).toContainText('E-mail confirmado');
});

test('HTTP real: carregamento, indisponibilidade, recuperação e perda de conexão', async ({
  page,
}, info) => {
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  expect(Boolean(database), 'Informe somente o contêiner sintético local').toBe(true);
  const email = syntheticEmail('outage');
  await fillRegistration(page, email);
  execFileSync('podman', ['pause', database!]);
  try {
    await page.getByRole('button', { name: 'Cadastrar conta de teste', exact: true }).click();
    await expect(page.getByTestId('account-loading')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Cadastrar conta de teste', exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId('account-result')).toContainText('indisponível');
    await expect(page.getByTestId('account-result')).toHaveAttribute('role', 'alert');
    await page.screenshot({
      path: info.outputPath('account-unavailable.png'),
      fullPage: true,
      mask: [page.locator('input[type="password"]')],
    });
  } finally {
    execFileSync('podman', ['unpause', database!]);
  }
  await register(page, email);
  await page.context().setOffline(true);
  try {
    await page.getByRole('button', { name: 'Solicitar reenvio', exact: true }).click();
    await expect(page.getByTestId('account-result')).toContainText('conectar');
  } finally {
    await page.context().setOffline(false);
  }
  await resend(page);
});
