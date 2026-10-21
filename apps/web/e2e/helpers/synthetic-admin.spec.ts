import { expect, test } from '@playwright/test';
import { fixtureSql, syntheticDatabaseContainer } from './synthetic-admin';

const env = (
  globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }
).process.env;

test('fixture selection rejects the protected shared database before SQL', () => {
  const previous = env['VETOR_E2E_DATABASE_CONTAINER'];
  env['VETOR_E2E_DATABASE_CONTAINER'] = 'vetor-spec-postgis';
  try {
    expect(() => syntheticDatabaseContainer()).toThrow('explicitamente permitido');
  } finally {
    if (previous === undefined) delete env['VETOR_E2E_DATABASE_CONTAINER'];
    else env['VETOR_E2E_DATABASE_CONTAINER'] = previous;
  }
});

test('fixture selection rejects other synthetic containers during this isolated round', () => {
  const previous = env['VETOR_E2E_DATABASE_CONTAINER'];
  env['VETOR_E2E_DATABASE_CONTAINER'] = 'vu-batch-27361718-db';
  try {
    expect(() => syntheticDatabaseContainer()).toThrow('explicitamente permitido');
    expect(() => fixtureSql('SELECT 1')).toThrow('explicitamente permitido');
  } finally {
    if (previous === undefined) delete env['VETOR_E2E_DATABASE_CONTAINER'];
    else env['VETOR_E2E_DATABASE_CONTAINER'] = previous;
  }
});

test('collection fixtures reject the protected shared database before SQL', () => {
  const previous = env['VETOR_E2E_DATABASE_CONTAINER'];
  env['VETOR_E2E_DATABASE_CONTAINER'] = 'vetor-spec-postgis';
  try {
    expect(() => syntheticDatabaseContainer('vu-ticket29-e2e-db')).toThrow(
      'explicitamente permitido',
    );
    expect(() => fixtureSql('SELECT 1', 'vu-ticket29-e2e-db')).toThrow('explicitamente permitido');
  } finally {
    if (previous === undefined) delete env['VETOR_E2E_DATABASE_CONTAINER'];
    else env['VETOR_E2E_DATABASE_CONTAINER'] = previous;
  }
});
