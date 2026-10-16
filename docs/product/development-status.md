# Checklist de desenvolvimento

Atualização: 16/10/2026, com base nos commits e evidências até `ba83696`. Spec v1.1 preservada. Este inventário documental não reexecuta testes nem constitui aceite operacional.

## Estado reconciliado

- [x] Consulta demonstrativa: tickets 01–06, 08–11 verificados no recorte registrado.
- [x] 12: navegador → Java → PostgreSQL/PostGIS, migrações e consulta somente de publicadas.
- [x] 13: cadastro/confirmação/reenvio sintéticos, senha derivada, tokens de uso único e caixa efêmera.
- [x] 14: login/logout, sessão persistida, autorização de servidor, MFA e bootstrap administrativo local.
- [x] 16: fontes administrativas, versões, autoria, auditoria e projeção pública mínima; sem conectores.
- [ ] 07: resolver seleção física no MapLibre/Firefox e fechar critérios com sessão sintética.
- [ ] 36: documentos locais revisados; canal efetivo e acompanhamento de correções dependem de 27.
- [ ] 15: recuperação, alteração e exclusão da conta.
- [ ] 17–19: revisão/publicação, correção/retirada e consulta restrita de logs.
- [ ] 20–24: coleta recente/retroativa/monitoramento e avaliações/reavaliações operacionais.
- [ ] 25–27: proximidade integrada, versões territoriais e solicitações de correção.
- [ ] 28–35: Histórico, Relatórios, síntese, comparações, calor, XLSX/PDF e avisos persistidos.

A demonstração também contém telas locais/importação/exportação anteriores; sua presença não satisfaz os tickets integrados pendentes. Raio de Informes manuais tem máximo de 5 km; o limite demonstrativo antigo de 25 km não é regra de Informes integrados.

## Qualidade e limites

- Última medição registrada (16): bundle 653,67 kB, aviso +153,67 kB sobre 500 kB.
- Chromium/Firefox e testes HTTP/PostGIS possuem evidências por incremento. Não há nova aprovação da matriz geral neste documento.
- Tema/cadastro em 320 px, leitor de tela, zoom, dispositivo físico, desempenho representativo, cobertura/cartografia e preparação operacional continuam pendentes quando não comprovados.
- Contas, fontes e ocorrências usadas são sintéticas. Sem envio real de e-mail, coleta automática ou publicação.
- Política operacional de contas/sessões/MFA, retenção, recuperação/chaves, avaliações e fontes autorizadas não é homologada por configurações locais.
- RF06 e perfis legados continuam em reconciliação. Relatos populacionais, resumo por IA, planos, alertas/votos e escala não entram por inferência.

Próximo incremento recomendado: 17, após a entrega local de 16. Consulte [tickets-status.md](tickets-status.md), [estado estruturado](implementation-state.json) e [PLAN.md](../../PLAN.md) para dependências e rastreabilidade.
