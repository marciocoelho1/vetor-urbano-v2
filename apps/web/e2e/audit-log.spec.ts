import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { api, confirmedUser, testPassword } from './helpers/local-account';

test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige HTTP Java e PostGIS sintético real.');
test.use({ actionTimeout: 10_000, trace: 'off', screenshot: 'off' });

function sql(command: string): void {
  const container = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  if (!container) throw new Error('Informe o banco sintético exclusivo.');
  execFileSync(
    'podman',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'vetor_urbano',
    ],
    { input: command, stdio: ['pipe', 'pipe', 'pipe'] },
  );
}
function totp(value: string): string {
  let bits = '';
  for (const character of value)
    bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(character).toString(2).padStart(5, '0');
  const secret = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', secret).update(counter).digest();
  return String((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

test('ADMIN consulta logs reais com teclado, foco, carregamento, vazio, erro e recuperação em 390 px', async ({
  page,
}, testInfo) => {
  const email = await confirmedUser(page.request, 'audit19');
  sql(`UPDATE local_accounts SET role='ADMIN' WHERE email='${email}';`);
  const login = await page.request.post(`${api}/auth/login`, {
    data: { email, password: testPassword },
  });
  expect(login.status()).toBe(200);
  const headers = { 'X-CSRF-Token': (await login.json()).csrfToken };
  const enrollment = await page.request.post(`${api}/auth/mfa/enrollment`, { data: {}, headers });
  expect(enrollment.status()).toBe(200);
  const verified = await page.request.post(`${api}/auth/mfa/verification`, {
    data: { code: totp((await enrollment.json()).secret) },
    headers,
  });
  expect(verified.status()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  const open = page.getByRole('button', { name: 'Logs administrativos', exact: true });
  await open.focus();
  await expect(open).toBeFocused();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/admin/logs?**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('audit-loading')).toBeVisible();
  release();
  await expect(page.getByTestId('audit-loading')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Logs administrativos' })).toBeFocused();
  await page.getByLabel('Classe de retenção').selectOption('USE');
  await page.getByRole('button', { name: 'Atualizar registros' }).click();
  await expect(page.getByTestId('audit-events')).toContainText('CONSULTATION');
  await expect(page.getByTestId('query-loading-banner')).toBeHidden();
  sql("UPDATE auth_audit_events SET occurred_at=now()-interval '70 days' WHERE module='query';");
  await page.getByRole('button', { name: 'Atualizar registros' }).click();
  await expect(page.getByTestId('audit-empty')).toBeVisible();
  const database = process.env['VETOR_E2E_DATABASE_CONTAINER']!;
  execFileSync('podman', ['pause', database]);
  try {
    await page.getByRole('button', { name: 'Atualizar registros' }).click();
    await expect(page.getByTestId('audit-error')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('audit-empty')).toBeHidden();
  } finally {
    execFileSync('podman', ['unpause', database]);
  }
  await page.getByLabel('Classe de retenção').selectOption('ADMIN');
  await page.getByRole('button', { name: 'Atualizar registros' }).click();
  await expect(page.getByTestId('audit-events')).toContainText('LOG_READ');
  const fullHeaders = { 'X-CSRF-Token': (await verified.json()).csrfToken };
  const sourceDraft = {
    name: `Fonte sintética 19 ${testInfo.project.name}`,
    channel: 'Canal sintético',
    territories: ['Rio de Janeiro'],
    pillars: ['TRANSITO'],
    accessMethod: 'MANUAL',
    rating: 3,
    ratingJustification: 'Avaliação fictícia.',
  };
  const created = await page.request.post(`${api}/admin/sources`, {
    headers: fullHeaders,
    data: sourceDraft,
  });
  expect(created.status()).toBe(201);
  const source = await created.json();
  expect(
    (
      await page.request.put(`${api}/admin/sources/${source.id}`, {
        headers: fullHeaders,
        data: { ...sourceDraft, expectedVersion: 1, rating: 4 },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Atualizar registros' }).click();
  const updated = page
    .getByTestId('audit-events')
    .locator('li')
    .filter({ hasText: 'UPDATE · SUCCEEDED' })
    .first();
  await updated.getByText('Parâmetros e antes/depois').click();
  await expect(updated.locator('pre')).toContainText('"before"');
  await expect(updated.locator('pre')).toContainText('"rating": 3');
  await expect(updated.locator('pre')).toContainText('"rating": 4');
  for (let index = 0; index < 51; index++)
    expect(
      (
        await page.request.get(
          `${api}/occurrences?periodStart=2026-10-14T15:00:00Z&periodEnd=2026-10-15T15:00:00Z`,
        )
      ).status(),
    ).toBe(200);
  await page.getByLabel('Classe de retenção').selectOption('USE');
  await page.getByRole('button', { name: 'Atualizar registros' }).click();
  await expect(page.getByRole('button', { name: 'Carregar mais antigos' })).toBeVisible();
  await page.getByLabel('Classe de retenção').selectOption('SECURITY');
  await expect(page.getByRole('button', { name: 'Carregar mais antigos' })).toBeHidden();
  await page.getByRole('button', { name: 'Atualizar registros' }).click();
  await expect(page.getByTestId('audit-events')).toContainText('SECURITY');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('app-audit-log').screenshot({ path: testInfo.outputPath('audit-mobile.png') });
});
