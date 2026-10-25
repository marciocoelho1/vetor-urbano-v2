import { expect, test } from '@playwright/test';
import { fixtureSql, syntheticDatabaseContainer } from './synthetic-admin';

const env = (
  globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }
).process.env;

test('five-point families select only their explicit isolated database', () => {
  const oldContainer = env['VETOR_E2E_DATABASE_CONTAINER'];
  const oldDatabase = env['VETOR_E2E_DATABASE_NAME'];
  try {
    env['VETOR_E2E_DATABASE_CONTAINER'] = 'vu-uxh01-five-db';
    env['VETOR_E2E_DATABASE_NAME'] = 'vetor_renewal';
    expect(syntheticDatabaseContainer('vu-uxh01-five-db')).toBe('vu-uxh01-five-db');
    expect(() => syntheticDatabaseContainer('vu-uxh01-resume-db')).toThrow('Este fluxo exige');
    env['VETOR_E2E_DATABASE_NAME'] = 'vetor_urbano';
    expect(() => syntheticDatabaseContainer()).toThrow('base sintética');
  } finally {
    if (oldContainer === undefined) delete env['VETOR_E2E_DATABASE_CONTAINER'];
    else env['VETOR_E2E_DATABASE_CONTAINER'] = oldContainer;
    if (oldDatabase === undefined) delete env['VETOR_E2E_DATABASE_NAME'];
    else env['VETOR_E2E_DATABASE_NAME'] = oldDatabase;
  }
});

test('isolated resume accepts only the new explicitly authorized container', () => {
  const previous = env['VETOR_E2E_DATABASE_CONTAINER'];
  try {
    env['VETOR_E2E_DATABASE_CONTAINER'] = 'vu-uxh01-resume-db';
    expect(() => syntheticDatabaseContainer()).toThrow('explicitamente permitido');
    for (const rejected of [
      'vu-ticket29-e2e-db',
      'vu-fogo-cruzado-db',
      '',
      'vu-uxh01-resume-db;id',
    ]) {
      env['VETOR_E2E_DATABASE_CONTAINER'] = rejected;
      expect(() => fixtureSql('SELECT 1')).toThrow('explicitamente permitido');
    }
  } finally {
    if (previous === undefined) delete env['VETOR_E2E_DATABASE_CONTAINER'];
    else env['VETOR_E2E_DATABASE_CONTAINER'] = previous;
  }
});

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
