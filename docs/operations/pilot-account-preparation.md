# Preparação das contas do piloto — responsabilidades e segredos

Estado: orientação documental; não cria contas, projetos, credenciais, integrações ou deploys. Vercel Hobby + Render Free + Neon Free aprovados como primeira candidata técnica (Q27), não como produção validada. Ver [entrevista](../history/map-and-hosting-interview-2026-10-23.md).

## Divisão recomendada

O responsável mantém propriedade das contas, recuperação e MFA. Criação/login, confirmação de e-mail, CAPTCHA, consentimento OAuth/GitHub e eventual validação de identidade são realizados ou aprovados por ele. Não compartilhar a senha da conta entre participantes do piloto.

O agente pode preparar código/configuração, builds, arquivos de implantação, instruções e testes; depois de autorização específica e autenticação segura pode operar as sessões e preencher configurações não sensíveis. Não prometer automação sem intervenção de verificações pessoais. Durante o walkthrough, orientar uma ação por vez e aguardar o resultado.

Não entregar senha/token/string de conexão no chat nem criar «pacote de credenciais» versionado. Senhas de contas ficam no gerenciador/cofre do responsável; valores de runtime são inseridos diretamente no painel seguro do destino, ou transferidos por mecanismo seguro suportado e autorizado. Em navegação automatizada, login/MFA passam pelo cofre, sem digitação ou leitura de segredo pelo agente. Variáveis arbitrárias de ambiente não são automaticamente cobertas pelo preenchimento de login do cofre; se não houver canal seguro adequado, o responsável as preenche diretamente.

## O que fazer em cada serviço

| Serviço | Intervenção do responsável | Preparação/configuração técnica |
|---|---|---|
| Neon | Criar ou acessar a própria conta; conferir plano Free; proteger recuperação/MFA disponível | Projeto/banco exclusivo de homologação; região compatível; papéis/permissões; PostGIS e migrações; conexão TLS com a API |
| Render | Criar/acessar conta; aprovar integração GitHub com acesso mínimo necessário; confirmar Free e qualquer solicitação de cartão antes de continuar | Serviço Java por Docker, branch de homologação escolhida, variáveis/arquivos secretos, porta/healthcheck, auto-deploy controlado e testes |
| Vercel | Criar/acessar conta pessoal; escolher Hobby; aprovar acesso ao repositório necessário | Projeto Angular com raiz/build/saída verificados; domínio do piloto; encaminhamento da API e SPA; cache/cookies/CSRF e controles de deploy |

A ordem de recursos é banco → API → frontend integrado. Contas podem ser preparadas antes, mas não iniciar deploy com o código atual sem os ajustes de segurança/integração já identificados. Não aceitar upgrade, integração paga, trial como se fosse Free ou cobrança automática. Se houver exigência de cartão, interromper para alinhamento.

## API keys não são todas a mesma coisa

- **Vercel/Render:** cadastro e integração pelo painel não exigem gerar manualmente um token de API para a aplicação. Tokens pessoais só seriam necessários para uma automação por API/CLI que realmente os use; preferir autorização limitada e não criá-los antecipadamente.
- **Neon:** Java usa JDBC/PostgreSQL com host, banco, papel e senha. A API key administrativa do Neon não substitui a senha do banco e não precisa ir ao frontend.
- **Ambiente da API:** conexão/usuário/senha do banco são segredos de backend. O arranque local atual usa `VETOR_DATABASE_URL`, `VETOR_DATABASE_USERNAME` e `VETOR_DATABASE_PASSWORD` em `scripts/run-local-stack.sh`; mapear explicitamente o perfil hospedado antes de fornecer valores/campos definitivos. Não copiar as credenciais dos bancos locais.
- **MFA:** a chave de criptografia da aplicação precisa ser privada e estável entre deploys; provisionar no mecanismo de secret file do destino e verificar compatibilidade de formato/permissões. Não deixá-la ser regenerada em disco efêmero.
- **Frontend:** URLs/configuração pública podem aparecer no bundle. Nunca incluir senha de banco, chave MFA, token administrativo ou credenciais de coleta em variáveis de frontend, independentemente do nome.
- **Mapa-base e e-mail:** continuam preparações adicionais. Stadia exige autenticação adequada fora de loopback; confirmação/recuperação de conta exige envio real compatível com o host. Não supor que as três contas resolvem esses dois serviços.

## Entrega ao final de uma implantação autorizada

Relatório com URLs dos painéis e do piloto, nomes/IDs dos projetos, branch/versão implantada, plano selecionado, nomes das configurações (sem valores secretos), onde cada segredo está guardado e testes executados. Senhas permanecem no cofre, não no relatório. Confirmar efeito lendo o recurso criado e exercitando a cadeia navegador → API → banco, inclusive reinício/MFA e restrição aos convidados.

## Referências oficiais consultadas

- [Vercel: início pelo painel ou CLI](https://vercel.com/docs/getting-started-with-vercel)
- [Render: integração Git](https://render.com/docs/git-provider)
- [Render: variáveis e secret files](https://render.com/docs/configure-environment-variables)
- [Neon: conexão PostgreSQL](https://neon.com/docs/get-started/connect-neon)
- [Neon: papéis](https://neon.com/docs/manage/roles)

Autorização de topologia não equivale a autorização de push, merge, contratação ou implantação. Grill de produto encerrado; [especificação](../product/ui-ux-pilot-specification.md) e [plano/tickets](../product/ui-ux-pilot-plan.md) consolidados localmente. Preparação técnica, definições operacionais e autorização de execução externa continuam pendentes.
