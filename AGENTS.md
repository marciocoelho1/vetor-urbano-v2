# Vetor Urbano — instruções do projeto

## Contexto

Responda em português brasileiro, de forma direta e colaborativa. Comece por `PLAN.md`, inspecione o código e o estado do Git e preserve trabalho existente. Dentro da tarefa autorizada, execute alterações e verificações rotineiras sem confirmação repetida.

Consulte `docs/product/scope.md` para recursos, limites e RF/RNF; `docs/architecture/overview.md` para estado técnico; `docs/development/repository-layout.md` ao organizar arquivos; `docs/operations/web.md` ao preparar build ou hospedagem. Requisitos e visuais originais estão em `docs/references/` e devem ser preservados.

## Estado e escopo

A aplicação local reúne o frontend Angular em `apps/web/` e a API Java/Spring Boot em `apps/api/`, com PostgreSQL/PostGIS, migrações Flyway, contas, sessão/MFA, revisão/publicação e coleta condicionada à configuração. Demonstração e integração explícita `?consulta=api` são distintas. Código implementado não comprova operação hospedada; confira as evidências atuais no `PLAN.md`. SQL e contratos em `docs/archive/` são históricos, não migrações executáveis atuais.

Trabalhe no escopo autorizado. Mudanças relevantes de produto, experiência, custo ou compromisso precisam de alinhamento. Registre propostas como propostas e preserve IDs dos requisitos. A cobertura desejada é toda a Região Metropolitana do Rio de Janeiro, preservando a referência original Rio/Baixada. Catálogo, polígonos, direitos e cobertura operacional precisam de validação; lacunas permanecem explícitas.

## Implementação e dados

- Organize código pela responsabilidade das pastas existentes; prefira incrementos completos e evite abstrações ou dependências sem uso concreto.
- Preserve identidade visual, atribuições e licenças. Novas fontes exigem origem, licença/autorização, data e limitações registradas.
- Use dados fictícios nos exemplos. Separe localização da ocorrência de identidade/localização do informante; defina campos públicos e restritos antes de integração real.
- GeoJSON usa `[longitude, latitude]`, WGS 84/SRID 4326; raio em metros; instantes UTC e apresentação `America/Sao_Paulo`.
- Autorização e moderação devem continuar verificadas no backend. Contas exigem senhas protegidas, revogação/inatividade e MFA para Gestor. Migrações aplicadas evoluem por novas migrações.
- Segredos ficam fora do repositório e do contexto do agente. Publicação, contratação e alteração de dados reais exigem autorização específica.

## Verificação e continuidade

Execute o modo adequado de `scripts/verify.sh`. `docs`/`planning` conferem estrutura e links; `web` executa lint, unidade e build; Playwright é separado. `api`/`all` exigem a aplicação Java e testes esperados. Integração espacial usa PostgreSQL/PostGIS real em ambiente sintético identificado.

Verifique estados de carregamento, erro e vazio, teclado, alternativa em lista e apresentação móvel nas telas alteradas. Testes ausentes ou falhas não contam como sucesso. Informe comandos, resultados e limitações reais.

Atualize `PLAN.md` com estado, evidências e próxima ação; registre mudanças em `CHANGELOG.md`. Mantenha o plano curto e detalhes datados em `docs/history/`. Ao encerrar, apresente resultado, verificações e bloqueios relevantes.

## Guias para skills de engenharia

- Ao consultar ou atualizar issues, use GitHub conforme `docs/agents/issue-tracker.md`.
- Ao fazer triagem, use os cinco rótulos de `docs/agents/triage-labels.md`.
- Ao explorar termos e decisões de domínio, siga `docs/agents/domain.md` e `GLOSSARY.md`.
