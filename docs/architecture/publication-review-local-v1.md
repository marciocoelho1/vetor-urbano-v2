# Revisão humana e publicação sintéticas — v1

Ticket 17; D02/D09/D12/D13, CA18/CA19. Exclusivamente ADMIN com MFA completo, autorização no servidor, CSRF em toda decisão. Sem scraping, associação automática, fórmula nova ou dados reais.

## Fila e decisões

`GET /api/v1/admin/review-clippings?priority=HIGH|NORMAL|PLANNED&order=priority|wait` retorna somente pendentes, original, extração sintética, referência rastreável, prioridade e segundos de espera. Sem filtro, todas as prioridades; ordenação padrão por prioridade e espera; `wait` ordena pelo ingresso mais antigo. Prioridade não é SLA. `GET /options` fornece ocorrências publicadas com versão e acontecimentos para escolha explícita. `GET /{id}/history` permite inspecionar comandos, antes/depois, motivos, instantes e autoria ativa/histórica.

Clippings de teste entram por fixture SQL do banco isolado, não por endpoint de coleta. V11 não cria uma fila fictícia em produção. A identidade de referência é única por fonte quando informada; reenvio da coleta futura deve reutilizar esse registro.

`POST /api/v1/admin/review-clippings/{id}/decisions` recebe:

- `decisionKey`: UUID da tentativa; repetição idêntica devolve a mesma decisão persistida, inclusive após reinício. Chave com conteúdo diferente é 409.
- `expectedVersion`, `action` (`CREATE`, `ASSOCIATE`, `PENDING`, `DISMISS`), `reason` obrigatório.
- `CREATE`: `draft` obrigatório; `additionalEffects` opcional com outros núcleos factuais; escolher `happeningId` existente **ou** `happeningTitle` para contexto novo. Todos os efeitos são validados e publicados numa transação, ligados ao mesmo acontecimento e clipping.
- `ASSOCIATE`: `occurrenceId` e `expectedOccurrenceVersion`; acrescenta a referência sem criar outra ocorrência. Não combina efeitos adicionais implicitamente.
- Conflito essencial impede aprovação; exige `conflictResolution` explícita com evidência da resolução humana. A explicação fica no comando/histórico.

Bloqueio transacional por chave e clipping, versão esperada e chave única garantem replay/concorrência sem duplicação. Revisão aprovada não pode ser aprovada novamente por nova chave; revisão pendente conserva justificativa; descarte conserva motivo e sai da fila. Situação operacional (`ONGOING`/`CLOSED`/`UNKNOWN`) nunca equivale ao estado de revisão.

## Núcleo factual no servidor

Título, descrição sustentada, categoria/tipo compatíveis com catálogo, subtipo conhecido ou `NAO_INFORMADO`, situação, nota manual 1–5, município e precisão, instante ou intervalo UTC válido e referência da publicação. Bairro desconhecido fica `Não informado`; precisão territorial não recebe coordenadas. `POINT` exige longitude/latitude finitas e válidas. Nota alta não contorna campo ausente/conflito; não há inferência de zero, pin, data ou correspondência automática. Detalhes complementares sem evidência não são inventados.

V11 adiciona revisão atual e histórico append-only da publicação. Ocorrências anteriores recebem proveniência explícita de carga sintética, sem autor humano inventado. Publicação/associação gera versão com antes/depois, autor da sessão e instante; snapshots não embutem identidade de conta. Encerramento converte autoria de domínio para referência residual separada da segurança. Eventos administrativos usam apenas referência técnica, sem duplicar textos nos logs de acesso.

A consulta comum continua filtrando `PUBLISHED`, incluindo relações e leitura completa de relatórios/exportações. A referência original do clipping é projetada; URLs HTTP(S) podem ser abertas e identificadores permanecem texto. Pendentes/descartados não criam fatos consultáveis.
