import { expect, test, type Page } from '@playwright/test';
import { confirmedUser, testPassword } from './helpers/local-account';

/**
 * UXH-20 — formulário de feedback do piloto.
 *
 * Hooks: [data-vu-feedback-rating] · -message · -submit · -done · -error (role="alert")
 *
 * Contrato (ruling): `POST /api/v1/feedback` autenticado por cookie de sessão,
 * `rating` 1–5, `message` 1–2000, `route` obrigatória; 201 com id.
 *
 * Mutações por caso:
 *   1 sem sessão      → liberar o endpoint (401 vira 201)
 *   2 rating inválido → aceitar qualquer número
 *   3 texto vazio     → aceitar string vazia
 *   4 envio válido    → não mostrar confirmação
 *   5 falha           → limpar o texto digitado ao errar
 */

const API = process.env['VETOR_E2E_API_BASE'] ?? 'http://127.0.0.1:8080/api/v1';
// Conta NOVA por execução: o endpoint tem limite de 5/min por conta, e a conta de
// demonstração já está estourada por rodadas anteriores (429 legítimo, do produto).
const USUARIO = process.env['VETOR_DEMO_USER'] ?? 'usuario@vetorurbano.test';
const SENHA = process.env['VETOR_DEMO_PASSWORD'] ?? '123456';

/** Sessão real por API: cookie jar do próprio contexto de request. */
async function sessao(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const email = await confirmedUser(request, 'feedback').catch(() => USUARIO);
  const senha = email === USUARIO ? SENHA : testPassword;
  const resposta = await request.post(`${API}/auth/login`, {
    data: { email, password: senha },
    headers: { Origin: 'http://127.0.0.1:4201' },
  });
  console.log(`login sintético: ${resposta.status()}`);
  expect(resposta.ok(), 'login sintético falhou — API sem a base de demonstração?').toBeTruthy();
}

async function abrirTela(page: Page): Promise<void> {
  page.setDefaultTimeout(6_000);
  // Demo mode: a tela existe sem API; as chamadas de feedback são roteadas por caso.
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  const gatilhos = [
    page.getByRole('button', { name: /Feedback/i }),
    page.getByRole('link', { name: /Feedback/i }),
    page.locator('[data-vu-feedback-open]'),
  ];
  for (const alvo of gatilhos) {
    if ((await alvo.count()) > 0 && (await alvo.first().isVisible())) {
      await alvo.first().click();
      await page.waitForTimeout(500);
      return;
    }
  }
  // Sem gatilho visível: o formulário pode estar embutido na página.
  const embutido = page.locator('[data-vu-feedback-rating]');
  expect(await embutido.count(), 'formulário de feedback não encontrado na tela').toBeGreaterThan(
    0,
  );
}

test('UXH-20: envio sem sessão responde 401', async ({ request }) => {
  const resposta = await request.post(`${API}/feedback`, {
    data: { route: 'map', rating: 4, message: 'Sem sessão', contactOptIn: false },
  });
  console.log(`sem sessão → ${resposta.status()}`);
  expect(resposta.status(), 'endpoint aceitou envio sem sessão').toBe(401);
});

test('UXH-20: rating fora de 1–5 e texto vazio respondem 400', async ({ request }) => {
  await sessao(request);
  for (const [rotulo, corpo] of [
    ['rating 0', { route: 'map', rating: 0, message: 'x', contactOptIn: false }],
    ['rating 6', { route: 'map', rating: 6, message: 'x', contactOptIn: false }],
    ['texto vazio', { route: 'map', rating: 4, message: '', contactOptIn: false }],
  ] as const) {
    const resposta = await request.post(`${API}/feedback`, { data: corpo });
    console.log(`${rotulo} → ${resposta.status()}`);
    expect(resposta.status(), `${rotulo} não foi recusado com 400`).toBe(400);
  }
});

test('UXH-20: envio válido responde 201 com id', async ({ request }) => {
  await sessao(request);
  const resposta = await request.post(`${API}/feedback`, {
    data: { route: 'map', rating: 4, message: 'Feedback sintético da régua', contactOptIn: false },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as { id?: string };
  console.log(`válido → ${resposta.status()} · id=${corpo.id ?? 'ausente'}`);
  expect(resposta.status(), 'envio válido não respondeu 201').toBe(201);
  expect(corpo.id, '201 sem id').toBeTruthy();
});

test('UXH-20: envio válido na tela mostra confirmação', async ({ page }) => {
  await page.route('**/api/v1/feedback**', (r) =>
    r.fulfill({ status: 201, json: { id: '00000000-0000-0000-0000-000000000001' } }),
  );
  await abrirTela(page);
  // O hook está nos cinco <input type="radio"> — `check()` no primeiro é o que
  // dispara `setFeedbackRating`; `selectOption`/clique no rótulo não mudam o estado.
  await page.locator('[data-vu-feedback-rating]').first().check();
  await page.locator('[data-vu-feedback-message]').first().fill('Feedback sintético da régua');
  await page.locator('[data-vu-feedback-submit]').first().click();
  await page.waitForTimeout(600);
  const pronto = page.locator('[data-vu-feedback-done]');
  await expect(pronto, 'sucesso sem confirmação na tela').toBeVisible();
  console.log(`confirmação: "${((await pronto.textContent()) ?? '').trim().slice(0, 60)}"`);
});

test('UXH-20: falha mostra alerta e preserva o texto digitado', async ({ page }) => {
  await page.route('**/api/v1/feedback**', (r) =>
    r.fulfill({ status: 500, json: { code: 'UNAVAILABLE', message: 'Falha sintética' } }),
  );
  await abrirTela(page);
  const texto = 'Texto que não pode ser perdido';
  await page.locator('[data-vu-feedback-message]').first().fill(texto);
  await page.locator('[data-vu-feedback-submit]').first().click();
  await page.waitForTimeout(700);
  const erro = page.locator(
    '[data-vu-feedback-error], [data-vu-feedback-error] [role="alert"], main [role="alert"]',
  );
  await expect(erro.first(), 'falha sem role="alert"').toBeVisible();
  const valor = await page.locator('[data-vu-feedback-message]').first().inputValue();
  console.log(`texto preservado: "${valor}"`);
  expect(valor, 'o texto digitado foi perdido no erro').toBe(texto);
});
