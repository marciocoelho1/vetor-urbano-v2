# Ticket local 33 — checkpoint de implementação

Data: 17/10/2026. Ticket 33 é um ID local de `.scratch/consulta-coerente/issues/33-exportar-xlsx.md`; não pressupõe correspondência com issue do GitHub.

## Escopo e rastreabilidade

- Critérios reconciliados: D08, CA16 e RF02, preservando IDs originais; E04 sustenta a exportação auditável e E08 determina minimização dos dados de uso. E01–E19 foram consultadas como decisões aprovadas pertinentes. E20 e propostas pendentes permanecem fora desta fatia.
- Dependências 06 (consulta avançada) e 14 (sessão/autorização) estavam satisfeitas. Ticket 33 não depende do ticket 28 nem incorpora sua paginação.
- O responsável aprovou em 17/10 três abas e a ordem de colunas: `Recorte` (`Campo`, `Valor`, com geração, período, fuso, filtros, contagens e limitações); `Ocorrências` (IDs de ocorrência/acontecimento, título, descrição, pilar, tipo, subtipo, situação, município, bairro, precisão geográfica, longitude, latitude, precisão temporal, instante UTC, início UTC, fim exclusivo UTC, quantidade de referências); `Referências` (ID da ocorrência, ID da referência, título da publicação, fonte, publicação UTC e coleta UTC).
- Valores desconhecidos e coordenadas indisponíveis ficam vazios, nunca zero. Fatos aproximados conservam limites exclusivos e não viram instante exato. Fatores de avaliação, notas internas e dados restritos não saem no arquivo.
- Não há teto arbitrário de registros. Cada aba de dados pode ter até 1.048.575 linhas além do cabeçalho; a saída divide abas mantendo cabeçalhos. Texto acima de 32.767 caracteres, caracteres XML incompatíveis, número de abas ou tamanho acima do formato suportado causam erro antes de criar o download; não é anunciado arquivo parcial.

## Implementação

- `GET /api/v1/reports/occurrences/export` valida a mesma sessão completa no servidor, consulta todos os registros filtrados e suas referências na leitura PostGIS repetível e registra `REPORT_EXPORT`. A auditoria guarda apenas filtros permitidos, totais, instante e indicadores booleanos para busca textual/recorte espacial, conforme E08.
- O navegador constrói as abas com todos os itens da resposta, fora do limite da página visível. O exportador valida texto/XML, quantidade de linhas/abas e o pacote ZIP32 antes de começar o download. Erros e carregamento têm estado acessível; o botão é desativado durante a operação.
- Commits de implementação/testes/contrato e correções Spec: `9bac3e4` (`feat: export full report recut to xlsx`) e `6391a6c` (`fix: preserve unknown report export values`). Baseline da revisão: `117997302cf187fba5b77089f24e76c0552201fe`.

## Evidências

- TDD: dois novos testes primeiro falharam, confirmando (a) mensagem local alegava auditoria que não ocorreu e (b) `UNKNOWN` aparecia como “Desconhecida”; após as correções, ambos passaram.
- `bash scripts/verify.sh web`: passou lint, 111 testes e build; chunk inicial 695,25 kB, acima do orçamento configurado de 500 kB por 195,25 kB. Os mapas seguem em chunks lazy.
- `JAVA_HOME=/tmp/vu-jdk-21 PATH=/tmp/vu-jdk-21/bin:$PATH DOCKER_HOST=unix:///tmp/vu-podman.sock bash scripts/verify.sh api`: passou 14 testes unitários e 29 integrações HTTP contra PostgreSQL/PostGIS real. O teste do endpoint também verificou 401 sem sessão, retorno do recorte/referências autenticado, minimização do evento E08 e persistência da auditoria após reinício da aplicação.
- Playwright separado: `VETOR_PERSISTED_E2E=1 VETOR_E2E_DATABASE_CONTAINER=vu-ticket29-e2e-db VETOR_E2E_API_BASE=http://127.0.0.1:8081/api/v1 VETOR_E2E_MAILBOX_PORT=8026 DOCKER_HOST=unix:///tmp/vu-podman.sock ./node_modules/.bin/playwright test --project=chromium --project=firefox --workers=1 e2e/report-export.spec.ts` (diretório `apps/web`): 8/8 na execução final. A massa sintética inclui 33 registros e relações/referências; cobre arquivo completo, texto tipo fórmula, valores em branco, teclado/foco, viewport 390 px, carregamento, vazio, erro por limite e PostGIS indisponível sem download. Uma tentativa intermediária falhou no Chromium porque o cenário pausava o PostGIS antes de gerar o snapshot; o teste agora confirma o snapshot de 33 itens antes da falha, e a suíte completa passou nos dois navegadores.
- Os XLSX recém-baixados por Chromium e Firefox abriram no LibreOffice/Calc e foram convertidos sem erro. `bash scripts/verify.sh planning` e `git diff --check` passaram após os documentos do checkpoint.

## Revisão e limites

- Revisões Standards + Spec contra o baseline informado: nenhum finding acionável após correção. Spec encontrou dois P2: mensagem de sucesso no demo afirmava auditoria server-side inexistente e `UNKNOWN` era escrito como “Desconhecida”; ambos foram reproduzidos em testes, corrigidos em `6391a6c` e re-revisados sem findings. Standards também não apontou findings no delta da correção.
- A evidência usa somente contas e dados sintéticos locais. Não demonstra disponibilidade, segurança ou autorização operacional para coleta real e não declara prontidão operacional. Sem push, deploy, contratação ou alteração de dados reais.

## Próxima ação

Selecionar o próximo ticket local autorizado, conferir seus critérios/dependências/decisões antes de iniciar e preservar propostas ainda pendentes.
