# Netlify — publicação do CatalogoTop

## Objetivo

Publicar o CatalogoTop como site estático sem transformar o projeto em uma aplicação dependente de build.

O contrato versionado em `netlify.toml` é:

```toml
[build]
  command = "npm test"
  publish = "."
```

Assim, o deploy continua servindo diretamente `index.html` e os assets do repositório, mas a publicação falha antes do deploy se o smoke test estrutural falhar.

## Estado observado

Readback realizado em 2026-08-25/26 pela integração Netlify após a vinculação feita pela interface:

- projeto: `topcatalogos`;
- site id: `236cbacf-54ac-4167-9e50-83c078357bb8`;
- URL de produção: `https://topcatalogos.netlify.app`;
- branch de produção: `main`;
- Git continuous deployment: ativo e comprovado por deploy automático após merge do PR #1;
- Deploy Previews: ativos e comprovados pelos PRs #1 e #2;
- build command efetivo: `npm test`, vindo de `netlify.toml`;
- publish directory efetivo: `.`, vindo de `netlify.toml`;
- backend/serverless: nenhum;
- custom domain: ainda não registrado.

O primeiro production deploy útil após a promoção do PR #1 publicou `main@a7a8fcc83c2ea0a0774719db6126164045127f9e` com estado `ready`. O PR #2 também gerou Deploy Preview automaticamente, confirmando a separação produção/preview.

## Modelo operacional

- Repositório: `EAKerber/CatalogoTop`.
- Branch de produção: `main`.
- Branch deploys comuns permanecem desabilitados; PRs usam Deploy Preview.
- Build command: `npm test`.
- Publish directory: `.`.
- Variáveis de ambiente: nenhuma obrigatória no recorte atual.
- Backend/serverless: nenhum.

O aplicativo é browser-only. O estado de produtos e catálogos permanece no navegador do usuário (`localStorage`) e não é enviado para a Netlify.

## Continuous deployment

Pushes promovidos para `main` geram production deploys. Pull requests contra `main` geram Deploy Previews e são o ambiente preferido para validar alterações antes de nova promoção.

Para este projeto, o gate mínimo antes de considerar um deploy apto é:

1. `npm test` passa;
2. a página abre sem erro fatal de JavaScript;
3. cadastro/importação e seleção funcionam;
4. preview A4 renderiza header, cards e footer;
5. página e data são calculadas automaticamente;
6. impressão/PDF A4 é inspecionada ao menos em uma página cheia e uma página parcial;
7. importação CSV funciona sem depender da biblioteca Excel externa.

Para recortes de card, `examples/card-cases.html` é a referência rápida de inspeção visual no Deploy Preview. Ele não substitui o gate A4/PDF final.

## Dependência externa atual

A leitura de XLS/XLSX/XLSM usa SheetJS via jsDelivr no `index.html`. Se esse recurso externo falhar, o restante do aplicativo e a importação CSV continuam disponíveis. Não tratar a indisponibilidade do CDN como corrupção do acervo local.

Antes de endurecer Content Security Policy, lembrar que a política precisa permitir explicitamente esse script ou a dependência deve ser vendorizada no repositório.

## Rollback

Preferir rollback para um deploy anteriormente validado ou revert Git no repositório. Não fazer correções diretamente na cópia publicada que não existam no GitHub, pois isso quebra a rastreabilidade do deploy.

## Campos operacionais atuais

```text
Netlify project name: topcatalogos
Netlify project/site id: 236cbacf-54ac-4167-9e50-83c078357bb8
Default netlify.app URL: https://topcatalogos.netlify.app
Production branch: main
Custom domain: PENDING
Git continuous deployment: ACTIVE / VERIFIED
Deploy Previews: ACTIVE / VERIFIED
```

`PENDING` significa informação ainda não comprovada, não ausência do recurso.

## Referências operacionais

- Netlify Docs — Deploy from repository: https://docs.netlify.com/start/quickstarts/deploy-from-repository/
- Netlify Docs — Build configuration: https://docs.netlify.com/build/configure-builds/overview/
- Netlify Docs — File-based configuration (`netlify.toml`): https://docs.netlify.com/build/configure-builds/file-based-configuration/
- Netlify Docs — Production deploys: https://docs.netlify.com/deploy/deploy-types/production-deploy/
