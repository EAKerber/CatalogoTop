# Netlify — publicação e storage estreito do CatalogoTop

## Objetivo

Publicar o CatalogoTop preservando frontend simples e estático, com uma exceção deliberada a partir do v0.7: Netlify Functions + Blobs formam a autoridade remota estreita da base compartilhada de produtos e dos assets gerenciados.

O contrato versionado em `netlify.toml` permanece:

```toml
[build]
  command = "npm test"
  publish = "."
```

O deploy continua servindo diretamente `index.html` e os assets estáticos do repositório. Functions vivem em `netlify/functions`, diretório padrão da plataforma, e são empacotadas durante o deploy.

## Estado observado

Readback realizado em 2026-08-25/26 pela integração Netlify:

- projeto: `topcatalogos`;
- site id: `236cbacf-54ac-4167-9e50-83c078357bb8`;
- URL de produção: `https://topcatalogos.netlify.app`;
- branch de produção: `main`;
- Git continuous deployment: ativo;
- Deploy Previews: ativos;
- build command efetivo: `npm test`;
- publish directory efetivo: `.`;
- forms: não habilitados;
- custom domain: ainda não registrado.

O primeiro production deploy útil após a promoção do PR #1 publicou `main@a7a8fcc83c2ea0a0774719db6126164045127f9e` com estado `ready`. Deploy Previews foram comprovados repetidamente nos recortes posteriores.

## Modelo operacional v0.7

- Repositório: `EAKerber/CatalogoTop`.
- Branch de produção: `main`.
- PRs usam Deploy Preview.
- Frontend continua sem framework/build obrigatório.
- Base compartilhada de produtos usa Netlify Functions + Netlify Blobs.
- Assets de upload usam Blob separado, content-addressed por SHA-256.
- Sessões de escrita usam um terceiro Blob store, também isolado entre preview e produção.
- Produção usa store global com consistência forte.
- Deploy Preview/branch usam deploy store isolado; nunca devem gravar na base global.
- seleção atual, template e catálogo em elaboração permanecem locais ao navegador.

## Autorização de escrita v0.7

Não há API key, OAuth ou segredo de sessão para configurar na conta Netlify.

A frase compartilhada forte é verificada por um valor scrypt versionado no código. O verifier é público e não revela a frase, embora permita tentativa offline; por isso a frase deve continuar longa e exclusiva do CatalogoTop.

Após a validação, a Function gera um token aleatório de 256 bits e grava apenas o SHA-256 desse token no store `catalogotop-sessions`, com expiração de uma hora. O token bruto volta ao browser apenas por cookie `HttpOnly`, `Secure`, `SameSite=Strict` e `Path=/api`.

`GET /api/write-session` consulta o cookie/store e permite reconhecer a sessão já aberta sem pedir novamente a frase durante sua validade.

### Correção após o primeiro teste manual

O primeiro Deploy Preview do v0.7 revelou duas falhas que os testes estáticos não capturaram: o cliente consultava `GET /api/write-session`, mas a Function inicialmente não implementava readback coerente da sessão; além disso, a primeira implementação dependia de variáveis de ambiente que não estavam materializadas no projeto apesar do retorno de upsert da integração. O efeito observado foi frase sendo solicitada repetidamente e writes sem efeito remoto.

A correção removeu essa dependência: as sessões passaram a ser tokens aleatórios armazenados no próprio Blob store e a Function de sessão ganhou `GET` funcional. Esse caso agora faz parte do fixture estrutural para evitar regressão equivalente.

## Rotas

- `GET /api/products` — leitura pública da base;
- `PUT /api/products` — escrita revisionada, exige sessão;
- `GET /api/write-session` — estado da sessão atual;
- `POST /api/write-session` — valida frase e emite cookie curto;
- `POST /api/assets` — upload gerenciado, exige sessão;
- `GET /api/assets/sha256/<hash>` — leitura pública de asset imutável.

O contrato detalhado está em `docs/storage-v0.7.md`.

## Continuous deployment

Pushes promovidos para `main` geram production deploys. Pull requests contra `main` geram Deploy Previews e são o ambiente obrigatório para validar Functions/Blobs antes de promoção.

Para o v0.7, o gate inclui:

1. `npm test` passa;
2. Deploy Preview fica `ready`;
3. `GET /api/products` responde sem autenticação;
4. frase incorreta não libera escrita;
5. frase correta cria sessão;
6. `GET /api/write-session` reconhece a sessão criada sem nova frase;
7. PUT cria revisão no store do preview;
8. GET faz readback da revisão criada;
9. upload/readback de asset funciona;
10. PUT com revisão obsoleta retorna conflito;
11. produção permanece intocada durante esses testes.

O gate visual A4 continua válido para mudanças de apresentação, mas storage não deve alterar geometria editorial.

## Dependência externa de planilha

A leitura de XLS/XLSX/XLSM usa SheetJS via jsDelivr no `index.html`. Se esse recurso externo falhar, o restante do aplicativo e a importação CSV continuam disponíveis.

## Rollback

Código: preferir rollback para deploy anteriormente validado ou revert Git.

Dados: snapshots anteriores de produtos são preservados no Blob store em `history/NNNNNNNN`. Não editar blobs de produção manualmente como procedimento normal; restauração deve ser uma operação explícita e auditável em recorte posterior.

## Campos operacionais atuais

```text
Netlify project name: topcatalogos
Netlify project/site id: 236cbacf-54ac-4167-9e50-83c078357bb8
Default netlify.app URL: https://topcatalogos.netlify.app
Production branch: main
Custom domain: PENDING
Git continuous deployment: ACTIVE / VERIFIED
Deploy Previews: ACTIVE / VERIFIED
Product/asset backend: IN DEVELOPMENT / v0.7
```

`PENDING` significa informação ainda não comprovada, não ausência do recurso.
