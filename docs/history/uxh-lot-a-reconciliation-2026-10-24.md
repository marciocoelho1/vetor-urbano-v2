# Lote A UXH — reconciliação e limites da rodada

## Estado posterior à recuperação

A recuperação atual está em [cinco correções e retestes](uxh-01-five-fixes-2026-10-24.md): parcela técnica UXH-01 verificada localmente, aceite pendente. Consolidação de evidências sem duplicação: 184 aprovações/24 skips de modos de coleta complementares/zero falhas em208 entradas; não execução integral nova. Sessão/fontes corrigidas e aprovadas, autoria exata ADMIN e solicitante USER comprovados, XLSX completo8/8 por porta8080/8081. API/controlador não reexecutados na recuperação; produto não alterado. UXH-02 segue parcial, sem dados reais incorporados. Não recomendar merge/publicação por inferência: destino dos materiais ignorados e candidato completo ainda exigem decisão. Os pareceres e contagens abaixo são checkpoints históricos, não o estado atual das falhas.

## Autorização e baseline

Pedido do responsável em 24/10/2026: executar **Lote A**, localmente; **não** criar commits, push, merge, trocar branch, publicar issues, alterar controlador, criar recursos externos, fazer deploy ou acessar/importar/modificar/publicar dados reais. Aceite continua com o responsável.

Baseline observada: `integration/functional-spec-v1`, HEAD `fc35eba12d3c65a714854df6073e245bd72183cb`. Cinco arquivos rastreados já alterados: CHANGELOG.md, GLOSSARY.md, PLAN.md, docs/README.md e docs/product/scope.md; documentos UXH e entrevistas de 23/10 já não rastreados. Essas alterações não são entrega desta rodada e foram preservadas. Sem staging.

Selecionados UXH-01 e UXH-02, ambos sem dependências de tickets. UXH-01 cobre reprodução/reconciliação, não implementação da UX futura. UXH-02 cobre pesquisa de fontes/metadados públicos, sem ingestão, download de geometrias ou acesso a bases reais. Cartografia validada continua pendente.

## Contrato de trabalho paralelo

Verificador técnico possui exclusivamente processos, portas, builds e suítes; pesquisador possui novos arquivos do inventário UXH-02. Documentação compartilhada, registros dos tickets e checklist externo ficam com a sessão principal. Nenhum agente pode commitar, enviar, alterar controlador ou reduzir critérios. Nenhuma fonte da aplicação foi alterada nesta reconciliação.

## Evidência de código inspecionada nesta rodada

- `apps/api/pom.xml`: Spring Boot 4.1.1, Java 21, JDBC, Flyway e Testcontainers.
- `apps/api/src/main/resources/db/migration/`: V1–V22 versionadas no Git; não foram alteradas nem presumidas aplicadas a banco existente.
- `auth/AuthController.java`: login/sessão/logout, cookie HttpOnly/SameSite Strict, CSRF e matrícula/verificação MFA.
- `auth/AuthConfiguration.java` e `AuthService.java`: inatividade configurável, padrão de uma hora, verificada no servidor.
- `accounts/AccountPassword.java`: PBKDF2WithHmacSHA256.
- `collection/CollectionController.java`: coleta administrativa local, comandos com CSRF e operação condicionada à configuração; não executada contra fonte real por esta rodada.
- `moderation/ReviewController.java`: fila, histórico e decisão humana persistida; presença de código não é aceite operacional.
- Controllers de correções, fontes, territórios, confiabilidade, relatórios, auditoria e administração de ocorrências também presentes. Os contratos da arquitetura detalham cada fatia.

Corrigidos documentos de entrada que diziam inexistirem API, contas e persistência. Não foram reconstruídas capacidades existentes nem reabertas decisões aprovadas. A cobertura desejada RMRJ não equivale a geometria disponível ou operação validada.

## Proposta para clone novo — decisão pendente, nada publicado

`git check-ignore -v docs/product/specification.md .scratch/consulta-coerente/README.md` confirmou as regras de ignore para a especificação anterior e o diretório de tickets antigos. Não houve mudança do ignore nem inclusão forçada no índice.

**Proposta:** após revisão específica do responsável, selecionar a especificação normativa e os tickets antigos necessários, revisar dados pessoais/segredos/direitos, copiá-los para caminhos documentais versionáveis sob `docs/product/` e `docs/archive/` conforme sua vigência, atualizar links e validar em clone limpo. Preservar IDs, conteúdo original e proveniência; separar anexos privados, extrações brutas e materiais sem direito confirmado. Evitar publicar `.scratch/` inteiro. Uma futura autorização de commit não implica autorização para publicar esses materiais ignorados.

**Destino proposto das alterações anteriores:** manter entrevistas, especificação UXH e tickets como fatia documental revisável separada da reconciliação desta rodada; GLOSSARY/docs/README preexistentes não devem entrar por arraste em eventual commit. PLAN/CHANGELOG/scope são arquivos compartilhados e exigirão seleção de hunks quando houver autorização Git.

## Parecer de merge

**Não recomendar merge neste checkpoint.** A suíte Java API/PostGIS já foi concluída nesta rodada (59 unitários + 145 integrações, sem falhas/skips), mas a jornada persistida do navegador permanece incompleta. A revisão independente confirmou essa parcialidade e apontou defasagem verbal neste parecer, corrigida no fechamento. A decisão sobre materiais normativos ignorados e a seleção documental continuam pendentes. Nenhuma simulação histórica de conflito comprova aceite funcional. Não foi executado merge nem troca de branch.

## Retomada autorizada — estado posterior

O responsável autorizou: «Autorizo. Retome a tarefa.» Novo baseline sintético isolado preservou o banco anterior e corrigiu as três falhas da seleção persistida, sem alterar critérios. [Relatório posterior](uxh-01-resume-2026-10-24.md): matriz persistida 54/54 Chromium/Firefox, guards finais 8/8, demonstrativas 46/46, web lint/205/build. XMLs recalculados pela sessão principal. API/controlador não reexecutados nesta retomada.

O parecer continua **não recomendar merge** por bloqueios da ampliação integrada: renovação, clique no mapa, fila global e associação de referência Firefox. Segunda seleção ampliada 70 aprovados/2 falhas/1 erro/55 skips (29 configurados e 26 interrompidos); suplemento 29 aprovados/1 falha/22 skips configurados. Limite de três seleções atingido; próxima ação exige decisão antes de repetir. Nenhum código de produto/migração/controlador mudou; oito arquivos de harness/E2E foram alterados. Registros abaixo descrevem a primeira execução e não substituem essa atualização.

## Evidências e próxima ação

Execução técnica: [UXH-01](uxh-01-verification-2026-10-24.md); pesquisa: [UXH-02](uxh-02-inventory-2026-10-24.md). A sessão principal recalculou XMLs: API 59 unitários + 145 integrações sem falhas/erros/skips; demonstrativa 46/46; persistida 13 aprovados, 3 falhas e 36 não executados. Conferiu logs web (205 testes/28 arquivos, build 852,03 kB) e controlador (43). Recalculou inventário (46 linhas, 22 municípios, unicidade) e checklist (23 caixas desmarcadas). Planning final após correção do parecer apontada nas revisões Standards e Spec: 706 links, exit 0; `git diff --check` exit 0. Resultados anteriores são históricos.

Critérios não demonstrados: matriz persistida completa e Firefox persistido, outras famílias integradas, quantitativos intramunicipais/direitos e validação espacial. A seleção não foi repetida após as três falhas. Nenhum código, teste ou migração foi alterado; alterações posteriores aos testes são documentais. Processos de verificação foram encerrados. Próxima ação exige decisão do responsável sobre baseline sintético isolado e correção dirigida antes de novas tentativas; sem reduzir critérios ou apagar resíduos alheios. Aceites permanecem desmarcados.
