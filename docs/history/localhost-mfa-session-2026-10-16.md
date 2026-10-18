# Retorno ao login ao configurar MFA em localhost - 16/10/2026

## Sintoma e reprodução

O responsável iniciou `npm start` em apps/web e abriu localhost:4201. Após senha administrativa aceita, Configurar autenticador retornava ao login. A entrega anterior conferiu acesso apenas em 127.0.0.1, deixando esta entrada alternativa sem cobertura.

Loop inicial Playwright em `/tmp/vu-repro-enrollment.cjs`: mesmo clique em 127.0.0.1 passou em Chromium/Firefox. Variante localhost falhou sem encontrar a chave do autenticador. O teste permanente [local-origin-session.spec.ts](../../apps/web/e2e/local-origin-session.spec.ts) foi escrito antes da correção. Com `VETOR_LOCAL_ACCESS_E2E=1` e senha sintética no ambiente, `npx playwright test e2e/local-origin-session.spec.ts --project=chromium --workers=1 --grep autenticador` falhou na ausência da chave após o clique. O estado final era a tela de login. Trace, vídeo e screenshots desativados para não capturar a chave.

Hipóteses priorizadas e comunicadas: diferença de host e cookie; expiração da sessão parcial; falha do enrollment no servidor. Probe de uma tentativa por host confirmou: localhost login HTTP 200, enrollment HTTP 401 / SESSION_REQUIRED; 127.0.0.1 login 200, enrollment 200 / MFA_ENROLLMENT. Nenhum cabeçalho, cookie, código TOTP ou chave foi impresso. O relógio/expiração e o backend não precisaram ser alterados.

Repetições iniciais atingiram o limite de login da conta sintética e produziram 429, uma interferência distinta do bug. Foi limpo somente o bucket de tentativas de admin@vetorurbano.test no banco sintético, preservando contas, sessões, MFA, eventos e demais contadores; o teste foi repetido para registrar a falha exata de sessão ausente. Política e limites do servidor permanecem iguais.

## Causa e correção

A aplicação usa API absoluta em 127.0.0.1:8080, cookie HttpOnly/SameSite=Strict. O frontend em localhost usa outro site: o login pode responder com JSON válido sem que a sessão seja transportada na próxima requisição. CORS permitido não substitui as regras de cookie do navegador.

[src/main.ts](../../apps/web/src/main.ts) normaliza somente HTTP localhost:4201 para 127.0.0.1:4201, por `location.replace`, antes de iniciar Angular ou fazer requisições de sessão. Caminho, query e fragmento são mantidos, inclusive no cadastro/confirmacão. URLs de outros hosts/portas/protocolos mantêm o comportamento anterior. Sem alteração de banco/migração, API, senha, política de sessão, CSRF ou requisito MFA. Segredo pendente do autenticador continua restrito à sessão válida e não foi ativado pelos testes; responsável pode cadastrá-lo.

## Verificações

- Reprodução mínima antes da correção: falhou conforme o sintoma; comparação HTTP confirmou 401 de sessão ausente somente com localhost.
- Primeira matriz após correção: 4/4 Chromium/Firefox passaram (configuração MFA e Usuário com recarga/logout). MFA permanece obrigatório e acesso administrativo parcial retorna 403.
- A verificação web inicial detectou formatação no novo arquivo de testes; corrigida com o formatador do projeto, sem mudanças em código preexistente.

- Matriz final: `VETOR_LOCAL_ACCESS_E2E=1` e senha sintética no ambiente, `npx playwright test e2e/local-origin-session.spec.ts --project=chromium --project=firefox --workers=1`: **6/6 passaram**. Inclui cadastro/fragmento, matrícula MFA com sessão preservada e USER com recarga/logout; teclado e 390 px no cenário administrativo. Não há captura do segredo.
- `bash scripts/verify.sh web`: lint, **96 unitários em 11 arquivos** e build passaram. Bundle inicial 653,82 kB; aviso de 153,82 kB acima do orçamento de 500 kB permanece.
- `bash scripts/verify.sh planning`: passou com 288 links locais; `git diff --check`: passou.
- Loops/probes temporários removidos após transformar a reprodução no teste permanente. Nenhum log de depuração adicionado ao produto.

 Backend não foi alterado e sua suíte completa não foi reexecutada. O teste MFA confere enrollment e manutenção de sessão, sem ativar o autenticador da conta do responsável. Jornada TOTP completa mantém evidência própria do Ticket 14.

## Continuidade

Atualizar a aba aberta; localhost:4201 passa ao endereço canônico. Entrar novamente como Administrador e clicar em Configurar autenticador. O responsável deve adicionar a chave ao seu autenticador e confirmar o código. Publicação, coleta real e pendências dos demais tickets não foram alteradas. Trabalho preexistente preservado; sem commit/push.
