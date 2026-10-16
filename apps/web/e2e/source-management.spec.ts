import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('visitante vê apenas a lista pública e os estados de erro e vazio são recuperáveis', async ({
  page,
}) => {
  let finishFirstRequest!: () => void;
  const firstRequest = new Promise<void>((resolve) => {
    finishFirstRequest = resolve;
  });
  let attempts = 0;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/sources', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await firstRequest;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'ACCESS_UNAVAILABLE', message: 'Serviço indisponível.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto('/?consulta=api');
  const publicLink = page.locator('#public-sources-link');
  await publicLink.focus();
  await expect(publicLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('public-sources-loading')).toBeVisible();
  finishFirstRequest();
  await expect(page.getByTestId('public-sources-error')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByTestId('public-sources-empty')).toBeVisible();
  const placeholder = page.getByTestId('source-placeholder');
  await expect(placeholder.getByText('G1 — Rio de Janeiro')).toBeVisible();
  await expect(placeholder.getByText(/Coleta desativada/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test.describe('gestão autenticada de fonte em HTTP local', () => {
  test.skip(
    process.env.VETOR_SOURCE_E2E !== '1',
    'Exige API local, PostGIS e conta sintética ADMIN/MFA.',
  );

  test('ADMIN cria fonte sem URL, edita com nova versão e mantém a projeção pública mínima', async ({
    page,
  }, testInfo) => {
    const credentialsPath = process.env.VETOR_SOURCE_E2E_CREDENTIALS;
    expect(
      credentialsPath,
      'Informe o arquivo local de credenciais sintéticas sem incluí-lo no repositório.',
    ).toBeTruthy();
    const credentials = JSON.parse(readFileSync(credentialsPath!, 'utf8')) as {
      email: string;
      password: string;
      totpSecret: string;
    };
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?consulta=api');
    await page.getByLabel('E-mail').fill(credentials.email);
    await page.getByLabel('Senha').fill(credentials.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByLabel('Código do autenticador')).toBeVisible();
    const offset = testInfo.project.name === 'firefox' ? 1 : 0;
    await page.getByLabel('Código do autenticador').fill(totp(credentials.totpSecret, offset));
    await page.getByRole('button', { name: 'Confirmar segundo fator' }).click();
    let listAttempts = 0;
    let finishFirstListRequest!: () => void;
    const firstListRequest = new Promise<void>((resolve) => {
      finishFirstListRequest = resolve;
    });
    await page.route('**/api/v1/admin/sources', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      listAttempts += 1;
      if (listAttempts === 1) {
        await firstListRequest;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'ACCESS_UNAVAILABLE', message: 'Serviço indisponível.' }),
        });
        return;
      }
      if (listAttempts === 2) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        });
        return;
      }
      await route.continue();
    });
    await page.getByRole('button', { name: 'Fontes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Gestão de fontes' })).toBeVisible();
    const manager = page.locator('app-source-management');
    await expect(page.getByTestId('managed-sources-loading')).toBeVisible();
    finishFirstListRequest();
    await expect(page.getByTestId('managed-sources-error')).toBeVisible();
    await manager.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByTestId('managed-sources-empty')).toBeVisible();
    await manager.getByRole('button', { name: 'Atualizar lista' }).click();
    await expect(page.getByTestId('managed-sources-loading')).toBeHidden();

    await manager.getByRole('button', { name: 'Nova fonte' }).click();
    await expect(page.locator('#source-name')).toBeFocused();
    const suffix = `${testInfo.project.name}-${Date.now()}`;
    const originalName = `Fonte sintética ${suffix}`;
    const revisedName = `Fonte revisada ${suffix}`;
    await manager.getByLabel('Nome da fonte').fill(originalName);
    await manager.getByLabel('Canal concreto').fill(`Canal local ${suffix}`);
    await manager.getByLabel('Territórios, um por linha').fill('Rio de Janeiro');
    await manager.getByLabel('Forma de acesso registrada').selectOption('MANUAL');
    await manager.getByLabel('Nota interna (1 a 5)').selectOption('3');
    await manager
      .getByLabel('Justificativa administrativa')
      .fill('Avaliação fictícia de teste local.');
    await manager.getByRole('button', { name: 'Cadastrar fonte', exact: true }).click();
    await expect(page.getByTestId('source-form-status')).toContainText(
      `${originalName} salva na versão 1`,
    );
    let card = page.locator('.managed-source-card').filter({ hasText: originalName });
    await expect(card).toContainText('Sem URL pública; a fonte continua válida.');
    const sourceId = await card.getAttribute('data-source-id');
    expect(sourceId).toBeTruthy();

    await card.getByRole('button', { name: 'Histórico de versões' }).click();
    await expect(card.getByRole('heading', { name: /Versão 1/ })).toBeVisible();
    await card.getByRole('button', { name: 'Editar' }).click();
    await expect(page.locator('#source-name')).toBeFocused();
    await manager.getByLabel('Nome da fonte').fill(revisedName);
    await manager.getByLabel('Canal concreto').fill(`Canal revisado ${suffix}`);
    await manager.getByLabel('Nota interna (1 a 5)').selectOption('4');
    await manager
      .getByLabel('Justificativa administrativa')
      .fill('Segunda avaliação fictícia da mesma fonte.');
    await manager.getByRole('button', { name: 'Salvar nova versão' }).click();
    await expect(page.getByTestId('source-form-status')).toContainText(
      `${revisedName} salva na versão 2`,
    );
    card = page.locator('.managed-source-card').filter({ hasText: revisedName });
    await expect(card).toHaveAttribute('data-source-id', sourceId!);
    await card.getByRole('button', { name: 'Histórico de versões' }).click();
    await expect(card.getByRole('heading', { name: /Versão 2/ })).toBeVisible();
    await expect(card.getByRole('heading', { name: /Versão 1/ })).toBeVisible();

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page.getByText('Sessão encerrada.')).toBeVisible();
    const visitorLink = page.locator('#public-sources-link');
    await visitorLink.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('source-placeholder')).toBeVisible();
    const publicCard = page
      .locator('.public-source-list .source-card')
      .filter({ hasText: revisedName });
    await expect(publicCard).toContainText(revisedName);
    await expect(publicCard).toContainText('Sem link público disponível.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    const publicResponse = await page.request.get('http://127.0.0.1:8080/api/v1/sources');
    expect(publicResponse.status()).toBe(200);
    const publicItems = (await publicResponse.json()).items as Record<string, unknown>[];
    expect(publicItems.find((item) => item.name === revisedName)).toEqual({
      name: revisedName,
      url: null,
    });
    expect((await page.request.get('http://127.0.0.1:8080/api/v1/admin/sources')).status()).toBe(
      401,
    );
  });
});

function totp(secret: string, counterOffset: number): string {
  const key = decodeBase32(secret);
  const counter = BigInt(Math.floor(Date.now() / 30_000) + counterOffset);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fff_ffff;
  return String(value % 1_000_000).padStart(6, '0');
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let buffer = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const character of value.replaceAll('=', '').toUpperCase()) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Chave TOTP sintética inválida.');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}
