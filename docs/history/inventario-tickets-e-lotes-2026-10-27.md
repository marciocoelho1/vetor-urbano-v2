# Vetor Urbano — inventário de tickets e lotes

27/10/2026 · branch `integration/functional-spec-v1` · `HEAD 0148153`.
Legenda: ✓ implementado e com aceite registrado · ◐ parcial · ✗ não implementado.
**Atenção ao que ✓ significa aqui:** é estado de implementação e aceite, **não** prova de execução da
suíte de navegador. O selo por execução está na seção 5 e ainda não foi produzido com perfil válido.
Datas de implementação vêm do commit que fechou a entrega; onde não há commit datado, a data é a do
checkpoint em `docs/history/`. "Solicitado" = rodada em que o item entrou na spec.

## 1. Spec funcional — 36 tickets (solicitados em 15/10/2026; realocados em 17/10/2026)

| # | Título | Estado | Implementado |
|---|---|---|---|
| 01 | Consultar o catálogo aprovado na abertura | ✓ | 15/10 |
| 02 | Explorar ocorrências de um mesmo acontecimento | ✓ | 15/10 |
| 03 | Combinar e remover filtros sem duplicar resultados | ✓ | 15/10 |
| 04 | Consultar tempo impreciso e confirmação de andamento | ✓ | 15/10 |
| 05 | Aplicar território e distinguir registros só em lista | ✓ | 15/10 |
| 06 | Alternar Modo simples e Análise e Inteligência | ✓ | 15/10 |
| 07 | Selecionar agrupamentos e pins sobrepostos | ✓ | 15/10 (checkpoint 18/10) |
| 08 | Consultar Informes Ativos por ponto manual | ✓ | 15/10 |
| 09 | Áreas de Risco com referência temporal | ✓ | 15/10 |
| 10 | Atualizar a consulta sem perder contexto | ✓ | 15/10 |
| 11 | Conhecer fontes e avaliação pela consulta | ✓ | 15/10 (checkpoint 18/10) |
| 12 | Consultar publicadas persistidas pela API | ✓ | 15/10 |
| 13 | Criar e confirmar conta de usuário | ✓ | 15/10 |
| 14 | Proteger módulos com sessão e MFA | ✓ | 15/10 |
| 15 | Recuperar, alterar e encerrar a própria conta | ✓ | 17/10 (15A/15B/15C) |
| 16 | Administrar fontes e lista pública | ✓ | 16/10 |
| 17 | Revisar e publicar sem duplicar clippings | ✓ | 17/10 |
| 18 | Corrigir ou retirar ocorrência publicada | ✓ | 17/10 |
| 19 | Consultar logs administrativos com retenção | ✓ | 17/10 |
| 20 | Coletar publicações de fonte autorizada | ✓ | 19/10 |
| 21 | Carregar publicações retroativas com retomada | ✓ | 21/10 |
| 22 | Acompanhar falhas de coleta e espera de revisão | ✓ | 22/10 |
| 23 | Avaliar confiabilidade versionada | ✓ | 22/10 |
| 24 | Decidir recomendação mensal de notas de fonte | ✓ | 22/10 |
| 25 | Proximidade e vigência no fluxo integrado | ✓ | 19/10 |
| 26 | Revisar versões de Áreas de Risco | ✓ | 18/10 (edição de campos 22/10) |
| 27 | Solicitar e acompanhar correção de dados | ✓ | 17/10 |
| 28 | Histórico avançado paginado | ✓ | 17/10 |
| 29 | Relatório com recorte independente | ✓ | 17/10 |
| 30 | Síntese determinística do relatório | ✓ | 17/10 |
| 31 | Comparar períodos ou territórios | ✓ | 17/10 |
| 32 | Concentração de ocorrências (mapa de calor) | ✓ | 17/10 |
| 33 | Exportar XLSX do recorte | ✓ | 17/10 |
| 34 | Exportar PDF do relatório | ✓ | 17/10 |
| 35 | Avisar atualizações na consulta aberta | ✓ | 19/10 |
| 36 | Documentos de uso, privacidade e metodologia | ◐ | rascunhos 15–22/10; **publicação adiada (D3)** |

## 2. Lotes de UX/UI (solicitados em 25/10/2026)

| Lote | Título | Estado | Implementado |
|---|---|---|---|
| C0 | Catálogo territorial, seletor e harness E2E | ✓ | 25/10 (`c0b70ac`, `b8c6027`, `5346f70`; docs 26/10 `9eaa9f5`) |
| UX-0 | Tokens: escala, espaço, movimento | ✓ | 25/10 (`51fe617`) |
| UX-1 | Escala tipográfica aplicada, 6 → 3 pesos | ✓ | 25/10 (`51fe617`) |
| UX-1b | Cores em token, pares de superfície e tinta | ✓ | 25/10 (`00bca0f`) |
| UX-1c | Contorno que não renderizava; auditor no gate | ✓ | 25/10 (`f03974a`) |
| UX-1d | Tinta de estado do badge de coincidentes | ✓ | 25/10 (`6c4ca14`, `56fdf8e`) |
| UX-9 | Contorno de controle 3:1 e tinta do âmbar | ✓ | 26/10 (`cedcfa9`, `5d054dd`, `9d710eb`) |
| UX-3 | Alvos de 44 px e separação de 8 px | ✓ | 26/10 (`84a308e`, `879f1dc`) |
| UX-4 | Três durações e par `reduce` | ✓ | 26/10 (`c07d781`, `6af9c66`) |
| UX-5 | Texto de apoio: 54 linhas → 1 bloco de 51 ch | ✓ | 26/10 (`dd4bad8`, `990f1fd`) |
| UX-6 | Shell móvel: barra, folha e botão flutuante | ✓ | 26/10 (`e1954d7`, `b84cc25`, `d374ef5`) |
| UX-2 | Ritmo e container dos painéis | ✓ | 26/10 (`284bbf1`, `db8c82c`) |
| UX-7 | Seis estados da consulta em `data-state` | ✓ | 26/10 (`c2f9a0c`; CLS fica no UX-7b) |
| UX-8 | Contraste do painel de confiabilidade | ✓ | 26/10 (`9d6cf37`, `59a4480`, `67088c3`, `06e572a`) |
| UX-7b | Salto de layout no boot (CLS 0,1394 a 390) | ✗ | não iniciado — decisão pendente |

## 3. Piloto UXH — 23 tickets em 7 lotes (solicitados em 23/10/2026)

| Ticket | Título | Lote | Estado | Implementado |
|---|---|---|---|---|
| UXH-01 | Reproduzir e reconciliar o candidato | A | ✓ | 24/10 (aceito) |
| UXH-02 | Inventariar fontes e cobertura metropolitana | A | ✓ | 24/10 (aceito) |
| UXH-03 | Municípios por catálogo territorial | B | ✓ | 25/10 (`c0b70ac`, `b8c6027`) |
| UXH-04 | Bairros, RAs e APs do Rio | B | ✗ | bloqueado: fonte territorial sem licença validada |
| UXH-05 | Bairros dos demais municípios da RMRJ | B | ✗ | bloqueado: fonte territorial sem licença validada |
| UXH-06 | Centro do raio por localidade | B | ◐ | município entregue no UXH-03; demais geometrias bloqueadas |
| UXH-07 | Navegação e linguagem responsivas | C | ✓ | 26/10 (`7bd0a1b`, `0148153`) |
| UXH-08 | Mapa ampliado, filtros e ferramentas unificados | C | ✓ | 27/10 (`f106d20` + `8462047`) — ferramentas acima do formulário, paginação, janela 36→280 px |
| UXH-09 | Área visível aplicada explicitamente | C | ✓ | 27/10 (`2cab078` + `35949f0`) — área no caminho API, raio substituído, contenção provada pelo par dentro/fora |
| UXH-10 | Mapa móvel com painéis exclusivos | C | ✓ | 27/10 (`3731d02`) — painéis exclusivos na folha, `10/10` + UX-6 `14/14` na mesma execução |
| UXH-11 | Telas administrativas em Configurações | C | ◐ | 27/10 (`7519706`) — incremento 1: moldura, acesso restrito, guarda de 403 (`7/11`) |
| UXH-12 | Detalhe único e retorno ao contexto | C | ✗ | não iniciado |
| UXH-13 | Informes com filtros no servidor | D | ✗ | não iniciado |
| UXH-14 | Histórico com filtros no topo | D | ✗ | não iniciado |
| UXH-15 | Relatórios com ciclo próprio | D | ✗ | não iniciado |
| UXH-16 | Gerar pelo mapa e separar filtros salvos | D | ✗ | não iniciado |
| UXH-17 | PDF e XLSX do mesmo resultado | D | ✗ | não iniciado |
| UXH-18 | Pacote de Áreas de Risco | E | ✗ | bloqueado: direitos de fonte |
| UXH-19 | Integração remota e operação segura | E | ✗ | bloqueado: provisionamento externo |
| UXH-20 | Formulário de feedback do piloto | E | ✗ | não iniciado |
| UXH-21 | Verificação do candidato integrado | F | ✗ | depende de 04, 06, 10–20 |
| UXH-22 | Implantar piloto em Neon/Render/Vercel | G | ✗ | **pendente por decisão do responsável** |
| UXH-23 | Homologar piloto e liberar convidados | G | ✗ | **pendente por decisão do responsável** |

## 4. Pendências que dependem do responsável

1. **Ticket 36** — publicação jurídica dos documentos institucionais (D3).
2. **Aceite formal** — UX-2 a UX-9 e UXH-07 aceitos em 26/10; **UXH-08 e UXH-09 entregues em 27/10** e aguardam aceite.
3. **Lotes B (UXH-04 a 06) e G (UXH-22/23)** — manter pendentes, por decisão de 26/10.

## 5. Selo por execução — ainda não produzido com perfil válido

A campanha de 27/10 no `HEAD 0148153` foi **invalidada e o número retirado**: a API subiu sem os quatro
limites que o próprio repositório documenta (`README.md:47` e `:71`). A assinatura do erro é exata —
`account-registration` acusou **890 s ≈ 14,8 min** de diferença onde esperava 5 s: era o TTL padrão de
15 minutos, não defeito do produto. **11 de 19 famílias vermelhas mediam o arranque, não o `HEAD`.**

Nova execução em curso, com o perfil documentado: `token-ttl=5s`, `recovery-ttl=5s`,
`resend-cooldown=1s`, `resends-per-hour=2`, **um processo por família** e `jdbc` provado por `/proc` a
cada ciclo. A linha final separa: quantas famílias fecharam com o perfil, quantas seguem vermelhas, e em
que classe cada uma cai (asserção de tempo/limite no caso · base não virgem · interferência entre specs,
que só pode ocorrer em `operations_panel`, onde quatro specs dividem a família).

Duas conclusões já firmadas e que não dependem do número novo:

- **volume de resíduo não explica os vermelhos** — quatro famílias verdes têm mais linhas que oito das
  vermelhas (`account_closure` 257 contra `account_recovery` 41), e os limites por conta vão na direção
  oposta (verdes 10/9, vermelhas 4/3);
- **o isolamento spec → família (UXH-01) não apaga os vermelhos sozinho**: dez das onze famílias rodam
  **um único spec**, então não há interferência entre specs para remover nelas. Ele continua necessário
  para `operations_panel` e ganha o item de **reset por ciclo** como higiene, não como causa.

**Requisito para o selo valer:** o script da campanha passa a ser versionado em `scripts/campanha-e2e.sh`,
com os quatro argumentos e o laço por família. Prova que mora em `scratch/` não é reproduzível por quem
clonar o repositório, e o padrão desta casa, desde o auditor tipográfico, é prova por comando versionado.

## 6. Retomada — 28/10, na ordem, sem reabrir nada

**Estado na pausa (27/10, 03h):** `integration/functional-spec-v1`, `HEAD 7519706`, `local = origin`, árvore com dois não rastreados (`e2e/admin-config.spec.ts`, este inventário).

**Fechados hoje, com hash:** UXH-08 (`f106d20`), UXH-09 (`2cab078` + `35949f0`), UXH-10 (`3731d02`, `10/10` + UX-6 `14/14` numa execução), UXH-11 incremento 1 (`7519706`, `7/11`).

**O que falta do UXH-11, em dois incrementos, nesta ordem:**

1. **Superfície de Logs + três estados** — vazio ≠ falha, `role="status"` no carregamento, `role="alert"` + tentar de novo no erro. Reusar `query-loading-state`, `query-error-state`, `empty-state`, `empty-action-btn`; `app.scss` está a 0,01 kB do teto, então CSS novo se paga apagando CSS morto **provado** no mesmo commit. Esperado: os quatro vermelhos de tela caem para um.
2. **Diálogo de descarte** — foco preso, `Escape` cancela, foco inicial no botão não destrutivo. É o último vermelho da régua (`admin-config.spec.ts`, 11 casos).

**Regras de método que a rodada produziu e que valem na retomada** (todas no §3 do `ux-lotes`): régua nova nasce com espera de estado; semente ancora na referência da tela; número viaja com hash e janela (`HH:MM:SSZ → HH:MM:SSZ`); gate se lê por `$?`, nunca por `| tail -1`; sonda HTTP só depois de `/auth/session` provar a sessão; CSS novo se paga apagando CSS morto provado.

**Dívidas datadas abertas:** `/auth/session` sem campo de segundo fator cumprido (tela não distingue "negado" de "MFA pendente"); teto do `app.scss`; folha móvel sem `role`/`aria-modal`/`inert`; sete specs de `VETOR_PERSISTED_E2E` fora do manifesto da campanha; selo por execução ainda não produzido.

## 7. Retomada 2 — pausa de 27/10 à noite

**Estado na pausa:** `integration/functional-spec-v1`, `HEAD 3b91115`, `local = origin`, árvore limpa.

**Fechados hoje, com hash:** UXH-08 (`f106d20`), UXH-09 (`2cab078`+`35949f0`), UXH-10 (`3731d02`), UXH-11 (`182d58f`, `21/21`, três portas de descarte, «Sair» recuperado no móvel), UXH-12 (`9722c2a`, `9/9`). README com o passo a passo de abertura (`6c96f51`).

**Em curso, commitado como WIP em `3b91115` (gate verde, régua NÃO rodada):** Lote D passada 1 — Histórico com tabela responsiva (um `@for`, duas apresentações), `[data-vu-history-table]`, `[data-vu-history-apply]` e o recorte aplicado (`historyAppliedFilters`), Reprodução temporal removida. **Falta:** complementos recolhíveis (destacados: `text`, período, `municipality`, `neighborhood`, `types`; recolhíveis: `subtypes`, `sourceId`, `minRating`/`maxRating`, `situation` — recolher nunca zera valor), marcação do snapshot, e o bloco de Informes com raio ≤5 km na requisição.

**Ordem da retomada:** 1) completar UXH-13+14 e rodar a régua uma vez; 2) UXH-15+16+17; 3) UXH-20. **Não fecham:** 04/05/06 (fonte territorial licenciada), 18/19 (provisionamento externo), 21 (depende), 22/23 (proibidos).

**Ambiente ao pausar:** PC desligado pelo dono. Ao retomar: `podman start vu-uxh01-five-db` (55442) e `vetor-spec-postgis` (55436), API em `8080`, `ng serve` em `4201`. A base do login manual é `vetor_spec_test` (55436); as 29 bases de família em `55442` têm contas sem senha fixa.

## 8. Retomada 3 — segunda pausa de 27/10

**Estado:** `HEAD 1cf906d`, `local = origin`, árvore limpa.

**Fechados hoje com hash:** UXH-08 `f106d20` · UXH-09 `2cab078`+`35949f0` · UXH-10 `3731d02` · UXH-11 `182d58f` (21/21) · UXH-12 `9722c2a` (9/9) · UXH-13+14 `1e6da36` (7/7) · README `6c96f51`.

**WIP `1cf906d`:** UXH-15/16 com os dez hooks de estado do relatório já no template (`report-state/-generate/-update/-new/-snapshot/-total/-period/-copy-map/-conflict/-alert`). **As réguas `report-state.spec.ts` e `report-exports.spec.ts` estão na árvore e NUNCA foram executadas** — o primeiro passo da retomada é rodar `report-state` uma vez.

**Ordem da retomada:** 1) `report-state` → commitar UXH-15/16 com o número; 2) UXH-17 (export bloqueado antes de gerar, PDF/XLSX com o total do snapshot, arquivo inspecionado); 3) UXH-20 (formulário de feedback). **Não fecham:** 04/05/06, 18/19, 21, 22/23.

**Modelo de trabalho (corrigido pelo dono):** a sala é stand-up; a execução acontece **dentro do turno de cada bot, na janela dele**, e ele volta só com decisão, bloqueio e resultado. Corrente que termina sem próximo turno para — e o @arquiteto avisa no Telegram quando isso acontece.
