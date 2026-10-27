# Vetor Urbano — estado geral em 26/10/2026

Resumo para acompanhamento do responsável. Branch `integration/functional-spec-v1`, `HEAD c2f9a0c`.
Não substitui `PLAN.md` nem `docs/product/ux-lotes.md`; é a leitura de conjunto.

## 1. O que existe agora que não existia antes (spec funcional)

Os 36 tickets do programa funcional estão **implementados localmente**, com evidência sintética. Em
linguagem de resultado:

- **Consulta completa pelo servidor**: filtrar por pilar, período, território e raio, com mapa e lista
  sincronizados, agrupamento de pins e estado de carga/erro/vazio em cada tela.
- **API Java + PostgreSQL/PostGIS de verdade**: as ocorrências são persistidas e consultadas pela API,
  com migrações versionadas (a base sintética está na V23).
- **Contas com sessão e duplo fator**: cadastro com confirmação por e-mail local, login, recuperação,
  autoatendimento, encerramento de conta e MFA obrigatório para Administrador.
- **Revisão e publicação humana**: fila de revisão, publicação, correção e retirada com histórico
  auditável; canal privado de correções para o usuário.
- **Coleta de fonte autorizada** (Instituto Fogo Cruzado) com pausa/retomada, idempotência e backfill
  retroativo — **sem publicação automática**: tudo passa por revisão.
- **Painel de operação** (falhas de coleta, fila de revisão, confirmações), **confiabilidade versionada**
  das ocorrências e **recomendação mensal** sobre notas de fontes.
- **Relatórios e exportação**: recorte próprio, síntese determinística, comparação de períodos, mapa de
  calor, XLSX com crédito de fonte e PDF diagramado.
- **Catálogo territorial versionado** (V23): municípios por código IBGE, com proveniência por versão e
  publicação apenas da versão aprovada. É o que alimenta o seletor de território no painel de raio.

## 2. O que mudou na interface (UX/UI, por lote)

Em linguagem de tela — o que se vê e o que deixou de acontecer:

- **Tipografia (UX-0/UX-1)** — a tela tem agora uma escala só. Título principal com 28 px no celular e
  32 px no desktop, três pesos em vez de seis, e nenhum texto com tamanho improvisado: eram 68
  declarações fora da escala, hoje são zero.
- **Cores definidas uma vez (UX-1b/UX-1d/UX-9)** — o cartão branco fixo que aparecia no tema escuro
  acabou; texto branco sobre verde do aviso saiu de 1,67:1 (ilegível) para 11:1; o selo de ocorrências
  coincidentes no mapa saiu de 1,96:1 no escuro para 9,22:1; o âmbar do marcador de busca chegou a
  5,4:1, contra 3,75 antes.
- **Contornos que não existiam (UX-1c)** — três blocos da tela eram desenhados **sem borda nenhuma**
  porque o token não existia; agora têm contorno. E um **auditor de tipografia e token** passou a rodar
  no build: se alguém reintroduzir um tamanho ou um token fantasma, o build falha em vez de passar.
- **Contorno de controle (UX-9)** — botões, campos e seleções ficaram identificáveis nos dois temas:
  3,36:1 no claro e 4,30:1 no escuro. O chip de categoria selecionado passou a ser mais forte que o
  inativo (6,13:1), em vez de mais apagado.
- **Alvos de toque (UX-3)** — na tela de entrada, todo botão, link e campo visível tem no mínimo 44 px
  (os painéis atrás do gate de sessão não foram medidos). Havia 14 de 20 abaixo disso;
  os links do topo eram **cortados** a 320 e 390 px; hoje nenhum. No celular o rodapé virou duas colunas
  para não triplicar de altura, e nenhuma tela rola de lado.
- **Movimento (UX-4)** — as animações usam três durações (120/240/400 ms) em vez de sete valores soltos.
  Saiu o `420 ms` que estava fora do vocabulário de três durações. Quem pede "menos
  movimento" no sistema operacional não vê animação nenhuma.
- **Texto de apoio (UX-5)** — o paredão de explicação da tela de entrada virou **uma linha de 51
  caracteres**: «Explore ocorrências por território, período e tipo.» As limitações do dado continuam
  visíveis, em nota própria, e não foram cortadas.
- **Shell móvel (UX-6)** — no celular a barra do topo caiu de **233 px para 54 px** e o conteúdo passou
  de **71% para 93% da tela**. Há barra inferior com cinco destinos, botão flutuante «Registrar
  ocorrência» e uma folha que abre com o botão de tema.
- **Ritmo dos painéis (UX-2)** — espaçamento interno padronizado (12 e 16 px) e vãos de 12 px; os
  cartões deixaram de ter alturas e respiros diferentes entre si.
- **Estado da tela (UX-7, em fecho)** — a área de resultados passa a declarar o que está fazendo
  (`initial`, `loading`, `empty`, `error`, `ready`, `refreshing`). Ao medir isso, apareceu um defeito
  real: quando um filtro não retorna nada, a tela mostrava «sem resultados» e o app dizia «estado
  inicial». É o que está sendo corrigido agora.

## 3. O que está pendente e por quê

**Depende de decisão sua**

- **UX-7b — ordem de boot.** A tela de entrada tem um salto de layout a 390 px (CLS 0,1394, contra teto
  0,1), causado pela troca de ramo durante o boot. Consertar mexe em **quando o app começa a buscar
  dados**. Opção A: autorizar o lote (critério triplo: CLS < 0,1, `test:ci` 225/225 e gate verde).
  Opção B: manter como dívida datada e não abrir.
- **Push.** 15 commits locais não enviados. Enviar é ato seu.
- **Ticket 36 (documentos institucionais)** — publicação jurídica adiada por você (D3). Sem publicação,
  o ticket não fecha.
- **Aceite formal** dos lotes UX-2…UX-6 e do UX-7 quando fechar.

**Depende de ferramenta ou autorização externa**

- **B5 / `integrated-review`** (controlador de tickets): bloqueado por limitação de ferramenta — a
  `baseline_worktree` é anterior às correções e não existe rebaseline. Não é achado aberto.
- **UXH-04/05/06** (bairros, RAs, APs do Rio e demais municípios, centro por local): falta fonte
  territorial com licença e geometria validadas.
- **Lotes E, F e G do piloto** (UXH-18…23): hospedagem, e-mail, textos jurídicos e liberação de
  convidados exigem autorização separada. **Lote G está proibido por você.**

**Depende de trabalho do time**

- **UX-7** — `empty` corrigido; régua em **5/6 no DOM** (`initial` não é pintado em nenhum dos dois
  modos, provado por sonda no demo e em `?consulta=api`), com o sexto estado asserido no teste unitário.
  Fecha com o commit de código + régua + teste.
- **UX-8** — contraste do painel de confiabilidade no tema escuro (`2,11 / 2,80 / 2,54`); régua pronta,
  alvo definido (texto 4,5:1, contorno 3:1).
- **Lotes C e D do piloto** (UXH-07…17): 11 tickets de construção de interface — navegação, mapa,
  configurações, informes, histórico, relatórios. Não iniciados; é a próxima tranche depois de UX-7/UX-8.

**Dívidas datadas que ficam registradas, não consertadas**

- `controls.scss:376` — âmbar literal em borda sobre fundo a 19%, fora dos tokens.
- `.area-result-mark` — fundo de 12% em literal; a razão de contraste anda se a tinta mudar.
- A 390 px, a área de resultados fica `display:none` no modo Mapa: o estado só é percebível na Lista.
- `--color-warning-ink`, `#8aae9d` e `#17684f` são valores literais com motivo escrito no código.

## 4. Estado da árvore

`HEAD c2f9a0c`, **17 commits locais à frente** de `origin/integration/functional-spec-v1` (mais o commit
de documentação que publica este arquivo), nenhum enviado. **UX-7 commitado** em `c2f9a0c` — código,
régua e teste no mesmo commit, `test:ci` **226/226** e `verify.sh web` `EXIT=0`. Árvore de trabalho com
**3 arquivos sujos da régua do UX-8** (`e2e/helpers/reliability-fixtures.ts` não rastreado,
`e2e/reliability-panel.spec.ts` e `e2e/contrast-tokens.spec.ts` modificados) — a régua está vermelha
com `.reliability-pill` a **2,80** no escuro, e o passe é do @executor.
`main` intocada, sem merge.
