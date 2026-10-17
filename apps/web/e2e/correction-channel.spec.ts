import { expect, test } from '@playwright/test';
import { confirmedUser, testPassword } from './helpers/local-account';

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
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4201',
    viewport: { width: 390, height: 844 },
  });
  const admin = await context.newPage();
  await syntheticAdmin(admin, request);
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
  await channel.getByRole('button', { name: 'Atualizar pedidos' }).click();
  await expect(
    channel.getByText(
      'Motivo da decisão: Referência conferida; registro correto sem alteração material',
    ),
  ).toBeVisible();
  expect(
    fixtureSql(
      "SELECT count(*) FROM correction_decisions WHERE state='COMPLETED' AND author_id IS NOT NULL",
    ),
  ).not.toBe('0');
  await context.close();
});
