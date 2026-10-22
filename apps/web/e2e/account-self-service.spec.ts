import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API/caixa local e PostgreSQL reais.');
// Não reter credenciais nem tokens em traces ou capturas de falha.
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15_000 });

type Mail = {
  kind: string;
  recipient: string;
  token: string | null;
  expiresAt: string | null;
  link: string | null;
  body: string | null;
};
const api = 'http://127.0.0.1:8080/api/v1';
const secret = 'Uma frase de teste sintética longa 13';
const renewed = 'Frase alterada sintética longa 15';
const syntheticEmail = (kind: string) =>
  `self-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

async function messages(request: APIRequestContext, email: string): Promise<Mail[]> {
  const response = await request.get('http://127.0.0.1:8025/messages');
  expect(response.status(), 'Caixa local real deve estar disponível').toBe(200);
  return ((await response.json()) as Mail[]).filter((message) => message.recipient === email);
}
async function latest(request: APIRequestContext, email: string, kind: string): Promise<Mail> {
  const mail = (await messages(request, email)).filter((message) => message.kind === kind);
  expect(mail.length, `Esperava mensagem ${kind} para ${email}`).toBeGreaterThan(0);
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
/** Entra pela interface real e aguarda a seção da própria conta aparecer na navegação. */
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
/** Envia um formulário do painel pelo botão que dá nome à ação e devolve o status real. */
async function submitPanel(
  page: Page,
  form: string,
  button: string,
  path: string,
): Promise<number> {
  const response = page.waitForResponse(
    (reply) => reply.request().method() === 'POST' && reply.url().endsWith(path),
  );
  await page.getByRole('form', { name: form }).getByRole('button', { name: button }).click();
  const status = (await response).status();
  await expect(page.getByTestId('self-account-loading')).toBeHidden();
  return status;
}

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
});

test('minha conta mostra o perfil, salva o nome pela tecla e se apresenta no móvel', async ({
  page,
}, info) => {
  const email = await confirmed(page.request, syntheticEmail('profile'));
  await login(page, email);
  await openAccount(page);
  await expect(page.getByTestId('self-account-email')).toHaveText(email);
  await expect(page.getByTestId('self-account-role')).toHaveText('Pessoa usuária');
  // Estado vazio: nada é anunciado antes do primeiro envio e não há troca pendente.
  await expect(page.getByTestId('self-account-result')).toBeHidden();
  await expect(page.getByTestId('self-account-pending')).toBeHidden();
  // Teclado: salvar o nome com Tab e Enter, com foco devolvido ao resultado.
  const nameForm = page.getByRole('form', { name: 'Nome de exibição' });
  await nameForm.getByLabel('Nome de exibição', { exact: true }).fill('Pessoa sintética 15B');
  await nameForm.getByLabel('Nome de exibição', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(nameForm.getByRole('button', { name: 'Salvar nome' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('self-account-loading')).toBeHidden();
  await expect(page.getByTestId('self-account-result')).toContainText(
    'Nome de exibição atualizado',
  );
  await expect(page.getByTestId('self-account-result')).toBeFocused();
  await expect(page.getByTestId('self-account-name')).toHaveText('Pessoa sintética 15B');
  // A sessão continua válida depois de mudar o nome.
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('minha-conta-mobile.png'),
    fullPage: true,
    mask: [page.locator('input')],
  });
});

test('troca de e-mail só vale após confirmar no novo endereço e encerra as sessões', async ({
  page,
}) => {
  const current = await confirmed(page.request, syntheticEmail('swap-old'));
  const next = syntheticEmail('swap-new');
  await login(page, current);
  await openAccount(page);
  await expect(page.getByTestId('self-account-pending')).toBeHidden();
  const emailForm = page.getByRole('form', { name: 'Alterar e-mail' });
  // Senha atual obrigatória; nada muda quando ela está errada.
  await emailForm.getByLabel('Novo e-mail', { exact: true }).fill(next);
  await emailForm.getByLabel('Senha atual', { exact: true }).fill('senha errada de propósito');
  expect(
    await submitPanel(
      page,
      'Alterar e-mail',
      'Solicitar troca de e-mail',
      '/account/email-changes',
    ),
  ).toBe(400);
  await expect(page.getByTestId('self-account-result')).toContainText('Senha atual incorreta');
  await expect(page.getByTestId('self-account-pending')).toBeHidden();
  expect(await messages(page.request, next)).toHaveLength(0);
  // Pedido válido: endereço atual continua valendo e a pendência fica visível.
  await emailForm.getByLabel('Senha atual', { exact: true }).fill(secret);
  expect(
    await submitPanel(
      page,
      'Alterar e-mail',
      'Solicitar troca de e-mail',
      '/account/email-changes',
    ),
  ).toBe(202);
  await expect(page.getByTestId('self-account-result')).toContainText(
    'Confirmação pendente no novo endereço',
  );
  await expect(page.getByTestId('self-account-pending')).toContainText(next);
  // A pendência mostra a expiração real devolvida pelo servidor (fuso acordado local).
  await expect(page.getByTestId('self-account-pending')).toContainText(
    /vale até\s+\d{2}\/\d{2}\/\d{4}/,
  );
  expect(
    (
      await page.request.post(`${api}/auth/login`, { data: { email: current, password: secret } })
    ).status(),
  ).toBe(200);
  const confirmation = await latest(page.request, next, 'EMAIL_CHANGE_CONFIRMATION');
  expect(confirmation.link).toContain(`#trocar-email=${confirmation.token}`);
  // A confirmação só se conclui ao acionar o botão, no endereço novo.
  await page.goto(`/?conta=local#trocar-email=${confirmation.token}`);
  await expect(page.getByRole('heading', { name: 'Confirmar novo e-mail' })).toBeFocused();
  const confirmedSwap = page.waitForResponse((reply) =>
    reply.url().endsWith('/accounts/email-changes/confirmations'),
  );
  await page.getByRole('button', { name: 'Confirmar novo e-mail', exact: true }).click();
  expect((await confirmedSwap).status()).toBe(200);
  await expect(page.getByTestId('account-result')).toContainText('E-mail atualizado');
  // O endereço antigo recebe aviso e não entra mais; o novo entra com a mesma senha.
  const notice = await latest(page.request, current, 'EMAIL_CHANGE_NOTICE');
  expect(notice.token).toBeFalsy();
  expect(
    (
      await page.request.post(`${api}/auth/login`, { data: { email: current, password: secret } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post(`${api}/auth/login`, { data: { email: next, password: secret } })
    ).status(),
  ).toBe(200);
});

test('senha atual errada não altera nada e a troca encerra a sessão', async ({ page }) => {
  const email = await confirmed(page.request, syntheticEmail('password'));
  await login(page, email);
  await openAccount(page);
  const passwordForm = page.getByRole('form', { name: 'Alterar senha' });
  await passwordForm.getByLabel('Nova senha', { exact: true }).fill(renewed);
  await passwordForm.getByLabel('Senha atual', { exact: true }).fill('senha errada de propósito');
  expect(await submitPanel(page, 'Alterar senha', 'Alterar senha', '/account/password')).toBe(400);
  await expect(page.getByTestId('self-account-result')).toContainText('Senha atual incorreta');
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  // A interface limpa os campos de senha após cada tentativa; a nova senha é digitada de novo.
  await passwordForm.getByLabel('Nova senha', { exact: true }).fill(renewed);
  await passwordForm.getByLabel('Senha atual', { exact: true }).fill(secret);
  expect(await submitPanel(page, 'Alterar senha', 'Alterar senha', '/account/password')).toBe(200);
  // A troca encerra todas as sessões: a interface volta ao acesso com aviso.
  await expect(page.getByRole('heading', { name: 'Acesso aos módulos' })).toBeVisible();
  await expect(page.locator('#access-result')).toContainText('entre novamente com a nova senha');
  expect(
    (await page.request.post(`${api}/auth/login`, { data: { email, password: secret } })).status(),
  ).toBe(401);
  await login(page, email, renewed);
  await openAccount(page);
  await expect(page.getByTestId('self-account-email')).toHaveText(email);
});

test('HTTP real: indisponibilidade aparece como erro e a conta volta a carregar depois', async ({
  page,
  request,
}, info) => {
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  expect(Boolean(database), 'Informe somente o contêiner sintético local').toBe(true);
  const email = await confirmed(request, syntheticEmail('outage'));
  await login(page, email);
  await openAccount(page);
  await expect(page.getByTestId('self-account-profile')).toBeVisible();
  execFileSync('podman', ['pause', database!]);
  try {
    // Reabrir a view refaz a leitura; com o banco pausado a sessão global falha antes do painel.
    await page.getByRole('button', { name: 'Mapa de ocorrências', exact: true }).click();
    await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
    await expect(
      page.locator('main [role="alert"], [data-testid="self-account-service-error"]'),
    ).toContainText('indisponível');
    await page.screenshot({
      path: info.outputPath('minha-conta-indisponivel.png'),
      fullPage: true,
      mask: [page.locator('input')],
    });
  } finally {
    execFileSync('podman', ['unpause', database!]);
  }
  // A falha de infraestrutura não deixa estado intermediário: reabrir a view recarrega a conta.
  await page.getByRole('button', { name: 'Mapa de ocorrências', exact: true }).click();
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  await expect(page.getByTestId('self-account-profile')).toBeVisible();
  await expect(page.getByTestId('self-account-email')).toHaveText(email);
});
