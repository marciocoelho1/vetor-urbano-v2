# Coleta autorizada — contrato local v1 (tickets 20, 21 e 22)

Fonte real autorizada pelo responsável: **API Fogo Cruzado v2**. Dados reais entram apenas no banco
dedicado; os bancos sintéticos de teste continuam intocados. Este contrato é a fronteira entre a coleta
e a revisão humana do ticket 17 — **nada aqui publica ocorrência**.

## Configuração (fora do repositório para segredos)

| Propriedade | Padrão | Papel |
|---|---|---|
| `vetor.collection.enabled` | `false` | Liga o agendador. Desligado, tudo responde «não configurado» |
| `vetor.collection.source-base-url` | `https://api-service.fogocruzado.org.br/api/v2` | Base da API da fonte |
| `vetor.collection.credentials-file` | vazio | Arquivo privado `chave=valor` com `VETOR_FOGO_CRUZADO_EMAIL` e `VETOR_FOGO_CRUZADO_PASSWORD` (0600, fora do repositório) |
| `vetor.collection.poll-seconds` | `900` | Cadência da coleta recente; sem SLA e sem promessa de instantaneidade |
| `vetor.collection.window-start` | `2026-06-01` | Início único do recorte aprovado |
| `vetor.collection.page-size` | `100` | `take` por página |
| `vetor.collection.max-pages` | `200` | Teto de segurança por execução; excedente vira retomada, não descarte |

Municípios: lista versionada no repositório com a fonte legal registrada, cruzada com `GET /cities` da
fonte. Município da lista ausente na fonte é **relatado**, nunca silenciado nem substituído.

## Autenticação e leitura

`POST /auth/login` `{email, password}` → `accessToken` (`expiresIn` 3600 s). Token guardado só em
memória durante a execução; renovação por `POST /auth/refresh`; 401 em uso renova uma vez e, se falhar,
a execução termina como `AUTH_FAILED`. As leituras usam `GET /occurrences` com `initialdate`,
`finaldate`, `idState`, `idCities` (repetível), `order=ASC`, `page`, `take`. Cabeçalhos
`X-Last-Update`/`X-Last-Update-State` são guardados como metadado de estado. Datas da fonte são
`America/Sao_Paulo` (UTC-3) segundo a documentação v2 e são convertidas para instante UTC ao persistir.

## Estados distintos (nunca fundidos)

| Estado | Significado |
|---|---|
| `NOT_CONFIGURED` | Sem arquivo de credencial ou coleta desligada — **não** é falha nem vazio |
| `RUNNING` | Execução em andamento com página/cursor |
| `PAUSED` | Pausada pelo ADMIN; retomada continua do cursor |
| `SUCCEEDED_NO_CHANGES` | Concluída sem publicação nova |
| `SUCCEEDED_NEW_ITEMS` | Concluída com itens novos encaminhados à revisão |
| `PARTIAL` | Falha no meio da paginação com retomada preservada |
| `FAILED` | Falha sem página concluída; classe `AUTH_FAILED`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INVALID_RESPONSE` |

Falha nunca aparece como zero ocorrências, nunca apaga itens já encaminhados e nunca é convertida em
`SUCCEEDED_NO_CHANGES`.

## Persistência (migração V15)

- `collection_sources`: liga a fonte do produto (`sources.id`) à configuração de coleta, à janela e ao
  último estado observado (`last_attempt_at`, `last_success_at`, `last_error_class`, `paused`).
- `collection_runs`: identidade, tipo (`RECENT`/`BACKFILL`), janela, cursor de página, contadores
  (`items_seen`, `items_created`, `items_duplicated`, `pages_done`), estado, instantes, classe de erro.
- `collection_run_events`: trilha append-only de transições e falhas (sem credencial, token, endereço
  completo da vítima ou atributo pessoal).
- `collection_items`: chave de idempotência (`source_id`, `source_reference`) com o `documentNumber`/`id`
  da fonte, apontando para o `clipping_id`/`clipping_review_id` criados. Reprocessar não duplica.

## Minimização (obrigatória)

O payload da fonte traz atributos por vítima (idade, gênero, raça, corporação, unidade, partido, situação
de serviço). Eles **não** são persistidos nem projetados: guarda-se somente a extração minimizada
(contagens, contexto do fato, localidade, coordenadas da ocorrência, instante) e um resumo factual para
o revisor. Nenhuma ocorrência coletada é publicada automaticamente: cada item entra em
`clipping_reviews` com `state='PENDING'` e prioridade `NORMAL` (ou `HIGH` quando a fonte marca chacina),
para decisão humana no fluxo do ticket 17.

## Superfície administrativa

Todas exigem ADMIN com MFA no servidor e CSRF nas escritas:

- `GET /api/v1/admin/collections` — estado por fonte (estado, tentativa, último sucesso, contadores,
  cabeçalhos de atualização da fonte).
- `POST /api/v1/admin/collections/runs` — dispara execução manual (`kind`, `from`, `to`).
- `POST /api/v1/admin/collections/runs/{id}/pause` e `/resume`.
- `GET /api/v1/admin/collections/runs` — histórico com contadores e classes de erro.

Sem sessão completa: 401; USER: 403. O JSON nunca inclui credencial, token ou atributo pessoal de vítima.

## Interface

No modo `?consulta=api`, a área administrativa ganha a seção **Coleta** com estado, última tentativa,
último sucesso, contadores, disparo manual e pausa/retomada. Estados de carregamento, erro e vazio são
distintos; «não configurado» é textual e não se confunde com falha. Teclado/foco e 390 px são exigidos.
A fila de revisão existente passa a exibir a origem «Fogo Cruzado» com a referência da fonte.

## Verificação

- Unidade: cliente HTTP (token, renovação, paginação, cabeçalhos), mapeamento/minimização, máquina de
  estados, pausa/retomada e idempotência.
- Integração HTTP com PostgreSQL/PostGIS **real**: migração V15 aplicada, execução completa com provedor
  externo substituído no limite HTTP (documentado), falha por página preservando retomada, deduplicação
  por referência, autorização ADMIN/MFA/CSRF e ausência de atributo pessoal no JSON.
- Navegador Chromium/Firefox: disparo manual, pausa/retomada, estados distintos, teclado/foco, 390 px.
- Execução real autorizada com a conta do responsável contra o banco dedicado, registrada como evidência
  separada, com origem, data e limitações da fonte.

## Atribuição e termos de uso (obrigatório)

Termo de consentimento da fonte, registrado em `docs/history/ticket-20-decisions-2026-10-19.md`: acesso **gratuito**, dados de cadastro usados **apenas para login** e não repassados a terceiros, e a contrapartida pedida é **citar a fonte**. Portanto:

- «Fonte: Instituto Fogo Cruzado» acompanha o dado coletado onde ele aparecer: item originado da coleta na fila de revisão, seção de coleta da área administrativa, e exportação/relatório que carregue ocorrência dessa origem.
- A credencial nunca aparece em log, resposta HTTP, evidência, fixture ou repositório.
- A coleta não tem custo por requisição; nenhuma contratação é necessária.

## Limites declarados

Sem promessa de SLA, instantaneidade ou cobertura; a fonte é de terceiros e pode mudar de contrato.
Sem geofencing (RF03) e sem coleta fora da janela aprovada. Sem atribuição de nota de confiabilidade
(23/24 bloqueados pela definição da regra). A lista de municípios segue a composição legal vigente da
Região Metropolitana, com a divergência entre redações registrada.
