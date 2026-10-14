import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const require = createRequire(`${root}/apps/web/package.json`);
const { chromium, firefox, expect } = require('@playwright/test');
const output = resolve(process.env.VU_CAPTURE_DIR ?? `${root}/apps/web/test-results/ui-ux-gallery`);
await mkdir(output, { recursive: true });
const metadata = { capturedAt: new Date().toISOString(), url: 'http://127.0.0.1:4210', records: '71 fixtures sintéticas do gerador existente; relógio fixo 13/10/2026 18:00Z', views: [], checks: [], errors: [], tileStatuses: {} };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1120 } });
page.on('pageerror', error => metadata.errors.push(error.message));
page.on('response', response => { if (response.url().includes('tiles.stadiamaps.com')) metadata.tileStatuses[response.status()] = (metadata.tileStatuses[response.status()] ?? 0) + 1; });
async function readyMap(currentPage) {
  await expect.poll(() => currentPage.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(0);
  await expect.poll(() => currentPage.locator('.leaflet-tile:not(.leaflet-tile-loaded)').count()).toBe(0);
  await expect.poll(() => currentPage.locator('.leaflet-tile-loaded').evaluateAll(tiles => tiles.every(tile => Number(getComputedStyle(tile).opacity) > 0.99))).toBe(true);
}
async function ensureParity(currentPage) {
  await expect.poll(() => currentPage.locator('.gallery-marker').count()).toBe(await currentPage.locator('.gallery-result').count());
}
async function ensureLayout(currentPage) {
  await expect.poll(() => currentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function ensureInitialCamera(currentPage) {
  await expect.poll(() => currentPage.evaluate(() => {
    const component = window.ng.getComponent(document.querySelector('vu-gallery-map'));
    const center = component.map.getCenter();
    // Leaflet rounds at the pixel grid; 0.0005° allows <2 px at zoom 12.
    return Math.abs(center.lng + 43.19156) < 0.0005 && Math.abs(center.lat + 22.90332) < 0.0005;
  })).toBe(true);
  await expect.poll(() => currentPage.evaluate(() => {
    const bounds = document.querySelector('.gallery-map-canvas').getBoundingClientRect();
    return [...document.querySelectorAll('.gallery-marker')].some(marker => {
      const box = marker.getBoundingClientRect();
      return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
    });
  })).toBe(true);
}
async function switchTo(currentPage, variant) {
  await currentPage.getByRole('button', { name: new RegExp(`^Proposta ${variant}:`) }).click();
  await expect(currentPage.locator('.gallery-root')).toHaveAttribute('data-variant', String(variant));
}
async function openFilters(currentPage) {
  const button = currentPage.locator('.filter-disclosure');
  if (await button.count() && await button.getAttribute('aria-expanded') === 'false') await button.click();
}
async function capture(currentPage, variant, mode, width, height) {
  await ensureLayout(currentPage);
  await currentPage.evaluate(() => scrollTo(0, 0));
  const filename = `proposal-${variant}-${mode}.png`;
  await currentPage.screenshot({ path: `${output}/${filename}`, fullPage: true });
  metadata.views.push({ variant, width, height, filename, resultCount: await currentPage.locator('.gallery-result').count() });
}
try {
  await page.goto(metadata.url);
  const variantCount = await page.locator('.dock-options button').count();
  await page.evaluate(() => document.fonts.ready);
  for (let variant = 1; variant <= variantCount; variant++) {
    await switchTo(page, variant);
    await readyMap(page);
    await ensureParity(page);
    await ensureInitialCamera(page);
    await capture(page, variant, 'desktop', 1440, 1120);
    metadata.checks.push(`Chromium: proposta ${variant}, desktop, mapa/lista iguais e tiles reais completos`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (let variant = 1; variant <= variantCount; variant++) {
    await switchTo(page, variant);
    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
    await readyMap(page);
    await ensureInitialCamera(page);
    await expect(page.locator('.gallery-map-pane')).toBeVisible();
    await expect(page.locator('.gallery-results-pane')).toBeHidden();
    await capture(page, variant, 'mobile-map', 390, 844);
    await page.getByRole('button', { name: /^Lista / }).click();
    await expect(page.locator('.gallery-map-pane')).toBeHidden();
    await expect(page.locator('.gallery-results-pane')).toBeVisible();
    await capture(page, variant, 'mobile-list', 390, 844);
    metadata.checks.push(`Chromium: proposta ${variant}, 390 px, Mapa/Lista e consulta preservada`);
  }
  await page.getByRole('button', { name: /Comparar/ }).click();
  await expect(page.locator('dialog')).toBeVisible();
  await page.screenshot({ path: `${output}/comparison-mobile.png`, fullPage: true });
  metadata.views.push({ filename: 'comparison-mobile.png', width: 390, height: 844, view: 'comparison' });
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: /Comparar/ })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1120 });
  await switchTo(page, 1);
  await page.locator('#gallery-place').fill('Tijuca');
  await page.locator('#gallery-place').press('Enter');
  await expect(page.locator('#gallery-place')).toHaveValue('Tijuca, Rio de Janeiro');
  await page.getByRole('combobox', { name: 'Período da consulta' }).selectOption('3');
  await page.getByRole('slider', { name: 'Raio da consulta em metros' }).evaluate(input => { input.value = '10000'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-category="TRANSITO"]').click();
  await expect(page.locator('[data-record-id^="demo-transito"]')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Ordenar resultados' }).selectOption('distance');
  await expect.poll(async () => {
    const values = (await page.locator('.record-meta span').allTextContents()).map(value => Number(value.split(' km')[0].replace(',', '.')));
    return values.every((value, index) => index === 0 || value >= values[index - 1]);
  }).toBe(true);
  const resultIds = await page.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.dataset.recordId));
  expect(resultIds.length).toBeGreaterThan(0);
  await page.locator('[data-record-id]').first().click();
  const selectedId = resultIds[0];
  await expect(page.locator(`[data-record-id="${selectedId}"]`)).toHaveAttribute('aria-expanded', 'true');
  for (let variant = 1; variant <= variantCount; variant++) {
    await switchTo(page, variant);
    await openFilters(page);
    await expect(page.locator('#gallery-place')).toHaveValue('Tijuca, Rio de Janeiro');
    await expect(page.getByRole('combobox', { name: 'Período da consulta' })).toHaveValue('3');
    await expect(page.getByRole('slider', { name: 'Raio da consulta em metros' })).toHaveValue('10000');
    await expect(page.locator('[data-category="TRANSITO"]')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.dataset.recordId))).toEqual(resultIds);
    await expect(page.locator(`[data-record-id="${selectedId}"]`)).toHaveAttribute('aria-expanded', 'true');
    await ensureParity(page);
    await expect(page.locator('.gallery-marker.is-selected')).toHaveCount(1);
    metadata.checks.push(`Chromium: proposta ${variant}, endereço/período/raio/categorias/ordem/seleção preservados`);
  }
  await page.screenshot({ path: `${output}/selected-result-desktop.png`, fullPage: true });
  metadata.views.push({ filename: 'selected-result-desktop.png', width: 1440, height: 1120, view: 'selected' });
  await page.locator('[data-category="SEGURANCA"]').click();
  await page.locator('[data-category="CONTINGENCIA"]').click();
  await expect(page.locator('.gallery-empty')).toBeVisible();
  await ensureParity(page);
  await page.locator('.gallery-empty .primary-action').click();
  await expect(page.locator('.gallery-result')).toHaveCount(71);
  await expect(page.getByRole('slider', { name: 'Raio da consulta em metros' })).toBeDisabled();
  await ensureParity(page);
  metadata.checks.push('Chromium: nenhuma categoria → vazio; limpar → 71 registros, raio desativado e igualdade mapa/lista');
  await page.locator('#gallery-place').fill('Rua inexistente');
  await expect(page.locator('.no-suggestion')).toBeVisible();
  await page.locator('#gallery-place').press('Escape');
  await expect(page.locator('.gallery-suggestions')).toHaveCount(0);
  await page.locator('#gallery-place').fill('Caxias');
  await page.locator('#gallery-place').press('ArrowDown');
  await page.locator('#gallery-place').press('Enter');
  await expect(page.locator('#gallery-place')).toHaveValue('Centro, Duque de Caxias');
  await page.getByRole('button', { name: 'Escolher no mapa', exact: true }).click();
  await expect(page.locator('.gallery-pick-message')).toBeVisible();
  const canvas = page.locator('.gallery-map-canvas');
  await canvas.click({ position: { x: 100, y: 160 } });
  await expect(page.locator('#gallery-place')).toHaveValue('Ponto escolhido no mapa');
  await expect(page.locator('.gallery-pick-message')).toHaveCount(0);
  await ensureParity(page);
  metadata.checks.push('Chromium: autocomplete por teclado, sugestão inexistente/Escape e seleção explícita do centro no mapa');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.gallery-root')).toHaveAttribute('data-variant', '1');
  await page.locator('#gallery-place').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.gallery-root')).toHaveAttribute('data-variant', '1');
  await readyMap(page);
  await page.locator('.gallery-map-canvas').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.gallery-root')).toHaveAttribute('data-variant', '1');
  metadata.checks.push('Chromium: setas trocam proposta fora dos controles e respeitam edição/mapa');
  await page.getByRole('button', { name: 'Sobre os dados', exact: true }).click();
  await expect(page.locator('dialog')).toContainText('71 registros');
  await page.getByRole('button', { name: 'Fechar diálogo' }).click();
  await page.getByRole('button', { name: 'Como consultar', exact: true }).click();
  await expect(page.locator('dialog .help-steps li')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Comparar/ }).click();
  await page.locator('.comparison-option[data-preview="4"]').click();
  await expect(page.locator('.gallery-root')).toHaveAttribute('data-variant', '4');
  await expect(page).toHaveURL(/variant=4/);
  await page.reload();
  await expect(page.locator('.gallery-root')).toHaveAttribute('data-variant', '4');
  await expect(page.locator('#gallery-place')).toHaveValue('Centro, Rio de Janeiro');
  metadata.checks.push('Chromium: diálogos funcionam, URL conserva variante e recarga restaura consulta de exemplo');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await readyMap(page);
  await ensureLayout(page);
  await page.setViewportSize({ width: 320, height: 780 });
  for (let variant = 1; variant <= variantCount; variant++) {
    await switchTo(page, variant);
    await ensureLayout(page);
    await page.getByRole('button', { name: /^Lista / }).click();
    await expect(page.locator('.gallery-results-pane')).toBeVisible();
    await ensureLayout(page);
    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
    await readyMap(page);
    await ensureLayout(page);
  }
  await capture(page, variantCount, '320-map', 320, 780);
  metadata.checks.push(`Chromium: ${variantCount} variantes a 320 px, Mapa/Lista sem rolagem horizontal; desktop 1920 px`);
  const failurePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  failurePage.on('pageerror', error => metadata.errors.push(error.message));
  await failurePage.route('https://tiles.stadiamaps.com/**', route => route.abort());
  await failurePage.goto(`${metadata.url}/?variant=2`);
  await expect(failurePage.locator('.gallery-map-message')).toContainText('O mapa-base não carregou');
  await failurePage.getByRole('button', { name: /^Lista / }).click();
  await expect(failurePage.locator('.gallery-result')).toHaveCount(9);
  await failurePage.locator('[data-record-id]').first().click();
  await expect(failurePage.locator('.record-details:visible')).toHaveCount(1);
  metadata.checks.push('Chromium: falha de tiles provocada mantém lista, filtros e detalhes disponíveis');
  await failurePage.close();
  const firefoxBrowser = await firefox.launch();
  try {
    const firefoxPage = await firefoxBrowser.newPage({ viewport: { width: 1440, height: 1050 } });
    firefoxPage.on('pageerror', error => metadata.errors.push(error.message));
    await firefoxPage.goto(metadata.url);
    for (let variant = 1; variant <= variantCount; variant++) {
      await switchTo(firefoxPage, variant);
      await readyMap(firefoxPage);
      await ensureParity(firefoxPage);
      await ensureLayout(firefoxPage);
      await firefoxPage.setViewportSize({ width: 320, height: 780 });
      await firefoxPage.getByRole('button', { name: /^Lista / }).click();
      await ensureLayout(firefoxPage);
      if (await firefoxPage.locator('[data-record-id]').first().getAttribute('aria-expanded') === 'false') await firefoxPage.locator('[data-record-id]').first().click();
      await expect(firefoxPage.locator('.record-details:visible')).toHaveCount(1);
      await firefoxPage.getByRole('button', { name: 'Mapa', exact: true }).click();
      await readyMap(firefoxPage);
      await ensureLayout(firefoxPage);
      await firefoxPage.setViewportSize({ width: 1440, height: 1050 });
      metadata.checks.push(`Firefox: proposta ${variant}, mapa real, detalhes, 320 px e consulta preservada`);
    }
    metadata.firefox = firefoxBrowser.version();
  } finally { await firefoxBrowser.close(); }
  expect(metadata.errors).toEqual([]);
  metadata.chromium = browser.version();
  metadata.status = 'passed';
  console.log(JSON.stringify({ status: metadata.status, views: metadata.views.length, checks: metadata.checks.length, errors: metadata.errors, tileStatuses: metadata.tileStatuses }));
} catch (error) {
  metadata.status = 'failed';
  metadata.failure = error.message;
  await page.screenshot({ path: `${output}/review-failure.png`, fullPage: true });
  throw error;
} finally { await writeFile(`${output}/review.json`, `${JSON.stringify(metadata, null, 2)}\n`); await browser.close(); }
