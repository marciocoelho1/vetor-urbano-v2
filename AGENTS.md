# Vetor Urbano — instruções do projeto

## Contexto

Responda em português brasileiro, de forma direta e colaborativa. Comece por `PLAN.md`, inspecione o código e o estado do Git e preserve trabalho existente. Dentro da tarefa autorizada, execute alterações e verificações rotineiras sem confirmação repetida.

Consulte `docs/product/scope.md` para recursos, limites e RF/RNF; `docs/architecture/overview.md` para estado técnico; `docs/development/repository-layout.md` ao organizar arquivos; `docs/operations/web.md` ao preparar build ou hospedagem. Requisitos e visuais originais estão em `docs/references/` e devem ser preservados.

## Estado e escopo

A aplicação executável é o frontend demonstrativo em `apps/web/`. `apps/api/` reserva a futura API Java; PostgreSQL/PostGIS e autenticação ainda não estão implementados. SQL e contratos antigos estão em `docs/archive/`, sujeitos à reconciliação antes do backend.

Trabalhe no escopo autorizado. Mudanças relevantes de produto, experiência, custo ou compromisso precisam de alinhamento. Registre propostas como propostas e preserve IDs dos requisitos. A cobertura solicitada é Rio de Janeiro/Baixada Fluminense; municípios e limites operacionais permanecem em aberto.

## Implementação e dados

- Organize código pela responsabilidade das pastas existentes; prefira incrementos completos e evite abstrações ou dependências sem uso concreto.
- Preserve identidade visual, atribuições e licenças. Novas fontes exigem origem, licença/autorização, data e limitações registradas.
- Use dados fictícios nos exemplos. Separe localização da ocorrência de identidade/localização do informante; defina campos públicos e restritos antes de integração real.
- GeoJSON usa `[longitude, latitude]`, WGS 84/SRID 4326; raio em metros; instantes UTC e apresentação `America/Sao_Paulo`.
- Autorização e moderação futuras devem ser verificadas no backend. Contas exigem senhas protegidas, revogação/inatividade e MFA para Gestor. Migrações aplicadas evoluem por novas migrações.
- Segredos ficam fora do repositório e do contexto do agente. Publicação, contratação e alteração de dados reais exigem autorização específica.

## Verificação e continuidade

Execute o modo adequado de `scripts/verify.sh`. `docs`/`planning` conferem estrutura e links; `web` executa lint, unidade e build; Playwright é separado. `api`/`all` exigem a aplicação Java e testes esperados. Integração espacial futura usa PostgreSQL/PostGIS real.

Verifique estados de carregamento, erro e vazio, teclado, alternativa em lista e apresentação móvel nas telas alteradas. Testes ausentes ou falhas não contam como sucesso. Informe comandos, resultados e limitações reais.

Atualize `PLAN.md` com estado, evidências e próxima ação; registre mudanças em `CHANGELOG.md`. Mantenha o plano curto e detalhes datados em `docs/history/`. Ao encerrar, apresente resultado, verificações e bloqueios relevantes.

## Guias para skills de engenharia

- Ao consultar ou atualizar issues, use GitHub conforme `docs/agents/issue-tracker.md`.
- Ao fazer triagem, use os cinco rótulos de `docs/agents/triage-labels.md`.
- Ao explorar termos e decisões de domínio, siga `docs/agents/domain.md` e `GLOSSARY.md`.
