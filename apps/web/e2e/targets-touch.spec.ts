import { expect, test, type Page } from '@playwright/test';

/**
 * UX-3 — alvos de toque. Régua de `getBoundingClientRect` no DOM real, em
 * 390, 320 e 1440: **0 alvos efetivos abaixo de 44×44** e **separação ≥ 8 px**
 * entre alvos que não são um dentro do outro.
 *
 * "Alvo efetivo" não é a lista do grep: campo visualmente oculto (`opacity: 0`
 * ou ≤2 px) que tem `<label for>` ou está dentro de um `<label>` é medido pelo
 * rótulo, porque é o rótulo que recebe o clique. Isso impede o falso positivo
 * que o @executor separou como isca (`period-option input` com 1 px).
 *
 * A separação é a distância euclidiana entre as bordas dos dois retângulos,
 * ignorando pares aninhados (um dentro do outro não é disputa de toque).
 * O caso negativo injeta um alvo de 24 px e um `gap: 0` e exige que a régua
 * reprove — sem isso, uma régua quebrada passaria verde.
 */

const ALVO_MINIMO = 44;
const SEPARACAO_MINIMA = 8;

const SELETOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="searchbox"]',
].join(', ');

type Alvo = { rotulo: string; largura: number; altura: number; viaRotulo: boolean };
type Par = { a: string; b: string; distancia: number };
type Relatorio = {
  total: number;
  pequenos: Alvo[];
  separacaoMinima: number | null;
  paresJuntos: Par[];
  /** Estouro horizontal: a régua de alvo não pode aceitar tela que rola de lado. */
  rolagemHorizontal: { scrollWidth: number; clientWidth: number; estoura: boolean };
};

/** Serializada para o navegador: não referencia nada do escopo do módulo. */
function medirAlvos42(entrada: { seletor: string; minimo: number; separacao: number }): Relatorio {
  const visivel = (elemento: Element): boolean => {
    const estilo = getComputedStyle(elemento);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
    const caixa = elemento.getBoundingClientRect();
    return caixa.width > 0 && caixa.height > 0;
  };
  const nomear = (elemento: Element): string => {
    const classe = (elemento.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
    const texto = (elemento.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
    const papel = elemento.getAttribute('role');
    const base = `${elemento.tagName.toLowerCase()}${classe ? '.' + classe : ''}${
      papel ? `[role=${papel}]` : ''
    }`;
    return texto ? `${base} «${texto}»` : base;
  };
  const rotuloDe = (elemento: Element): Element | null => {
    const id = elemento.getAttribute('id');
    const porId = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    return porId ?? elemento.closest('label');
  };

  type Candidato = { elemento: Element; viaRotulo: boolean };
  const candidatos: Candidato[] = [];
  for (const elemento of Array.from(document.querySelectorAll(entrada.seletor))) {
    if (!visivel(elemento)) continue;
    const estilo = getComputedStyle(elemento);
    const caixa = elemento.getBoundingClientRect();
    const oculto = Number(estilo.opacity) === 0 || (caixa.width <= 2 && caixa.height <= 2);
    if (oculto) {
      const rotulo = rotuloDe(elemento);
      if (rotulo && visivel(rotulo)) {
        candidatos.push({ elemento: rotulo, viaRotulo: true });
        continue;
      }
    }
    candidatos.push({ elemento, viaRotulo: false });
  }

  // Um rótulo pode servir a dois inputs ocultos: conta uma vez.
  const unicos = new Map<Element, Candidato>();
  for (const candidato of candidatos) {
    const anterior = unicos.get(candidato.elemento);
    unicos.set(candidato.elemento, {
      elemento: candidato.elemento,
      viaRotulo: (anterior?.viaRotulo ?? false) || candidato.viaRotulo,
    });
  }
  const alvos = Array.from(unicos.values()).map((candidato) => {
    const caixa = candidato.elemento.getBoundingClientRect();
    return {
      elemento: candidato.elemento,
      rotulo: nomear(candidato.elemento),
      largura: Number(caixa.width.toFixed(1)),
      altura: Number(caixa.height.toFixed(1)),
      viaRotulo: candidato.viaRotulo,
    };
  });

  const pequenos = alvos
    .filter((alvo) => alvo.largura < entrada.minimo || alvo.altura < entrada.minimo)
    .map(({ rotulo, largura, altura, viaRotulo }) => ({ rotulo, largura, altura, viaRotulo }))
    .sort((a, b) => a.altura - b.altura || a.largura - b.largura);

  const pares: Par[] = [];
  for (let i = 0; i < alvos.length; i += 1) {
    for (let j = i + 1; j < alvos.length; j += 1) {
      const a = alvos[i];
      const b = alvos[j];
      if (a.elemento.contains(b.elemento) || b.elemento.contains(a.elemento)) continue;
      // Exclusão nomeada (ruling de 26/10): o par "rodapé × barra fixa" não é disputa de
      // toque — o rodapé é fim de página, e qualquer chrome fixo cobre o fim do documento
      // no scroll 0. O alcance de cada link é PROVADO no caso próprio (`elementFromPoint`),
      // não presumido aqui. Esta exclusão vale só para este par; "≥8 px" segue para todo o resto.
      const noRodape = (elemento: Element): boolean =>
        Boolean(elemento.closest('footer.site-footer'));
      const noShellFixo = (elemento: Element): boolean => Boolean(elemento.closest('.vu-shell'));
      if (
        (noRodape(a.elemento) && noShellFixo(b.elemento)) ||
        (noRodape(b.elemento) && noShellFixo(a.elemento))
      )
        continue;
      const ca = a.elemento.getBoundingClientRect();
      const cb = b.elemento.getBoundingClientRect();
      const dx = Math.max(0, Math.max(ca.left, cb.left) - Math.min(ca.right, cb.right));
      const dy = Math.max(0, Math.max(ca.top, cb.top) - Math.min(ca.bottom, cb.bottom));
      const distancia = Number(Math.hypot(dx, dy).toFixed(1));
      if (distancia < entrada.separacao) pares.push({ a: a.rotulo, b: b.rotulo, distancia });
    }
  }
  pares.sort((x, y) => x.distancia - y.distancia);

  return {
    total: alvos.length,
    pequenos,
    separacaoMinima: pares.length ? pares[0].distancia : null,
    paresJuntos: pares.slice(0, 8),
    rolagemHorizontal: (() => {
      const raiz = document.documentElement;
      return {
        scrollWidth: raiz.scrollWidth,
        clientWidth: raiz.clientWidth,
        estoura: raiz.scrollWidth > raiz.clientWidth + 1,
      };
    })(),
  };
}

const VIEWPORTS = [
  { largura: 390, altura: 844 },
  { largura: 320, altura: 720 },
  { largura: 1440, altura: 900 },
];

async function abrirEntrada(page: Page, largura: number, altura: number): Promise<void> {
  await page.setViewportSize({ width: largura, height: altura });
  await page.goto('/');
  await expect(page.locator('.map-loading, .map-fallback')).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test(`UX-3: alvos ≥ ${ALVO_MINIMO}px e separação ≥ ${SEPARACAO_MINIMA}px a ${viewport.largura}`, async ({
    page,
  }) => {
    await abrirEntrada(page, viewport.largura, viewport.altura);
    const relatorio = await page.evaluate(medirAlvos42, {
      seletor: SELETOR,
      minimo: ALVO_MINIMO,
      separacao: SEPARACAO_MINIMA,
    });

    console.log(
      `${viewport.largura}px: ${relatorio.total} alvos, ${relatorio.pequenos.length} abaixo de ${
        ALVO_MINIMO
      }px, separação mínima ${relatorio.separacaoMinima ?? '—'}px, rolagem ${
        relatorio.rolagemHorizontal.estoura ? 'ESTOURA' : 'ok'
      } (${relatorio.rolagemHorizontal.scrollWidth}/${relatorio.rolagemHorizontal.clientWidth})`,
    );
    for (const alvo of relatorio.pequenos.slice(0, 12)) {
      console.log(
        `  pequeno ${alvo.largura}×${alvo.altura}${alvo.viaRotulo ? ' (via label)' : ''} ${alvo.rotulo}`,
      );
    }
    for (const par of relatorio.paresJuntos.slice(0, 5)) {
      console.log(`  juntos ${par.distancia}px: ${par.a} × ${par.b}`);
    }

    // Anti-vacuidade: sem alvos medidos, "0 abaixo de 44" seria verdade trivial.
    expect(relatorio.total, 'nenhum alvo medido').toBeGreaterThan(5);
    expect(
      relatorio.pequenos.map((alvo) => `${alvo.rotulo} ${alvo.largura}×${alvo.altura}`),
      `alvos abaixo de ${ALVO_MINIMO}px a ${viewport.largura}`,
    ).toEqual([]);
    expect(
      relatorio.paresJuntos.map((par) => `${par.a} × ${par.b} = ${par.distancia}px`),
      `pares abaixo de ${SEPARACAO_MINIMA}px de separação a ${viewport.largura}`,
    ).toEqual([]);
    // Aumentar altura e separação empurra a barra: sem esta linha, "0 alvos
    // abaixo de 44" aceitaria uma tela que rola de lado.
    expect(
      relatorio.rolagemHorizontal,
      `estouro horizontal a ${viewport.largura}: scrollWidth ${relatorio.rolagemHorizontal.scrollWidth} > clientWidth ${relatorio.rolagemHorizontal.clientWidth}`,
    ).toMatchObject({ estoura: false });
  });
}

/**
 * Controle negativo do instrumento: duas sondas injetadas — um botão de 24 px e
 * um par com `gap: 2px` — têm de ser reprovadas. Ancorar em alvo que já existe
 * na página seria vacuidade: hoje a tela inteira reprova e o caso passaria sem
 * provar que a régua enxerga um alvo reduzido. A sonda é do teste, nunca do
 * produto, e vive só neste caso.
 */
test('controle negativo: alvo de 24px e par a 2px reprovam a régua', async ({ page }) => {
  await abrirEntrada(page, 390, 844);
  await page.evaluate(() => {
    const caixa = document.createElement('div');
    caixa.style.cssText =
      'position: fixed; left: 0; top: 0; z-index: 2147483647; display: flex; gap: 2px;';
    const baixo = document.createElement('button');
    baixo.type = 'button';
    baixo.textContent = 'sonda baixa';
    baixo.style.cssText = 'width: 60px; height: 24px;';
    const alto = document.createElement('button');
    alto.type = 'button';
    alto.textContent = 'sonda alta';
    alto.style.cssText = 'width: 60px; height: 44px;';
    caixa.append(baixo, alto);
    document.body.appendChild(caixa);
  });
  const relatorio = await page.evaluate(medirAlvos42, {
    seletor: SELETOR,
    minimo: ALVO_MINIMO,
    separacao: SEPARACAO_MINIMA,
  });
  const sondaPequena = relatorio.pequenos.filter((alvo) => alvo.rotulo.includes('sonda baixa'));
  const sondaJuntas = relatorio.paresJuntos.filter(
    (par) => par.a.includes('sonda') && par.b.includes('sonda'),
  );
  console.log(
    `negativo: sonda de 24px listada=${sondaPequena.length}  par a 2px listado=${sondaJuntas.length}`,
  );
  expect(sondaPequena.length, 'a régua não reprovou o alvo de 24px').toBe(1);
  expect(sondaPequena[0].altura).toBe(24);
  expect(sondaJuntas.length, 'a régua não reprovou o par a 2px').toBe(1);
  expect(sondaJuntas[0].distancia).toBe(2);

  // Terceira sonda: uma caixa de 2000 px tem de aparecer como rolagem lateral.
  await page.evaluate(() => {
    const larga = document.createElement('div');
    larga.style.cssText = 'position: absolute; left: 0; top: 0; width: 2000px; height: 8px;';
    document.body.appendChild(larga);
  });
  const comEstouro = await page.evaluate(medirAlvos42, {
    seletor: SELETOR,
    minimo: ALVO_MINIMO,
    separacao: SEPARACAO_MINIMA,
  });
  console.log(
    `negativo: estouro ${comEstouro.rolagemHorizontal.scrollWidth}/${comEstouro.rolagemHorizontal.clientWidth}`,
  );
  expect(comEstouro.rolagemHorizontal.estoura, 'a régua não viu o estouro horizontal').toBe(true);
});

for (const largura of [320, 390]) {
  test(`UX-3: todo link do rodapé é alcançável a ${largura} — o chrome fixo não o cobre`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largura, height: largura === 320 ? 720 : 844 });
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    const bloqueados = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('footer.site-footer a')) as HTMLElement[];
      const falhas: string[] = [];
      for (const link of links) {
        link.scrollIntoView({ block: 'end' });
        const caixa = link.getBoundingClientRect();
        const alvo = document.elementFromPoint(
          caixa.left + caixa.width / 2,
          caixa.top + caixa.height / 2,
        );
        if (alvo !== link && !link.contains(alvo))
          falhas.push(
            `${(link.textContent ?? '').trim()} → ${(alvo as HTMLElement | null)?.className ?? alvo?.tagName ?? 'null'}`,
          );
      }
      return falhas;
    });
    console.log(`links do rodapé cobertos a ${largura}px: ${JSON.stringify(bloqueados)}`);
    // O mesmo instrumento do hit-test do UX-6, no sentido oposto: em vez de provar que a
    // folha cobre a barra, prova que a barra NÃO cobre o rodapé.
    expect(bloqueados, `links do rodapé cobertos pelo chrome fixo a ${largura}px`).toEqual([]);
  });
}
