# Controlador local de tickets — 15/10/2026

Registro histórico. A operação foi posteriormente adaptada exclusivamente para Codex CLI; consulte [adaptação e comando auto](ticket-controller-codex-2026-10-15.md). As instruções Antigravity abaixo registram o estado anterior.

## Escopo e operação

Criado `tools/ticketctl.py` com configuração declarativa em `tools/ticketctl.json` e prompts reutilizáveis em `tools/prompts/`. O controlador lê tickets/dependências, administra estado persistente e checkpoints, salva logs por execução, serializa execuções e oferece `status`, `models`, `simulate`, `run`, `next`, `phase`, `verify`, `review`, `correct` e `resume`. O fluxo padrão executa um único modelo por vez e exige revisão independente; correções têm limite de duas rodadas. As etapas de 12 e 15 são executadas em chamadas técnicas sequenciais, com índice de etapa salvo para retomada. A aprovação funcional dos tickets 12–35 exige as verificações declaradas, revisão e commit associado ao ticket. O commit recusa índice previamente staged e arquivos que já estavam sujos no início; as fases 06/07/10 e a revisão documental não criam commit automaticamente.

Codex CLI `0.162.1` e Antigravity CLI `1.3.6` foram identificados. `codex models` e `agy models` listaram os modelos; chamadas mínimas confirmaram `gpt-6.1-sol`, `gpt-6-luna`, `gemini-3.8-flash-medium` e `gemini-3.8-flash-high`. Codex roda sem override de velocidade, cujo padrão é Standard. Antigravity usa `--mode accept-edits`, pois `auto` não está disponível nesta conta. Nenhum modelo foi trocado.

## Validação do controlador

- `python3 -m py_compile tools/ticketctl.py`: passou.
- Simulação feliz: concluiu com rótulo `simulation_only`, sem aceite funcional.
- Simulação `failure-resume`: gravou checkpoint (código 1 esperado); `TICKETCTL_SIMULATE=1 python3 tools/ticketctl.py resume` retomou e encerrou sem chamar CLI real (código 0).
- Simulação de dependência bloqueada: bloqueou Ticket 12 por 02, 04 e 05 (código 3 esperado).
- O controlador mantém serialização via lock e não usa modelo gerente ou agentes auxiliares.

## Piloto e bloqueios

A reconciliação documental foi executada com Codex/Luna Medium e revisada por Codex/Sol Medium. Corrigiu rastreabilidade de 11 e 36, natureza demonstrativa de 09 e integração real prevista no 12. `bash scripts/verify.sh planning` e `git diff --check` passaram. O revisor aceitou após uma rodada de correções. Nenhum commit foi criado: os arquivos documentais afetados já tinham alterações não commitadas antes deste controlador, e o fluxo de commit recusa alterações preexistentes no mesmo arquivo.

Ticket 07 continua pendente. `bash scripts/verify.sh web` passou lint e 85 testes unitários; build 600,60 kB excede em 100,60 kB o orçamento de 500 kB. E2E direcionado de agrupamentos/sobreposições passou em Chromium; no Firefox, a seleção do segundo item no popup MapLibre não disparou, enquanto teclado e Leaflet passaram. A etapa não recebeu aceite nem commit.

O primeiro processo Antigravity ficou aguardando uma tarefa Playwright em segundo plano e foi interrompido. Ao retomar, o sandbox negou escrita no diretório de log da CLI e abertura de socket local (`operation not permitted`). O estado salvou Ticket 07 como pausado no checkpoint de implementação, com log em `.scratch/consulta-coerente/controller-logs/phase-07-cc8ef1577e5b.log`. Uma tentativa escalada com o mesmo Gemini 3.8 Flash High encerrou sem resultado utilizável e sem processo ativo. Nenhuma conclusão nem alteração dessa tentativa foi aceita.

## Próxima ação

Concluir/revisar Ticket 07, sem reduzir cobertura; executar a fase de Ticket 10 e revisão integrada apenas depois, e então consumir a fila `12→13→14`, administração, proximidade/correções e análise/exportações, respeitando dependências e bloqueios originais. Retomar a execução controlada com `python3 tools/ticketctl.py resume`; para simulações isoladas, `python3 tools/ticketctl.py simulate 12 --scenario failure-resume` e depois `TICKETCTL_SIMULATE=1 python3 tools/ticketctl.py resume`.
