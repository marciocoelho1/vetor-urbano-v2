# Adaptação do controlador para Codex CLI — 15/10/2026

## Resultado e preservação

O controlador existente em `tools/ticketctl.py` foi adaptado, mantendo configuração declarativa, fila, dependências, etapas técnicas de 12/15, comandos de compatibilidade, proteção de commits, importação histórica, logs e checkpoints. A execução operacional agora usa exclusivamente Codex CLI. O [registro anterior](ticket-controller-2026-10-15.md) permanece como histórico; suas instruções de retomada com Antigravity foram substituídas por este documento.

Nenhum ticket real foi executado nesta adaptação. HEAD continua `505a0b1`; nenhum commit do projeto, push, publicação ou contratação foi realizado. Os commits usados nos testes pertencem apenas a repositórios temporários com arquivos fictícios. As alterações preexistentes no frontend e nos documentos foram preservadas.

O checkpoint real do 07 continua pausado em `implement`, run `cc8ef1577e5b`, com suas três tentativas, motivo anterior, diagnóstico e log originais. Foi acrescentado `executor_profile: sol_medium`; o executor escolhido pelo roteamento é GPT-6.1 Sol / Medium. A migração adiciona metadados e não declara resolvida a falha de clique MapLibre/Firefox. Nenhum aceite histórico foi alterado, inclusive o aceite parcial documental do 36 e a demonstração histórica do 06.

Backup integral anterior à migração: `.scratch/consulta-coerente/controller-state.json.pre-codex-1870adb4`. A auditoria local `.scratch/consulta-coerente/controller-migration-audit-before.json` registra o estado anterior, HEAD e hashes do frontend e dos logs. A comparação após `migrate` confirmou hashes iguais, todos os registros históricos iguais (07 recebeu apenas dois campos), checkpoint ativo igual e eventos antigos preservados.

## Roteamento

| Papel | Modelo / esforço | Tarefas |
|---|---|---|
| Execução | GPT-6 Luna / Medium | reconciliação, ajuste documental 36, pendências 10; 16, 19, 22, 27, 28, 29, 33, 34 |
| Execução | GPT-6.1 Sol / Medium | pendências 06/07; 12, 13, 14, 15, 17, 18, 20, 21, 23, 24, 25, 26, 30, 31, 32, 35 |
| Revisão | GPT-6.1 Sol / High | 12, 13, 14, 15, 17, 18, 23, 24, 25, 26, 30, 31, 32 |
| Revisão | GPT-6.1 Sol / Medium | demais tarefas e revisão integrada inicial |

Correções usam o mesmo perfil da execução da tarefa. A revisão integrada inicia em verificação/revisão, sem chamada de implementação; eventuais correções integradas usam Sol Medium. `models` mostra o inventário configurado localmente, sem inferência para sondar disponibilidade. Modelo indisponível ou CLI incompatível produz checkpoint, sem substituição.

Standard é explícito com `service_tier="default"`; Fast e troca automática de modelos estão desabilitados. Há uma chamada por vez, `features.multi_agent=false` e `agents.max_threads=1`; os prompts também proíbem subagentes. A configuração do CLI instalada foi conferida por `codex exec --help`/`codex features list`; a [referência oficial de configuração](https://developers.openai.com/codex/config-reference/) e seu schema foram consultados. A checagem inicial não detectou a restrição de providers internos; os dois overrides de retry incompatíveis foram removidos na correção operacional registrada abaixo. A disponibilidade dos modelos nesta conta não foi testada por chamada real.

## Ciclo e evidência

`auto` carrega o checkpoint ativo e avança por implementação → verificação → revisão independente → correção → nova verificação/revisão → conclusão/commit → próxima tarefa. Até duas rodadas de correção; interrupção no meio de uma rodada mantém seu número. As etapas técnicas concluídas de 12/15 não reiniciam. A verificação salva cada comando aprovado e retoma pelo primeiro ainda não concluído, desde que o conteúdo e os comandos permaneçam iguais.

Cada chamada registra contexto do vínculo, comando, perfil, eventos, log e resposta final JSON em arquivos únicos. `--output-schema` e `--output-last-message` substituem a extração de `REVIEW_ACCEPTED` de texto livre. O controlador confere tarefa, etapa, run, nonce da chamada, hash do conteúdo e ID das verificações. Código zero sozinho não aprova nada. Texto livre, vínculos divergentes e alteração de conteúdo durante revisão não recebem aceite.

O hash inclui HEAD, índice, conteúdo/modos dos arquivos rastreados e não ignorados, configuração e ticket original (inclusive em `.scratch`). Na revisão integrada, inclui todos os tickets das fases iniciais. Os resultados das verificações têm comandos, códigos, hashes de logs e vínculo ao mesmo conteúdo revisado. Mudança de código, configuração, ticket, índice ou log invalida a evidência e exige nova verificação/revisão antes da conclusão. Os arquivos ignorados de dependências/build não são considerados código revisado; os comandos efetivos continuam obrigatórios.

Fases iniciais são barreiras explícitas em `phase_completed`, distintas dos aceites funcionais históricos. O checkpoint 07 já ativo é retomado primeiro; depois o seletor cumpre as fases ainda pendentes na ordem configurada. A reconciliação documental já concluída é preservada. A pendência 06 e o ajuste documental 36 precisam de evidência nova para suas barreiras, sem apagar seus registros históricos. O 36 permanece parcial até receber/acompanhamento depender do canal 27. A fila 12–35 só abre após todas as fases e a revisão integrada.

Bloqueios declarados pelo executor/revisor, ausência de verificações, limite de correções e impossibilidade de commit isolado permitem tarefas independentes. Dependentes continuam bloqueadas; barreiras iniciais não podem ser puladas. Interrupção, timeout ou falha de infraestrutura salva o checkpoint e pausa a execução para retomada. A proteção de commit recusa índice previamente staged ou alterado durante execução, arquivos preexistentes modificados pela tarefa e ausência de alterações isoláveis; não tenta descartar nem reorganizar trabalho do usuário.

Todas as operações adquirem o mesmo lock **antes** de ler/migrar estado, inclusive `status`, `models`, simulação e retomada. O estado é salvo por substituição atômica. Execução de CLI, verificações e comandos Git usa grupos de processos; conclusão normal, timeout, Ctrl+C e SIGTERM encerram filhos/netos antes de liberar o lock. SIGKILL/queda de energia não permitem executar limpeza; o último checkpoint persistido orienta a retomada e o lock do sistema é liberado ao morrer o processo.

## Cota e simulação

Erros de limite/cota do CLI ou resultado estruturado `quota_exhausted` gravam `provider_pause`, preservando a etapa ativa. `auto` e `resume` posteriores não fazem chamadas enquanto essa pausa existir. O controlador não repete chamadas depois de detectar cota, não compra créditos e não faz fallback. Os overrides HTTP/stream do provider interno eram incompatíveis e foram removidos; não há garantia de retries internos desativados no Codex CLI. Depois de restabelecer a cota, o operador pode executar `python3 tools/ticketctl.py clear-quota` e então `auto`. A remoção da pausa é explícita, registrada e não chama o provedor.

`simulate` e `TICKETCTL_SIMULATE=1` usam exclusivamente `.scratch/consulta-coerente/controller-simulation-v2/`, com estado e logs próprios, sem importação histórica, commits ou processos de provedor. `TICKETCTL_STATE` não pode redirecionar a simulação ao estado real. Estados de modo incompatível são recusados; registros `simulation_only`/`simulation_fixture` não satisfazem dependências reais. O estado antigo de simulação foi preservado e não é importado.

Exemplo local: `python3 tools/ticketctl.py simulate --scenario two-tasks`. Percorre duas fixtures denominadas 12/13, revisão com achado na primeira, correção e nova revisão. Demonstração executada nesta etapa: `12:implement → 12:review → 12:correction → 12:review → 13:implement → 13:review`, com verificações entre implementação/correção e revisão; ambos encerraram em `simulated_complete`. Estado e logs reais permaneceram intactos. Retomadas da simulação usam `TICKETCTL_SIMULATE=1 python3 tools/ticketctl.py resume`; o cenário salvo é preservado. Para executar todos os cenários independentes, use a suíte abaixo, que cria novos repositórios temporários a cada caso e nunca apaga estados/logs existentes.

## Verificação desta adaptação

- `python3 -m unittest discover -s tools/tests -v`: **24/24 passaram**, em 4,823 s, com CLI falsa e sem acesso ao provedor. Log local: `.scratch/consulta-coerente/controller-codex-tests.log`.
- Fluxo de duas tarefas: implementar 12 → revisar com achado → corrigir → verificar/revisar → commit fictício → implementar/verificar/revisar 13 → commit fictício.
- Retomadas: revisão sem reimplementar; verificação sem repetir comando aprovado; correção sem consumir rodada extra; etapa técnica sem reiniciar a anterior.
- Cota: pausa durante revisão; nova instância do controlador preserva a pausa e realiza zero chamadas adicionais.
- Isolamento: simulação com override de caminho real preserva os bytes sentinela reais; estado incompatível e aceite simulado não liberam dependência real.
- Regressões adicionais: limite de duas correções, tarefa independente após bloqueio, barreira obrigatória, rejeição de texto livre/vínculo incorreto/revisor que edita código, alteração pós-revisão, alteração de log, estado parcial do 36 preservado, roteamento, verificação que falha e volta à correção, lock em todos os comandos, encerramento de netos após saída normal/timeout/SIGTERM.
- `python3 -m py_compile tools/ticketctl.py tools/tests/fake_codex.py tools/tests/test_ticketctl.py`, `bash scripts/verify.sh planning` e `git diff --check`: passaram. `planning` conferiu 190 links locais; âncoras e URLs externas não são verificadas por esse script.

A aplicação e o E2E real não foram reexecutados. Estes testes validam o controlador e os comandos construídos, sem comprovar a resolução do Ticket 07 nem a disponibilidade de modelos/sockets no sandbox de uma chamada real. Se o sandbox bloquear Java/Docker, navegador ou outro recurso, o controlador preserva checkpoint; não pede escalada nem remove restrições.

## Iniciar no terminal local

Na raiz do repositório:

```bash
python3 tools/ticketctl.py auto
```

Esse comando inicia chamadas reais somente quando o usuário o executar. Retoma o 07 salvo em Sol Medium, cumpre as barreiras restantes e percorre a fila enquanto houver tarefas prontas. `resume` também continua o ciclo a partir da etapa persistida. `next`, `verify`, `review` e `correct` permanecem disponíveis para executar uma transição por vez; não são necessários entre etapas de `auto`.

## Correção de inicialização e visibilidade — 15/10/2026

A execução local posterior de `auto` parou no 07 com `cli_exit_1`. O log real `07-implement-fa26cc6b95434adea70f00e3bba5aeb1.log` contém `Error loading config.toml: model_providers contains reserved built-in provider IDs: openai`. A causa foram os overrides `model_providers.openai.request_max_retries=0` e `model_providers.openai.stream_max_retries=0`: esse CLI não permite redefinir o provider interno. Ambos foram removidos de `invoke()`, sem criar provider alternativo ou alterar autenticação. O login ChatGPT existente, roteamento, Standard, serialização e pausa por cota permanecem. A afirmação anterior de retries internos desativados estava incorreta e foi corrigida neste registro e na configuração descritiva. O controlador pausa novas chamadas ao detectar cota; não controla todos os retries internos do CLI.

O terminal agora imprime tarefa, etapa, modelo e esforço com `flush=True` antes da execução da etapa, inclusive ao retomar. Em falha, imprime motivo, código de saída do processo, caminho do log completo e trecho relevante do erro. Configuração recusada é classificada como `config_rejected`; suporta tanto a mensagem de `config.toml` quanto o diagnóstico em várias linhas `failed to load bootstrap configuration`. O código do processo e o log ficam também no estado da chamada; o controlador continua retornando 3 ao salvar pausa. As verificações locais mostram comando e log; suas falhas também apresentam diagnóstico antes de entrar em correção. JSONL completo e arquivos antigos de log são preservados.

Exemplo de saída esperada para recusa (validado com CLI falsa, sem executar o 07):

```text
Tarefa=07 etapa=implement modelo=gpt-6.1-sol esforço=medium
Falha: tarefa=07 etapa=implement motivo=config_rejected código de saída=1 log=.../07-implement-<id>.log
Error loading config.toml: model_providers contains reserved built-in provider IDs: `openai`. Built-in providers cannot be overridden.
```

Validação realizada:

- Antes da correção, `python3 -m unittest discover -s tools/tests -p test_ticketctl.py -k config_rejection -v` falhou porque a saída capturada era vazia, reproduzindo o encerramento sem diagnóstico.
- `python3 -m unittest discover -s tools/tests -v`: **27/27 passaram**, em 5,197 s. Log separado: `.scratch/consulta-coerente/controller-init-regressions-final-2026-10-15.log`; logs das validações anteriores preservados. A CLI falsa agora recusa qualquer override de `model_providers.openai.*`. Novos testes cobrem recusa antes de implementação, diagnóstico/código/log visíveis, preservação e retomada do run, progresso com flush anterior ao processo e causa relevante em erro multilinha. Os cenários de cota continuam passando.
- CLI instalado: `codex --version` → `codex-cli 0.162.1`. A chamada construída por `invoke()` foi interceptada e validada com `--help`, sem prompt nem inferência: código 0. `codex features list`, com todos os overrides `-c` restantes da chamada, retornou 0. A variante antiga com override de retry retornou 1 e reproduziu localmente a recusa do provider reservado, sem inferência. `--strict-config` foi tentado apenas nessa consulta local e recusado porque não é suportado por `codex features`; não faz parte da chamada operacional. A checagem válida usou `features list` sem esse argumento. Ajuda e leitura de configuração não comprovam execução autenticada do modelo; nenhuma inferência foi iniciada.
- Sintaxe Python, `bash scripts/verify.sh planning` e `git diff --check` conferidos nesta correção. Nenhum teste real do frontend/E2E foi executado.

O checkpoint real foi somente lido. Comparação de hashes com o início desta correção confirmou estado/checkpoint integral, arquivos do frontend e logs antigos sem alteração. O 07 permanece pausado em `implement`, run `cc8ef1577e5b`, mantendo o erro da última tentativa e o diagnóstico MapLibre/Firefox pendente. Aceites históricos não foram alterados. Nenhum ticket real foi executado, e nenhuma configuração/autenticação global foi editada.

Retomada, na raiz do repositório, somente quando o usuário executar no terminal local:

```bash
python3 tools/ticketctl.py resume
```

O comando retoma a etapa salva do 07 e continua o ciclo autônomo; `auto` também usa esse mesmo checkpoint. Não é necessário limpar nem recriar estado para corrigir esse erro de configuração.
