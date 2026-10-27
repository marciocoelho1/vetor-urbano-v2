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
1. **UXH-08** (mapa com filtros/ferramentas/resultados) — implementado e **não commitado**: ferramentas acima do formulário, paginação nos três viewports, janela da lista 36 → 280 px, link de conta sem sobreposição. Guardado em `stash`. Bloqueia: dois casos do UX-6 caíram a 12/14 e a causa não foi isolada.
2. **UXH-09** (área visível explícita) — defeito medido: em modo API, "Buscar nesta área" **não dispara requisição** porque o front barra pela cobertura da demonstração. O backend já sabe filtrar; falta remover o gate no front e decidir que aplicar área **substitui** o raio.
3. **Selo por execução** — campanha dos 70 testes que hoje se auto-pulam, autorizada por você e **em execução** com o perfil documentado (`scripts/campanha-e2e.sh`: TTL/cooldown/limites curtos, um processo por família); o número entra neste documento quando o laço fechar, com o perfil ao lado.
4. **UXH-01 isolamento por família** — mapa spec → base, autorizado, não iniciado.
5. **UX-7b** — salto de layout a 390 px (CLS 0,1394 contra teto 0,1), origem medida no boot.
6. **Lotes C–F do piloto** — UXH-09 a UXH-21; dois deles com bloqueio externo (direitos de fonte, provisionamento).

**Fechado como dívida datada, sem ação:** literal de cor em `controls.scss:376`; fundo de 12% literal no `.area-result-mark`; área de resultados invisível no modo Mapa a 390.

**Pendente por sua ordem:** UXH-02/Lote B (bairros, RA, AP) e Lote G (hospedagem e convidados).

## 4. O que preciso de você agora

1. **Aceite formal** de UX-2 a UX-8 e UXH-07 — **registrado pelo responsável em 26/10**; é o que transforma "entregue" em "aceito" no controlador.
2. **Ticket 36 (documentos institucionais)** — a publicação jurídica está adiada; para o MVP, precisa da sua decisão.
3. Nada mais bloqueia. Push está em dia (`local = origin`), e a autorização para seguir nos lotes está de pé.
