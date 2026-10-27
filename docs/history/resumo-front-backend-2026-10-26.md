# Vetor Urbano — o que mudou, por que, e o que falta (26/10/2026)

Resumo de leitura única. Branch `integration/functional-spec-v1`, `HEAD 0148153`, em sincronia com `origin`.

## 1. Frontend — o que mudou e por quê

O front saiu de uma interface funcional mas desalinhada para uma com sistema de design aplicado. Cada mudança responde a um defeito medido:

| Mudança | Por quê |
|---|---|
| Escala tipográfica única, 3 pesos | 68 declarações fora de qualquer escala no censo estático; no DOM, **5 tamanhos e 7 pesos** misturados |
| Cores em token (`--color-*`, `--accent`, tintas de estado) | 8 tokens eram citados sem existir, e 3 declarações de borda **não renderizavam**; cartão branco fixo aparecia no tema escuro |
| Contraste de texto e estado corrigido | badge do mapa dava **1,96:1** no escuro; aviso branco sobre verde, **1,67:1**; âmbar do marcador, **3,75** |
| Contorno de controle a 3:1 | `--color-border-subtle` dava **1,24:1** no claro em **68 sítios** (contados por nome de token); hoje `3,17` na base e `3,36` no branco |
| Alvos de toque ≥44 px | 14 de 20 alvos abaixo de 44; links do topo **cortados** a 320 e 390 px |
| Movimento em 3 durações + `reduce` | 7 durações soltas, incluindo `420 ms` fora do vocabulário `{120,240,400}` |
| Shell móvel: topbar 233 → 54 px | conteúdo ocupava só **71%** da tela no celular; agora **93%**, com barra de 5 destinos e botão flutuante |
| Texto de apoio em 1 bloco de 51 ch | eram 54 linhas de prosa (média 92 ch, maior 421) na medição de 25/10; a árvore de 26/10 media 7 blocos, 605 ch, média 86, maior 121 — a baseline antiga não era reproduzível, então os dois números ficam |
| Ritmo dos painéis padronizado | a régua do UX-2 media **`[8,16]` px de padding** e **`[12,14]` de `gap`** entre cartões iguais antes do passe |
| `data-state` na área de resultados | a tela não declarava o que estava fazendo; ao medir, apareceu defeito real: vazio aparecia como "estado inicial" |
| Navegação com `aria-current` e conta no móvel | destino ativo só por cor; "Minha conta" inalcançável abaixo de 1024 |
| Auditor de tipografia e token no build | nada impedia a reintrodução de tamanho solto ou token fantasma |

## 2. Backend e banco — o que mudou e por quê

Nesta rodada o backend teve **um** incremento; o restante já existia das rodadas anteriores.

- **Catálogo territorial versionado (novo):** migração **V23**, municípios por código IBGE, proveniência por versão, histórico imutável e publicação só da versão aprovada. Motivo: o recorte territorial era lista fixa no front, sem fonte nem versão. Endpoint `GET /api/v1/territories` (commit `c0b70ac`).
- **Já existente e em uso pelo front:** consulta persistida com filtros no servidor — **inclusive recorte espacial por `west/south/east/north` com `ST_Intersects`** —, contas com sessão e MFA, revisão/publicação, correção com histórico, auditoria, coleta de fonte autorizada com backfill, painel de operação, confiabilidade versionada (V20/V21), exportação XLSX/PDF.
- **Banco:** 23 migrações aplicadas, 29 bases sintéticas por família, cada uma em 23/23 com o mesmo checksum.
- **Harness de teste:** allowlist por família (16 arquivos, `5346f70`) — antes, spec apontava para base de rodada anterior e passava por engano.

## 3. Pendências

**Do time, em aberto:**
1. **UXH-08** (mapa com filtros/ferramentas/resultados) — **commitado em `f106d20`**: ferramentas acima do formulário (`1440: 260 < 322`, `1024: 302 < 364`), paginação real nos três viewports, janela da lista **36 → 280 px**, reserva da barra fixa por token, exclusão **nomeada** do par «rodapé × chrome fixo» e alcance de cada link provado por `elementFromPoint` (6 links cobertos a 320 → zero). Critérios do lote: `workspace-structure` **8/8**, `targets-touch` **6/6**. A/B de não-atribuição: `mobile-shell` deu **12/14 igual com e sem o patch**; depois, em ambiente ocioso, os dois casos fecharam como **falso vermelho de instrumento** — a régua lia `data-vu-sheet-state` na linha seguinte ao clique, antes do render do Angular; com a espera do atributo, **14/14**.
2. **UXH-09** (área visível explícita) — defeito medido: em modo API, "Buscar nesta área" **não dispara requisição** porque o front barra pela cobertura da demonstração. O backend já sabe filtrar; falta remover o gate no front e decidir que aplicar área **substitui** o raio.
3. **Selo por execução — campanha rodada em 27/10 e o número é diagnóstico do arranque, não selo.** `HEAD 0148153`, `scripts/campanha-e2e.sh`, 19 famílias, um processo por família, `jdbc` provado por `/proc`: **11 famílias verdes, 8 vermelhas**. A classificação, medida e não atribuída: **2 por TTL do arranque** (`account_recovery`, `account_registration` — fecharam verdes com os quatro argumentos; a assinatura era `890 s ≈ 14,8 min`, o TTL padrão contra os 5 s do ensaio); **2 por endereço de controle movido pelo UXH-07** (`active-report-renewal`, `audit-authorship` — o helper procurava «Minha conta» na topbar, que o UXH-07 levou para a folha abaixo de 768); **1 por navegação de ADMIN no móvel** (`audit_log` — `primary-nav` oculta abaixo de 768, destino administrativo vai para o UXH-11); **11 casos de `collection_recent` por perfil de execução** (a flag `VETOR_COLLECTION_E2E=configured` foi necessária e **não** suficiente: 11 failed de novo); e o resto não identificado. **Cobertura declarada:** 7 specs de `VETOR_PERSISTED_E2E` (`history-pagination`, `occurrence-heatmap-http`, `persisted-query`, `report-comparison`, `report-export`, `report-pdf`, `report-summary`) **não estavam no manifesto** e não rodaram. Regra adotada: família que roda fora do modo do próprio spec **não conta como verde nem como vermelha** — não mediu o produto.
4. **UXH-01 isolamento por família** — mapa spec → base, autorizado, não iniciado.
5. **UX-7b** — salto de layout a 390 px (CLS 0,1394 contra teto 0,1), origem medida no boot.
6. **Lotes C–F do piloto** — UXH-09 a UXH-21; dois deles com bloqueio externo (direitos de fonte, provisionamento).

**Fechado como dívida datada, sem ação:** literal de cor em `controls.scss:376`; fundo de 12% literal no `.area-result-mark`; área de resultados invisível no modo Mapa a 390; **a 390 px um ADMIN não alcança «Logs administrativos»** — `primary-nav` sai abaixo de 768 e a folha móvel não tem destino de administração (medido em 27/10 por `audit_log.spec.ts`; o destino entra no UXH-11).

**Pendente por sua ordem:** UXH-02/Lote B (bairros, RA, AP) e Lote G (hospedagem e convidados).

## 4. O que preciso de você agora

1. **Aceite formal** de UX-2 a UX-8 e UXH-07 — **registrado pelo responsável em 26/10**; é o que transforma "entregue" em "aceito" no controlador.
2. **Ticket 36 (documentos institucionais)** — a publicação jurídica está adiada; para o MVP, precisa da sua decisão.
3. Nada mais bloqueia. Push está em dia (`local = origin`), e a autorização para seguir nos lotes está de pé.
