# Encerramento dos lotes restantes — entrevista de decisão

29/10/2026 · branch `integration/functional-spec-v1` · `HEAD b9814d4` · árvore limpa antes desta rodada.

Grill de encerramento do incremento UXH. Objetivo do responsável: «faça um grill sobre os itens
restantes para conseguirmos finalizar». Este documento registra as decisões já confirmadas e a fronteira
que segue aberta. Ele não autoriza implementação, provisionamento, commit, merge, push ou publicação.

## 1. Estado que serviu de base

Fechados com commit: UXH-07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17 e 20.
Abertos: UXH-04, 05, 06, 18, 19, 21, 22, 23.
Dívidas nomeadas: **UX-7b** (CLS `0,1394` a 390, origem medida no rodapé em `t=482 ms`), **selo da
campanha E2E** (o `11/8` de 27/10 foi retirado como diagnóstico de arranque), **registro documental**
(três documentos de estado parados antes dos commits de 28/10).

## 2. Decisões confirmadas — rodada Q1–Q4

- **Q1 — fronteira do encerramento: piloto no ar.** O responsável escolheu ir até UXH-22/23,
  «por mais que exija configuração manual, vamos fazê-lo». Substitui a recomendação de parar no
  candidato verificado. Consequência: 04/05/06/18/19/21 deixam de ser fim de linha e passam a integrar
  o caminho até o ambiente hospedado; 22/23 continuam exigindo as permissões próprias (conta, recurso,
  envio de material), que não foram concedidas por esta resposta.
- **Q2 — registro das entregas: fazer agora.** Autorizada a gravação das entregas de 28/10 que não
  tinham linha em `docs/`. Executada em [registro das entregas](uxh-13-20-registro-2026-10-29.md), com
  commit, entrega, prova e janela por ticket.
- **Q3 — prova do aceite: réguas por ticket.** Aceite de UXH-08 a UXH-20 usa as réguas por ticket com
  hash e janela; a campanha E2E com perfil válido fica como condição do parecer do **UXH-21**. Família
  vermelha não vira aceite em nenhum dos dois casos.
- **Q4 — UX-7b entra agora.** Corrigir o salto de layout no celular como lote pequeno e isolado, com o
  CSS novo pagando por remoção de CSS morto no mesmo commit, porque o `app.scss` está no teto de
  `anyComponentStyle`.

## 3. Decisões confirmadas — rodada Q5–Q10

- **Q5 — cartografia: fontes encontradas, cobertura medida.** O responsável trouxe as fontes e pediu que eu
  extraísse o que serve: IPP/PCRJ para bairros, RAs e APs da capital; IBGE para municípios e bairros dos
  demais. Medido nesta data, não por relato: **167** bairros na camada 4 do IPP e, no
  `RJ_bairros_CD2022.gpkg`, **1.727 feições**, **31 dos 92 municípios** do estado e **13 dos 22 da RMRJ**.
  UXH-04 passa a depender só de ingestão; UXH-05 entrega 13 municípios e nomeia 9 sem geometria. Registro
  em [fontes territoriais](../product/territorial-sources-rmrj.md).
- **Q6 — Áreas de Risco reais com limitação declarada.** Não existe fonte oficial: limites e comando mudam.
  Decidido usar as áreas atuais, declarando origem aberta, data-base incerta e impossibilidade de garantir
  risco atual. UXH-18 deixa de esperar licença e passa a exigir validação topológica local mais o texto de
  limitação no pacote.
- **Q7 — sem provedor de e-mail por enquanto:** manter as contas de teste que já existem.
- **Q8 — backup e segredo estável:** chave de sessão/MFA em variável de ambiente do Render, dump semanal do
  Neon e uma restauração provada antes dos convidados.
- **Q9 — 36/D3:** aviso visível de protótipo com dados fictícios; documentos institucionais seguem rascunho
  interno, sem publicação jurídica.
- **Q10 — contas dos provedores:** o responsável já tem conta nos três. Ele informa nomes e IDs; os valores
  secretos ficam em `~/.config/vetor-urbano/` com permissão `0600`, nunca em chat, repositório ou log.

## 4. Insumos pedidos para o provisionamento (Q10)

- **Neon:** nome do projeto e da base, região, versão do Postgres, papel de conexão, plano e se a extensão
  PostGIS está disponível.
- **Render:** nome e URL do serviço, runtime (Docker), região, plano, **nomes** das variáveis de ambiente,
  caminho de health check e confirmação de que não há disco persistente.
- **Vercel:** escopo/equipe, nome do projeto, domínio, diretório raiz `apps/web`, comando e saída de build, e
  se `rewrites` está habilitado.

## 5. Fronteira aberta

1. **Contas de teste no host público.** Manter `usuario@vetorurbano.test` e `admin@vetorurbano.test` com a
   senha das fixtures, publicada na documentação, só é aceitável se elas forem rotacionadas no banco
   hospedado e o valor viver fora do repositório.
2. **Mesma origem.** O cookie é `SameSite=Strict` e a base da API está fixa em `http://127.0.0.1:8080`
   (`persisted-query.ts:208` e `:239`; `main.ts:12-17`). Hospedar exige proxy `/api` na mesma origem
   (Vercel → Render) e base configurável.
3. **Health check.** A API não expõe `actuator`: sem endpoint de saúde o Render não tem o que sondar.
4. **Zonas populares** (Zona Norte/Sul/Oeste/Centro) não entram no piloto; AP, RA e bairro já cobrem a
   hierarquia aprovada em Q28.

## 6. Limites desta rodada

Nenhum código alterado, nenhum contêiner iniciado, nenhum serviço externo provisionado, nenhum commit,
merge, push ou deploy. A gravação é documental e transcreve números medidos na árvore dos commits de
28/10; ela não reexecuta aquelas réguas.
