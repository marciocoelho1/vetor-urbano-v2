# UXH-19 — Preparar integração remota, acesso restrito e operação segura

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** E.
**Bloqueado por:** [UXH-01](uxh-01.md)
**Condição adicional:** Implementação não autorizada; decisões operacionais e canais seguros ainda pendentes. Não criar contas/projetos nem inserir segredos por este ticket local.

## Entrega verificável

Preparar a aplicação existente para piloto remoto com perfil/configuração explícitos, acesso por convidados e procedimentos operacionais verificáveis.

## Critérios de aceite

- [ ] Configurar integração remota explícita, HTTPS/proxy/cookies/CSRF e sem fallback silencioso para demo; proteger leitura/escrita no backend.
- [ ] Implementar/testar allowlist de e-mails e contas individuais com confirmação; ADMIN/MFA, revogação e fluxo de recuperação preservados.
- [ ] Planejar/provar chave MFA estável fora de disco efêmero e banco/segredos separados; coleta real desativada no piloto e dados fictícios identificados.
- [ ] Fechar com responsável serviço de e-mail, backup/restauração e retenção/responsáveis, provisionamento seguro de segredos e mapa-base autorizado; testar dependências com ambientes isolados.
- [ ] Documentar build/healthcheck/configurações sem valores secretos e recuperação de hibernação; não ativar caixa sintética ou senha de fixture em host público.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA23, UXH-CA24, UXH-CA25, UXH-CA26, UXH-CA28**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
