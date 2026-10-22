import { expect, test, type Page } from '@playwright/test';

test.use({ actionTimeout: 10_000 });

test.beforeEach(async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-10-15T15:00:00Z'));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
});

async function openWithSyntheticUserSession(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        code: 'SESSION',
        message: 'Sessão sintética para teste público',
        authenticated: true,
        role: 'USER',
        csrfToken: 'synthetic-ticket-11',
      },
    }),
  );
  await page.route('**/api/v1/auth/access/**', (route) =>
    route.fulfill({
      json: {
        code: 'AUTHENTICATED',
        message: 'Acesso sintético para módulo USER',
        accountId: 'synthetic-ticket-11-user',
        role: 'USER',
        authenticated: true,
        mfaEnrolled: false,
        csrfToken: 'synthetic-ticket-11',
      },
    }),
  );
  await page.goto('/');
}

test('rodapé apresenta G1 como placeholder e separa exemplos sintéticos com e sem URL', async ({
  page,
}, testInfo) => {
  const g1Requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://g1.globo.com')) g1Requests.push(request.url());
  });
  await openWithSyntheticUserSession(page);
  await page.locator('[data-quick-category="SEGURANCA"]').click();
  const sourceLink = page.getByRole('link', { name: 'Conheça nossas fontes', exact: true });
  await expect(sourceLink).toBeVisible({ timeout: 3000 });
  await sourceLink.focus();
  await page.keyboard.press('Enter');
  const title = page.getByRole('heading', { name: 'Conheça nossas fontes', exact: true });
  await expect(title).toBeFocused();
  const content = page.getByRole('region', { name: 'Conheça nossas fontes', exact: true });
  await expect(
    content.getByRole('link', { name: 'G1 — Rio de Janeiro', exact: true }),
  ).toHaveAttribute('href', 'https://g1.globo.com/rj/rio-de-janeiro/');
  await expect(content).toContainText('Placeholder não avaliado');
  await expect(content).toContainText('Coleta desativada');
  await expect(
    content.getByRole('link', { name: 'Fonte fictícia — Demonstração local', exact: true }),
  ).toHaveAttribute('href', 'https://example.invalid/fontes/demo');
  const noUrl = content.getByRole('article').filter({ hasText: 'Canal fictício sem URL pública' });
  await expect(noUrl).toContainText('Sem URL pública');
  await expect(noUrl.getByRole('link')).toHaveCount(0);
  await expect(content).not.toContainText(/ISP-RJ|OTT360|Fogo Cruzado|COR-Rio/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('sources-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(sourceLink).toBeFocused();
  await expect(page.locator('[data-quick-category="SEGURANCA"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.locator('.result-list > li')).toHaveCount(12);
  expect(g1Requests).toEqual([]);
});

test('explicação da nota abre pelo detalhe e devolve foco sem perder ocorrência ou filtros', async ({
  page,
}, testInfo) => {
  await openWithSyntheticUserSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Lista/ }).click();
  await page.locator('[data-result-detail-toggle="demo-002"]').click();
  const detail = page.locator('[data-result-detail="demo-002"]');
  const evaluationLink = detail.getByRole('link', {
    name: 'Entenda nossa avaliação de confiabilidade',
    exact: true,
  });
  await expect(evaluationLink).toBeVisible({ timeout: 3000 });
  await evaluationLink.focus();
  await page.keyboard.press('Enter');
  const content = page.getByRole('region', {
    name: 'Entenda nossa avaliação de confiabilidade',
    exact: true,
  });
  await expect(content.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(content).toContainText('qualidade e precisão');
  await expect(content).toContainText('confirmação independente');
  await expect(content).toContainText('divergências');
  await expect(content).toContainText('não é uma probabilidade');
  await expect(content).toContainText('notas são fictícias');
  await expect(content).not.toContainText(
    /40\/40\/20|bônus|penalidade|peso|nota da fonte|equação|amostra mínima/i,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('evaluation-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(evaluationLink).toBeFocused();
  await expect(detail).toContainText('3 ocorrências · 1 acontecimento');
  await expect(detail).toContainText('Canal fictício sem URL pública');
  await expect(detail.getByRole('link', { name: /Publicação fictícia/ })).toHaveCount(2);
  await expect(page.locator('.result-list > li')).toHaveCount(17);
  await expect(
    detail.getByText('Confiabilidade da ocorrência: 3 / 5', { exact: true }),
  ).toBeVisible();
});

test('páginas públicas retornam ao histórico e preservam a consulta demonstrativa', async ({
  page,
}) => {
  // A página de fontes é pública e abre pelo rodapé, sem exigir sessão.
  await page.goto('/');
  const publicEntry = page.getByRole('link', { name: 'Conheça nossas fontes', exact: true });
  await publicEntry.click();
  const sources = page.locator('section[aria-labelledby="public-sources-heading"]');
  await expect(sources).toContainText('G1 — Rio de Janeiro');
  await expect(sources).not.toContainText(/ISP-RJ|OTT360|Fogo Cruzado|COR-Rio/);
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(publicEntry).toBeFocused();

  // O percurso do Histórico é de módulo e usa sessão sintética, sem testar autenticação neste ticket.
  await openWithSyntheticUserSession(page);
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Buscar título, descrição ou identificador' })
    .fill('Interdição parcial simulada');
  await page.getByRole('button', { name: 'Abrir detalhes e proveniência' }).click();
  const evaluationLink = page
    .locator('.workspace-detail')
    .getByRole('link', { name: 'Entenda nossa avaliação de confiabilidade', exact: true });
  await evaluationLink.click();
  const sourceLink = page.getByRole('link', { name: 'Conheça nossas fontes', exact: true });
  await sourceLink.click();
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(
    page.getByRole('heading', { name: 'Entenda nossa avaliação de confiabilidade', exact: true }),
  ).toBeVisible();
  await expect(sourceLink).toBeFocused();
  await page.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(evaluationLink).toBeFocused();
  await expect(
    page.getByRole('searchbox', { name: 'Buscar título, descrição ou identificador' }),
  ).toHaveValue('Interdição parcial simulada');
  await expect(page.locator('.history-record')).toHaveCount(1);
  await expect(page.locator('.workspace-detail')).toContainText('Canal fictício sem URL pública');
});

test('rodapé permite consultar termos, privacidade, metodologia e correções sem login com foco e retorno preservados', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  // 1. Termos de uso
  const termsLink = page.getByRole('link', { name: 'Termos de uso', exact: true });
  await expect(termsLink).toBeVisible();
  await termsLink.focus();
  await page.keyboard.press('Enter');
  const termsHeading = page.getByRole('heading', { name: 'Termos de uso', exact: true });
  await expect(termsHeading).toBeFocused();
  const termsSection = page.getByRole('region', { name: 'Termos de uso', exact: true });
  await expect(termsSection).toContainText('Rascunho de revisão local');
  await expect(termsSection).toContainText('Versão demonstrativa v1.4 · 22/10/2026');
  await expect(termsSection).toContainText('não constitui canal de emergência');
  await expect(termsSection).toContainText('registros sintéticos e fictícios');
  await expect(termsSection).toContainText('190');
  await termsSection.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(termsLink).toBeFocused();

  // 2. Política de privacidade
  const privacyLink = page.getByRole('link', { name: 'Privacidade', exact: true });
  await privacyLink.click();
  const privacyHeading = page.getByRole('heading', {
    name: 'Política de privacidade',
    exact: true,
  });
  await expect(privacyHeading).toBeFocused();
  const privacySection = page.getByRole('region', { name: 'Política de privacidade', exact: true });
  await expect(privacySection).toContainText('Rascunho de revisão local');
  await expect(privacySection).toContainText('Versão demonstrativa v1.4 · 22/10/2026');
  await expect(privacySection).toContainText('Consulta na demonstração local');
  await expect(privacySection).toContainText('módulos de consulta exigem sessão autenticada');
  await expect(privacySection).toContainText(
    'documentos institucionais continuam acessíveis sem autenticação',
  );
  await expect(privacySection).not.toContainText('permite consulta sem login');
  await expect(privacySection).toContainText('endereços residenciais privados');
  await expect(privacySection).toContainText(
    '60 dias para uso, 180 dias para segurança e 365 dias para operação administrativa',
  );
  await privacySection.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(privacyLink).toBeFocused();

  // 3. Metodologia dos dados
  const methodologyLink = page.getByRole('link', { name: 'Metodologia dos dados', exact: true });
  await methodologyLink.click();
  const methodHeading = page.getByRole('heading', { name: 'Metodologia dos dados', exact: true });
  await expect(methodHeading).toBeFocused();
  const methodSection = page.getByRole('region', { name: 'Metodologia dos dados', exact: true });
  await expect(methodSection).toContainText('Rascunho de revisão local');
  await expect(methodSection).toContainText('Versão demonstrativa v1.4 · 22/10/2026');
  await expect(methodSection).toContainText('Clipping');
  await expect(methodSection).toContainText('Ocorrência');
  await expect(methodSection).toContainText('Acontecimento');
  await expect(methodSection).toContainText('regra versionada');
  await expect(methodSection).toContainText('revisão humana');
  await expect(methodSection).not.toContainText('cálculo operacional permanece desativado');
  await expect(methodSection).toContainText('não comprovam cobertura operacional');
  await expect(methodSection).toContainText('Dados de Riscos');
  await expect(methodSection).toContainText('julho de 2026');
  await expect(methodSection).toContainText('1.671 polígonos');
  await expect(methodSection).toContainText('classificação segundo a fonte');
  await expect(methodSection).not.toContainText('usa polígonos sintéticos de demonstração');
  await expect(methodSection).toContainText('não recebem pinos inventados');
  await expect(methodSection).not.toContainText(/peso|equação|amostra mínima|40\/40\/20/i);
  await methodSection.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(methodologyLink).toBeFocused();

  // 4. Procedimento de correções
  const correctionsLink = page.getByRole('link', {
    name: 'Procedimento de correções',
    exact: true,
  });
  await correctionsLink.click();
  const correctionsHeading = page.getByRole('heading', {
    name: 'Procedimento de correções',
    exact: true,
  });
  await expect(correctionsHeading).toBeFocused();
  const correctionsSection = page.getByRole('region', {
    name: 'Procedimento de correções',
    exact: true,
  });
  await expect(correctionsSection).toContainText('Rascunho de revisão local');
  await expect(correctionsSection).toContainText('Versão demonstrativa v1.4 · 22/10/2026');
  await expect(correctionsSection).toContainText('Distinção entre correção e novo registro');
  await expect(correctionsSection).toContainText('não deve ser usada para relatar um novo fato');
  await expect(correctionsSection).toContainText('canal privado local exige autenticação');
  await expect(correctionsSection).toContainText('O pedido não altera o registro automaticamente');
  await expect(correctionsSection).toContainText(
    'Recebida, Em análise, Concluída e Não procedente',
  );
  await expect(correctionsSection).not.toContainText(
    'Na versão operacional futura, haverá formulário',
  );

  // Testar responsividade móvel em 390px
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('institutional-mobile.png'), fullPage: true });

  await correctionsSection.getByRole('button', { name: 'Voltar à consulta de origem' }).click();
  await expect(correctionsLink).toBeFocused();
});
