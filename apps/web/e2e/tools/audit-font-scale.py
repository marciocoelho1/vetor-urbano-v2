#!/usr/bin/env python3
"""Auditor estático das réguas de tipografia, token de cor e `aria-hidden`.

Instrumento versionado do gate UX-1/UX-1b. Lê a árvore, não o bundle, e não
confia em exclusão silenciosa: tudo o que ele deixa de contar é impresso com a
justificativa.

Réguas
------
1. ``font-size`` em ``**/*.scss`` tem de existir na escala declarada em
   ``styles/tokens.scss`` (``--vu-text-*``); ``clamp()`` pinta os extremos.
   Fora da escala → exit 1.
2. ``font-weight`` em ``**/*.scss``, **ignorando blocos ``@font-face``** (ali o
   peso é descritor de face, não escolha tipográfica). Peso escrito por token
   (``var(--vu-weight-*)``) resolve para o número declarado em
   ``styles/tokens.scss`` — sem isso o gate de três pesos passa por vacuidade.
   Mais de três pesos distintos → exit 1.
3. ``var(--token)`` citado e não declarado em lugar nenhum do projeto (``.scss``,
   atributo ``style`` de template, ``setProperty``/``ngStyle`` de TS) → exit 2.
   Token fantasma é defeito: sem fallback o navegador descarta a declaração
   (IACVT) e a borda não existe no pixel; com fallback o nome continua não
   existindo e o literal volta pela porta dos fundos.

   Censo de declarações **e** censo de usos varrem o mesmo conjunto de fontes
   (``.scss``, ``.html``, ``.ts``) — o glob é único. Nos templates e no
   TypeScript o uso só conta em contexto de estilo: bloco ``styles:`` de
   componente (lista ou template literal), atributo/binding ``style``,
   ``[style.x]``/``[ngStyle]`` e ``setProperty``. A regra continua por linha:
   ``var()`` quebrado em várias linhas não é detectado.
4. ``aria-hidden="true"`` que contém **palavra** (``\\p{L}{2,}``) → exit 2.
   Letra solta (``S``/``C`` de ``record-symbol``) passa; interpolação
   ``{{ … }}`` e bloco de controle ``@if/@for/…`` não são texto e não contam.
   Cada excluído é impresso com o texto que sobrou.

Uso
---
    python3 apps/web/e2e/tools/audit-font-scale.py [--src DIR] [--json]
                                                    [--verbose] [--selftest]

``--src`` aponta a raiz de fontes (padrão: ``apps/web/src``, resolvido a partir
da raiz do repositório). ``--selftest`` sintetiza árvores temporárias fora do
repositório e prova os quatro vereditos (limpo=0, fora da escala=1, token
ausente=2, palavra em aria-hidden=2) sem tocar na árvore real.

Status: 0 limpo · 1 fora da escala ou excesso de pesos · 2 token fantasma ou
palavra em ``aria-hidden`` (2 vence 1).
"""
from __future__ import annotations

import glob
import json
import re
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

RAIZ_REPO = Path(__file__).resolve().parents[4]
SRC_PADRAO = RAIZ_REPO / 'apps' / 'web' / 'src'

# Escala do UX-0, usada quando `styles/tokens.scss` ainda não existe.
FALLBACK = [
    ('--vu-text-xs', 12.0, 12.0),
    ('--vu-text-sm', 13.0, 13.0),
    ('--vu-text-base', 14.0, 14.0),
    ('--vu-text-md', 16.0, 16.0),
    ('--vu-text-lg', 20.0, 20.0),
    ('--vu-text-xl', 22.0, 24.0),
    ('--vu-text-2xl', 28.0, 32.0),
    ('--vu-text-3xl', 36.0, 44.0),
]
PESOS_MAXIMOS = 3
# Palavras-chave de `font-weight` que não são degrau de peso: `inherit` não declara
# peso nenhum. `normal`/`bold` são equivalentes numéricos e entram como 400/700.
RE_PESO_NUMERICO = re.compile(r'^\d+(?:\s+\d+)?$')
PESO_SINONIMO = {'normal': '400', 'bold': '700'}

RE_SIZE = re.compile(r'font-size:\s*([^;]+);')
RE_WEIGHT = re.compile(r'font-weight:\s*([^;]+);')
RE_VAR = re.compile(r'var\(\s*(--vu-text-[a-z0-9-]+)\s*\)')
RE_REM = re.compile(r'([\d.]+)rem')
RE_PX = re.compile(r'([\d.]+)px')
RE_CLAMP = re.compile(r'clamp\(\s*([\d.]+)rem\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)rem\s*\)')
RE_TOKEN_DECL = re.compile(
    r'(--vu-text-[a-z0-9-]+)\s*:\s*clamp\(\s*([\d.]+)rem\s*,\s*[^,]+,\s*([\d.]+)rem\s*\)'
)
RE_TOKEN_SIMPLES = re.compile(r'(--vu-text-[a-z0-9-]+)\s*:\s*([\d.]+)rem\s*;')
# Pesos declarados por token: `font-weight: var(--vu-weight-strong)` conta como 700,
# senão o gate de ≤3 pesos passa por vacuidade (0 distintos sempre ≤ 3).
RE_PESO_DECL = re.compile(r'(--vu-weight-[a-z0-9-]+)\s*:\s*(\d{3})\s*;')
RE_PESO_USO = re.compile(r'^var\(\s*(--vu-weight-[a-z0-9-]+)\s*\)$')

RE_QUALQUER_VAR = re.compile(r'var\(\s*(--[a-zA-Z0-9_-]+)')
# declaração = token abrindo um bloco (`{`) ou logo após um `;`; dentro de `var(` não conta
RE_DECL_SCSS = re.compile(r'(?:^|[{;])\s*(--[a-zA-Z0-9_-]+)\s*:', re.M)
RE_SET_PROPERTY = re.compile(r"setProperty\(\s*['\"](--[a-zA-Z0-9_-]+)['\"]")
RE_NG_STYLE_TOKEN = re.compile(r"['\"](--[a-zA-Z0-9_-]+)['\"]\s*:")
RE_STYLE_ATTR = re.compile(r'style\s*=\s*["\'][^"\']*?(--[a-zA-Z0-9_-]+)\s*:')
RE_BRACKET_STYLE = re.compile(r'\[style\.(--[a-zA-Z0-9_-]+)\]')

# Mesmo glob para declarações e usos: um só conjunto de fontes.
SUFIXOS_CENSO = {'.scss', '.html', '.ts'}
# Contexto de estilo: onde um `var()` significa uso, e não prosa/comentário.
RE_ABRE_STYLES_LISTA = re.compile(r'\bstyles\s*:\s*\[')
RE_ABRE_STYLES_TEXTO = re.compile(r'\bstyles\s*:\s*[`\'"]')
RE_ABRE_STYLE_UNICO = re.compile(r'\bstyle\s*:\s*[`\'"]')
RE_ABRE_STYLE_HTML = re.compile(r'<style\b')
RE_FECHA_STYLE_HTML = '</style>'
RE_LINHA_ESTILO_DIRETO = re.compile(
    r'style\s*=|\[style|\[ngStyle\]|\bngStyle\b|setProperty\('
)

# Texto que não é texto: interpolação Angular e cabeçalho de bloco de controle.
RE_MUSTACHE = re.compile(r'\{\{.*?\}\}', re.S)
RE_BLOCO_ANGULAR = re.compile(
    r'@(?:if|else\s+if|for|switch|case|default|defer|placeholder|loading|error|empty|let)\b[^{]*\{'
)
RE_LETRA_SOLTA = re.compile(r'[^\W\d_]{2,}', re.U)  # \p{L}{2,} em Python puro


def escala(src: Path) -> list[tuple[str, float, float]]:
    """Lê a escala de `styles/tokens.scss` (fonte única); senão, tabela do UX-0."""
    tokens = src / 'styles' / 'tokens.scss'
    if not tokens.exists():
        return FALLBACK
    texto = tokens.read_text()
    achados: dict[str, tuple[float, float]] = {}
    for nome, minimo, maximo in RE_TOKEN_DECL.findall(texto):
        achados[nome] = (round(float(minimo) * 16, 2), round(float(maximo) * 16, 2))
    for nome, valor in RE_TOKEN_SIMPLES.findall(texto):
        achados.setdefault(nome, (round(float(valor) * 16, 2), round(float(valor) * 16, 2)))
    if not achados:
        return FALLBACK
    return [(n, a, b) for n, (a, b) in achados.items()]


def para_px(valor: str, tabela: list[tuple[str, float, float]]) -> tuple[float, float] | None:
    valor = valor.strip()
    achado = RE_VAR.search(valor)
    if achado:  # `font-size: var(--vu-text-sm)` resolve para o intervalo do token
        for nome, minimo, maximo in tabela:
            if nome == achado.group(1):
                return minimo, maximo
        return None
    achado = RE_CLAMP.search(valor)
    if achado:
        return round(float(achado.group(1)) * 16, 2), round(float(achado.group(3)) * 16, 2)
    achado = RE_REM.search(valor)
    if achado:
        px = round(float(achado.group(1)) * 16, 2)
        return px, px
    achado = RE_PX.search(valor)
    if achado:
        px = round(float(achado.group(1)), 2)
        return px, px
    return None


def _na_escala(px_min: float, px_max: float, tabela: list[tuple[str, float, float]]) -> bool:
    """On-scale = o valor existe em algum viewport. `clamp` só pinta os extremos."""
    a, b = round(px_min, 2), round(px_max, 2)
    if a == b:
        return any(abs(m - a) < 0.01 or abs(M - a) < 0.01 for _, m, M in tabela)
    return any(abs(m - a) < 0.01 and abs(M - b) < 0.01 for _, m, M in tabela)


def token_para(px_max: float, tabela: list[tuple[str, float, float]]) -> str | None:
    for nome, minimo, maximo in tabela:
        if minimo - 0.01 <= px_max <= maximo + 0.01:
            return nome
    return min(tabela, key=lambda e: abs(e[2] - px_max))[0] if tabela else None


def linhas_sem_fontface(conteudo: str) -> list[tuple[int, str]]:
    """Devolve (número, linha) fora de blocos `@font-face`."""
    saida: list[tuple[int, str]] = []
    profundidade = 0
    dentro = False
    for numero, linha in enumerate(conteudo.splitlines(), 1):
        if not dentro and '@font-face' in linha:
            dentro = True
        if dentro:
            profundidade += linha.count('{') - linha.count('}')
            if profundidade <= 0:
                dentro = False
                profundidade = 0
            continue
        saida.append((numero, linha))
    return saida


class CensoAria(HTMLParser):
    """Conta `aria-hidden="true"` e mede o texto **próprio** de cada elemento."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.pilha: list[dict] = []
        self.achados: list[dict] = []

    def handle_starttag(self, tag, attrs):
        mapa = dict(attrs)
        self.pilha.append(
            {
                'tag': tag,
                'linha': self.getpos()[0],
                'oculto': mapa.get('aria-hidden') == 'true',
                'texto': [],
            }
        )

    def handle_startendtag(self, tag, attrs):
        mapa = dict(attrs)
        if mapa.get('aria-hidden') == 'true':
            self.achados.append({'linha': self.getpos()[0], 'texto': ''})

    def handle_endtag(self, tag):
        for i in range(len(self.pilha) - 1, -1, -1):
            if self.pilha[i]['tag'] == tag:
                no = self.pilha.pop(i)
                if no['oculto']:
                    self.achados.append(
                        {'linha': no['linha'], 'texto': ''.join(no['texto']).strip()}
                    )
                # texto de filho não é texto próprio do ancestral
                del self.pilha[i:]
                return

    def handle_data(self, data):
        if self.pilha and self.pilha[-1]['oculto']:
            self.pilha[-1]['texto'].append(data)


def normalizar_texto(bruto: str) -> str:
    """Remove interpolação e blocos de controle; sobra só o que é texto estático."""
    texto = RE_MUSTACHE.sub('', bruto)
    texto = RE_BLOCO_ANGULAR.sub('', texto)
    texto = texto.replace('{', '').replace('}', '')
    return re.sub(r'\s+', ' ', texto).strip()


def fontes_censo(src: Path) -> list[Path]:
    """O conjunto único de fontes: `.scss`, `.html` e `.ts`.

    Declarações e usos leem **este** conjunto. Antes, o censo de declarações
    varria as três extensões e o de usos só os `.scss`, e o token declarado em
    componente era acusado de fantasma.
    """
    return sorted(
        Path(caminho)
        for caminho in glob.glob(str(src / '**' / '*.*'), recursive=True)
        if Path(caminho).suffix in SUFIXOS_CENSO
    )


def trechos_de_uso(caminho: Path) -> list[tuple[int, str]]:
    """(número, linha) onde um `var()` é uso de estilo, com arquivo real.

    `.scss` é estilo inteiro. Em `.html` valem bloco `<style>` e linhas com
    atributo/binding `style`/`ngStyle`. Em `.ts` valem o bloco `styles:` do
    componente (lista ou template literal), o `style:` inline e as linhas de
    `setProperty`/`[style…]`. Fica de fora o que não é estilo — comentário,
    prosa — para o censo não inflar com falso fantasma.
    """
    linhas = caminho.read_text().splitlines()
    if caminho.suffix == '.scss':
        return list(enumerate(linhas, 1))
    saida: list[tuple[int, str]] = []
    modo: str | None = None  # 'lista' | 'texto' | 'style'
    profundidade = 0
    fecha_com = '`'
    for numero, linha in enumerate(linhas, 1):
        if modo == 'lista':
            profundidade += linha.count('[') - linha.count(']')
            if profundidade <= 0:
                modo = None
                continue
            saida.append((numero, linha))
            continue
        if modo == 'texto':
            saida.append((numero, linha))
            if fecha_com in linha:
                modo = None
            continue
        if modo == 'style':
            saida.append((numero, linha))
            if RE_FECHA_STYLE_HTML in linha:
                modo = None
            continue

        comentario = linha.lstrip().startswith(('//', '*', '/*'))
        achado = None if comentario else RE_ABRE_STYLES_LISTA.search(linha)
        if achado:
            resto = linha[achado.end():]
            profundidade = 1 + resto.count('[') - resto.count(']')
            saida.append((numero, linha))
            modo = 'lista' if profundidade > 0 else None
            continue
        achado = None if comentario else (
            RE_ABRE_STYLES_TEXTO.search(linha) or RE_ABRE_STYLE_UNICO.search(linha)
        )
        if achado:
            fecha_com = linha[achado.end() - 1]
            saida.append((numero, linha))
            if fecha_com not in linha[achado.end():]:
                modo = 'texto'
            continue
        if caminho.suffix == '.html' and RE_ABRE_STYLE_HTML.search(linha):
            saida.append((numero, linha))
            if RE_FECHA_STYLE_HTML not in linha:
                modo = 'style'
            continue
        if not comentario and RE_LINHA_ESTILO_DIRETO.search(linha):
            saida.append((numero, linha))
    return saida



def pesos_declarados(src: Path) -> dict[str, str]:
    """`--vu-weight-*` → número, lidos de `styles/tokens.scss` (fonte única)."""
    tokens = src / 'styles' / 'tokens.scss'
    if not tokens.exists():
        return {}
    return dict(RE_PESO_DECL.findall(tokens.read_text()))


def auditar(src: Path) -> dict:
    tabela = escala(src)
    pesos_tokens = pesos_declarados(src)
    fontes = fontes_censo(src)
    arquivos_scss = sorted(glob.glob(str(src / '**' / '*.scss'), recursive=True))

    # 1 + 2 — tipografia
    itens = []
    pesos: dict[str, list[str]] = {}
    palavras_chave: dict[str, list[str]] = {}
    for caminho in arquivos_scss:
        rel = str(Path(caminho).relative_to(src))
        conteudo = Path(caminho).read_text()
        for numero, linha in enumerate(conteudo.splitlines(), 1):
            for casamento in RE_SIZE.finditer(linha):
                bruto = casamento.group(1).strip()
                faixa = para_px(bruto, tabela)
                itens.append(
                    {
                        'arquivo': rel,
                        'linha': numero,
                        'valor': bruto,
                        'px': faixa,
                        'token': token_para(faixa[1], tabela) if faixa else None,
                        'on_scale': _na_escala(*faixa, tabela) if faixa else False,
                    }
                )
        for numero, linha in linhas_sem_fontface(conteudo):
            for casamento in RE_WEIGHT.finditer(linha):
                bruto = casamento.group(1).strip()
                valor = PESO_SINONIMO.get(bruto.lower(), bruto)
                por_token = RE_PESO_USO.match(valor)
                if por_token:
                    resolvido = pesos_tokens.get(por_token.group(1))
                    if resolvido is None:
                        palavras_chave.setdefault(valor, []).append(f'{rel}:{numero}')
                        continue
                    valor = resolvido
                if not RE_PESO_NUMERICO.match(valor):
                    palavras_chave.setdefault(valor, []).append(f'{rel}:{numero}')
                    continue
                pesos.setdefault(valor, []).append(f'{rel}:{numero}')
    fora = [i for i in itens if not i['on_scale']]

    # 3 — token citado e ausente (mesmo conjunto de fontes para declarar e usar)
    declarados: set[str] = set()
    for caminho in fontes:
        texto = caminho.read_text()
        declarados |= set(RE_DECL_SCSS.findall(texto))
        declarados |= set(RE_SET_PROPERTY.findall(texto))
        declarados |= set(RE_NG_STYLE_TOKEN.findall(texto))
        declarados |= set(RE_STYLE_ATTR.findall(texto))
        declarados |= set(RE_BRACKET_STYLE.findall(texto))
    fantasmas: list[dict] = []
    usados: set[str] = set()
    for caminho in fontes:
        rel = str(caminho.relative_to(src))
        for numero, linha in trechos_de_uso(caminho):
            for casamento in RE_QUALQUER_VAR.finditer(linha):
                nome = casamento.group(1)
                usados.add(nome)
                if nome in declarados:
                    continue
                resto = linha[casamento.end():]
                tem_fallback = resto.lstrip().startswith(',') and ')' in resto
                fantasmas.append(
                    {
                        'arquivo': rel,
                        'linha': numero,
                        'token': nome,
                        'fallback': tem_fallback,
                        'declaracao': linha.strip(),
                    }
                )

    # 4 — aria-hidden com palavra
    htmls = sorted(glob.glob(str(src / '**' / '*.html'), recursive=True))
    total_ocultos = 0
    com_texto = 0
    reprovados: list[dict] = []
    aprovados: list[dict] = []
    vazios: list[dict] = []
    interpolados: list[dict] = []
    for caminho in htmls:
        rel = str(Path(caminho).relative_to(src))
        censo = CensoAria()
        censo.feed(Path(caminho).read_text())
        total_ocultos += len(censo.achados)
        for achado in censo.achados:
            texto = normalizar_texto(achado['texto'])
            registro = {'arquivo': rel, 'linha': achado['linha'], 'texto': texto}
            if not texto:
                # nada visível a anunciar; guardado para não virar exclusão silenciosa
                if '{{' in achado['texto']:
                    interpolados.append(registro)
                else:
                    vazios.append(registro)
                continue
            com_texto += 1
            if RE_LETRA_SOLTA.search(texto):
                reprovados.append(registro)
            else:
                aprovados.append(registro)

    return {
        'src': str(src),
        'arquivos': len(arquivos_scss),
        'arquivos_html': len(htmls),
        'declaracoes': len(itens),
        'fora_da_escala': len(fora),
        'valores_fora': sorted({i['valor'] for i in fora}),
        'itens_fora': fora,
        'escala': tabela,
        'pesos': {k: len(v) for k, v in sorted(pesos.items())},
        'pesos_distintos': sorted(pesos),
        'pesos_origem': {k: v[:8] for k, v in sorted(pesos.items())},
        'pesos_palavras_chave': {k: len(v) for k, v in sorted(palavras_chave.items())},
        'tokens_usados': len(usados),
        'tokens_declarados': len(declarados),
        'tokens_fantasmas': fantasmas,
        'aria_ocultos': total_ocultos,
        'aria_com_texto': com_texto,
        'aria_reprovados': reprovados,
        'aria_aprovados': aprovados,
        'aria_vazios': vazios,
        'aria_interpolados': interpolados,
    }


def veredicto(dados: dict) -> int:
    codigo = 0
    if dados['fora_da_escala'] or len(dados['pesos_distintos']) > PESOS_MAXIMOS:
        codigo = max(codigo, 1)
    if dados['tokens_fantasmas'] or dados['aria_reprovados']:
        codigo = 2
    return codigo


def relatar(dados: dict, verboso: bool) -> None:
    print(f"src: {dados['src']}")
    print(f"arquivos: {dados['arquivos']}  declarações: {dados['declaracoes']}")
    print(f"fora da escala: {dados['fora_da_escala']}")
    print(f"valores fora: {dados['valores_fora']}")
    print(
        f"pesos: {dados['pesos_distintos']} "
        f"({len(dados['pesos_distintos'])} numéricos distintos, limite {PESOS_MAXIMOS})"
    )
    for peso, qtd in dados['pesos'].items():
        print(f"  {peso}: {qtd}")
    if dados['pesos_palavras_chave']:
        print(f"  palavras-chave (não contam como peso): {dados['pesos_palavras_chave']}")
    print(
        f"tokens: {dados['tokens_usados']} usados / {dados['tokens_declarados']} declarados "
        f"/ {len(dados['tokens_fantasmas'])} fantasma(s)"
    )
    for fantasma in dados['tokens_fantasmas']:
        marca = 'fallback' if fantasma['fallback'] else 'SEM fallback (IACVT)'
        print(
            f"  AUSENTE {fantasma['token']} — {fantasma['arquivo']}:{fantasma['linha']} "
            f"[{marca}] {fantasma['declaracao']}"
        )
    print(
        f"aria-hidden: {dados['aria_ocultos']} elementos, {dados['aria_com_texto']} com texto, "
        f"{len(dados['aria_reprovados'])} com palavra, "
        f"{len(dados['aria_aprovados'])} só com glifo/letra solta, "
        f"{len(dados['aria_interpolados'])} só com interpolação, "
        f"{len(dados['aria_vazios'])} vazios"
    )
    for item in dados['aria_reprovados']:
        print(f"  REPROVA {item['arquivo']}:{item['linha']} → «{item['texto']}»")
    if verboso:
        for item in dados['aria_aprovados']:
            print(f"  ok glifo {item['arquivo']}:{item['linha']} → «{item['texto']}»")
        for item in dados['aria_interpolados']:
            print(f"  ok interpolação {item['arquivo']}:{item['linha']}")
        for item in dados['aria_vazios']:
            print(f"  ok vazio {item['arquivo']}:{item['linha']}")
        for item in dados['itens_fora'][:200]:
            print(f"  fora {item['arquivo']}:{item['linha']} {item['valor']} → {item['px']}")


# --------------------------------------------------------------------------- #
# autoteste: prova os vereditos numa árvore sintética, fora do repositório
# --------------------------------------------------------------------------- #
LIMPO_SCSS = """
:root { --vu-text-sm: 13px; --accent: #24765b; --color-border-subtle: #dde1e6; }
@font-face { font-family: X; font-weight: 300; src: url(x.woff2); }
@font-face { font-family: Y; font-weight: 700; src: url(y.woff2); }
.a { font-size: var(--vu-text-sm); font-weight: 400; border: 1px solid var(--color-border-subtle); }
.b { font-size: 13px; font-weight: 700; }
.c { font-weight: 400; }
"""
LIMPO_HTML = '<div><span aria-hidden="true">S</span><p>texto</p></div>'

# Componente Angular: o CSS mora no `.ts`. É o caso do `verification-panel.ts`.
COMPONENTE_TEXTO = """// var(--comentario-fora-de-estilo) não é uso de estilo
@Component({
  selector: 'vu-a',
  styles: `
    .a { background: var(--nao-existe-ts, #fff); }
  `,
})
export class A {}
"""
COMPONENTE_LISTA = """@Component({
  selector: 'vu-b',
  styles: ['.b { color: var(--nao-existe-array); }'],
})
export class B {}
"""


def _arvore(
    base: Path, scss: str, html: str = LIMPO_HTML, ts: dict[str, str] | None = None
) -> Path:
    (base / 'styles').mkdir(parents=True, exist_ok=True)
    (base / 'styles' / 'a.scss').write_text(scss)
    (base / 'app.html').write_text(html)
    for nome, conteudo in (ts or {}).items():
        alvo = base / nome
        alvo.parent.mkdir(parents=True, exist_ok=True)
        alvo.write_text(conteudo)
    return base


def selftest() -> int:
    casos = []
    with tempfile.TemporaryDirectory(prefix='vu-audit-selftest-') as tmp:
        raiz = Path(tmp)
        # 1 — limpo: 2 pesos (400/700), `@font-face` com 300/700 ignorado, token declarado
        dados = auditar(_arvore(raiz / 'limpo', LIMPO_SCSS))
        casos.append(
            (
                'limpo',
                0,
                veredicto(dados),
                f"fora={dados['fora_da_escala']} pesos={dados['pesos_distintos']} "
                f"fantasmas={len(dados['tokens_fantasmas'])} aria={len(dados['aria_reprovados'])}",
            )
        )
        # 2 — fora da escala
        dados = auditar(_arvore(raiz / 'fora', LIMPO_SCSS + '\n.d { font-size: 17px; }\n'))
        casos.append(('fora_da_escala', 1, veredicto(dados), f"fora={dados['fora_da_escala']}"))
        # 3 — peso demais sem @font-face
        dados = auditar(
            _arvore(raiz / 'peso', LIMPO_SCSS + '\n.e { font-weight: 500; }\n.f { font-weight: 600; }\n')
        )
        casos.append(
            ('peso_demais', 1, veredicto(dados), f"distintos={dados['pesos_distintos']}")
        )
        # 4 — token citado e ausente, com fallback
        dados = auditar(
            _arvore(raiz / 'fantasma', LIMPO_SCSS + '\n.g { color: var(--accent-subtle, #6366f1); }\n')
        )
        casos.append(
            (
                'token_ausente',
                2,
                veredicto(dados),
                f"fantasmas={[f['token'] for f in dados['tokens_fantasmas']]}",
            )
        )
        # 5 — aria-hidden com palavra
        dados = auditar(
            _arvore(raiz / 'aria', LIMPO_SCSS, '<div><span aria-hidden="true">Atualização</span></div>')
        )
        casos.append(
            (
                'aria_palavra',
                2,
                veredicto(dados),
                f"reprovados={[r['texto'] for r in dados['aria_reprovados']]}",
            )
        )
        # 6 — interpolação e bloco @if não contam como palavra
        dados = auditar(
            _arvore(
                raiz / 'interp',
                LIMPO_SCSS,
                '<div aria-hidden="true">{{ icon }}</div>'
                '<div aria-hidden="true">@if (x) { ⌄ }</div>',
            )
        )
        casos.append(
            (
                'interpolacao_nao_conta',
                0,
                veredicto(dados),
                f"reprovados={[r['texto'] for r in dados['aria_reprovados']]}",
            )
        )
        # 7 — fantasma em `styles:` de componente .ts (template literal e lista).
        #     Prova que o censo de usos varre o mesmo glob do censo de declarações.
        dados = auditar(
            _arvore(
                raiz / 'fantasma_ts',
                LIMPO_SCSS,
                ts={
                    'app/a.component.ts': COMPONENTE_TEXTO,
                    'app/b.component.ts': COMPONENTE_LISTA,
                },
            )
        )
        tokens = sorted(f['token'] for f in dados['tokens_fantasmas'])
        so_ts = all(f['arquivo'].endswith('.ts') for f in dados['tokens_fantasmas'])
        locais = [f"{f['arquivo']}:{f['linha']}" for f in dados['tokens_fantasmas']]
        esperado_ts = ['--nao-existe-array', '--nao-existe-ts']
        obtido = veredicto(dados) if tokens == esperado_ts and so_ts else -1
        casos.append(
            (
                'fantasma_em_styles_ts',
                2,
                obtido,
                f"tokens={tokens} arquivos={locais}",
            )
        )
        # 8 — peso escrito por token resolve para o número: 4 degraus distintos
        #     reprovam. Sem a resolução, `distintos=[]` e o gate passaria vazio.
        base = _arvore(
            raiz / 'peso_token',
            '.a { font-weight: var(--vu-weight-regular); }\n'
            '.b { font-weight: var(--vu-weight-medium); }\n'
            '.c { font-weight: var(--vu-weight-strong); }\n'
            '.d { font-weight: var(--vu-weight-heavy); }\n',
        )
        (base / 'styles' / 'tokens.scss').write_text(
            ':root {\n'
            '  --vu-weight-regular: 400;\n'
            '  --vu-weight-medium: 500;\n'
            '  --vu-weight-strong: 700;\n'
            '  --vu-weight-heavy: 800;\n'
            '}\n'
        )
        dados = auditar(base)
        casos.append(
            (
                'peso_por_token',
                1,
                veredicto(dados),
                f"distintos={dados['pesos_distintos']}",
            )
        )
    falhas = 0
    for nome, esperado, obtido, detalhe in casos:
        estado = 'ok' if esperado == obtido else 'FALHA'
        falhas += esperado != obtido
        print(f"selftest {estado:6} {nome:24} esperado={esperado} obtido={obtido}  {detalhe}")
    print(f"selftest: {len(casos) - falhas}/{len(casos)} casos")
    return 0 if falhas == 0 else 3


def main(argv: list[str]) -> int:
    if '--selftest' in argv:
        return selftest()
    src = SRC_PADRAO
    if '--src' in argv:
        src = Path(argv[argv.index('--src') + 1]).resolve()
    if not src.exists():
        print(f'src inexistente: {src}', file=sys.stderr)
        return 2
    dados = auditar(src)
    if '--json' in argv:
        dados.pop('itens_fora', None)
        dados.pop('pesos_origem', None)
        print(json.dumps(dados, ensure_ascii=False, indent=2, default=str))
    else:
        relatar(dados, '--verbose' in argv)
    codigo = veredicto(dados)
    if '--json' not in argv:
        print(f'EXIT={codigo}')
    return codigo


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
