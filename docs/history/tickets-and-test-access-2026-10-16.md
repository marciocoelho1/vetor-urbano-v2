# Tickets e acessos de teste - 16/10/2026

## Entrega e escopo

Pedido: documento simples com todos os tickets, descrições, implementados/testados e restantes; duas contas de teste com senha `123456`; estado atual do Vetor Urbano.

Entregues [inventário consolidado](../product/tickets-status.md) e [PDF de quatro páginas](../../output/pdf/vetor-urbano-tickets-e-acessos-2026-10-16.pdf). Base: 36 arquivos originais em `.scratch/consulta-coerente/issues/`, código, Git e checkpoints recentes. Contagem: 14 com implementação/testes locais registrados (01-06, 08-14, 16); 07/36 com pendências; 20 restantes (15, 17-35). O 09 tem evidências históricas e checklist original não marcado; não recebeu novo aceite. Nenhuma suíte histórica foi apresentada como reexecutada. O GitHub via `gh issue list --state all --limit 200 --json number,title,state,body,url` falhou por conexão; o conector GitHub, consulta `repo:marciocoelho1/vetor-urbano-v2 is:issue`, retornou lista vazia. IDs são locais, sem correspondência GitHub presumida.

Árvore de trabalho já continha alterações em frontend, testes, controlador, plano e documentos. Foram preservadas; sem commit/push, coleta real ou publicação. Os resumos antigos de escopo/arquitetura ainda contêm trechos anteriores aos tickets 12-16; o inventário aponta explicitamente para o plano e checkpoints recentes.

## Ambiente e contas

O banco utilizado nas últimas evidências do 16 (`vetor-api-ticket12-db`) não existia neste host. O contêiner sintético existente `vetor-spec-postgis` estava parado, com banco `vetor_spec_test` sem tabelas da aplicação. Foi iniciado, mantendo porta loopback 55436 e dados anteriores; a API compilada aplicou V1-V5 sem editar migrações. Java 25 executa o JAR existente, compilado anteriormente em Java 21. Não houve recompilação nem download.

API local em 127.0.0.1:8080 e frontend em 127.0.0.1:4201. A API foi iniciada por um lançador temporário que lê a configuração do contêiner e a passa no ambiente ao processo, sem imprimir credenciais. Log em `/tmp/vu-demo-api.log`. Chave MFA local no caminho privado padrão da aplicação, sem leitura/exposição. Não foi alterado serviço de produção.

O [provisionador offline](../../scripts/create-local-test-accounts.py), chamado com `--synthetic-local-only`, restringe a conexão ao contêiner e banco sintéticos conhecidos. Insere somente `admin@vetorurbano.test`/ADMIN e `usuario@vetorurbano.test`/USER confirmados. Senha curta explicitamente solicitada é exceção para fixtures; PBKDF2-HMAC-SHA256, 600.000 iterações, salt aleatório individual, nenhuma mudança em AccountPassword, cadastro, login, autorização ou MFA. Não redefine contas existentes. Criação e auditoria são transacionais. Repetição não duplicou contas nem eventos. O Administrador está sem fator cadastrado para que o responsável o configure na interface; senha sozinha não libera módulos protegidos.

## Comandos e resultados

- `podman start vetor-spec-postgis`: passou; não criou novo contêiner nem imagem.
- `python3 scripts/create-local-test-accounts.py --synthetic-local-only`: passou. Segunda execução preservou duas contas e dois eventos `TEST_FIXTURE_BOOTSTRAP`; SQL conferiu confirmação, dois salts distintos e formato derivado, sem expor hashes.
- `python3 /tmp/vu-check-test-accounts.py`: passou para ambos os papéis: senha incorreta 401, senha correta 200, sessão 200, consulta USER 200 / ADMIN parcial 403, fontes administrativas 403 para ambos antes de MFA, logout 200 e sessão revogada 401. Cadastro público com senha curta continua 400. Primeira tentativa do verificador usava consulta sem período e caminho administrativo incorreto; o oráculo foi corrigido para os contratos existentes e repetido. Nenhuma alteração no produto foi necessária.
- `npm run start -- --host 127.0.0.1 --port 4201`, em apps/web: servidor de desenvolvimento ativo; build de desenvolvimento concluído, sem equivalência a build de produção.
- `node /tmp/vu-browser-access.cjs`: 4/4 cenários passaram (USER e ADMIN, Chromium e Firefox), teclado Enter, viewport 390x844 sem overflow; Usuário entra/sai, Administrador recebe tela de MFA e opção de configurar autenticador. Não foi cadastrado segundo fator nem gerado segredo para entregar no documento. A jornada MFA completa já tem evidência histórica do ticket 14; não foi repetida nesta entrega.
- PDF gerado com ReportLab; `pdfinfo` confirmou quatro páginas A4. `pdftoppm -scale-to 1100 -png` e inspeção visual das quatro páginas: sem cortes, sobreposição ou glyphs ausentes. Conferência textual confirmou IDs 01-36 e as duas identidades de teste.

`bash scripts/verify.sh planning`: passou com 284 links locais, estrutura e sintaxe Bash. `git diff --check`: passou. Sintaxe Python conferida com AST. A conferência final das duas derivações PBKDF2 confirmou 600.000 iterações, senha correspondente e salts distintos, sem imprimir hashes; a checagem SQL anterior com literal interpolado pelo shell foi substituída por envio de SQL via stdin. Não houve alteração de telas nem de regras da API; testes de carregamento/erro/vazio já existentes não foram repetidos, e suites web/API completas não foram executadas. Contas e serviços são exclusivamente locais, sem prontidão operacional.

## Continuidade

O responsável deve abrir `http://127.0.0.1:4201/?consulta=api` e cadastrar o autenticador do Administrador. Se os processos forem encerrados ou o host reiniciar, os serviços locais precisam ser iniciados de novo com a configuração do banco sintético na porta 55436; as contas ficam persistidas. O provisionador não é inicializador da API. A chave MFA deve ser preservada no host.

Próxima implementação permanece escolha explícita: resolver aceite do 07 ou iniciar outro ticket liberado. 36 depende de 27 para recebimento/acompanhamento; publicação, fontes reais/custos, RF06, metas de desempenho e QA físico seguem pendentes.
