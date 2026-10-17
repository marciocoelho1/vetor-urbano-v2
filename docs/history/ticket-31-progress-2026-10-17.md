# Ticket local 31 — comparação de recortes — 17/10/2026

## Baseline e escopo

Baseline resolvido: `0fbcb14e734014a5ae85bf95060a212c7d24e028`, checkpoint do 30 concluído antes desta implementação. Delta preexistente preservado conforme inventário do [ticket 30](ticket-30-progress-2026-10-17.md). Fontes: ticket local 31, D08/CA15/RF02, contrato de consulta e E04/E08. A seleção atual supera a nota antiga de integração não autorizada.

## Decisão aprovada nesta sessão

Comparação explícita de dois snapshots gerados, A como base e B; mesmas distribuições da síntese. Diferença absoluta B−A; percentual somente com base positiva e filtros não temporais/territoriais equivalentes. Exemplos: A=4 registros/2 dias, B=6/3 dias → +2/+50%, ambos 2 registros/dia somente quando datas exatas e inclusões certas. Base zero não gera infinito. Cobertura não aferida enquanto não houver evidência própria; zero nunca comprova ausência de cobertura. Sem taxa de risco, ranking de segurança ou nova base externa.

A declaração anterior de “recorte sem cobertura” é reconciliada com a decisão aprovada: a base local não contém catálogo operacional de cobertura e a tela deve identificar desconhecimento, sem deduzi-lo da contagem zero. Cobertura aferida por origem/território é proposta de complemento operacional, fora desta fatia.

## TDD e verificação

Em andamento. Fronteiras aprovadas: navegador Chromium/Firefox e HTTP → Java → PostgreSQL/PostGIS real. Os snapshots vêm da geração autenticada já existente; comparar não dispara nova consulta nem altera o momento gerado. Capturas A/B vivem somente na memória da aba, sem retenção ilimitada.

Primeiro vermelho: teste `report-comparison.spec.ts` falhou pela ausência da ação “Usar relatório como base A”. Primeira implementação passou 2/2 Chromium/Firefox: snapshots 1/7 dias com intervalo incerto, diferença zero, percentual 0%, média não calculável, tabelas comparativas, teclado e 390 px.

A segunda fatia usa dez ocorrências sintéticas persistidas por fixture no banco exclusivo: quatro em 01/10 e seis em 04/10. Pela interface, gera janelas semiabertas de dois/três dias e exige diferença +2/+50% e média 2 em cada lado. O fixture é removido em `finally`; não modifica migrações ou registros preexistentes.


O vermelho da média confirmou ausência do texto esperado 2 vezes; implementação mínima calcula contagem/duração em dias de 24h somente com limites completos, datas exatas, inclusão CERTAIN e sem faixa diária de horários. Primeiro ensaio corrigiu uma corrida no roteiro de transferência (aguardar Substituir), sem mudança de produto. A rodada da média passou 4/4 Chromium/Firefox antes da regressão final.

Rodada integrada antes do reforço de precisão: 22/22 Chromium/Firefox (`report-comparison.spec.ts`, `report-summary.spec.ts`, `persisted-query.spec.ts`, workers=1, banco exclusivo `vu-ticket30-db`). Confere snapshots A/B, dois períodos e territórios, 4/2dias versus6/3dias, base zero, vazio, erro503/recuperação, carregamento, teclado/foco e390px. `verify.sh web` passou lint,111 unitários e build704,26kB (aviso+204,26kB). Captura móvel inspecionada; rótulos podem ganhar mais espaço sem alterar os números.

Verificação final do reforço de precisão A/B: teste vermelho pela ausência da separação em cada captura; implementação mínima reutiliza as classes da síntese. Playwright8/8 (`report-comparison.spec.ts` + `report-summary.spec.ts`) passou em Chromium/Firefox, depois dos22/22 da regressão completa. Tabelas móveis passaram a reservar50% aos rótulos. `verify.sh web` final: lint,111 unitários, build704,57kB (aviso+204,57kB). `verify.sh api`:14 unitários+29 integrações HTTP/PostGIS, BUILD SUCCESS; sem alterações de backend ou migração. `planning`/revisão final pendentes de consolidação.
