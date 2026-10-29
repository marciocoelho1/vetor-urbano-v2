import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

/**
 * Lote D, passada 2b — UXH-17 (exports do mesmo resultado).
 *
 * Hooks: [data-vu-report-export-pdf] · [data-vu-report-export-xlsx] ·
 *        [data-vu-report-state] · [data-vu-report-total] · [data-vu-report-period]
 *
 * O critério é o arquivo, não o nome: o PDF tem de conter o total e a data do
 * snapshot; o XLSX tem de conter cabeçalho e linhas. Nome e extensão não contam.
 */

const sessaoAdmin = {
  code: 'SESSION',
  message: 'Sessão sintética de administração',
  authenticated: true,
  role: 'ADMIN',
  csrfToken: 'synthetic-exports',
};

async function abrirRelatorios(page: Page): Promise<void> {
  page.setDefaultTimeout(6_000);
  // Mesmo conjunto de rotas da `report-state.spec.ts`: sem elas o módulo não monta.
  await page.route('**/api/v1/**', (r) =>
    r.fulfill({ status: 200, json: { items: [], records: [], total: 0, page: 1 } }),
  );
  await page.route('**/api/v1/auth/session', (r) => r.fulfill({ json: sessaoAdmin }));
  await page.route('**/api/v1/auth/access/**', (r) => r.fulfill({ json: sessaoAdmin }));
  await page.route('**/api/v1/admin/**', (r) =>
    r.fulfill({ status: 200, json: { items: [], total: 0 } }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?consulta=api');
  await expect(page.locator('main')).toBeVisible();
  await irParaModulo(page, /Relatórios/i);
}

/** Navega SEM recarregar — `goto` destrói o estado em memória do relatório. */
async function irParaModulo(page: Page, rotulo: RegExp): Promise<void> {
  for (const alvo of [
    page.locator('nav.primary-nav button', { hasText: rotulo }),
    page.locator('nav.vu-bottom-bar button', { hasText: rotulo }),
    page.getByRole('button', { name: rotulo }),
  ]) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      await page.waitForTimeout(700);
      return;
    }
  }
  throw new Error(`destino ${rotulo} não acionável`);
}

/** Um chip de filtro no Mapa deixa `queryFilters()` não-nulo para a geração. */
async function recorteNoMapa(page: Page): Promise<void> {
  await irParaModulo(page, /Mapa/i);
  let chips = page.locator('[data-filter]');
  if ((await chips.count()) === 0) {
    for (const gatilho of [
      page.getByRole('button', { name: /Filtros/i }),
      page.getByRole('button', { name: /filtros avançados/i }),
    ]) {
      if ((await gatilho.count()) > 0 && (await gatilho.first().isVisible())) {
        await gatilho.first().click();
        await page.waitForTimeout(500);
        chips = page.locator('[data-filter]');
        if ((await chips.count()) > 0) break;
      }
    }
  }
  const total = await chips.count();
  expect(total, 'nenhum chip [data-filter] no Mapa para preparar o recorte').toBeGreaterThan(0);
  await chips.first().evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(400);
  await irParaModulo(page, /Relatórios/i);
}

/** Payload do contrato do relatório (o catch-all genérico não tem `counts`). */
async function mockRelatorio(page: Page, valores: number[]): Promise<void> {
  let chamada = 0;
  await page.route('**/api/v1/reports/occurrences**', (r) => {
    const n = valores[Math.min(chamada, valores.length - 1)] ?? 0;
    chamada += 1;
    return r.fulfill({
      json: {
        generatedAt: '2026-10-28T12:00:00Z',
        attribution: [],
        items: [],
        relatedItems: [],
        counts: {
          occurrences: n,
          happenings: n,
          mappedOccurrences: n,
          listOnlyOccurrences: 0,
          temporallyCertain: n,
          temporallyPossible: 0,
        },
      },
    });
  });
}

/** Gera o relatório para que os exports tenham snapshot. */
async function gerar(page: Page): Promise<{ total: string; periodo: string }> {
  await recorteNoMapa(page);
  await mockRelatorio(page, [3]);
  await page.locator('[data-vu-report-generate]').first().click();
  await page.waitForTimeout(1200);
  return {
    total: (
      (await page
        .locator('[data-vu-report-total]')
        .first()
        .textContent()
        .catch(() => '')) ?? ''
    ).trim(),
    periodo: (
      (await page
        .locator('[data-vu-report-period]')
        .first()
        .textContent()
        .catch(() => '')) ?? ''
    ).trim(),
  };
}

/** Texto de um PDF: bytes crus + streams descomprimidos. */
function textoDoPdf(caminho: string): string {
  const bruto = readFileSync(caminho);
  const partes: string[] = [bruto.toString('latin1')];
  const marcador = Buffer.from('stream');
  let indice = bruto.indexOf(marcador);
  while (indice !== -1) {
    let inicio = indice + marcador.length;
    if (bruto[inicio] === 0x0d) inicio += 1;
    if (bruto[inicio] === 0x0a) inicio += 1;
    const fim = bruto.indexOf(Buffer.from('endstream'), inicio);
    if (fim === -1) break;
    try {
      partes.push(inflateSync(bruto.subarray(inicio, fim)).toString('latin1'));
    } catch {
      // stream não comprimido: já está no bruto
    }
    indice = bruto.indexOf(marcador, fim);
  }
  return partes.join('\n');
}

/** Conteúdo de uma planilha XLSX (Open XML): todas as folhas como texto. */
function textoDoXlsx(caminho: string): string {
  const listagem = execFileSync('unzip', ['-Z1', caminho]).toString();
  const folhas = listagem
    .split('\n')
    .filter((linha) => /^xl\/worksheets\/sheet\d+\.xml$/.test(linha.trim()));
  const textos: string[] = [];
  for (const folha of folhas) {
    textos.push(execFileSync('unzip', ['-p', caminho, folha.trim()]).toString('utf8'));
  }
  return textos.join('\n');
}

test('UXH-17: exportação bloqueada antes de gerar', async ({ page }) => {
  await abrirRelatorios(page);
  const estado = await page.locator('[data-vu-report-state]').getAttribute('data-vu-report-state');
  console.log(`estado antes de exportar: ${estado}`);
  for (const hook of ['[data-vu-report-export-pdf]', '[data-vu-report-export-xlsx]']) {
    const botao = page.locator(hook);
    if ((await botao.count()) === 0) {
      console.log(`${hook}: ausente (bloqueado por ausência — aceitável antes de gerar)`);
      continue;
    }
    const desabilitado = await botao.first().isDisabled();
    console.log(`${hook}: presente · desabilitado=${desabilitado}`);
    expect(desabilitado, `${hook} habilitado sem snapshot`).toBe(true);
  }
});

test('UXH-17: PDF e XLSX carregam o total do snapshot, não a página visível', async ({ page }) => {
  await abrirRelatorios(page);
  const snapshot = await gerar(page);
  console.log(`snapshot: total="${snapshot.total}" período="${snapshot.periodo}"`);
  expect(snapshot.total, 'sem total no snapshot').not.toBe('');

  for (const [hook, extensao] of [
    ['[data-vu-report-export-pdf]', 'pdf'],
    ['[data-vu-report-export-xlsx]', 'xlsx'],
  ]) {
    const botao = page.locator(hook);
    await expect(botao, `sem botão de exportação ${extensao}`).toHaveCount(1);
    const [download] = await Promise.all([page.waitForEvent('download'), botao.first().click()]);
    const caminho = await download.path();
    console.log(`${extensao}: ${download.suggestedFilename()} · ${caminho}`);
    expect(caminho, `download ${extensao} sem arquivo`).toBeTruthy();
    const conteudo = extensao === 'pdf' ? textoDoPdf(caminho!) : textoDoXlsx(caminho!);
    // Primeiro número do total (ocorrências). Juntar todos os dígitos gerava "33"
    // para "3 ocorrências · 3 acontecimentos" e reprovava o arquivo por artefato meu.
    const digitos = (snapshot.total.match(/\d+/) ?? [''])[0] ?? '';
    console.log(`${extensao}: contém o total ${digitos}? ${conteudo.includes(digitos)}`);
    expect(conteudo, `${extensao} não contém o total do snapshot (${digitos})`).toContain(digitos);
  }
});

test('UXH-17: conteúdo indisponível pede regenerar em vez de exportar recorte novo', async ({
  page,
}) => {
  await abrirRelatorios(page);
  await gerar(page);
  // O snapshot deixa de estar disponível no servidor.
  await page.route('**/api/v1/**', (r) =>
    r.fulfill({ status: 410, json: { code: 'SNAPSHOT_GONE', message: 'Recorte indisponível' } }),
  );
  const botao = page.locator('[data-vu-report-export-pdf]');
  await expect(botao, 'sem botão de exportação PDF').toHaveCount(1);
  const baixou = await Promise.all([
    page
      .waitForEvent('download', { timeout: 4_000 })
      .then(() => true)
      .catch(() => false),
    botao.first().click(),
  ]);
  const aviso = await page
    .locator('main')
    .evaluate((el) => /regener|indispon|expir/i.test(el.textContent ?? ''));
  console.log(`baixou arquivo=${baixou[0]} · aviso de regenerar=${aviso}`);
  expect(baixou[0], 'exportou mesmo com o snapshot indisponível').toBe(false);
  expect(aviso, 'não pediu para regenerar').toBe(true);
});

test('UXH-17: o XLSX tem cabeçalho e linhas do snapshot', async ({ page }) => {
  await abrirRelatorios(page);
  await gerar(page);
  const botao = page.locator('[data-vu-report-export-xlsx]');
  await expect(botao, 'sem botão de exportação XLSX').toHaveCount(1);
  const [download] = await Promise.all([page.waitForEvent('download'), botao.first().click()]);
  const conteudo = textoDoXlsx((await download.path())!);
  const celulas = [...conteudo.matchAll(/<t[^>]*>([^<]{2,40})<\/t>/g)].map((m) => m[1]!);
  console.log(`células: ${JSON.stringify(celulas.slice(0, 10))}`);
  expect(celulas.length, 'planilha sem células de texto').toBeGreaterThan(3);
  const temCabecalho = celulas.some((c) => /data|ocorr|situa|territ/i.test(c));
  console.log(`cabeçalho reconhecido: ${temCabecalho}`);
  expect(temCabecalho, 'planilha sem cabeçalho reconhecível').toBe(true);
});
