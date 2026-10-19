# Vetor Urbano — situação dos tickets

Atualizado em **18/10/2026** após a implementação local do ticket 26, sobre baseline `integration/functional-spec-v1` em `84fba01`; verificação sintética e revisão independente Standards + Spec concluídas. Inventário dos 36 tickets locais da especificação v1.1; IDs locais, sem correspondência presumida com issues do GitHub. Estado remoto não consultado nesta rodada. Evidências e sequência atual em [PLAN.md](../../PLAN.md) e nos checkpoints por ticket.

## Visão geral

- **29 implementados localmente**, com verificações registradas para o incremento correspondente.
- **1 parcial:** 25.
- **6 ainda não iniciados:** 20, 21, 22, 23, 24 e 35.

“Implementado localmente” descreve o estado do código e das evidências sintéticas disponíveis; não significa publicação, operação real ou aprovação de produção. As suítes completas não foram reexecutadas para produzir este inventário. Os checkpoints individuais estão ligados na tabela quando disponíveis.

## Implementados localmente

**01–19, 26–34 e 36** — incrementos implementados; a tabela resume a entrega e o tipo de evidência/limitação atual. Os tickets 07, 11, 15, 17, 18, 19, 27, 28, 29, 30, 31, 32, 33, 34 e 36 têm checkpoints ou validações posteriores documentados.

## Parciais ou com pendência

**25** — retomado no incremento de proximidade integrada sobre `d60fd73`; a linha descreve a consulta entregue e a pendência explícita de D06/CA08 que impede fechar o ticket. O 26 tem implementação e verificações locais; seu aceite operacional permanece aberto. O ticket 18 foi movido para implementados após a conclusão local do E2E opt-in; o 36 foi concluído no lote 27 → 36 → 17 → 18, com o canal de correções então disponível.

## Ainda não iniciados

**20, 21, 22, 23, 24 e 35** — ainda não há implementação local do fluxo correspondente. Dependências e decisões em aberto aparecem na descrição individual.

## Inventário dos 36 tickets

| ID | Ticket | Descrição breve | Estado atual |
|---|---|---|---|
| 01 | [Consultar o catálogo aprovado na abertura](../../.scratch/consulta-coerente/issues/01-catalogo-consulta-inicial.md) | Exibe três pilares, tipos e subtipos aprovados; inicia a consulta pelas últimas 24 horas. | Implementado localmente; testes anteriores registrados. |
| 02 | [Explorar ocorrências de um mesmo acontecimento](../../.scratch/consulta-coerente/issues/02-ocorrencias-acontecimentos.md) | Relaciona ocorrências do mesmo acontecimento e suas referências sem duplicar fatos. | Implementado localmente; testes anteriores registrados. |
| 03 | [Combinar e remover filtros sem duplicar resultados](../../.scratch/consulta-coerente/issues/03-filtros-combinados.md) | Combina filtros temáticos, temporais e espaciais com mapa e lista sincronizados. | Implementado localmente; testes anteriores registrados. |
| 04 | [Consultar tempo impreciso e confirmação de andamento](../../.scratch/consulta-coerente/issues/04-tempo-situacao-precisao.md) | Distingue datas imprecisas, situação e confirmação de andamento com expiração. | Implementado localmente; testes anteriores registrados. |
| 05 | [Aplicar território e distinguir registros apenas em lista](../../.scratch/consulta-coerente/issues/05-territorio-mapa-lista.md) | Filtra município/bairro e mantém registros sem coordenadas apenas na lista. | Implementado localmente; regressões direcionadas registradas. |
| 06 | [Alternar Modo simples e Análise e Inteligência](../../.scratch/consulta-coerente/issues/06-dois-modos.md) | Alterna os modos, suspende filtros ocultos e preserva preferências. | Implementado localmente; regressões direcionadas registradas. |
| 07 | [Selecionar agrupamentos e pins sobrepostos](../../.scratch/consulta-coerente/issues/07-agrupamentos-sobreposicoes.md) | Agrupa ocorrências e permite selecionar pins na mesma posição do mapa. | Concluído localmente em 18/10: IDs únicos e contagens exatas; lista seleciona durante carga/erro e vazio aprovado na Lista a 390 px em Chromium/Firefox. [Checkpoint](../history/ticket-07-progress-2026-10-18.md). Coordenadas preservadas; sem QA físico ou prontidão operacional. |
| 08 | [Consultar Informes Ativos por ponto manual](../../.scratch/consulta-coerente/issues/08-informes-manuais.md) | Consulta informes recentes e vigentes próximos a um ponto, respeitando raio máximo de 5 km. | Implementado localmente; testes anteriores registrados. |
| 09 | [Consultar Áreas de Risco com referência temporal](../../.scratch/consulta-coerente/issues/09-areas-risco-demo.md) | Exibe camada territorial demonstrativa, fonte, referência temporal e limites de interpretação. | Implementado como demonstração; persistência e versões territoriais pertencem ao ticket 26. |
| 10 | [Atualizar a consulta sem perder contexto](../../.scratch/consulta-coerente/issues/10-consulta-atualizacao-estados.md) | Apresenta estados de carregamento, vazio e erro; atualização mantém filtros e câmera. | Implementado localmente; atualização de dados ainda é demonstrativa. |
| 11 | [Conhecer fontes e avaliação pela consulta](../../.scratch/consulta-coerente/issues/11-paginas-publicas-demo.md) | Apresenta fontes demonstrativas e explicação pública resumida da confiabilidade. | Concluído localmente em 18/10: `public-information.spec.ts` passou 8/8 Chromium/Firefox; jornadas de módulo usam sessão sintética e a página pública segue acessível pelo rodapé sem autenticação. [Checkpoint](../history/ticket-11-progress-2026-10-18.md). Coleta automatizada não está integrada. |
| 12 | [Consultar publicadas persistidas pela API](../../.scratch/consulta-coerente/issues/12-consulta-persistida.md) | Consulta ocorrências publicadas pela API Java/PostGIS com filtros no servidor. | Implementado localmente; integração e persistência verificadas em ambiente sintético. |
| 13 | [Criar e confirmar conta de usuário](../../.scratch/consulta-coerente/issues/13-cadastro-confirmacao.md) | Cria conta sintética USER e confirma endereço por caixa local e token de uso único. | Implementado localmente; fluxo verificado em ambiente sintético. |
| 14 | [Proteger módulos e administração com sessão e MFA](../../.scratch/consulta-coerente/issues/14-acesso-sessao-mfa.md) | Implementa sessão, permissões verificadas no servidor e MFA para Administração. | Implementado localmente; fluxo verificado em ambiente sintético. |
| 15 | [Recuperar, alterar e encerrar a própria conta](../../.scratch/consulta-coerente/issues/15-ciclo-conta.md) | Reúne recuperação de acesso, autoatendimento de perfil/credenciais e encerramento da conta. | Implementado localmente nas fatias 15A, 15B e 15C; aceite usa dados sintéticos e não representa prontidão operacional. |
| 16 | [Administrar fontes e consultar sua lista pública](../../.scratch/consulta-coerente/issues/16-gestao-fontes.md) | Administra fontes versionadas e auditadas; publica apenas nome e link. | Implementado localmente; gestão não executa coleta. |
| 17 | [Revisar e publicar ocorrências sem duplicar clippings](../../.scratch/consulta-coerente/issues/17-revisar-publicar.md) | Revisa clippings, associa acontecimentos e decide publicação sem duplicar ocorrências. | Implementado localmente; fila ADMIN/MFA, núcleo validado no servidor, replay/concorrência e histórico registrados no checkpoint. |
| 18 | [Corrigir ou retirar uma ocorrência publicada](../../.scratch/consulta-coerente/issues/18-corrigir-retirar.md) | Corrige ou retira publicação com revisão e histórico auditável. | Concluído localmente em 18/10: E2E editor e canal 4/4 cada em Chromium/Firefox, incluindo erro/retry por teclado e fila vazia; API 18 + 86 prova remoção de query/export, contagens e trilha de snapshots; web 124, `planning` 433 links e `git diff --check` passaram. [Checkpoint](../history/ticket-18-progress-2026-10-18.md). Aceite sintético; sem prontidão operacional. |
| 19 | [Consultar logs administrativos com retenção configurada](../../.scratch/consulta-coerente/issues/19-consultar-logs.md) | Permite consulta administrativa de logs com retenção definida para o ambiente. | Concluído localmente em 18/10: `/api/v1/admin/logs` devolve `actor` e `historicalActor` para conta viva e autoria residual; `AuditHttpIT` prova o encerramento, a ausência do UUID eliminado e as duas referências distintas. [Checkpoint](../history/ticket-19-progress-2026-10-18.md). |
| 20 | [Coletar publicações recentes de uma fonte autorizada](../../.scratch/consulta-coerente/issues/20-coleta-recente.md) | Coleta publicações recentes de fonte autorizada e encaminha os itens para revisão. | Ainda não iniciado; a fonte e os parâmetros operacionais continuam sem autorização/definição final. |
| 21 | [Carregar publicações retroativas com retomada](../../.scratch/consulta-coerente/issues/21-coleta-retroativa.md) | Ingere publicações históricas por período e território, com retomada e acompanhamento. | Ainda não iniciado; depende da trilha de coleta recente do ticket 20. |
| 22 | [Acompanhar falhas de coleta e espera de revisão](../../.scratch/consulta-coerente/issues/22-painel-operacao.md) | Monitora falhas, progresso de coleta e espera na fila de revisão. | Ainda não iniciado; depende de eventos e estados produzidos pela coleta (ticket 20). |
| 23 | [Avaliar confiabilidade com regra calibrada e versionada](../../.scratch/consulta-coerente/issues/23-avaliar-ocorrencia.md) | Calcula avaliação versionada da ocorrência e publica explicação resumida. | Ainda não iniciado; calibração e fórmula de confiabilidade precisam ser definidas. |
| 24 | [Decidir recomendação mensal sobre notas de fontes](../../.scratch/consulta-coerente/issues/24-reavaliar-fontes.md) | Recomenda revisão periódica das notas das fontes, sujeita a aprovação humana. | Ainda não iniciado; depende das definições e do mecanismo de avaliação do ticket 23. |
| 25 | [Consultar proximidade e vigência no fluxo integrado](../../.scratch/consulta-coerente/issues/25-proximidade-vigencia-integradas.md) | Integra localização consentida ou ponto manual às regras de vigência dos Informes. | Parcial: HTTP/USER/PostGIS, política declarada com negação segura, insuficiência pública, auditoria e web de localização/manual integrados. API 21 + 96, web 127 e Playwright 14/14 Chromium/Firefox (25 + 08). [Checkpoint](../history/ticket-25-progress-2026-10-18.md). Persistência D06/CA08 de transições/última verificação e parâmetros operacionais permanecem pendentes; configuração produtiva vazia, sem V14. Revisão independente/commits ainda cabem ao parent. |
| 26 | [Revisar versões persistidas de Áreas de Risco](../../.scratch/consulta-coerente/issues/26-versoes-areas-risco.md) | Persiste versões de áreas territoriais com referência temporal e procedência. | Implementado localmente: V13, revisões/aprovação explícita, autoria histórica, HTTP ADMIN/MFA/CSRF, correções AREA e web opt-in; API 18 + 93, web 127 e Playwright 12/12 Chromium/Firefox. [Checkpoint](../history/ticket-26-progress-2026-10-18.md). Revisão Standards + Spec sem achados pendentes; aceite operacional aberto (autorização/evidência e validação cartográfica reais). |
| 27 | [Solicitar e acompanhar correção de dados](../../.scratch/consulta-coerente/issues/27-solicitar-correcao.md) | Recebe solicitações de correção e permite acompanhar o andamento. | Implementado localmente; canal autenticado privado com quatro estados, fila ADMIN/MFA e alvo validado. |
| 28 | [Percorrer Histórico avançado paginado](../../.scratch/consulta-coerente/issues/28-historico-avancado.md) | Oferece Histórico publicado, filtrado e paginado, com snapshot consistente. | Implementado localmente; web, API/PostGIS, jornadas e revisão estão registradas no checkpoint. |
| 29 | [Gerar relatório com recorte independente](../../.scratch/consulta-coerente/issues/29-relatorios-recorte.md) | Gera relatório com recorte próprio, transferido explicitamente da consulta. | Implementado localmente; web, API/PostGIS, jornadas e revisão estão registradas no checkpoint. |
| 30 | [Ler síntese determinística do relatório](../../.scratch/consulta-coerente/issues/30-sintese-deterministica.md) | Produz síntese determinística sem inferir causas, respeitando precisão e cobertura. | Implementado localmente e verificado com dados sintéticos; checkpoint e revisão registrados. |
| 31 | [Comparar períodos ou territórios com limites explícitos](../../.scratch/consulta-coerente/issues/31-comparar-recortes.md) | Compara recortes com unidades, precisão e limites de interpretação explícitos. | Implementado localmente e verificado com dados sintéticos; checkpoint e revisão registrados. |
| 32 | [Ler concentração de ocorrências no modo avançado](../../.scratch/consulta-coerente/issues/32-mancha-termica.md) | Exibe concentração de ocorrências únicas geograficamente compatíveis no modo avançado. | Implementado e integrado localmente; aceite verificado com dados sintéticos. |
| 33 | [Baixar XLSX de todo o recorte avançado](../../.scratch/consulta-coerente/issues/33-exportar-xlsx.md) | Exporta o recorte completo para XLSX com abas, filtros, metadados e limitações. | Implementado localmente; exportação, jornadas, abertura no LibreOffice e revisão estão registradas no checkpoint. |
| 34 | [Baixar PDF do relatório gerado](../../.scratch/consulta-coerente/issues/34-exportar-pdf.md) | Exporta relatório diagramado em PDF com mapa, síntese e indicadores. | Implementado localmente e verificado com dados sintéticos; checkpoint e revisão registrados. |
| 35 | [Avisar atualizações publicadas na consulta aberta](../../.scratch/consulta-coerente/issues/35-avisos-atualizacao-integrados.md) | Informa sobre publicações/correções e permite atualizar a consulta explicitamente. | Ainda não iniciado; depende dos eventos de publicação/correção do ticket 18. |
| 36 | [Consultar documentos de uso, privacidade e metodologia](../../.scratch/consulta-coerente/issues/36-documentos-institucionais.md) | Apresenta termos, privacidade, metodologia e procedimento de correção versionados. | Implementado localmente como rascunho v1.3 com canal de correções disponível; publicação jurídica e revisão final de conteúdo pendentes do responsável. |

## Evidências recentes

- [Ticket 28](../history/ticket-28-progress-2026-10-17.md), [29](../history/ticket-29-progress-2026-10-17.md), [30](../history/ticket-30-progress-2026-10-17.md) e [31](../history/ticket-31-progress-2026-10-17.md), [32](../history/ticket-32-progress-2026-10-17.md), [33](../history/ticket-33-progress-2026-10-17.md) e [34](../history/ticket-34-progress-2026-10-17.md): checkpoints e verificações locais.
- [Estado do lote 27 → 36 → 17 → 18](../history/batch-27-36-17-18-2026-10-17.md): commits, verificações reais, pendência de navegador do 18 e diagnóstico do acesso local.
- [Ticket 17](../history/ticket-17-progress-2026-10-17.md), [18](../history/ticket-18-progress-2026-10-17.md), [27](../history/ticket-27-progress-2026-10-17.md) e [36](../history/ticket-36-progress-2026-10-17.md): lote autorizado 27 → 36 → 17 → 18, com HTTP/PostGIS sintéticos e Playwright separado.
- [Ticket 07](../history/ticket-07-progress-2026-10-18.md), [11](../history/ticket-11-progress-2026-10-18.md), [18](../history/ticket-18-progress-2026-10-18.md), [15](../history/ticket-15-progress-2026-10-17.md), [19](../history/ticket-19-progress-2026-10-18.md) e [25/26](../history/): estado das contagens/estados cartográficos, jornadas públicas, editor de publicação, fatias de conta, auditoria e incrementos parciais. O [plano de trabalho](../../PLAN.md) contém o checkpoint mais recente.

## Acessos de teste

Contas criadas e confirmadas **somente no banco sintético local** `vetor-spec-postgis`, banco `vetor_spec_test`, porta `55436`. Não são contas de produção nem dados de pessoas reais.

> **Acesso local em 17/10/2026:** o contêiner `vetor-spec-postgis` estava **parado**, e a API em `127.0.0.1:8080` servia outro banco — por isso o login era recusado com `LOGIN DENIED` de `account_id` nulo (e-mail ausente no banco em uso, não senha inválida). Depois de `podman start vetor-spec-postgis` e de subir a API contra `vetor_spec_test` (`55436`, migrações pendentes aplicadas até `v12`), as duas contas foram conferidas por HTTP real: `usuario@vetorurbano.test` responde 200 com cookie de sessão e `admin@vetorurbano.test` responde 200 exigindo o autenticador. Comandos e cuidados em [operação da web](../operations/web.md#banco-e-credenciais-locais).

| Perfil | Login | Senha |
|---|---|---|
| Administrador | `admin@vetorurbano.test` | `123456` |
| Usuário | `usuario@vetorurbano.test` | `123456` |

Acesse [o ambiente integrado local](http://127.0.0.1:4201/?consulta=api). Use `127.0.0.1` tanto no frontend quanto na API; `localhost` usa outro domínio de cookies. O endereço só funciona no computador onde os serviços locais estiverem ativos.

No primeiro acesso do Administrador, clique em **Configurar autenticador**, adicione a chave apresentada ao seu aplicativo TOTP (SHA-1, seis dígitos, 30 segundos) e confirme o código. A senha sozinha inicia uma sessão parcial; o acesso administrativo exige o segundo fator. O autenticador foi deixado sem configuração para o responsável cadastrá-lo. Nenhuma chave MFA é incluída neste documento.

A senha curta foi provisionada como exceção offline explícita apenas para estas duas fixtures, a pedido do responsável. O banco guarda PBKDF2-SHA256 com salt aleatório por conta e 600.000 iterações. Cadastro público e bootstrap administrativo habitual mantêm suas validações. O [provisionador local](../../scripts/create-local-test-accounts.py) exige ativação explícita, não redefine contas existentes e não remove MFA.

## Conferência desta entrega

As duas senhas e perfis foram conferidos por HTTP real, incluindo senha inválida, sessão, consulta, restrição administrativa, logout/revogação e exigência de MFA. O cadastro público continuou recusando `123456` (400). Os testes de navegador e a verificação documental estão detalhados no [registro desta entrega](../history/tickets-and-test-access-2026-10-16.md). As suítes completas dos 36 tickets não foram reexecutadas.

Base de rastreabilidade: [plano atual](../../PLAN.md), [inventário local de execução](../../.scratch/consulta-coerente/implementation-state.json), [revalidação 05](../history/ticket-05-dependency-retest-2026-10-15.md), [06](../history/ticket-06-resume-2026-10-15.md), [07](../history/ticket-07-resume-2026-10-15.md), [10](../history/ticket-10-retest-2026-10-15.md), [12](../history/ticket-12-progress-2026-10-15.md), [13](../history/ticket-13-progress-2026-10-15.md), [14](../history/ticket-14-progress-2026-10-15.md) e [16](../history/ticket-16-progress-2026-10-15.md). O plano e checkpoints recentes prevalecem sobre estados antigos ainda não reconciliados no inventário JSON e em outros resumos.
