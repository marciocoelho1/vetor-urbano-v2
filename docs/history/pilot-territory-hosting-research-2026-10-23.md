# Pesquisa — busca territorial e hospedagem do piloto — 23/10/2026

Estado: levantamento para decisão; sem escolha de provedor, conta criada, implantação, consulta a bancos ou alteração funcional. Complementa a [entrevista](map-and-hosting-interview-2026-10-23.md). Pesquisa delegada em paralelo; conclusões abaixo conferidas pelo agente principal contra arquivos e documentação oficial. Não é teste de funcionamento hospedado.

## Busca por local

### Fatos conferidos

- O [catálogo de municípios](../../apps/api/src/main/resources/collection/metropolitan-municipalities-v1.json) contém nomes e referência legal, mas declara expressamente não ser limite geográfico ou operacional. Não fornece polígonos.
- [Referências demonstrativas](../../apps/web/src/app/data/demo-locations.ts) são autorais e fictícias, sem geocodificador ou polígonos oficiais. `demoRecordBounds` enquadra ocorrências; não representa município/bairro. Não usar esse retângulo, média das ocorrências ou seu centro como prova de ponto interno ao território.
- A [auditoria cartográfica](../maps/territorial-sources.md) descreve os polígonos da camada Dados de Riscos, atributos nome/classificação, IDs sequenciais locais e ausência de validação topológica. Registra autorização declarada para demonstração local, sem licença explícita localizada ou instrumento verificado independentemente. Publicação/uso operacional tem gate próprio de cobertura, precisão, atualização e comunicação.
- Portanto, ponto representativo interno exige geometria territorial apropriada, validade e identidade da seleção. A existência de polígonos de Áreas de Risco não completa o catálogo municipal/de bairros nem licencia automaticamente sua hospedagem.

### Proposta de catálogo aprovada em Q22; publicação refinada em Q23

Construir catálogo territorial versionado com origem, licença/autorização, data, identificador e relações entre localidades. Municípios e bairros somente participam de «Definir centro por local» quando houver geometria verificável; listas parciais devem informar a cobertura. Manter como objetivo os três níveis pedidos — município, bairro e Área de Risco — sem declarar conclusão quando houver apenas um. Testes automatizados podem usar polígonos fictícios identificados; não reutilizar limites fictícios como reais. Geocodificador externo não é requisito automático e depende de termos/custo/qualidade.

Em Q23, o responsável determinou que as Áreas de Risco atuais locais **devem subir para o piloto hospedado**, substituindo a recomendação de camada inteiramente fictícia. Sua autorização de envio fica registrada; ainda é necessário conferir/documentar origem, licença/autorização da fonte, validade, referência temporal e comunicação dos limites antes da publicação efetiva. Q21 mantém ocorrências fictícias e coleta real desligada. O mapeamento metropolitano e bairros/regiões do Rio foi elevado a [pendência extrema](../product/territorial-mapping-priority.md).

## Hospedagem — alternativas documentadas

Planos sem prazo anunciado não são promessa de gratuidade permanente. Limites devem ser reconferidos antes da criação de qualquer serviço. Compatibilidade de runtime/PostGIS é documental; memória, tempos, migrações, sessão e persistência ainda exigem prova.

| Alternativa | Composição | Benefício | Principal condição |
|---|---|---|---|
| A | Angular no Vercel Hobby; Java em contêiner no Render Free; PostgreSQL/PostGIS Neon Free | Frontend separado e banco espacial gerenciado | Vercel pessoal/não comercial; API hiberna; sessão entre origens requer desenho seguro e testes |
| B | Vercel Hobby + Render Free + Supabase Free | PostGIS documentado como alternativa gerenciada | Mesmo limite Vercel/Render, banco menor e pausa após inatividade |
| C | Angular compilado servido pelo Spring no Render Free + Neon Free | Mesma origem, menos peças para cookies | Exige empacotamento/fallback Angular; também atrasa a abertura da interface durante despertar |

Não escolher automaticamente. A preferência inicial do responsável é Vercel para frontend e custo zero sem cobrança automática.

### Fontes oficiais e limites conferidos

- [Vercel Hobby](https://vercel.com/docs/plans/hobby): uso pessoal não comercial; excedentes normalmente indisponibilizam recurso até reset. Trial Pro não é gratuidade contínua. Não presumir que acesso de convidados pela aplicação depende de contas Vercel ou que proteger somente frontend protege a API.
- [Render Free](https://render.com/docs/free): serviço dorme após 15 minutos sem entrada; despertar estimado pelo provedor em cerca de um minuto. 750 horas por workspace/mês. Arquivos locais são perdidos em reinício, redeploy e suspensão. Sem disco persistente gratuito. Com método de pagamento, certos excedentes de banda/build podem ser cobrados; sem método, há suspensão/bloqueio. Não prometer ausência de exigência de cartão na abertura da conta.
- A mesma página Render informa banco gratuito com expiração em 30 dias e exclusão após a carência: não é banco duradouro adequado à proposta. Também bloqueia SMTP em 25/465/587 no serviço Free; envio de e-mail real precisa de alternativa compatível, possivelmente API HTTPS.
- [Neon pricing](https://neon.com/pricing): Free sem cartão/prazo anunciado, 1 GB por projeto, 100 CU-h mensais por projeto, suspensão do compute após cinco minutos de inatividade; restauração limitada a até seis horas ou 1 GB de mudanças e um snapshot. Isso não substitui plano próprio de backup/restauração conforme retenção aprovada do projeto.
- [PostGIS no Neon](https://neon.com/docs/extensions/postgis-related-extensions): suporte à extensão e habilitação documentados. Versões e permissões do destino precisam de teste com as migrações existentes.
- [Supabase pricing](https://supabase.com/pricing): 500 MB de banco no Free, 5 GB de egress e pausa após uma semana de inatividade; dois projetos ativos. Backups diários estão descritos no Pro, não presumir esse benefício no Free.
- [PostGIS no Supabase](https://supabase.com/docs/guides/database/extensions/postgis): extensão disponível; recomendação de schema dedicado, nunca `public`, devido à exposição via Data API. Compatibilizar migrações/search_path e impedir exposição de tabelas internas sem alterar migrações aplicadas.
- [Stadia Authentication](https://docs.stadiamaps.com/authentication/): localhost dispensa autenticação com limites; host publicado exige autenticação por domínio ou chave adequada. Logo, mapa-base também é parte da preparação, não somente frontend/API/banco.

## Bloqueios concretos de integração conferidos no código

- [Consulta persistida](../../apps/web/src/app/data/persisted-query.ts): `isLocalPersistedQuery` aceita apenas loopback e `consulta=api`. Build hospedado isolado não liga a API remota.
- [AuthController](../../apps/api/src/main/java/br/com/vetorurbano/api/auth/AuthController.java): cookie HttpOnly, `SameSite=Strict`, path `/api/v1`, `Secure` configurável; respostas de autenticação `no-store`. Frontend e API em sites distintos não funcionam automaticamente apenas com CORS. Preferir solução de mesma origem (por exemplo proxy), preservando CSRF/autorização/cache privado e provando a cadeia completa antes do aceite.
- [AuthConfiguration](../../apps/api/src/main/java/br/com/vetorurbano/api/auth/AuthConfiguration.java): perfil local, ativação explícita e `secure-cookie` falso por padrão. Não tratar ligar perfil local na internet como perfil hospedado seguro validado.
- [MfaVault](../../apps/api/src/main/java/br/com/vetorurbano/api/auth/MfaVault.java): chave gerada em arquivo privado de 32 bytes. Em disco efêmero, perder/recriar chave impede decifrar fatores existentes. Exige provisionamento estável e privado, separado do banco e do artefato, com política de recuperação.

## Situação após Q22–Q26

1. Catálogo territorial aprovado; cartografia municipal/de bairros/regiões é prioridade extrema e Áreas de Risco atuais devem integrar o piloto, sob as verificações documentadas.
2. Responsável confirmou finalidade exclusivamente de teste, não comercial.
3. Hibernação/espera aceita para o piloto; não há autorização de cobrança automática. Exigência de cartão continua ponto de interrupção para alinhamento antes de prosseguir.
4. Lista de e-mails permitidos no backend e contas individuais aprovadas. E-mail e backup/restauração precisam de preparação compatível com a topologia.
5. Recomendação atual: alternativa A como ambiente de homologação para feedback, sujeita à escolha do responsável e prova de integração; não confundir com deploy de produção.

Nada contratado, conectado, publicado ou testado em nuvem. As bases reais existentes foram preservadas sem consulta.
