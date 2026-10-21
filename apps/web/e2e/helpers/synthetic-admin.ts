import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { confirmedUser, testPassword } from './local-account';

const databaseByContainer: Record<string, string> = {
  // This fixture round is restricted to the dedicated PostGIS on 127.0.0.1:55440.
  'vu-ticket29-e2e-db': 'vetor_urbano',
};

/** Só permite contêineres sintéticos explicitamente aprovados para as fixtures locais. */
export function syntheticDatabaseContainer(expectedContainer?: string): string {
  const container = process.env['VETOR_E2E_DATABASE_CONTAINER'];
  if (!container || !Object.prototype.hasOwnProperty.call(databaseByContainer, container)) {
    throw new Error('Exige contêiner PostGIS sintético explicitamente permitido.');
  }
  if (expectedContainer !== undefined && container !== expectedContainer) {
    throw new Error(`Este fluxo exige o contêiner PostGIS sintético ${expectedContainer}.`);
  }
  return container;
}

/** Only explicitly allowlisted synthetic databases may receive these fixtures. */
export function fixtureSql(sql: string, expectedContainer?: string): string {
  const container = syntheticDatabaseContainer(expectedContainer);
  const database = databaseByContainer[container]!;
  const postgresUser = execFileSync('podman', ['exec', container, 'printenv', 'POSTGRES_USER'])
    .toString()
    .trim();
  if (!/^[a-zA-Z0-9_]+$/.test(postgresUser)) throw new Error('Usuário de fixture inválido.');
  return execFileSync('podman', [
    'exec',
    container,
    'psql',
    '-U',
    postgresUser,
    '-d',
    database,
    '-v',
    'ON_ERROR_STOP=1',
    '-tAc',
    sql,
  ])
    .toString()
    .trim();
}
function code(secret: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, ''))
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', bytes).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
export async function loginBrowser(page: Page, email: string): Promise<void> {
  await page.goto('/?consulta=api');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}
export async function syntheticAdmin(
  page: Page,
  request: APIRequestContext,
  expectedContainer?: string,
): Promise<void> {
  syntheticDatabaseContainer(expectedContainer);
  const email = await confirmedUser(request, 'admin-batch');
  if (!/^[a-z0-9@.\-]+$/.test(email)) throw new Error('Identificador de fixture inválido.');
  fixtureSql(`UPDATE local_accounts SET role='ADMIN' WHERE email='${email}'`, expectedContainer);
  await loginBrowser(page, email);
  await page.getByRole('button', { name: 'Configurar autenticador' }).click();
  const secret = await page.getByLabel('Chave do autenticador (restrita)').inputValue();
  await page.getByLabel('Código do autenticador', { exact: true }).fill(code(secret));
  await page.getByRole('button', { name: 'Confirmar segundo fator' }).click();
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
}
