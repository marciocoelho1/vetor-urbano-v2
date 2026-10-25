import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { confirmedUser, testPassword } from './helpers/local-account';

test.skip(process.env['VETOR_ACCOUNTS_E2E'] !== '1', 'Exige API e PostGIS sintéticos isolados.');
test.use({ trace: 'off', screenshot: 'off', actionTimeout: 15000 });

/** Cada projeto de navegador recomeça do mesmo estado sintético: nada é herdado da rodada anterior. */
function resetPublicationFixture(
  fixtureSql: (sql: string) => string,
  target: string,
  title: string,
): void {
  fixtureSql(
    'TRUNCATE correction_editor_audit, occurrence_editor_preparations, correction_decisions, correction_requests CASCADE',
  );
  fixtureSql(
    `UPDATE occurrences SET title='${title}', revision=GREATEST(revision, COALESCE((SELECT max(version) FROM publication_versions WHERE occurrence_id='${target}'), 1)), publication_status='PUBLISHED', withdrawn_at=NULL, description=description WHERE id='${target}'`,
  );
}

/** Titular abre o pedido em um contexto próprio, para não reutilizar a sessão ADMIN. */
async function requestCorrection(
  browser: Browser,
  request: APIRequestContext,
  prefix: string,
  target: string,
  explanation: string,
): Promise<void> {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4201',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const email = await confirmedUser(request, prefix);
  await page.goto('/?consulta=api');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Minha conta', exact: true })).toBeVisible();
  await page.locator('#corrections-link').click();
  const channel = page.locator('app-correction-channel');
  await channel.getByLabel('Identificador do alvo').fill(target);
  await channel.getByLabel('Explicação', { exact: true }).fill(explanation);
  await channel.getByLabel('Referências restritas').fill(`Referência privada sintética ${prefix}`);
  await channel.getByRole('button', { name: 'Enviar pedido de correção' }).click();
  await expect(channel.getByText(/Recebida · versão 1/)).toBeVisible();
  await context.close();
}

/** A fila administrativa é aberta no pedido do titular e a edição da publicação é revelada. */
async function openQueueItem(
  page: import('@playwright/test').Page,
  target: string,
  explanation: string,
  afterOpen?: (item: import('@playwright/test').Locator) => Promise<void>,
): Promise<import('@playwright/test').Locator> {
  const queue = page.locator('app-correction-channel');
  await expect(
    queue.getByRole('heading', { name: 'Solicitar e acompanhar correção' }),
  ).toBeVisible();
  await queue.getByRole('button', { name: 'Fila administrativa de correções' }).click();
  const item = queue.locator('li').filter({ hasText: explanation }).last();
  await item.getByLabel('Motivo visível ao solicitante').fill('Conferência iniciada');
  // A ação pertence ao pedido aberto: com mais de um item na fila a busca global seria ambígua.
  await item.getByRole('button', { name: 'Iniciar análise' }).click();
  await expect(item.getByText(/Em análise/)).toBeVisible();
  // The completed decision deliberately moves focus to feedback after reloading the queue.
  // Observe that keyboard stop before moving on, rather than racing its scheduled focus.
  await expect(
    queue.getByRole('status').filter({ hasText: 'Solicitação registrada.' }),
  ).toBeFocused();
  const editorButton = item.getByRole('button', { name: `Abrir edição da publicação ${target}` });
  await editorButton.focus();
  await expect(editorButton).toBeFocused();
  await page.keyboard.press('Enter');
  await afterOpen?.(item);
  await expect(item.getByLabel('Ação sobre o registro')).toBeVisible();
  return item;
}

test('ADMIN prepara, aprova nova versão e confere o endereço publicado', async ({
  page,
  request,
  browser,
}) => {
  const { syntheticAdmin, fixtureSql } = await import('./helpers/synthetic-admin');
  const target = 'vu-demo-occurrence-traffic-001';
  resetPublicationFixture(fixtureSql, target, 'Colisão demonstrativa');
  await page.setViewportSize({ width: 390, height: 844 });
  await syntheticAdmin(page, request);
  await page.locator('#corrections-link').click();
  const correctionChannel = page.locator('app-correction-channel');
  await correctionChannel.getByRole('button', { name: 'Fila administrativa de correções' }).click();
  await expect(correctionChannel.getByText('Nenhum pedido nesta fila.')).toBeVisible();
  await correctionChannel.getByRole('button', { name: 'Meus pedidos' }).click();
  await requestCorrection(
    browser,
    request,
    'requester18a',
    target,
    'Título sintético divergente do publicado',
  );

  let releasePublication!: () => void;
  let failPublication = true;
  const publicationGate = new Promise<void>((resolve) => {
    releasePublication = resolve;
  });
  await page.route('**/api/v1/admin/corrections/*/publication', async (route) => {
    if (failPublication) {
      await publicationGate;
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.continue();
  });
  const item = await openQueueItem(
    page,
    target,
    'Título sintético divergente do publicado',
    async (openedItem) => {
      try {
        expect(await openedItem.getByLabel('Título corrigido').count()).toBe(0);
        await expect(
          openedItem.getByRole('status').filter({ hasText: 'Carregando editor da publicação' }),
        ).toBeVisible();
      } finally {
        releasePublication();
      }
      await expect(
        page.getByRole('status').filter({ hasText: 'Não foi possível acessar o canal' }),
      ).toBeVisible();
      expect(await openedItem.getByLabel('Título corrigido').count()).toBe(0);
      failPublication = false;
      const retryButton = openedItem.getByRole('button', {
        name: `Abrir edição da publicação ${target}`,
      });
      await retryButton.focus();
      await page.keyboard.press('Enter');
    },
  );
  await expect(item.getByLabel('Título corrigido')).toBeVisible();
  await expect(item.getByLabel('Título corrigido')).toHaveValue('');
  await expect(item.getByLabel('Motivo da preparação')).toHaveValue('');
  await expect(item.getByLabel('Evidência da conferência')).toHaveValue('');

  await item.getByLabel('Título corrigido').fill('Título corrigido sintético 18');
  await expect(item.getByLabel('Título corrigido')).toHaveValue('Título corrigido sintético 18');

  await item.getByLabel('Motivo da preparação').fill('Referência independente conferida');
  await item.getByLabel('Evidência da conferência').fill('Segunda referência sintética');
  const preparationRequestPromise = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/publication/preparations'),
  );
  await item.getByRole('button', { name: 'Preparar alteração sem publicar' }).click();
  const preparationRequest = await preparationRequestPromise;
  expect(preparationRequest.postDataJSON()).toMatchObject({
    action: 'CORRECTION',
    changes: { title: 'Título corrigido sintético 18' },
    reason: 'Referência independente conferida',
    evidence: 'Segunda referência sintética',
  });
  await expect(item.getByText(/Preparação: PREPARED/)).toBeVisible();
  // Preparar não altera o que está publicado.
  expect(fixtureSql(`SELECT title FROM occurrences WHERE id='${target}'`)).toBe(
    'Colisão demonstrativa',
  );

  await item.getByLabel('Motivo da decisão final').fill('Correção aprovada com evidência');
  await item.getByRole('button', { name: 'Aprovar e aplicar nova versão' }).click();
  await expect(item.getByText(/Concluída/)).toBeVisible();
  expect(fixtureSql(`SELECT title FROM occurrences WHERE id='${target}'`)).toBe(
    'Título corrigido sintético 18',
  );
  expect(
    fixtureSql(
      `SELECT count(*) FROM correction_editor_audit WHERE action='CORRECTION_APPLIED' AND author_id IS NOT NULL`,
    ),
  ).not.toBe('0');

  const queue = page.locator('app-correction-channel');
  await queue.getByLabel('Identificador do registro').fill(target);
  await queue.getByRole('button', { name: 'Conferir registro' }).click();
  await expect(queue.getByText(/PUBLISHED —/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('retirada por erro essencial torna o endereço indisponível sem repetir o conteúdo', async ({
  page,
  request,
  browser,
}) => {
  const { syntheticAdmin, fixtureSql } = await import('./helpers/synthetic-admin');
  const target = 'vu-demo-occurrence-contingency-002';
  resetPublicationFixture(fixtureSql, target, 'Bloqueio demonstrativo na borda do raio');
  await requestCorrection(browser, request, 'requester18b', target, 'Fato demonstrado incorreto');

  await page.setViewportSize({ width: 390, height: 844 });
  await syntheticAdmin(page, request);
  await page.locator('#corrections-link').click();
  const item = await openQueueItem(page, target, 'Fato demonstrado incorreto');

  await item.getByLabel('Ação sobre o registro').selectOption('RETRACTION');
  await item.getByLabel('Razão essencial da retirada').selectOption('FATO_INCORRETO');
  await item.getByLabel('Motivo da preparação').fill('Erro essencial demonstrado');
  await item.getByLabel('Evidência da conferência').fill('Duas referências sintéticas');
  await item.getByRole('button', { name: 'Preparar alteração sem publicar' }).click();
  await expect(item.getByText(/Preparação: PREPARED/)).toBeVisible();
  // Preparar a retirada ainda mantém o registro publicado.
  expect(fixtureSql(`SELECT publication_status FROM occurrences WHERE id='${target}'`)).toBe(
    'PUBLISHED',
  );

  await item.getByLabel('Motivo da decisão final').fill('Retirada confirmada pela Administração');
  await item.getByRole('button', { name: 'Aprovar e aplicar nova versão' }).click();
  await expect(item.getByText(/Concluída/)).toBeVisible();
  expect(fixtureSql(`SELECT publication_status FROM occurrences WHERE id='${target}'`)).toBe(
    'WITHDRAWN',
  );
  expect(fixtureSql(`SELECT withdrawn_at IS NOT NULL FROM occurrences WHERE id='${target}'`)).toBe(
    't',
  );

  const queue = page.locator('app-correction-channel');
  await queue.getByLabel('Identificador do registro').fill(target);
  await queue.getByRole('button', { name: 'Conferir registro' }).click();
  await expect(queue.getByText(/UNAVAILABLE —/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
