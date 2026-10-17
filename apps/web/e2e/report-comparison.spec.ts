import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { loginUser } from './helpers/local-account';

test.skip(process.env['VETOR_PERSISTED_E2E'] !== '1', 'Exige API Java e PostGIS reais.');
test.use({ actionTimeout: 15_000, trace: 'off', screenshot: 'off' });

test('comparação A/B usa snapshots explícitos, duração, variação e limitações', async ({
  page,
}) => {
  await loginUser(page.request);
  await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('vetor-consultation-mode', 'advanced');
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
  await page.goto('/?consulta=api');
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await page.getByTestId('report-generate-from-map').click();
  const saveA = page.getByRole('button', { name: 'Usar relatório como base A', exact: true });
  await saveA.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('report-comparison-pending')).toContainText(
    'Selecione o recorte B',
  );
  await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
  await page.getByRole('combobox', { name: 'Período da consulta', exact: true }).selectOption('1w');
  await expect(page.getByTestId('event-count')).toHaveText('4');
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await page.getByTestId('report-generate-from-map').click();
  await page.getByTestId('report-transfer-replace').click();
  await page.getByRole('button', { name: 'Usar relatório como recorte B', exact: true }).click();
  const comparison = page.getByTestId('report-comparison');
  await expect(comparison).toContainText('Variação B − A: 0 ocorrências');
  await expect(comparison).toContainText('Percentual: 0%');
  await expect(comparison).toContainText('1 dias de 24 horas');
  await expect(comparison).toContainText('7 dias de 24 horas');
  await expect(comparison).toContainText('Média diária não calculável');
  await expect(
    comparison.getByText(
      'Inclusão temporal: 3 certamente · 1 possivelmente · 0 sem classificação.',
      { exact: true },
    ),
  ).toHaveCount(2);
  await expect(comparison).toContainText('Cobertura não aferida');
  await expect(
    comparison.getByRole('table', { name: 'Comparação — Pilar', exact: true }),
  ).toContainText('Contingência');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(comparison).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('média de registros disponíveis compara 4/2 dias e 6/3 dias sem taxa de risco', async ({
  page,
}) => {
  const sql = (text: string) =>
    execFileSync('podman', [
      'exec',
      'vu-ticket30-db',
      'psql',
      '-U',
      'postgres',
      '-d',
      'vetor_urbano',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      text,
    ]);
  sql(`INSERT INTO occurrences (id,happening_id,title,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,occurred_at,publication_status)
    SELECT 'vu-compare-'||n,happening_id,'Comparação sintética '||n,description,category,occurrence_type,subtype,situation,reliability_score,municipality,neighborhood,location_precision,location,
    CASE WHEN n<=4 THEN '2026-10-01T12:00:00Z'::timestamptz ELSE '2026-10-04T12:00:00Z'::timestamptz END,publication_status
    FROM occurrences CROSS JOIN generate_series(1,10) n WHERE id='vu-demo-occurrence-traffic-001'`);
  try {
    await loginUser(page.request);
    await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
    await page.addInitScript(() => {
      localStorage.setItem('vetor-consultation-mode', 'advanced');
      Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined });
    });
    await page.route('https://tiles.stadiamaps.com/**', (route) => route.abort());
    await page.goto('/?consulta=api');
    let generated = false;
    const generateWindow = async (start: string, end: string, count: string) => {
      await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
      await page
        .getByRole('combobox', { name: 'Período da consulta', exact: true })
        .selectOption('custom');
      await page.getByLabel('Início (horário de Brasília)', { exact: true }).fill(start);
      await page.getByLabel('Início (horário de Brasília)', { exact: true }).blur();
      await page.getByLabel('Fim (horário de Brasília; exclusivo)', { exact: true }).fill(end);
      await page.getByLabel('Fim (horário de Brasília; exclusivo)', { exact: true }).blur();
      await expect(page.getByTestId('query-loading-banner')).toBeHidden();
      await expect(page.getByTestId('event-count')).toHaveText(count);
      await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
      await page.getByTestId('report-generate-from-map').click();
      if (generated) await page.getByTestId('report-transfer-replace').click();
      generated = true;
      await expect(page.getByTestId('report-snapshot-counts')).toContainText(
        count + ' ocorrências',
      );
    };
    await page
      .getByRole('combobox', { name: 'Município (demonstração)', exact: true })
      .selectOption('Rio de Janeiro');
    await page
      .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
      .selectOption('Centro');
    await generateWindow('2026-10-01T00:00', '2026-10-03T00:00', '4');
    await page.getByRole('button', { name: 'Usar relatório como base A', exact: true }).click();
    await generateWindow('2026-10-04T00:00', '2026-10-07T00:00', '6');
    await page.getByRole('button', { name: 'Usar relatório como recorte B', exact: true }).click();
    const comparison = page.getByTestId('report-comparison');
    await expect(comparison).toContainText('Variação B − A: +2 ocorrências');
    await expect(comparison).toContainText('Percentual: +50%');
    await expect(
      comparison.getByText('Média de registros disponíveis por dia: 2.', { exact: true }),
    ).toHaveCount(2);
    await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
      .selectOption('Setor demonstrativo');
    await expect(page.getByTestId('event-count')).toHaveText('0');
    await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
    await page.getByTestId('report-generate-from-map').click();
    await page.getByTestId('report-transfer-replace').click();
    await expect(page.getByTestId('report-empty')).toBeVisible();
    await expect(comparison).toContainText('Variação B − A: +2 ocorrências');
    await page.getByRole('button', { name: 'Usar relatório como base A', exact: true }).click();
    await expect(comparison).toContainText('Variação B − A: +6 ocorrências');
    await expect(comparison).toContainText(
      'Percentual: não calculável — base zero ou filtros não comparáveis',
    );
    await expect(comparison).toContainText('Média de registros disponíveis por dia: 0.');
    await expect(comparison).toContainText('Setor demonstrativo');
    await expect(comparison).toContainText('Centro');
    await expect(comparison).toContainText('Cobertura não aferida');
    await expect(comparison).not.toContainText('Infinity');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await comparison.screenshot({ path: '/tmp/vu31-comparison-mobile.png' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Mapa público', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Bairro (demonstração)', exact: true })
      .selectOption('Centro');
    await generateWindow('2026-10-04T09:00', '2026-10-04T09:01', '6');
    await page.getByRole('button', { name: 'Usar relatório como recorte B', exact: true }).click();
    await expect(comparison).toContainText('Duração: 0,000694 dias de 24 horas');
  } finally {
    sql("DELETE FROM occurrences WHERE id LIKE 'vu-compare-%'");
  }
});
