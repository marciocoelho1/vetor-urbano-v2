# Tickets 23 e 24 — proposta de calibração e o que falta decidir (22/10/2026)

Os dois tickets continuam **não iniciados**. Este registro existe para que a próxima rodada comece
decidindo, não descobrindo: os critérios de aceite exigem uma «regra aprovada» (23) e uma «rubrica,
amostra mínima e janela acumulada» (24), e os próprios arquivos dos tickets proíbem adotar valores por
suposição. A implementação sem essa decisão reduziria critério — o que esta rodada não fez.

## O que já existe e pode ser reutilizado

- **Versão de efeito e histórico de verificação** (`occurrence_verifications`, V14): permite provar
  «erro de extração não rebaixa a fonte» e «ausência de essencial bloqueia publicação».
- **Conflito essencial e bloqueio de publicação** (`clipping_reviews.essential_conflict`, ticket 17):
  o critério 2 do 23 depende desse bloqueio, já implementado.
- **Publicação versionada e retirada** (V11/V12): a nota pública pode acompanhar a versão do registro.
- **Fontes versionadas com procedência** (V5/V15): a nota da fonte tem onde ser guardada com autoria.
- **Painel de operação** (ticket 22): é o lugar natural para o operador ver pendências de avaliação.

## Decisões necessárias — ticket 23 (avaliação de ocorrência)

1. **Referência da nota.** Critério: «maior nota das fontes de suporte». Falta decidir o que acontece
   quando a fonte de maior nota é uma reprodução literal de outra (não deve premiar origem reproduzida).
   Opções: (a) excluir do conjunto de referência toda fonte que seja reprodução detectada; (b) contar
   a reprodução apenas uma vez, pela fonte original; (c) tratar reprodução como corroboração parcial.
2. **Fatores e pesos.** O critério fala em qualidade, corroboração e divergências «sem premiar
   quantidade bruta». Uma proposta defensável, para discussão:
   - `qualidade` = nota da fonte de referência (1–5), sem média entre fontes;
   - `corroboracao` = fontes independentes distintas (não contagem de clippings), saturando em 3;
   - `divergencia` = penalidade por conflito essencial, aplicada como bloqueio (não como desconto);
   - `completude` = presença dos campos essenciais; ausência bloqueia, não subtrai.
3. **Escala final.** Como converter os fatores em 1–5 com arredondamento explícito e reprodutível.
4. **Não informado × Não se aplica.** O critério exige efeitos próprios: falta decidir quais campos
   aceitam «não se aplica» e qual o efeito numérico de cada um (o desconhecido nunca é zero).

## Decisões necessárias — ticket 24 (recomendação mensal de nota da fonte)

1. **Rubrica do resultado por afirmação da fonte:** confirmado, demonstrado incorreto, inconclusivo,
   corrigido e erro de extração/cadastro — com o peso de cada um.
2. **Amostra mínima** para permitir recomendação (por fonte e por janela acumulada).
3. **Janela acumulada** (mensal corrida ou últimos N dias) e o que conta como «amostra insuficiente».
4. **Direção da recomendação:** subir, manter, descer — e a regra que impede rebaixamento automático
   por baixo volume ou inconclusão.

## Desenho técnico já delineado (para acelerar a implementação)

- `reliability_rules` (versão, parâmetros JSONB, autor, data, justificativa) — append-only, como
  `territorial_versions`.
- `occurrence_reliability_evaluations` (ocorrência, versão do efeito, versão da regra, fatores
  internos, nota 1–5, autoria, instante) — reproduzível por reexecução da mesma versão.
- Projeção pública estrita: `nota` + `link`, sem fórmula, rubrica ou nota interna da fonte.
- `source_rating_recommendations` (fonte, janela, amostra, justificativa, decisão humana, versão).
- Endpoint administrativo de avaliação/reprodução e de decisão mensal, ambos ADMIN+MFA e auditados.
- Testes: tabela de casos qualitativos antes de números; RED/GREEN por critério; HTTP/PostGIS real;
  Playwright em Chromium/Firefox com teclado/foco e 390 px.

## Próxima ação recomendada

Uma sessão curta de decisão com o responsável sobre os quatro itens de cada ticket (ou uma proposta
fechada apresentada como um todo para aceite/ajuste). Com os valores aprovados, 23 é implementável em
uma rodada e 24 na seguinte, sem alterar os critérios de aceite.
