import { expect, test, type Page } from '@playwright/test';

/**
 * UXH-09 — passada 1: área visível aplicada sem ocultar contexto.
 *
 * O ticket pede, no navegador:
 *  - ação explícita ("Buscar nesta área") aplica o recorte e sincroniza;
 *  - a tela **distingue** a área aplicada da câmera atual ("Área do mapa
 *    alterada" quando a câmera muda depois da aplicação);
 *  - filtros continuam aplicados — nada é removido em silêncio para evitar vazio;
 *  - camada de Áreas de Risco fica ativa **sem** virar ocorrência, contagem ou
 *    intensidade.
 *
 * Limite declarado desta passada: a régua mede o DOM. A prova por IDs,
 * requisições e bordas espaciais em HTTP/PostGIS é a passada 2, com a pilha
 * sintética, e não é substituída por esta.
 */

const VIEWPORTS = [390, 1440];

async function abrir(page: Page, largura: number): Promise<void> {
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de área visível',
    authenticated: true,
    role: 'USER',
    csrfToken: 'synthetic-area',
  };
  await page.route('**/api/v1/auth/session', (rota) => rota.fulfill({ json: sessao }));
  await page.route('**/api/v1/auth/access/**', (rota) => rota.fulfill({ json: sessao }));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (rota) =>
    rota.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
  if (largura <= 768) {
    const disclosure = page.locator('[data-vu="sheet-disclosure"]');
    if ((await disclosure.count()) > 0) {
      await disclosure
        .first()
        .click({ timeout: 3000 })
        .catch(() => undefined);
      await page.waitForTimeout(250);
    }
    const lista = page.getByRole('button', { name: /^Lista/ });
    if ((await lista.count()) > 0) {
      await lista
        .first()
        .click({ timeout: 3000 })
        .catch(() => undefined);
      await page.waitForTimeout(250);
    }
  }
}

/** Relê todo texto de aviso/estado visível na tela. */
async function avisos(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="status"], .query-note, .search-message'))
      .filter((elemento) => {
        const rect = elemento.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((elemento) => (elemento.textContent ?? '').trim().replace(/\s+/g, ' '))
      .filter(Boolean),
  );
}

for (const largura of VIEWPORTS) {
  test(`UXH-09: "Buscar nesta área" aplica e declara a área a ${largura}`, async ({ page }) => {
    await abrir(page, largura);
    const antes = await avisos(page);
    const chipPilar = page.locator('button', { hasText: 'Remover pilar Trânsito' });
    const pilarAntes = await chipPilar.count();

    const aplicar = page.getByRole('button', { name: 'Buscar nesta área' });
    await expect(aplicar, 'ação explícita de área ausente').toHaveCount(1);
    await aplicar.click({ timeout: 5000 });
    await page.waitForTimeout(600);

    const depois = await avisos(page);
    const novos = depois.filter((texto) => !antes.includes(texto));
    console.log(`${largura}px: avisos novos após aplicar = ${JSON.stringify(novos)}`);

    // A tela tem de dizer o que foi aplicado — e distinguir da câmera.
    // Só vale a mensagem **nova** e específica da aplicação: um `query-note`
    // estático que também fala em "recorte" passaria por engano.
    const declaracao = novos.find((texto) => /área visível aplicada/i.test(texto));
    expect(declaracao, 'aplicar a área não declarou nada na tela').toBeTruthy();
    console.log(`  declaração: "${declaracao}"`);

    // Filtros não podem ser removidos em silêncio para evitar vazio.
    expect(await chipPilar.count(), 'filtro de pilar removido ao aplicar a área').toBe(pilarAntes);
  });
}

test('UXH-09: a tela distingue câmera atual da área aplicada', async ({ page }) => {
  await abrir(page, 1440);
  await page.getByRole('button', { name: 'Buscar nesta área' }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
  const texto = await page.evaluate(() =>
    (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' '),
  );
  const distingue = /área do mapa alterada|área aplicada|câmera atual/i.test(texto);
  console.log(`distingue câmera × área aplicada: ${distingue}`);
  expect(
    distingue,
    'nenhum texto distingue a área aplicada da câmera atual — "Área do mapa alterada" não existe na tela',
  ).toBe(true);
});

test('UXH-09: camada de Áreas de Risco não vira ocorrência nem contagem', async ({ page }) => {
  await abrir(page, 1440);
  const contar = async (): Promise<number> => {
    const lista = page.locator('.result-list > li');
    return lista.count();
  };
  const antes = await contar();
  const camada = page.getByLabel('Exibir Áreas de Risco');
  await expect(camada, 'controle de camada de Áreas de Risco ausente').toHaveCount(1);
  await camada.check({ timeout: 5000 });
  await page.waitForTimeout(700);
  const depois = await contar();
  console.log(`ocorrências na lista: ${antes} → ${depois}`);
  expect(depois, 'ligar a camada de Áreas de Risco mudou a contagem de ocorrências').toBe(antes);
});

test('controle negativo: esconder o aviso de área reprova o caso', async ({ page }) => {
  await abrir(page, 1440);
  await page.getByRole('button', { name: 'Buscar nesta área' }).click({ timeout: 5000 });
  await page.waitForTimeout(500);
  const antes = await avisos(page);
  await page.addStyleTag({ content: '.query-note { display: none !important; }' });
  await page.waitForTimeout(200);
  const depois = await avisos(page);
  console.log(`negativo: avisos ${antes.length} → ${depois.length}`);
  expect(depois.length, 'a régua não viu o aviso escondido').toBeLessThan(antes.length);
});
