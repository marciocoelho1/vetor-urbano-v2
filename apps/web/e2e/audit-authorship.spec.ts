import { expect, test } from '@playwright/test';
import { api, confirmedUser, testPassword } from './helpers/local-account';
import { fixtureSql, syntheticAdmin } from './helpers/synthetic-admin';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API e PostGIS sintéticos reais.');
test.use({ trace: 'off', screenshot: 'off' });

test('Administrador distingue autoria viva e histórica após encerramento real em 390 px', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await syntheticAdmin(page, page.request);
  const subject = await browser.newContext();
  try {
    const email = await confirmedUser(subject.request, 'historical-author');
    const actor = fixtureSql(`SELECT id FROM local_accounts WHERE email='${email}'`);
    const login = await subject.request.post(`${api}/auth/login`, {
      data: { email, password: testPassword },
    });
    expect(login.status()).toBe(200);
    const { csrfToken } = await login.json();
    const open = page.getByRole('button', { name: 'Logs administrativos', exact: true });
    await open.focus();
    await expect(open).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Logs administrativos' })).toBeFocused();
    await page.getByLabel('Classe de retenção').selectOption('SECURITY');
    await page.getByRole('button', { name: 'Atualizar registros' }).click();
    await expect(page.getByTestId('audit-events')).toContainText(actor);
    const before = await page.request.get(`${api}/admin/logs?eventClass=SECURITY`);
    expect(before.status()).toBe(200);
    const live = (await before.json()).items.find(
      (item: { actor: string; action: string }) => item.actor === actor && item.action === 'LOGIN',
    );
    expect(live).toBeTruthy();
    expect(live.historicalActor).toBeNull();
    const closed = await subject.request.post(`${api}/account/closure`, {
      headers: { 'X-CSRF-Token': csrfToken },
      data: { currentPassword: testPassword },
    });
    expect(closed.status()).toBe(200);
    const after = await page.request.get(`${api}/admin/logs?eventClass=SECURITY`);
    expect(after.status()).toBe(200);
    const body = await after.json();
    const historical = body.items.find((item: { id: string }) => item.id === live.id);
    expect(historical.actor).toBeNull();
    expect(historical.historicalActor).toMatch(/^[0-9a-f-]{36}$/);
    expect(historical.historicalActor).not.toBe(actor);
    expect(JSON.stringify(body)).not.toContain(actor);
    const refresh = page.getByRole('button', { name: 'Atualizar registros' });
    await refresh.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('audit-events')).toContainText(
      `Autor histórico: ${historical.historicalActor}`,
    );
    await expect(page.getByTestId('audit-events')).not.toContainText(actor);
    await expect(refresh).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await subject.close();
  }
});
