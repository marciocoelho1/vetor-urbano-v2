import { expect, test } from '@playwright/test';

test.skip(
  process.env['VETOR_LOCAL_ACCESS_E2E'] !== '1',
  'Exige API/PostGIS locais e as duas fixtures de acesso provisionadas.',
);
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('localhost preserva a entrada do cadastro e o fragmento', async ({ page }) => {
  await page.goto('http://localhost:4201/?conta=local&entrada=teste#orientacao');
  await expect(page.getByRole('heading', { name: 'Crie sua conta de teste' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4201/?conta=local&entrada=teste#orientacao');
});

test('localhost preserva a sessão ao configurar o autenticador', async ({ page }) => {
  const password = process.env['VETOR_LOCAL_TEST_PASSWORD'];
  if (!password) throw new Error('Informe VETOR_LOCAL_TEST_PASSWORD no ambiente.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4201/?consulta=api&entrada=teste#consulta-local');
  await page.getByLabel('E-mail', { exact: true }).fill('admin@vetorurbano.test');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Segundo fator administrativo' })).toBeVisible();
  await page.getByRole('button', { name: 'Configurar autenticador' }).click();
  await expect(page.getByRole('heading', { name: 'Segundo fator administrativo' })).toBeVisible();
  const secret = page.getByLabel('Chave do autenticador (restrita)');
  await expect(secret).toBeVisible();
  // Não incluir a chave real em mensagens de asserção, trace ou captura.
  expect((await secret.inputValue()).length).toBe(32);
  await expect(page).toHaveURL('http://127.0.0.1:4201/?consulta=api&entrada=teste#consulta-local');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const reply = await page.request.get('http://127.0.0.1:8080/api/v1/auth/session');
  expect(reply.status()).toBe(200);
  expect((await reply.json()).code).toBe('MFA_REQUIRED');
  expect((await page.request.get('http://127.0.0.1:8080/api/v1/admin/sources')).status()).toBe(403);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
});

test('localhost preserva o login de Usuário e a sessão após recarga', async ({ page }) => {
  const password = process.env['VETOR_LOCAL_TEST_PASSWORD'];
  if (!password) throw new Error('Informe VETOR_LOCAL_TEST_PASSWORD no ambiente.');
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('http://localhost:4201/?consulta=api');
  await page.getByLabel('E-mail', { exact: true }).fill('usuario@vetorurbano.test');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4201/?consulta=api');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
});
