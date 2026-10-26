import { expect, test, type Page } from '@playwright/test';

/**
 * Contraste real dos pares que o UX-1b criou e dos contornos que o UX-1c
 * trouxe de volta — medido no navegador, nos dois temas, não deduzido do token.
 *
 * Regra da conta: a cor é composta sobre a pilha de fundos do próprio elemento
 * até achar uma camada opaca; `rgba()` com alfa nunca é comparado cru (foi
 * assim que `--accent-subtle` a 30% virou "4,47" no papel). Contraste WCAG
 * 2.x: (L claro + 0,05) / (L escuro + 0,05).
 *
 * Limite declarado: o texto é medido contra o fundo **do elemento**, não contra
 * o pixel renderizado (gradiente, imagem ou sombra não entram). O que este
 * arquivo prova é par de token em repouso; estado `:hover`/`:focus` fica fora.
 * `--color-line-strong` a 2,84:1 no claro é dívida do UX-9 e por isso o
 * contorno aqui é verificado por **presença**, não por 3:1.
 */

type Tipo = 'texto' | 'borda';
type Alvo = { seletor: string; tipo: Tipo };
type Medida = Alvo & {
  presente: boolean;
  frente: string;
  fundo: string;
  contraste: number;
  amostra: string;
};

/** Serializada para o navegador: não referencia nada do escopo do módulo. */
function medirAlvos(alvos: Alvo[]): Medida[] {
  type Cor = { r: number; g: number; b: number; a: number };
  const ler = (valor: string): Cor | null => {
    const achado = valor.match(/rgba?\(([^)]+)\)/);
    if (!achado) return null;
    const partes = achado[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return {
      r: partes[0],
      g: partes[1],
      b: partes[2],
      a: partes.length > 3 ? partes[3] : 1,
    };
  };
  const sobrepor = (frente: Cor, fundo: Cor): Cor => ({
    r: frente.r * frente.a + fundo.r * (1 - frente.a),
    g: frente.g * frente.a + fundo.g * (1 - frente.a),
    b: frente.b * frente.a + fundo.b * (1 - frente.a),
    a: 1,
  });
  const luminancia = (cor: Cor): number => {
    const canal = (valor: number) => {
      const x = valor / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(cor.r) + 0.7152 * canal(cor.g) + 0.0722 * canal(cor.b);
  };
  const razao = (a: Cor, b: Cor): number => {
    const la = luminancia(a);
    const lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const fundoEfetivo = (elemento: Element): Cor => {
    const camadas: Cor[] = [];
    let atual: Element | null = elemento;
    while (atual) {
      const cor = ler(getComputedStyle(atual).backgroundColor);
      if (cor && cor.a > 0) {
        camadas.push(cor);
        if (cor.a >= 1) break;
      }
      atual = atual.parentElement;
    }
    if (!camadas.length || camadas[camadas.length - 1].a < 1) {
      camadas.push({ r: 255, g: 255, b: 255, a: 1 }); // canvas branco do documento
    }
    let base = camadas[camadas.length - 1];
    for (let i = camadas.length - 2; i >= 0; i -= 1) base = sobrepor(camadas[i], base);
    return base;
  };
  return alvos.map((alvo) => {
    const elemento = document.querySelector(alvo.seletor);
    if (!elemento) {
      return { ...alvo, presente: false, frente: '', fundo: '', contraste: 0, amostra: '' };
    }
    const estilo = getComputedStyle(elemento);
    const fundo = fundoEfetivo(elemento);
    const bruto = alvo.tipo === 'texto' ? estilo.color : estilo.borderTopColor;
    const frente = ler(bruto);
    const efetiva = frente && frente.a < 1 ? sobrepor(frente, fundo) : frente;
    return {
      ...alvo,
      presente: true,
      frente: bruto,
      fundo: `rgb(${Math.round(fundo.r)}, ${Math.round(fundo.g)}, ${Math.round(fundo.b)})`,
      contraste: efetiva ? Number(razao(efetiva, fundo).toFixed(2)) : 0,
      amostra: (elemento.textContent ?? '').trim().slice(0, 40),
    };
  });
}

/** Troca de tema pelo controle real (sem `data-theme` forçado no DOM). */
async function trocarTema(page: Page, tema: 'light' | 'dark'): Promise<void> {
  await page.getByRole('button', { name: 'Modo escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
}

async function conferir(
  page: Page,
  alvos: Alvo[],
  minimo: Record<Tipo, number>,
  tema: 'light' | 'dark',
): Promise<Medida[]> {
  const medidas = await page.evaluate(medirAlvos, alvos);
  console.log(
    `${tema}: ` +
      medidas.map((m) => `${m.seletor}=${m.contraste}:1`).join('  ') +
      `  (${medidas.map((m) => `${m.frente} sobre ${m.fundo}`).join(' / ')})`,
  );
  for (const medida of medidas) {
    const rotulo = `${medida.seletor} [${tema}] ${medida.frente} sobre ${medida.fundo}`;
    expect(medida.presente, `elemento ausente: ${rotulo}`).toBe(true);
    expect(medida.contraste, rotulo).toBeGreaterThanOrEqual(minimo[medida.tipo]);
  }
  return medidas;
}

test.beforeEach(async ({ page }) => {
  // Mesma fronteira de demonstração dos specs de estado: sessão sintética, sem API.
  const sessao = {
    code: 'SESSION',
    message: 'Sessão sintética de contraste',
    authenticated: true,
    role: 'USER',
    csrfToken: 'synthetic-contrast',
  };
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: sessao }));
  await page.route('**/api/v1/auth/access/**', (route) => route.fulfill({ json: sessao }));
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    }),
  );
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
  await page.emulateMedia({ colorScheme: 'light' });
});

test('UX-1b: aviso de atualização e botão de atualizar mantêm 4,5:1 nos dois temas', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { vetorUrbano: { simulatePendingUpdate: () => void } }
    ).vetorUrbano.simulatePendingUpdate(),
  );
  await expect(page.getByTestId('query-update-notice')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const alvos: Alvo[] = [
    { seletor: '.query-update-badge', tipo: 'texto' },
    { seletor: '.update-action-btn', tipo: 'texto' },
  ];
  const claro = await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'light');
  await trocarTema(page, 'dark');
  const escuro = await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'dark');

  // O par é o mesmo token nos dois temas; o valor tem de mudar com o tema, não sumir.
  expect(claro.map((m) => m.contraste)).not.toEqual(escuro.map((m) => m.contraste));
});

test('erro de consulta: nota, ícone e contorno do painel de erro contrastam nos dois temas', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { vetorUrbano: { simulateQueryError: (mensagem: string) => void } }
    ).vetorUrbano.simulateQueryError('Falha na comunicação com o serviço de dados.'),
  );
  await expect(page.getByTestId('query-error-banner')).toBeVisible();
  await expect(page.locator('.query-error-note')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const alvos: Alvo[] = [
    { seletor: '.query-error-note', tipo: 'texto' },
    { seletor: '.query-error-icon', tipo: 'texto' },
    { seletor: '.query-error-state', tipo: 'borda' },
  ];
  await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'light');
  await trocarTema(page, 'dark');
  await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'dark');
});

test('UX-1c: o contorno do fieldset de Histórico existe de fato (IACVT morto)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  const fieldset = page.locator('fieldset.history-categories');
  await expect(fieldset).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const ler = (elemento: Element) => {
    const estilo = getComputedStyle(elemento);
    return {
      estilo: estilo.borderTopStyle,
      largura: estilo.borderTopWidth,
      cor: estilo.borderTopColor,
      fundo: estilo.backgroundColor,
    };
  };

  const claro = await fieldset.evaluate(ler);
  expect(claro.estilo, 'border-top-style none = declaração morta (IACVT)').toBe('solid');
  expect(claro.largura).toBe('1px');
  expect(claro.cor).not.toBe('rgba(0, 0, 0, 0)');

  await trocarTema(page, 'dark');
  const escuro = await fieldset.evaluate(ler);
  expect(escuro.estilo, 'border-top-style none = declaração morta (IACVT)').toBe('solid');
  expect(escuro.largura).toBe('1px');
  expect(escuro.cor).not.toBe('rgba(0, 0, 0, 0)');
  // Cor da borda muda com o tema: troca de token, não literal fixo.
  expect(escuro.cor).not.toBe(claro.cor);
});

test('UX-1b: o número do agrupamento do mapa contrasta nos dois temas', async ({ page }) => {
  await page.goto('/');
  const mapa = page.locator('#map-canvas.leaflet-container');
  await expect(mapa).toBeVisible();
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  // Zoom 13,2 não agrupa; um passo para fora põe o agrupamento em cena.
  await page.locator('.leaflet-control-zoom-out').click();
  const agrupamento = page.locator('#map-canvas .occurrence-cluster').first();
  await expect(agrupamento).toBeVisible();
  await expect(agrupamento).not.toBeEmpty();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const alvos: Alvo[] = [{ seletor: '#map-canvas .occurrence-cluster', tipo: 'texto' }];
  await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'light');
  await trocarTema(page, 'dark');
  await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'dark');
});

/**
 * Controle negativo do instrumento: com o token forçado a um par de baixo
 * contraste, a mesma medição tem de reprovar. Sem isso a régua poderia passar
 * por vacuidade (elemento ausente devolve 0, mas 0 não é "aprovado").
 */
test('controle negativo: a régua reprova um par de baixo contraste', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { vetorUrbano: { simulatePendingUpdate: () => void } }
    ).vetorUrbano.simulatePendingUpdate(),
  );
  await expect(page.getByTestId('query-update-notice')).toBeVisible();
  await page.addStyleTag({ content: ':root { --color-on-accent: #7a8f86; }' });

  const [medida] = await page.evaluate(medirAlvos, [
    { seletor: '.query-update-badge', tipo: 'texto' },
  ] as Alvo[]);
  expect(medida.presente).toBe(true);
  expect(medida.contraste).toBeGreaterThan(0);
  expect(medida.contraste).toBeLessThan(4.5);
});

/**
 * Dívida aberta, **não aceita**: o marcador de área do resultado de busca fica
 * em 12% de âmbar sobre a superfície. O alvo continua 4,5:1 — o marcador
 * `test.fail` só registra o defeito no relatório; no dia em que o token fechar
 * o par, o caso vira "unexpected pass" e alguém é obrigado a removê-lo.
 */
test('dívida: marcador de área do resultado de busca não alcança 4,5:1 no claro', async ({
  page,
}) => {
  test.fail();
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.getByTestId('map-search').first().fill('centro');
  await expect(page.locator('.area-result-mark').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await conferir(
    page,
    [{ seletor: '.area-result-mark', tipo: 'texto' }],
    { texto: 4.5, borda: 3 },
    'light',
  );
});
