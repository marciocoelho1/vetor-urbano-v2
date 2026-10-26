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
/**
 * `proprio` (padrão) mede contra a pilha de fundos do elemento; `branco` mede
 * contra a página branca — a mesma referência para os dois lados de uma
 * comparação de estados, senão o quociente mistura denominadores; `base` mede
 * contra `--color-bg-base` **declarado no tema**, que é o fundo onde o dono
 * autorizou 3:1 e que o `#8893a0` reprovava (2,94); `superficie` mede contra
 * `--color-bg-surface` — o fundo comum com que os dois estados do chip no
 * escuro são comparados (medir cada um no seu próprio fundo trocava o
 * denominador da razão e invertia a leitura).
 */
type Referencia = 'proprio' | 'branco' | 'base' | 'superficie';
type Alvo = { seletor: string; tipo: Tipo; referencia?: Referencia };
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
    // Fundo declarado no tema, resolvido pelo navegador (sonda), não por regex no CSS.
    const fundoDeclarado = (token: string): Cor => {
      const sonda = document.createElement('span');
      sonda.style.color = `var(${token})`;
      sonda.style.display = 'none';
      document.body.appendChild(sonda);
      const lido = ler(getComputedStyle(sonda).color);
      sonda.remove();
      return lido ?? { r: 255, g: 255, b: 255, a: 1 };
    };
    const fundo =
      alvo.referencia === 'branco'
        ? { r: 255, g: 255, b: 255, a: 1 }
        : alvo.referencia === 'base'
          ? fundoDeclarado('--color-bg-base')
          : alvo.referencia === 'superficie'
            ? fundoDeclarado('--color-bg-surface')
            : fundoEfetivo(elemento);
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

/**
 * Espera as transições de CSS assentarem. Medir no meio de um
 * `transition: border-color .15s` captura a cor anterior — foi assim que
 * `.mode-toggle-button` apareceu com 3,36 no escuro quando o valor final é
 * 1,62. Toda medição passa por aqui.
 */
async function assentar(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.race([
      Promise.all(document.getAnimations().map((animacao) => animacao.finished.catch(() => 0))),
      new Promise((pronto) => setTimeout(pronto, 800)),
    ]),
  );
}

async function medir(page: Page, alvos: Alvo[]): Promise<Medida[]> {
  await assentar(page);
  return page.evaluate(medirAlvos, alvos);
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
  const medidas = await medir(page, alvos);
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

  const [medida] = await medir(page, [{ seletor: '.query-update-badge', tipo: 'texto' }] as Alvo[]);
  expect(medida.presente).toBe(true);
  expect(medida.contraste).toBeGreaterThan(0);
  expect(medida.contraste).toBeLessThan(4.5);
});

/**
 * UX-9: o marcador de área do resultado de busca saiu da dívida. Era `3,75:1`
 * (12% de âmbar sobre o branco da linha) com `--color-warning-dot` de tinta;
 * `--color-warning-ink` separa o papel de texto do papel de marca e fecha o par.
 * O `test.fail` que registrava a dívida morreu junto com ela — a asserção volta
 * a ser 4,5, não o valor medido.
 */
test('UX-9: o marcador de área do resultado de busca alcança 4,5:1 nos dois temas', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.getByTestId('map-search').first().fill('centro');
  await expect(page.locator('.area-result-mark').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const alvos: Alvo[] = [{ seletor: '.area-result-mark', tipo: 'texto' }];
  await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'light');
  await trocarTema(page, 'dark');
  await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'dark');
});

/**
 * UX-1d: tinta sobre `--color-error`. O badge de ocorrências coincidentes era o
 * último branco fixo sobre vermelho — `#fff` sobre `--color-error` dá **1,96:1**
 * no tema escuro (#f1a5af), que é o tema alternativo real. A tinta passa a vir
 * de `--color-on-error`, em par nos dois blocos de `theme.scss`.
 *
 * O pin é desenhado pelo Leaflet fora do fluxo do template, então o badge entra
 * dentro do `#map-canvas` **real** para ser submetido à cascata de verdade.
 */
test('UX-1d: o badge de ocorrências coincidentes contrasta nos dois temas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('#map-canvas')).toBeVisible();
  // O badge é desenhado pelo app dentro do marcador coincidente (`app.ts:5554`).
  // Exigir o elemento real é o que impede a vacuidade: injetar um equivalente
  // mediria só o par de CSS e passaria mesmo que a UI nunca o renderizasse.
  const badge = page.getByTestId('coincident-badge').first();
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/^\d+$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const alvos: Alvo[] = [{ seletor: '#map-canvas .coincident-badge', tipo: 'texto' }];
  const claro = await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'light');
  await trocarTema(page, 'dark');
  const escuro = await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'dark');

  // Mesmo token, valor por tema: o par não pode ser um literal único.
  expect(claro[0].frente).not.toBe(escuro[0].frente);
});

/**
 * UX-1c: o hover do botão de dispensar do aviso de atualização. A borda era
 * `var(--color-border-main)` — token fantasma, então o computado caía em
 * `currentColor` por acidente. Virou `var(--color-text-main)` explícito; a
 * igualdade borda-vs-texto é a prova de que o pixel não mudou.
 */
test('UX-1c: no hover, a borda do botão de dispensar é igual à cor do texto', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { vetorUrbano: { simulatePendingUpdate: () => void } }
    ).vetorUrbano.simulatePendingUpdate(),
  );
  const botao = page.locator('.update-dismiss-btn');
  await expect(botao).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  for (const tema of ['light', 'dark'] as const) {
    if (tema === 'dark') await trocarTema(page, 'dark');
    await botao.hover();
    const cores = await botao.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return { borda: estilo.borderTopColor, texto: estilo.color };
    });
    expect(cores.borda, `borda != texto no tema ${tema}`).toBe(cores.texto);
    expect(cores.borda).not.toBe('rgba(0, 0, 0, 0)');
  }
});

/**
 * UX-9: contorno de controle a 3:1 no claro (WCAG 1.4.11). O token
 * `--color-border-control` existe para isso; a amostra é a dos controles que a
 * tela de entrada renderiza, não a lista do grep.
 *
 * O escuro é **medido e impresso**, nunca asserido: a dívida (`#364250` a 1,62)
 * foi nomeada no ruling e transformá-la em limiar faria o gate reprovar por
 * desenho. Quem quiser fechá-la muda o token, e aí o número impresso muda antes
 * de qualquer asserção.
 */
test('UX-9: o contorno dos controles alcança 3:1 no claro (escuro mede sem asserir)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const controles = ['.theme-toggle', '.nav-register', '.mode-toggle-button', '.map-filter-toggle'];
  const alvos: Alvo[] = controles.map((seletor) => ({ seletor, tipo: 'borda' as Tipo }));
  const claro = await conferir(page, alvos, { texto: 4.5, borda: 3 }, 'light');
  // Anti-vacuidade: elemento ausente devolve `presente: false` e já reprova,
  // mas a contagem explícita impede a lista de encolher em silêncio.
  expect(claro.filter((medida) => medida.presente).length).toBe(controles.length);

  // O critério do dono é "3:1", e o hex `#838d9a` só foi escolhido porque o
  // anterior reprovava **na base** (2,94). Medir só os quatro alvos acima, que
  // resolvem branco, deixaria o caso verde com o hex antigo de volta na base —
  // a decisão ficaria sem guarda justamente no par que a motivou.
  const [naBase] = await medir(page, [
    { seletor: '.theme-toggle', tipo: 'borda', referencia: 'base' },
  ]);
  console.log(
    `light: contorno sobre --color-bg-base ${naBase.frente} sobre ${naBase.fundo} = ${naBase.contraste}:1`,
  );
  expect(
    naBase.contraste,
    `contorno sobre --color-bg-base: ${naBase.frente} sobre ${naBase.fundo}`,
  ).toBeGreaterThanOrEqual(3);

  await trocarTema(page, 'dark');
  const escuro = await medir(page, alvos);
  for (const medida of escuro) expect(medida.presente, medida.seletor).toBe(true);
  console.log(
    'escuro (dívida nomeada, sem asserção): ' +
      escuro.map((m) => `${m.seletor}=${m.contraste}:1 (${m.frente} sobre ${m.fundo})`).join('  '),
  );
});

/**
 * UX-9: o chip de categoria selecionado não pode ficar mais apagado que o de
 * repouso. A migração do contorno inverteu a direção no claro (repouso 3,36,
 * selecionado 2,15) — só o limiar não pega isso, e só a direção não pega
 * regressão de 1,4,5. As duas juntas é que fecham:
 *
 *  - direção: mesma referência (branco) para os dois estados;
 *  - limiar do selecionado: contra o **próprio preenchimento**, que é a cor
 *    adjacente de verdade em 1.4.11 (o branco é do repouso);
 *  - escuro: imprime, não assere.
 *
 * Na carga os chips de pilar já vêm selecionados — desselecionar é o que cria a
 * amostra de repouso. Sem esse clique a asserção passaria por vacuidade.
 */
test('UX-9: o chip selecionado é mais forte que o de repouso e passa 3:1 no próprio fundo', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const chip = page.locator('.category-shortcut').first();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveClass(/is-selected/);

  const alvoProprio: Alvo[] = [{ seletor: '.category-shortcut', tipo: 'borda' }];
  const alvoBranco: Alvo[] = [
    { seletor: '.category-shortcut', tipo: 'borda', referencia: 'branco' },
  ];
  const [selecionadoProprio] = await medir(page, alvoProprio);
  const [selecionadoBranco] = await medir(page, alvoBranco);
  expect(selecionadoProprio.presente).toBe(true);
  expect(
    selecionadoProprio.contraste,
    `selecionado sobre o próprio fundo: ${selecionadoProprio.frente} sobre ${selecionadoProprio.fundo}`,
  ).toBeGreaterThanOrEqual(3);

  await chip.click();
  await expect(chip).not.toHaveClass(/is-selected/);
  const [repousoBranco] = await medir(page, alvoBranco);
  expect(repousoBranco.presente).toBe(true);
  console.log(
    `light: selecionado=${selecionadoProprio.contraste}:1 (próprio fundo) / ${selecionadoBranco.contraste}:1 (branco)  repouso=${repousoBranco.contraste}:1 (branco)`,
  );
  expect(
    selecionadoBranco.contraste,
    `direção: selecionado ${selecionadoBranco.contraste} tem de ser maior que repouso ${repousoBranco.contraste} (mesma referência: branco)`,
  ).toBeGreaterThan(repousoBranco.contraste);

  await trocarTema(page, 'dark');
  // Os dois estados contra o MESMO fundo (`--color-bg-surface`), como no claro.
  // Medir o repouso na superfície e o selecionado no próprio preenchimento
  // compara 4,30 com 3,12 — razões de fundos diferentes, que não respondem
  // "qual dos dois é mais forte".
  const alvoSuperficie: Alvo[] = [
    { seletor: '.category-shortcut', tipo: 'borda', referencia: 'superficie' },
  ];
  const [repousoEscuro] = await medir(page, alvoSuperficie);
  await chip.click();
  await expect(chip).toHaveClass(/is-selected/);
  const [selecionadoEscuro] = await medir(page, alvoSuperficie);
  // A direção no escuro também é asserida. O limiar de 3:1 continua fora — a
  // dívida nomeada não vira gate —, mas a inversão que aconteceu no claro não
  // pode passar calada no escuro.
  expect(selecionadoEscuro.presente && repousoEscuro.presente).toBe(true);
  expect(
    selecionadoEscuro.contraste,
    `direção no escuro (superfície): selecionado ${selecionadoEscuro.contraste} contra repouso ${repousoEscuro.contraste}`,
  ).toBeGreaterThan(repousoEscuro.contraste);
  console.log(
    `escuro: repouso=${repousoEscuro.contraste}:1  selecionado=${selecionadoEscuro.contraste}:1 (os dois sobre --color-bg-surface)`,
  );
});
