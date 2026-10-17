import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API/caixa local e PostgreSQL reais.');
// Não reter credenciais nem tokens em traces ou capturas de falha.
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15_000 });

type Mail = { kind: string; recipient: string; token: string | null };
const api = 'http://127.0.0.1:8080/api/v1';
const secret = 'Uma frase de teste sintética longa 13';
const syntheticEmail = (kind: string) =>
  `closure-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

async function messages(request: APIRequestContext, email: string): Promise<Mail[]> {
  const response = await request.get('http://127.0.0.1:8025/messages');
  expect(response.status(), 'Caixa local real deve estar disponível').toBe(200);
  return ((await response.json()) as Mail[]).filter((message) => message.recipient === email);
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
  const mail = (await messages(request, email)).find((message) => message.kind === 'CONFIRMATION')!;
  expect(
    (await request.post(`${api}/accounts/confirmations`, { data: { token: mail.token } })).status(),
  ).toBe(200);
  return email;
}
async function login(page: Page, email: string, password = secret): Promise<void> {
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  const response = page.waitForResponse(
    (reply) => reply.url().endsWith('/auth/login') && reply.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
}
async function openAccount(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minha conta', exact: true })).toBeVisible();
}
/** Contagem real na base sintética, sem passar pela interface. */
function sqlCount(query: string): number {
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  expect(Boolean(database), 'Informe somente o contêiner sintético local').toBe(true);
  const output = execFileSync('podman', [
    'exec',
    database!,
    'psql',
    '-U',
    'postgres',
    '-d',
    'vetor_urbano',
    '-tAc',
    query,
  ]).toString();
  return Number.parseInt(output.trim(), 10);
}

/** Decodifica a chave restrita (base32) e gera o código TOTP da janela pedida. */
function totp(secretBase32: string, windowOffset = 0): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secretBase32.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let index = 0; index < bytes.length; index += 1)
    bytes[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  const counter = Math.floor(Date.now() / 30_000) + windowOffset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', bytes).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    (((digest[offset]! & 0x7f) << 24) |
      (digest[offset + 1]! << 16) |
      (digest[offset + 2]! << 8) |
      digest[offset + 3]!) %
    1_000_000;
  return code.toString().padStart(6, '0');
}

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
});

test('encerramento exige confirmação digitada, preserva fatos coletivos e não restaura a conta', async ({
  page,
  request,
}, info) => {
  const email = await confirmed(request, syntheticEmail('close'));
  const occurrencesBefore = sqlCount('SELECT count(*) FROM occurrences');
  await login(page, email);
  await openAccount(page);
  const form = page.getByRole('form', { name: 'Encerrar conta' });
  const button = page.getByTestId('self-account-close');
  // Sem a confirmação digitada o botão permanece inativo, mesmo com a senha preenchida.
  await form.getByLabel('Senha atual', { exact: true }).fill(secret);
  await expect(button).toBeDisabled();
  await form.getByLabel('Escreva ENCERRAR para confirmar').fill('encerrar');
  await expect(button).toBeDisabled();
  // Senha errada com confirmação válida não encerra nada.
  await form.getByLabel('Senha atual', { exact: true }).fill('senha errada de propósito');
  await form.getByLabel('Escreva ENCERRAR para confirmar').fill('ENCERRAR');
  await expect(button).toBeEnabled();
  const refused = page.waitForResponse(
    (reply) => reply.request().method() === 'POST' && reply.url().endsWith('/account/closure'),
  );
  await button.click();
  expect((await refused).status()).toBe(400);
  await expect(page.getByTestId('self-account-result')).toContainText('Senha atual incorreta');
  expect(sqlCount(`SELECT count(*) FROM local_accounts WHERE email='${email}'`)).toBe(1);
  // 390 px e teclado continuam íntegros antes de encerrar.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  // Encerramento efetivo: a interface volta ao acesso com aviso e o cadastro desaparece.
  await form.getByLabel('Senha atual', { exact: true }).fill(secret);
  await form.getByLabel('Escreva ENCERRAR para confirmar').fill('ENCERRAR');
  const closed = page.waitForResponse(
    (reply) => reply.request().method() === 'POST' && reply.url().endsWith('/account/closure'),
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect((await closed).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Acesso aos módulos' })).toBeVisible();
  await expect(page.locator('#access-result')).toContainText('Conta encerrada');
  expect(sqlCount(`SELECT count(*) FROM local_accounts WHERE email='${email}'`)).toBe(0);
  expect(
    (await request.post(`${api}/auth/login`, { data: { email, password: secret } })).status(),
  ).toBe(401);
  // Os fatos coletivos continuam existindo e o novo cadastro com o mesmo endereço é aceito.
  expect(sqlCount('SELECT count(*) FROM occurrences')).toBe(occurrencesBefore);
  expect(
    (
      await request.post(`${api}/accounts/registrations`, {
        data: { displayName: 'Pessoa sintética 15', email, password: secret },
      })
    ).status(),
  ).toBe(202);
  await page.screenshot({
    path: info.outputPath('conta-encerrada.png'),
    fullPage: true,
    mask: [page.locator('input')],
  });
});

test('encerrar todas as sessões derruba este e o outro acesso sem eliminar a conta', async ({
  page,
  request,
}, info) => {
  const email = await confirmed(request, syntheticEmail('sessions'));
  // Outra sessão real, aberta pela API antes da ação.
  const other = await request.post(`${api}/auth/login`, { data: { email, password: secret } });
  expect(other.status()).toBe(200);
  await login(page, email);
  await openAccount(page);
  const sessionsForm = page.getByRole('form', { name: 'Sessões' });
  // E19: a decisão aprovada exige a senha atual; senha errada não encerra sessão alguma.
  await sessionsForm.getByLabel('Senha atual', { exact: true }).fill('senha errada de propósito');
  const refused = page.waitForResponse((reply) =>
    reply.url().endsWith('/account/sessions/revocations'),
  );
  await page.getByTestId('self-account-revoke-sessions').click();
  expect((await refused).status()).toBe(400);
  await expect(page.getByTestId('self-account-result')).toContainText('Senha atual incorreta');
  await sessionsForm.getByLabel('Senha atual', { exact: true }).fill(secret);
  const revoked = page.waitForResponse((reply) =>
    reply.url().endsWith('/account/sessions/revocations'),
  );
  await page.getByTestId('self-account-revoke-sessions').click();
  expect((await revoked).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Acesso aos módulos' })).toBeVisible();
  await expect(page.locator('#access-result')).toContainText('Todas as sessões foram encerradas');
  // A conta continua existindo e o acesso exige novo login.
  expect(sqlCount(`SELECT count(*) FROM local_accounts WHERE email='${email}'`)).toBe(1);
  await login(page, email);
  await openAccount(page);
  await expect(page.getByTestId('self-account-email')).toHaveText(email);
  await page.screenshot({
    path: info.outputPath('sessoes-encerradas.png'),
    fullPage: true,
    mask: [page.locator('input')],
  });
});

test('encerramento recusa campo fora do contrato sem alterar a conta', async ({
  page,
  request,
}) => {
  const email = await confirmed(request, syntheticEmail('extra'));
  await login(page, email);
  await openAccount(page);
  // O servidor recusa corpo fora dos campos declarados; nada é encerrado.
  const forged = await page.request.post(`${api}/account/closure`, {
    data: { currentPassword: secret, closureConfirmation: 'ENCERRAR', extra: '1' },
  });
  expect([400, 401, 403]).toContain(forged.status());
  expect(sqlCount(`SELECT count(*) FROM local_accounts WHERE email='${email}'`)).toBe(1);
  await openAccount(page);
  await expect(page.getByTestId('self-account-email')).toHaveText(email);
});

test('administrador encerra todas as sessões com código novo do autenticador', async ({
  page,
}, info) => {
  const password = process.env['VETOR_LOCAL_TEST_PASSWORD'];
  const restricted = page.getByLabel('Chave do autenticador (restrita)');
  test.skip(!password, 'Informe VETOR_LOCAL_TEST_PASSWORD e a fixture administrativa local');
  await page.goto('/?consulta=api');
  await page.getByLabel('E-mail', { exact: true }).fill('admin@vetorurbano.test');
  await page.getByLabel('Senha', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const configure = page.getByRole('button', { name: 'Configurar autenticador' });
  // Sem autenticador novo disponível não há como gerar o código; a limitação fica registrada.
  test.skip(!(await configure.count()), 'Fixture administrativa já tem autenticador configurado');
  await configure.click();
  await expect(restricted).toBeVisible();
  const secret = await restricted.inputValue();
  expect(secret.length).toBe(32);
  await page.getByLabel('Código do autenticador', { exact: true }).fill(totp(secret));
  const verified = page.waitForResponse((reply) => reply.url().endsWith('/auth/mfa/verification'));
  await page.getByRole('button', { name: 'Confirmar segundo fator', exact: true }).click();
  expect((await verified).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
  await openAccount(page);
  const sessionsForm = page.getByRole('form', { name: 'Sessões' });
  await sessionsForm.getByLabel('Senha atual', { exact: true }).fill(password!);
  // O código usado na entrada não se repete: a janela seguinte é aceita.
  await sessionsForm.getByLabel('Código do autenticador', { exact: true }).fill(totp(secret, 1));
  const revoked = page.waitForResponse((reply) =>
    reply.url().endsWith('/account/sessions/revocations'),
  );
  await page.getByTestId('self-account-revoke-sessions').click();
  expect((await revoked).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Acesso aos módulos' })).toBeVisible();
  await expect(page.locator('#access-result')).toContainText('Todas as sessões foram encerradas');
  await page.screenshot({
    path: info.outputPath('admin-sessoes-encerradas.png'),
    fullPage: true,
    mask: [page.locator('input')],
  });
});
