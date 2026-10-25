import { expect, test } from '@playwright/test';
import { api, confirmedUser, testPassword } from './helpers/local-account';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API e PostGIS sintéticos isolados.');
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15000 });
test('pedido privado persistido, teclado, vazio, carga, erro e 390px', async ({
  page,
  request,
}) => {
  const email = await confirmedUser(request, 'correction27');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?consulta=api');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
  await page.locator('#corrections-link').click();
  const channel = page.locator('app-correction-channel');
  await expect(channel.getByText('Nenhum pedido nesta fila.')).toBeVisible();
  await channel.getByLabel('Identificador do alvo').fill('vu-demo-occurrence-traffic-001');
  await channel
    .getByLabel('Explicação', { exact: true })
    .fill('Conferir localização sintética no original');
  await channel.getByLabel('Referências restritas').fill('Referência privada sintética 27');
  await channel.getByRole('button', { name: 'Enviar pedido de correção' }).focus();
  await page.keyboard.press('Enter');
  await expect(channel.getByText(/Recebida · versão 1/)).toBeVisible();
  await expect(channel.locator('[role="status"]').last()).toBeFocused();
  await page.reload();
  await page.locator('#corrections-link').click();
  await expect(channel.getByText(/Recebida · versão 1/)).toBeVisible();
  await page.route('**/api/v1/corrections', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.abort();
  });
  await channel.getByRole('button', { name: 'Atualizar pedidos' }).click();
  await expect(channel.getByText('Carregando pedidos…')).toBeVisible();
  await expect(channel.getByText(/Não foi possível|Failed to fetch|NetworkError/)).toBeVisible();
  await page.unroute('**/api/v1/corrections');
  await channel.getByRole('button', { name: 'Atualizar pedidos' }).click();
  await expect(channel.getByText(/Recebida · versão 1/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('ADMIN MFA decide e titular acompanha motivo privado e versão aplicada', async ({
  page,
  request,
  browser,
}) => {
  const { syntheticAdmin, loginBrowser, fixtureSql } = await import('./helpers/synthetic-admin');
  const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;
  const reference = `Documento sintético 27-${Date.now()}`;
  const email = await confirmedUser(request, 'requester27');
  await loginBrowser(page, email);
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
  await page.locator('#corrections-link').click();
  const channel = page.locator('app-correction-channel');
  await channel.getByLabel('Identificador do alvo').fill('vu-demo-occurrence-traffic-001');
  await channel.getByLabel('Explicação', { exact: true }).fill('Conferir referência factual');
  await channel.getByLabel('Referências restritas').fill(reference);
  await channel.getByRole('button', { name: 'Enviar pedido de correção' }).click();
  await expect(channel.getByText(/Recebida · versão 1/)).toBeVisible();
  const requesterResponse = await page.request.get(`${api}/auth/session`);
  expect(requesterResponse.status()).toBe(200);
  const requesterSession = await requesterResponse.json();
  expect(requesterSession).toMatchObject({ role: 'USER', authenticated: true });
  expect(
    fixtureSql(`SELECT email FROM local_accounts WHERE id=${quote(requesterSession.accountId)}`),
  ).toBe(email);
  const requestsResponse = await page.request.get(`${api}/corrections`);
  expect(requestsResponse.status()).toBe(200);
  const requests = await requestsResponse.json();
  const ownRequest = requests.items.find(
    (entry: { private_references: string }) => entry.private_references === reference,
  );
  expect(ownRequest).toBeDefined();
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4201',
    viewport: { width: 390, height: 844 },
  });
  const admin = await context.newPage();
  try {
    await syntheticAdmin(admin, context.request);
    const adminResponse = await context.request.get(`${api}/auth/session`);
    expect(adminResponse.status()).toBe(200);
    const adminSession = await adminResponse.json();
    expect(adminSession).toMatchObject({ role: 'ADMIN', authenticated: true });
    expect(adminSession.accountId).not.toBe(requesterSession.accountId);
    await admin.locator('#corrections-link').click();
    const queue = admin.locator('app-correction-channel');
    await queue.getByRole('button', { name: 'Fila administrativa de correções' }).click();
    const item = queue.locator('li').filter({ hasText: reference }).last();
    await item.getByLabel('Motivo visível ao solicitante').fill('Conferência iniciada');
    await item.getByRole('button', { name: 'Iniciar análise' }).click();
    await expect(item.getByText(/Em análise · versão 2/)).toBeVisible();
    await item
      .getByLabel('Motivo visível ao solicitante')
      .fill('Referência conferida; registro correto sem alteração material');
    await item.getByRole('button', { name: 'Concluir com motivo' }).focus();
    await admin.keyboard.press('Enter');
    await expect(item.getByText(/Concluída · versão 3/)).toBeVisible();
    const stillRequester = await page.request.get(`${api}/auth/session`);
    expect(stillRequester.status()).toBe(200);
    expect(await stillRequester.json()).toMatchObject({
      accountId: requesterSession.accountId,
      role: 'USER',
      authenticated: true,
    });
    await channel.getByRole('button', { name: 'Atualizar pedidos' }).click();
    await expect(
      channel.getByText(
        'Motivo da decisão: Referência conferida; registro correto sem alteração material',
      ),
    ).toBeVisible();
    expect(
      fixtureSql(
        `SELECT count(*) FROM correction_decisions d JOIN correction_requests r ON r.id=d.request_id WHERE d.request_id=${quote(ownRequest.id)} AND r.requester_id=${quote(requesterSession.accountId)} AND r.target_kind='OCCURRENCE' AND r.target_id='vu-demo-occurrence-traffic-001' AND r.private_references=${quote(reference)} AND d.version=3 AND d.previous_state='IN_REVIEW' AND d.state='COMPLETED' AND d.reason='Referência conferida; registro correto sem alteração material' AND d.author_id=${quote(adminSession.accountId)}`,
      ),
    ).toBe('1');
  } finally {
    await context.close();
  }
});
