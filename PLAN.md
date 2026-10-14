# Plano de trabalho

Atualização: 14/10/2026. Este é o único roadmap ativo; os registros anteriores estão no [diário de outubro](docs/history/work-log-2026-10.md).

## Estado atual

Frontend Angular demonstrativo com consulta em mapa/lista, filtros, cadastro local, histórico, informes, indicadores, importação manual e exportação XLSX. A interface segue a proposta 6, com temas claro/escuro e consulta encaixada na primeira tela. A API Java, o banco PostgreSQL/PostGIS e a autenticação ainda não existem.

Organização e documentação revisadas em 14/10: fontes agrupados por responsabilidade, galeria isolada, SQL legado arquivado, changelog convencional e guias curtos de produto, desenvolvimento e operação. Alterações anteriores de interface preservadas no commit `4449457`. Detalhes da manutenção: [registro](docs/history/repository-maintenance-2026-10-14.md).

## Verificação desta manutenção

Lint, **59 testes unitários** e build da aplicação passaram após a organização. Build inicial: **502,64 kB**, com o aviso anterior de 2,64 kB acima do orçamento preservado. Lint/build separados da galeria e sintaxe dos scripts de captura passaram; Playwright reconheceu **98 cenários**.

A execução E2E direcionada ficou bloqueada: o servidor configurado pelo Playwright não iniciou (código 127). A manutenção não declara aprovação da matriz de navegador. A análise sintática confirmou equivalência dos **25 arquivos TypeScript** após normalizar imports; SHA-256 confirmou **390 arquivos protegidos e SQL legado** íntegros. Verificações estruturais e links locais passaram. [Evidência da manutenção](docs/evidence/repository-maintenance-2026-10-14.json).

A execução geral E2E anterior passou em 89 de 98 cenários; testes direcionados foram corrigidos e verificados, mas a suíte geral não foi declarada aprovada. Os resultados pertencem às respectivas entregas e estão no [registro da primeira tela](docs/history/design/public-map-first-screen-2026-10-14.md).

## Pendências conhecidas

- Tema local do mapa vetorial no cadastro e largura do cadastro a 320 px, reproduzidos antes desta manutenção.
- Bundle inicial 2,64 kB acima do aviso de orçamento; limite preservado.
- QA com leitor de tela, zoom e aparelho físico; testes automatizados não substituem essa revisão.
- Municípios, limites de cobertura, regras de acesso/moderação e configuração cartográfica para hospedagem.

## Próximas etapas

| Marco | Entrega | Estado / condição |
|---|---|---|
| F0 | Concluir e validar o frontend demonstrativo | Implementado; pendências de QA e regressão acima |
| R0 | Fechar recorte, perfis, campos públicos e moderação | Pendente; reconciliar contratos e requisitos legados |
| R1 | PostgreSQL/PostGIS + API Java integrada a mapa/lista | Não iniciado; exige R0 e testes no banco real |
| R2 | Preparar mapas e hospedagem | Provedor, termos, limites e domínio a definir |
| R3 | Autenticação, cadastro protegido, moderação e auditoria | Não iniciado; sessão, senha e MFA definidos antes de escrita real |
| R4 | Completar filtros/análise no servidor | Recursos locais parciais; garantir consistência mapa/lista |
| R5 | Validar territórios para uso operacional | Camada demonstrativa existente; revisar geometria, cobertura e atualização |
| R6 | Candidato a 1.0 em homologação | Fluxo integrado, segurança, privacidade e recuperação verificados |
| R7 | Pesquisar alertas, votos, push/geofencing e escala | Backlog; sem compromisso de operação em tempo real |

Ordem prevista: finalizar F0 e revisão manual → R0/R1. Alertas e uso operacional dos territórios dependem de decisões próprias. Os [aceites CA01–CA08 e regras RN-P01–RN-P14](docs/archive/planning/scope-2026-10.md) seguem preservados como propostas para reconciliação.

Próxima ação de produto: corrigir as pendências do frontend e repetir a matriz de navegador antes da revisão de R0. Esta manutenção inclui commit e push na branch atual, sem deploy.
