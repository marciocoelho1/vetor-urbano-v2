# UXH-22 — Implantar piloto restrito em Neon, Render e Vercel

**Estado:** proposto para revisão da divisão; não iniciado, sem aceite ou publicação no GitHub.
**Lote:** G.
**Bloqueado por:** [UXH-21](uxh-21.md)
**Condição adicional:** BLOQUEADO POR AUTORIZAÇÃO EXTERNA: implantação, vinculação Git, envio de camadas e eventuais commit/push/merge são permissões separadas. Condições operacionais e decisão sobre cobertura precisam estar explícitas antes de publicar.

## Entrega verificável

Provisionar, após autorização específica, banco, API e frontend integrados no ambiente de homologação e conferir recursos reais criados.

## Critérios de aceite

- [ ] Reconfirmar condições dos planos e intervenção do responsável para conta/OAuth/MFA; parar se exigir cartão, upgrade ou cobrança.
- [ ] Provisionar Neon → Render → Vercel, com PostGIS/migrações, TLS, configuração segura, branch/versão explícitas e controles de auto-deploy.
- [ ] Enviar somente fixtures de ocorrências e pacote territorial validado/autorizado; manter coleta real desligada e não tocar banco de dados reais local.
- [ ] Ler de volta os recursos criados e provar navegador → API → banco, allowlist/negação HTTP, confirmação/recuperação, chave MFA após redeploy, backup/restauração e recuperação de hibernação.
- [ ] Entregar URLs/IDs/versão/planos e nomes dos segredos com local seguro de guarda, nunca valores; não executar harness destrutivo local contra serviços hospedados.

## Rastreabilidade e prova

Critérios compartilhados: **UXH-CA23, UXH-CA24, UXH-CA25, UXH-CA26, UXH-CA27, UXH-CA28, UXH-CA29**, na [especificação](../ui-ux-pilot-specification.md). Este ticket cobre sua parcela, não declara todo critério compartilhado encerrado isoladamente.

Aplicar verificações pertinentes da especificação; registrar versão, comandos, ambiente e limitações. API/PostGIS real quando houver seleção/persistência; navegador integrado quando houver jornada. Resultados de testes pulados ou de outra árvore não comprovam entrega. Preservar critérios antigos não superados explicitamente e não reduzir aceite para obter verde.

Ao concluir futuramente, preencher evidência real e pendências remanescentes, atualizar plano/checklist e submeter ao responsável. Não marcar este arquivo como entregue nesta consolidação.

[Plano e dependências](../ui-ux-pilot-plan.md). ID local do incremento UXH, sem equivalência com números antigos 01–36 ou issues do GitHub.
