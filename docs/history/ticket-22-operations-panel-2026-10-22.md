# Ticket 22 — painel de operação: implementação local (22/10/2026)

## Recorte entregue

Leitura administrativa do estado real de coleta e de fila, sem ação sobre nenhum dos dois. Nenhuma
migração de dados de domínio foi criada além da V19, que apenas autoriza o módulo de auditoria
`operations`.

| Peça | Onde |
|---|---|
| Serviço de leitura (3 consultas + agregados) | `apps/api/src/main/java/br/com/vetorurbano/api/operations/OperationsPanelService.java` |
| Endpoint `GET /api/v1/admin/operations` | `.../operations/OperationsController.java` |
| Auditoria `OPERATIONS_VIEW` | `AuthService.auditOperationsView` + `V19__operations_panel_audit.sql` |
| Propriedade explícita da janela | `vetor.operations.expiry-window=24h` em `application.properties` |
| Contrato | [`docs/architecture/operations-panel-local-v1.md`](../architecture/operations-panel-local-v1.md) |
| Transporte tipado | `apps/web/src/app/data/operations-api.ts` |
| Painel somente leitura | `apps/web/src/app/operations/` |
| Carga diferida da área administrativa | `apps/web/src/app/admin/admin-sources-panels.ts` + `@defer` em `app.html` |

## Critérios de aceite — evidência

1. **Fontes ativas/pausadas, tentativa, último sucesso, falhas, fila e espera.** Painel lê
   `collection_sources` + última `collection_runs` + `clipping_reviews`; `OperationsHttpIT.reviewQueue...`
   prova espera e prioridade com HTTP real e PostgreSQL.
2. **Confirmações próximas de expirar usam só prazos configurados; falta de configuração é
   identificada.** `OperationsHttpIT.confirmations...` roda dois arranques: `24h` (lista 1 expirando,
   conta 1 vencida, põe `ROUBO` em «sem prorrogação automática», nunca em «sem prazo») e propriedade
   em branco (`NOT_CONFIGURED`, `windowSeconds=null`, lista vazia e texto citando a propriedade).
3. **Falha de conector não vira nenhuma ocorrência; acesso restrito e ações auditáveis.** O mesmo IT
   assere `FAILING` com classe `RATE_LIMITED`, ausência de qualquer chave de contagem de ocorrências no
   corpo, `401` anônimo, `403` para `USER` e a linha de auditoria `operations`/`OPERATIONS_VIEW`/`ADMIN`
   com apenas contagens.
4. **Zero novos com sucesso ≠ erro de alimentação.** IT compara os rótulos
   (`Sem novidades na última execução` × `Falha de alimentação: limite de taxa da fonte`) e o estado
   `PAUSED`; o E2E repete no navegador a falha e o vazio explicado.
5. **Jornadas observáveis em Chromium/Firefox, teclado/foco, carga/erro/vazio e móvel.**
   `apps/web/e2e/operations-panel.spec.ts` — **4/4** (Chromium e Firefox), 390 px sem rolagem
   horizontal, foco movido para `review-heading` por teclado, repetição após erro sem perder a
   explicação de vazio. Regressões `admin-local-sources.spec.ts` e `audit-log.spec.ts` no mesmo
   arranque: **10/10**.

## Verificações desta árvore

- API completa pelo runner em contêiner: **59 unitários + 132 integrações**, zero falhas/erros/pulados
  (a classe nova `OperationsHttpIT` responde por 4 delas e `OccurrenceQueryHttpIT` ganhou 1).
- Web: `npm run lint` limpo, **180 testes em 24 arquivos**, build inicial **841,05 kB** (teto 900 kB,
  margem 58,95 kB) e chunk preguiçoso `admin-sources-panels` de **79,20 kB**.
- Playwright do painel + regressões: **10/10** em Chromium/Firefox com `--workers=1`.
- `ticketctl`: **39 testes** (33 anteriores + 6 do rebaseline/reconciliação).

## Decisões tomadas nesta rodada (por delegação do responsável, 22/10/2026)

- **Janela de antecedência configurada no repositório (`24h`)** em vez de valor implícito no código:
  sem configuração o painel informa `NOT_CONFIGURED`, o que mantém a regra «prazo só se explícito».
- **Auditoria própria (`operations`)** em vez de reutilizar `audit` (logs) ou `query` (USE), para que a
  leitura administrativa não se confunda com consulta pública; a V19 preserva as classes anteriores.
- **Conta e logs não foram diferidos** no `@defer`: o ganho era pequeno (26 kB) e a perda de foco do
  título da tela apareceu em navegador real. A área de fontes/coleta/revisão (79 kB) foi diferida.
- **Petrópolis** permanece limitação de cobertura da fonte, não de código: já registrada em
  `MUNICIPALITIES_MISSING` e no checkpoint do ticket 20; o painel não inventa município ausente.

## Controlador — estado registrado nesta data

- `reconcile` registrou **20, 21, 22 e 35** como `accepted` / `verified_local_demonstration`, com
  checkpoint versionado e commit ancestral como evidência. O 21 preserva o aceite concedido pelo
  responsável em 22/10/2026; 20 e 35 foram registrados por delegação explícita desta rodada.
- `rebaseline` refez a base do `integrated-review` (base anterior às correções de B5) e o ticket foi
  reconciliado como `blocked` / `tool_limitation_recorded`: a fase obrigatória continua pertencendo ao
  controlador, e o aceite técnico de 06/10/36 segue documentado.
- `ticketctl.py next` continua devolvendo **exit 3** («Fila sem tarefa pronta») porque as fases
  obrigatórias 06, 36, 07, 10 e `integrated-review` e os tickets 23/24 não estão concluídos. Nenhum
  gate foi contornado nesta rodada.

## Limitações

- Ambiente sintético: não comprova coleta real, cobertura, SLA ou prontidão operacional.
- O painel observa o fluxo existente; não cria agendador, limiar, alerta ou prazo novo.
- `expiring` limita-se a 50 linhas por leitura; acima disso a lista é truncada pelo banco, não pela UI.
- Sem QA físico, leitor de tela real ou cartografia operacional.
