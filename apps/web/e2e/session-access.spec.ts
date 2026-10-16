import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { api, confirmedUser, loginUser, testPassword } from './helpers/local-account';

test.skip(process.env['VETOR_SESSION_E2E'] !== '1', 'Exige API, caixa e PostGIS reais.');
test.use({ trace: 'off', screenshot: 'off' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
});
function totp(base32: string): string {
  let value = 0,
    bits = 0;
  const bytes: number[] = [];
  for (const char of base32) {
    value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

test('visitante, erros, teclado, consulta nos dois modos, recarga e logout móvel', async ({
  page,
}, info) => {
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await expect(page.getByRole('heading', { name: 'Acesso aos módulos' })).toBeVisible();
  expect((await page.request.get(`${api}/occurrences`)).status()).toBe(401);
  await page.getByRole('link', { name: 'Conheça nossas fontes' }).click();
  await expect(page.getByRole('heading', { name: 'Conheça nossas fontes' })).toBeVisible();
  await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
  const email = await confirmedUser(page.request);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('inválida');
  await page.getByRole('button', { name: 'Entrar', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#access-result')).toContainText('Credenciais inválidas');
  await expect(page.locator('#access-result')).toBeFocused();
  await page.getByLabel('Senha', { exact: true }).fill(testPassword);
  const login = page.waitForResponse(
    (response) => response.url().endsWith('/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await login).status()).toBe(200);
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await page.getByRole('button', { name: 'Fontes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Acesso não concedido');
  expect((await page.request.get(`${api}/auth/access/sources`)).status()).toBe(403);
  const toggle = page.locator('[data-mode-toggle]');
  const previous = await toggle.getAttribute('aria-pressed');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', previous === 'true' ? 'false' : 'true');
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await page.reload();
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acesso aos módulos' })).toBeVisible();
  expect((await page.request.get(`${api}/occurrences`)).status()).toBe(401);
  await page.getByLabel('E-mail', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('session-mobile.png'),
    fullPage: true,
    mask: [page.locator('input')],
  });
});

test('Administrador: segundo fator real, inválido, ativação e proibição de replay', async ({
  page,
}) => {
  const email = `admin14-browser-${Date.now()}@example.test`;
  // Offline bootstrap uses private stdin; no secret appears in command arguments or output.
  execFileSync('python3', ['../../scripts/local-account-admin.py', '--synthetic-local-only'], {
    input: JSON.stringify({
      action: 'create',
      email,
      displayName: 'Administrador sintético',
      password: testPassword,
    }),
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Segundo fator administrativo' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.request.get(`${api}/auth/access/sources`)).status()).toBe(403);
  expect((await page.request.get(`${api}/occurrences`)).status()).toBe(403);
  await page.getByRole('button', { name: 'Configurar autenticador' }).click();
  await expect(page.getByLabel('Chave do autenticador (restrita)')).toBeVisible();
  const secret = await page.getByLabel('Chave do autenticador (restrita)').inputValue();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Código do autenticador').fill('000000');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Confirmar segundo fator' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#access-result')).toContainText('Código inválido');
  await expect(page.locator('#access-result')).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 720 });
  const code = totp(secret);
  await page.getByLabel('Código do autenticador').fill(code);
  await page.getByRole('button', { name: 'Confirmar segundo fator' }).click();
  await expect(page.getByTestId('event-count')).toHaveText('4');
  expect((await page.request.get(`${api}/auth/access/sources`)).status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByLabel('Código do autenticador')).toBeVisible();
  await page.getByLabel('Código do autenticador').fill(code);
  await page.getByRole('button', { name: 'Confirmar segundo fator' }).click();
  await expect(page.locator('#access-result')).toContainText('Código inválido');
  expect((await page.request.get(`${api}/auth/access/sources`)).status()).toBe(403);
});

test('indisponibilidade e carregamento reais não liberam acesso', async ({ page }) => {
  await loginUser(page.request);
  execFileSync('podman', ['pause', 'vetor-api-ticket12-db']);
  try {
    await page.goto('/?consulta=api');
    await expect(page.getByText('Verificando acesso…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
    await expect(page.locator('#access-result')).toContainText(/indisponível|conexão/);
    await expect(page.getByTestId('event-count')).toHaveCount(0);
  } finally {
    execFileSync('podman', ['unpause', 'vetor-api-ticket12-db']);
  }
  await page.reload();
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
});
