# Sessão e MFA local — contrato do ticket 14

Contrato de desenvolvimento/teste sintético, 2026-10-15. Complementa [contas](accounts-local-v1.md); não define prontidão operacional nem resolve RF06/Operador/Gestor.

## Matriz

| Capacidade | Visitante | Usuário confirmado | Administrador confirmado |
| --- | --- | --- | --- |
| Institucional, fontes públicas, explicações, cadastro/confirmação | Sim | Sim | Sim |
| Consulta simples e Análise e Inteligência, API de ocorrências | Não | Sim | Somente após MFA |
| Configurar/ativar seu autenticador administrativo | Não | Não | Sessão parcial válida |
| Módulos administrativos demonstrativos existentes | Não | Não | Após MFA |

Não serão criados painéis administrativos futuros. Cada ação futura deverá verificar sua própria permissão no servidor. A UI demonstrativa não transforma operações locais em operações administrativas persistidas.

## Sessão

Cookie opaco aleatório de 256 bits, HttpOnly, SameSite=Strict, Path=/api/v1; apenas SHA-256 no banco. HTTP loopback local usa Secure=false; opção Secure=true obrigatória em futura implantação HTTPS, ainda não autorizada. Origem canônica do navegador http://127.0.0.1:4201. Não usar localStorage para credenciais. Login substitui a sessão apresentada; MFA bem-sucedido também rotaciona o identificador. Reinício preserva sessões válidas no PostgreSQL; logout revoga imediatamente no servidor. Conta pendente não inicia sessão. Indisponibilidade retorna 503, sem conceder acesso.

Inatividade: 1 hora, atualizada por requisições autenticadas válidas. Limite absoluto local: 12 horas; autenticação parcial: 5 minutos absolutos. Prazos inclusivos: agora >= prazo invalida. Todos configuráveis; relógio injetável em testes. Versão de segurança da conta permite revogar todas as sessões atomicamente; o ticket 15 deverá chamar `revokeAll` na mesma transação da troca de senha.

POST de sessão autenticada exige X-CSRF-Token associado à sessão e valida Origin quando presente. Login exige JSON e rejeita Origin fora da lista; sem cookies cross-site por SameSite e sem CORS arbitrário. GET nunca muda credenciais/MFA. Cadastro/confirmação mantém contrato do 13.

## MFA e operação local

TOTP RFC 6238, SHA-1, 6 dígitos, passo 30 segundos, tolerância local de um passo anterior/posterior, contador consumido por conta impedindo replay inclusive em sessões concorrentes. Cadastro só sob sessão parcial administrativa após senha; segredo aleatório 160 bits entregue exclusivamente nessa resposta no-store e mantido cifrado AES-256-GCM no banco. Ativação exige primeiro código válido e rotaciona sessão. Enrollment repetido retorna o mesmo segredo pendente, sem invalidá-lo; autenticador ativo não pode ser relido/recriado por HTTP. Não há recuperação pública/bypass. Perda exige operador local executar ferramenta offline restrita `reset-mfa`, revogando sessões e removendo fator; próximo login exige novo cadastro/ativação. Não implementa recuperação de conta do 15.

Chave AES em arquivo local fora do repositório com modo 0600, gerada se ausente, preservada entre reinícios. Nunca mostrar chave em saída/logs. Backup/rotação e recuperação operacional permanecem pendentes.

Bootstrap offline `LocalAccountAdmin` usa perfil local, servidor web desativado, ativação explícita e entrada JSON por stdin, aceita apenas identidade sintética .test e senha conforme cadastro; cria ADMIN confirmado sem endpoint público. Reset exige ADMIN existente e acesso ao host/banco/chave. Eventos guardam UUID, instante, módulo, ação e resultado, sem e-mail, senha, token, segredo ou código. RF06 permanece aberto.

Limites locais reversíveis: login 10 tentativas/5 minutos por e-mail normalizado (chave hash), 60/min global; MFA 5 tentativas/5 minutos por conta, persistentes. Esgotamento retorna 429; nova janela permite retentar. Nenhum bloqueio eterno. Parâmetros sob `vetor.auth.*`, não política operacional definitiva.

## Fundamentação primária

Consultados em 2026-10-15: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), [OWASP sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html). Fundamentam entropia/rotação, expiração no servidor, CSRF associado à sessão, proteção do segredo e consumo único; os valores locais explícitos não representam aprovação de política de produção.

## Verificação autorizada

Fronteiras: HTTP real → Java → PostGIS (autorização, falhas, relógio controlado, persistência e inspeção de proteção no banco) e Chromium/Firefox (jornada, foco/teclado, erros/carregamento, móvel). Testes da consulta preservam garantias de tempo/espaço/publicação usando sessão de Usuário.

## Endpoints e configuração

- `POST /api/v1/auth/login` `{email,password}`: 200 USER completo ou ADMIN parcial; 401 genérico para senha inválida/conta pendente; 400 campos extras; 429 limite; 503 indisponível.
- `GET /api/v1/auth/session`: estado e CSRF associado; 401 ausente/inválida/expirada. Não devolve cookie em JSON. Uma consulta de estado válida conta como atividade; não existe polling automático que mantenha sessão viva.
- `POST /auth/logout` `{}` com CSRF: 200, revoga cookie apresentado e o remove; repetição 401. `revokeAll(UUID)` é integração transacional interna para o 15 e operação offline, sem rota pública.
- `POST /auth/mfa/enrollment` `{}` e `/auth/mfa/verification` `{code}` exigem sessão ADMIN e CSRF. Enroll ativo: 409; código inválido/expirado/reutilizado: 401 genérico; limite: 429. Sucesso de verificação revoga a sessão parcial e emite outra completa. Novo login administrativo sempre exige novo código, mesmo com fator já ativo.
- `GET /auth/access/{query,active,history,insights,sources,report}` verifica a navegação existente no servidor: consulta/Informes/Histórico/Relatórios para USER ou ADMIN completo; fontes internas/registro demonstrativo para ADMIN completo. Fontes institucionais públicas são distintas da gestão. Isso não constitui autorização de futuras ações persistidas: cada endpoint futuro deverá aplicá-la.
- `GET /api/v1/occurrences` exige sessão completa independentemente da interface; o filtro de autorização retorna 401/403/503 antes da consulta. Se a autorização não puder acessar o banco, o 503 usa `ACCESS_UNAVAILABLE`; falha posterior da consulta mantém `QUERY_UNAVAILABLE`. Nenhum dos dois retorna contagens.

O navegador local usa `http://127.0.0.1:4201/?consulta=api`; cadastro continua em `/?conta=local`. Cookies não são portáveis entre `localhost` e `127.0.0.1`: usar a origem canônica. Preferências de tema/modo/filtros preexistentes podem continuar no storage; credenciais, sessão e MFA não são gravados ali. Respostas de sessão/MFA e consulta usam no-store; erros também recebem CORS restrito.

Propriedades `vetor.auth.inactivity=1h`, `lifetime=12h`, `partial-lifetime=5m`, `login-attempts=10`, `mfa-attempts=5`, `global-attempts=60`, `secure-cookie=false`. Janelas de limite são fixas em 5 min por identidade/MFA e 1 min global; os máximos são configuráveis. Prazos aceitam 1 s–1 dia e limites 1–1000. Chave: `vetor.auth.key-file`, padrão `${user.home}/.local/share/vetor-urbano/mfa.key`; testes usam diretório temporário privado, sem exportar a chave. Parâmetros locais não homologam limites operacionais.

Ferramenta offline (após build, JDK 21 e contêiner sintético disponíveis):

```bash
JAVA_HOME=/caminho/jdk-21 python3 scripts/local-account-admin.py --synthetic-local-only < /caminho/privado/entrada.json
```

Entrada privada em stdin: operação `action=create`, `email` .test, `displayName`, `password`; ou `action=reset-mfa`, `email` ADMIN existente. O operador prepara a entrada fora do repositório sem registrar senha em histórico de shell. A ferramenta não imprime credenciais nem gera senha em argumento; requer permissão local para acessar o contêiner, banco e chave. Não opera dados reais. `VETOR_LOCAL_DB_CONTAINER` seleciona o contêiner local; porta de desenvolvimento existente 55432. Não executar outro processo web para bootstrap. Confirmação de identidade/recuperação operacional, backup/rotação de chaves, HTTPS, antiabuso distribuído e retenção/eliminação definitiva dependem de trabalho posterior.

## Auditoria e limites do D13

Eventos de acesso têm UUID quando autenticado/identificado no servidor, instante UTC, módulo, ação e resultado. Tentativas não autenticadas não são atribuídas a um usuário declarado pelo cliente. Em conformidade com E04, consultas e gerações de relatório são eventos de uso. Aplicando E08, eventos novos conservam período, classificação, fontes, município/bairro, situação, notas e contagens; busca livre e recorte espacial exato são reduzidos a indicadores, sem texto, endereço, coordenadas, raio ou bounds. Essa mudança não reescreve eventos anteriores. Leitura desses eventos pela API ainda não existe: ticket 19 deverá exigir ADMIN completo e implementar sua própria autorização/retenção; expurgo segue E16 e ainda não é implementado aqui. Não há coleta real nem rastreamento contínuo.
