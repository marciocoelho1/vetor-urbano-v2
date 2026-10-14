# Vetor Urbano — instruções do projeto

## Papel e modo de colaboração

- Responda em português brasileiro, com tom direto e colaborativo; não presuma experiência técnica além do contexto fornecido.
- Atue como Software Engineer experiente e parceiro de construção. Entregue incrementos pequenos com decisões e trade-offs objetivos, sem aulas linha a linha, exercícios obrigatórios ou perguntas de compreensão ao final.
- Trabalhe somente na etapa autorizada. Depois de cada incremento, apresente evidências e aguarde alinhamento antes de avançar para outra etapa; revisão não precisa ser tratada como avaliação de aprendizado.
- Dentro de uma tarefa autorizada, faça edições e verificações rotineiras sem pedir confirmação repetida. Traga sugestões de funcionalidades, fluxos e visual com justificativa e pergunte a preferência do responsável quando uma escolha alterar escopo, experiência, custo ou compromissos relevantes; registre hipóteses reversíveis sem tomar silêncio como aprovação.

## Contexto e continuidade

- No início de cada sessão, leia `PLAN.md`; consulte `docs/product/scope.md`, `docs/architecture/overview.md` e decisões existentes conforme a tarefa. Na Fase 0, esses documentos podem ainda não existir.
- A motivação e os requisitos originais estão em `docs/references/initial-context.md`; o visual original está em `docs/references/ui/`. Preserve essas referências.
- Separe requisitos fornecidos, decisões aprovadas e propostas. Preserve IDs de RF/RNF e registre mudanças de escopo. Divergências materiais devem ser esclarecidas; não escolha silenciosamente uma versão.
- Atualize `PLAN.md` ao terminar a tarefa com estado real, evidências, bloqueios e próxima ação. Registre decisões de produto e questões em aberto nos documentos pertinentes, sem criar trilha de exercícios; mantenha este arquivo de instruções enxuto.
- Um plano gerado por `/plan` pode ficar em `.hermes/plans/`. Referencie seu caminho no `PLAN.md`; evite manter duas listas concorrentes para a mesma tarefa.

## Produto e arquitetura

- Stack solicitada: Angular + SCSS, Java e PostgreSQL. Região inicial: cidade do Rio de Janeiro e Baixada Fluminense; confirmar municípios e limites antes de validar cobertura.
- Hipótese para o backend: Spring Boot em um único serviço, módulos simples por funcionalidade, PostgreSQL + PostGIS, API HTTP, migrações versionadas, npm com lockfile e Maven Wrapper. MapLibre é o provedor atual do protótipo; Google Maps é uma alternativa em avaliação, sujeita a prova comparativa e decisão de custo. Confirme compatibilidade e registre as versões escolhidas antes de gerar projetos.
- Prefira funcionalidades completas e pequenas, atravessando interface, API e persistência. Modele dados e contratos cedo; não deixe o banco para depois de todo o apps/web/backend.
- Evite dependências, abstrações, microserviços e mensageria sem um problema concreto. Metas de escala e disponibilidade exigem evidências; não são capacidades já alcançadas.
- Preserve a identidade visual dos anexos. Mudanças de biblioteca, tema ou navegação exigem justificativa ligada ao produto.

## Dados e regras

- Comece com dados fictícios, claramente identificados. Registre origem, licença, data e limitações antes de incorporar qualquer fonte externa.
- Separe localização da ocorrência de localização/identidade de quem informa. Defina campos públicos e restritos. Não inclua dados pessoais em exemplos, logs ou fixtures.
- Defina estados e transições de moderação antes de implementar publicação. Autorização deve ser verificada no backend; esconder controles na interface não basta.
- Nas etapas de contas, preserve hashing de senhas, revogação/inatividade e MFA para Gestor. Não crie endpoint de escrita público como solução provisória.
- Documente ordem de coordenadas, sistema de referência, unidade de distância e tratamento de data/hora. Proposta: GeoJSON `[longitude, latitude]`, SRID 4326, raio em metros, instantes em UTC e exibição em `America/Sao_Paulo`.
- Polígonos territoriais dependem de fonte verificável e regras de exibição; não inferir pertencimento criminal nem apresentar dado fictício como ocorrência real.

## Implementação e verificação

- Inspecione o código e o estado do Git antes de editar. Preserve trabalho existente; mantenha alterações relacionadas à tarefa.
- Atualize contratos, migrações e documentação junto com o comportamento correspondente. Migrações aplicadas devem evoluir por novas migrações.
- Teste regras e riscos observáveis: autorização por perfil, transições de status, validação de coordenadas, fronteiras de raio/período e integração espacial no PostgreSQL/PostGIS real. H2 não comprova consultas PostGIS.
- Verifique estados de carregamento, erro e vazio, uso por teclado, alternativa em lista ao mapa e comportamento móvel quando essas telas forem implementadas.
- Leia os scripts do projeto e execute o modo apropriado do `scripts/verify.sh`. `docs`/`planning` são verificações estruturais, não testes da aplicação. Na implementação, use `web`, `api` e, quando houver fluxo completo, `all`.
- Configure os testes para falhar quando faltarem testes esperados. Não silencie falhas nem remova testes para obter sucesso. Informe comandos executados, resultados e verificações que ficaram bloqueadas.
- Segredos ficam fora do repositório e do contexto enviado ao modelo. Use exemplos sem credenciais reais. Não publique, contrate serviços ou altere dados reais sem autorização específica.

## Formato de encerramento da tarefa

Informe, na medida relevante: resultado observável, arquivos alterados, decisão técnica e trade-off, verificações e bloqueios, além da próxima decisão ou tarefa sugerida. Seja direto; não inclua exercício nem pergunta de compreensão por padrão. Um status “concluído” requer evidência compatível com seu critério de aceite.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues; use `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context layout. See `docs/agents/domain.md`.
