# Ponto de recuperação — interrupção solicitada pelo responsável

## Estado e autorização

Em 24/10/2026, o responsável pediu: **«Crie um ponto de recuperação e pare a tarefa, preciso encerrar a sessão»**. Trabalho interrompido; não iniciar novas correções, testes ou agentes automaticamente. A retomada depende de novo pedido.

Branch conferida: `integration/functional-spec-v1`; HEAD `fc35eba12d3c65a714854df6073e245bd72183cb`. Nenhum staging, commit, push, merge ou troca de branch realizado. Trabalho permanece na árvore local, incluindo documentação preexistente e correções de harness. Não descartar/restaurar arquivos em massa.

## Escopo em andamento

Lote A UXH-01/02. A fase mais recente autorizou diagnóstico e correções isoladas de cinco pontos, fixtures separadas por família e posterior matriz ampliada: renovação/foco, clique de Informes no mapa, fila global de operações, associação de referência Firefox e interceptação XLSX em porta alternativa. Não há autorização de dados reais, controlador, publicação ou deploy.

Correções adicionais estão na árvore em `apps/web/e2e/`: active-report-renewal, active-reports-api, helpers/synthetic-admin, operations-panel, publication-review, publication-editor, report-export, session-access e arquivos já alterados na fase anterior (collection-recent, occurrences-admin, reliability-panel, risk-area-drawing e guard spec). Conferir diff exato antes de retomar. Nenhuma dessas alterações finais recebeu ainda revisão independente de fechamento da sessão principal.

## Evidências duráveis atuais — não confundir com aceite

Diretório: `/home/marciocoelho/.hermes/workspace/uxh01-five/`.

- `web-final.log`: processo `bash scripts/verify.sh web` terminou com exit 0; contagens/conteúdo devem ser reconferidos no log antes de citar como evidência final.
- `matrix.log` e `matrix-results.json`: execução principal terminou exit 1. O JSON registra falhas nas seleções `final_session_access` e `final_source_management`; as demais famílias nele enumeradas registram exit 0. Existem artefatos posteriores `final_session_access-complete` e `final_source_management-complete`: não inferir resultados sem ler seus XMLs/logs e conferir timestamps.
- XMLs, RED/GREEN, artefatos de navegador, lançadores `run.py`, `start.py`, `matrix.py`, `summarize.py` e manifestos de proveniência estão nesse diretório. Não ler/copiar arquivos de credenciais/chaves sintéticas nem publicar a pasta inteira.
- `demo-final.xml`, artefatos persistidos e famílias adicionais presentes. Contagens agregadas e validade na árvore final **ainda não verificadas pela sessão principal** nesta interrupção.
- Resultados da fase anterior estão em `docs/history/uxh-01-resume-2026-10-24.md`: são históricos para alterações posteriores. UXH-02 continua parcial conforme inventário, sem nova aquisição real.

## Recursos encerrados e preservados

`shutdown.json` registra nenhum PID API vivo, nenhum listener da verificação e os contêineres parados. A sessão principal conferiu novamente `ss` (8080, 8081, 4201, 8025 e 8788 sem listeners) e `podman ps` (sem contêiner ativo).

Contêineres preservados, parados:

- `vu-uxh01-five-db`, ID `4beb18531f8d21e0c94f155103405f9f60b18e7d06f27464a45ddd94be3edd3b` — ambiente local da fase atual;
- `vu-uxh01-resume-db`, ID `fb735cac2c4016dd8bd0ecf61ec1e94e02611f795d523cb099685ffa8c274599` — fase anterior;
- `vu-ticket29-e2e-db`, ID `a522cec57821c0b1158754f33e9b0c8e8cd075f5ff0375a79cf01bcff35cef81` — baseline anterior preservado.

Agente técnico recebeu ordem de parada e interrupção explícita. Não presumir que qualquer processo/sessão continuará ativo depois do encerramento.

## Retomada segura

1. Ler `PLAN.md`, este checkpoint, relatório técnico mais recente se existir e registros anteriores UXH-01; revalidar Git/status/HEAD.
2. Inspecionar diff atual e logs/XML do diretório `uxh01-five`; calcular contagens reais, separar seleções sobrepostas, REDs intencionais, skips de configuração e interrupções. Verificar timestamps contra entradas cobertas.
3. Conferir resultados posteriores das famílias session-access/source-management e investigar o exit 1 de `matrix.py`, sem repetir a matriz cegamente nem reduzir critérios. Conferir limite de tentativas já consumido nos logs.
4. Ler scripts antes de executar e provar novamente cadeia API PID → JDBC sanitizado → banco sintético por família → helpers → Angular → fixtures. Bancos anteriores e banco real `vu-fogo-cruzado-db:55438` não podem ser limpos/usados como fixture.
5. Fazer revisão independente Standards/segurança e Spec da árvore combinada; corrigir/retestar apenas sob autorização vigente, atualizar PLAN/CHANGELOG/tickets/checklist com evidência realmente verificada.

**Situação:** parada solicitada, sem aceite integral, sem recomendação de merge, sem fechamento do Lote A. Checklist externo deve permanecer desmarcado: `/home/marciocoelho/Documentos/VetorUrbano-UXH-checklist-2026-10-23.md`.
