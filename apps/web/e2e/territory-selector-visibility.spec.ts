import { expect, test, type Page } from '@playwright/test';

/**
 * UXH-03 — apresentação do seletor «Definir centro por local» dentro do painel de raio.
 *
 * Mede o critério de aceite do @arquiteto (D3/D4/D5) contra a **caixa visível do painel**, não
 * contra o viewport: opção abaixo do recorte de `overflow-y` não é pintada e não é acertável.
 *
 * O catálogo é servido por `page.route` com 22 itens de forma fixa — esta spec mede **layout**, então
 * não depende de sessão, banco nem da API Java. A prova contra o catálogo real com PostGIS fica com a
 * medição do @ux (HTTP real, sem rota interceptada); aqui o objetivo é a regressão repetível no CI.
 */

const CATALOG = {
  dataset: {
    id: 'spec-layout',
    source: 'Spec de layout',
    sourceUrl: 'https://example.invalid/spec',
    license: 'Dados fictícios',
    attribution: 'Dados fictícios para verificação de layout',
    referenceDate: '2026-01-01',
    obtainedAt: '2026-01-01T00:00:00Z',
    checksum: 'spec',
    limitations: 'Nenhuma: dado fictício de teste.',
  },
  coverage: {
    level: 'MUNICIPALITY',
    expected: 22,
    available: 22,
    pending: 0,
    expectedSource: 'LEGAL_RECORTE',
    expectedRecorteVersion: 2,
  },
  items: Array.from({ length: 22 }, (_, index) => ({
    id: `spec-${index + 1}`,
    officialCode: String(3300000 + index + 1),
    level: 'MUNICIPALITY',
    name: `Município Fictício ${String(index + 1).padStart(2, '0')}`,
    version: 1,
    validated: true,
    internalPoint: [-43.5 + index / 100, -22.9 + index / 100],
    referenceDate: '2026-01-01',
  })),
};

const ACCESS_REPLY = {
  code: 'ACCESS_GRANTED',
  message: 'Sessão sintética apenas para medição de layout.',
  role: 'ADMIN',
  authenticated: true,
  mfaEnrolled: true,
  csrfToken: 'spec-csrf',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', {
      configurable: true,
      value: undefined,
    });
  });
  await page.route('https://tiles.stadiamaps.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf0f2"/></svg>',
    }),
  );
  // O mapa só é renderizado com sessão autorizada; esta spec não prova autorização (isso é do
  // backend), então serve a resposta de acesso para isolar a medição de layout.
  await page.route('**/api/v1/auth/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ACCESS_REPLY),
    }),
  );
  await page.route('**/api/v1/territories**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG),
    }),
  );
});

interface Measurement {
  bandHeight: number;
  wholeOptions: number;
  optionsInBand: number;
  coveredOptions: number;
  disclosureVisible: boolean;
  sliderVisible: boolean;
  pageScrollY: number;
  panelMaxHeight: number | null;
  panelPosition: string;
  bottomGap: number;
}

/** Mede a área visível do painel (recorte de ancestrais + viewport) e o que nela é pintado. */
async function measure(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#map-radius-options');
    if (!panel) throw new Error('painel de raio ausente');
    let top = 0;
    let bottom = window.innerHeight;
    let left = 0;
    let right = window.innerWidth;
    let node: HTMLElement | null = panel;
    while (node && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const clips =
        node === panel ||
        (style.overflow !== 'visible' && style.overflow !== '') ||
        (style.overflowY !== 'visible' && style.overflowY !== '');
      if (clips) {
        const rect = node.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
        left = Math.max(left, rect.left);
        right = Math.min(right, rect.right);
      }
      node = node.parentElement;
    }
    const options = Array.from(panel.querySelectorAll<HTMLElement>('.territory-list > li'));
    const rects = options.map((option) => option.getBoundingClientRect());
    const whole = rects.filter(
      (rect) => rect.height > 0 && rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5,
    ).length;
    const inBand = rects.filter(
      (rect) => rect.height > 0 && rect.bottom > top && rect.top < bottom,
    );
    const covered = rects.filter((rect) => {
      if (!(rect.height > 0 && rect.bottom > top && rect.top < bottom)) return false;
      const cx = (Math.max(rect.left, left) + Math.min(rect.right, right)) / 2;
      const cy = (Math.max(rect.top, top) + Math.min(rect.bottom, bottom)) / 2;
      const hit = document.elementFromPoint(cx, cy);
      return !hit || !hit.closest('.territory-list > li');
    }).length;
    const within = (element: Element | null): boolean => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.height > 0 && rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5;
    };
    const slider = document.querySelector('#map-radius-slider');
    const panelRect = panel.getBoundingClientRect();
    return {
      bandHeight: Math.max(0, Math.round(bottom - top)),
      wholeOptions: whole,
      optionsInBand: inBand.length,
      coveredOptions: covered,
      disclosureVisible: within(document.querySelector('.territory-disclosure')),
      sliderVisible: within(slider),
      pageScrollY: Math.round(window.scrollY),
      panelMaxHeight: panel.style.maxHeight ? Number.parseInt(panel.style.maxHeight, 10) : null,
      panelPosition: window.getComputedStyle(panel).position,
      bottomGap: Math.round(window.innerHeight - panelRect.bottom),
    };
  });
}

/** Leva a barra de raio para o topo, o meio ou fora da dobra da página. */
async function scrollBarTo(page: Page, target: 'top' | 'middle' | 'below'): Promise<number> {
  return page.evaluate((where) => {
    const bar = document.querySelector<HTMLElement>('.map-radius-bar');
    if (!bar) throw new Error('barra de raio ausente');
    const rect = bar.getBoundingClientRect();
    const desired =
      where === 'top'
        ? window.scrollY + rect.top - 120
        : where === 'middle'
          ? window.scrollY + rect.top - window.innerHeight / 2
          : window.scrollY + rect.top - window.innerHeight - 60;
    window.scrollTo(0, Math.max(0, desired));
    return Math.round(window.scrollY);
  }, target);
}

async function openRadiusPanel(page: Page, viaScriptClick = false): Promise<void> {
  const options = page.locator('#map-radius-options');
  if (!(await page.getByLabel('Filtrar por raio').isChecked())) {
    await page.getByLabel('Filtrar por raio').check();
  }
  // `check()` já abre o painel; só clica no disclosure se ele de facto não abriu. Clicar às cegas
  // no flush do `[hidden]` fecha o painel que o `check()` acabou de abrir (corrida de 2 em 3).
  const opened = await options
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) await page.locator('.map-radius-disclosure').click();
  await expect(options).toBeVisible();
  await expect(page.locator('.map-radius-disclosure')).toHaveAttribute('aria-expanded', 'true');
  if (viaScriptClick) {
    // Barra fora da dobra: um clique real rola a página e dissolve o caso. Dispara o clique no
    // próprio DOM para medir a promessa do D5 — o painel aparece preso ao viewport mesmo assim.
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.territory-disclosure')?.click();
    });
  } else {
    await page.locator('.territory-disclosure').click();
  }
  await expect(page.locator('#map-locality-listbox')).toBeVisible();
  await expect(page.locator('.territory-list > li').first()).toBeVisible();
}

const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 800 },
  { width: 768, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
];

test.describe('UXH-03 — seletor territorial dentro do painel de raio', () => {
  for (const { width, height } of WIDTHS) {
    test(`${width}×${height} — banda do painel e opções inteiras em três posições da página`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });

      const results: Array<{ position: string; measurement: Measurement }> = [];
      const rows: string[] = [];
      const render = (label: string, result: Measurement): string =>
        [
          `  ${label.padEnd(11)}`,
          `banda=${String(result.bandHeight).padStart(4)}px`,
          `inteiras=${result.wholeOptions}`,
          `na area=${result.optionsInBand}`,
          `cobertas=${result.coveredOptions}`,
          `disclosure=${result.disclosureVisible ? 'ok' : 'FORA'}`,
          `slider=${result.sliderVisible ? 'ok' : 'fora'}`,
          `pos=${result.panelPosition}`,
          `folga=${result.bottomGap}`,
          `maxH=${result.panelMaxHeight}`,
          `scrollY=${result.pageScrollY}`,
        ].join(' ');
      for (const position of ['top', 'middle', 'below'] as const) {
        await page.goto('/');
        await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
        await expect(page.locator('.map-radius-bar')).toBeVisible();
        await page.getByLabel('Filtrar por raio').check();
        await scrollBarTo(page, position);
        await openRadiusPanel(page, position === 'below');
        const result = await measure(page);
        results.push({ position, measurement: result });
        rows.push(render(position, result));

        // D6: a folha é presa ao viewport no móvel, então rolar a PÁGINA depois de abrir não pode
        // tirar o painel da vista — o caso que media banda −70 antes do fix.
        if (width <= 560) {
          for (const delta of [300, -600]) {
            await page.evaluate((value) => window.scrollBy(0, value), delta);
            const scrolled = await measure(page);
            const label = `${position}${delta > 0 ? '+' : ''}${delta}`;
            results.push({ position: label, measurement: scrolled });
            rows.push(render(label, scrolled));
          }
        }
      }
      console.log(`\n[${width}x${height}]\n${rows.join('\n')}`);

      const failures: string[] = [];
      for (const { position, measurement } of results) {
        const where = `${width}/${position}`;
        if (measurement.coveredOptions !== 0) {
          failures.push(`${where}: ${measurement.coveredOptions} opção(ões) coberta(s)`);
        }
        if (!measurement.disclosureVisible) failures.push(`${where}: disclosure fora da vista`);
        if (width <= 560) {
          if (measurement.wholeOptions < 3) {
            failures.push(`${where}: ${measurement.wholeOptions} inteiras (critério ≥3)`);
          }
          if (measurement.bandHeight < 340) {
            failures.push(`${where}: banda de ${measurement.bandHeight} px (critério ≥340)`);
          }
          if (measurement.panelPosition !== 'fixed') {
            failures.push(`${where}: painel ${measurement.panelPosition}, esperado fixed no móvel`);
          }
          if (measurement.bottomGap !== 12) {
            failures.push(`${where}: folga inferior ${measurement.bottomGap}, esperado 12`);
          }
        } else if (!measurement.sliderVisible) {
          failures.push(`${where}: slider «Distância do centro» fora da vista`);
        }
      }
      expect(failures, failures.join(' | ')).toEqual([]);
    });
  }
});
