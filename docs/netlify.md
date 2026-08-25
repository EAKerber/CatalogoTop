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

## Modelo recomendado

- Repositório: `EAKerber/CatalogoTop`.
- Branch de produção pretendida: `main`.
- Deploys de PR/branch devem ser usados como preview antes do merge.
- Build command: `npm test`.
- Publish directory: `.`.
- Variáveis de ambiente: nenhuma obrigatória no recorte atual.
- Backend/serverless: nenhum.

O aplicativo é browser-only. O estado de produtos e catálogos permanece no navegador do usuário (`localStorage`) e não é enviado para a Netlify.

## Primeira vinculação pela interface da Netlify

1. Em **Add new project**, escolha **Import an existing project**.
2. Selecione GitHub e autorize o repositório `EAKerber/CatalogoTop`.
3. Confirme `main` como branch de produção.
4. Deixe a configuração do repositório prevalecer; `netlify.toml` já define teste e diretório publicado.
5. Publique e registre nesta documentação o nome do projeto, URL `*.netlify.app`, team e, quando existir, domínio customizado.

Não preencher esses identificadores por suposição. Eles devem vir de readback da Netlify.

## Continuous deployment

Depois que o projeto estiver ligado ao GitHub, pushes para a branch de produção geram production deploys. PRs podem produzir Deploy Previews, que são o ambiente preferido para validar visualmente alterações antes de promover `main`.

Para este projeto, o gate mínimo antes de considerar um deploy apto é:

1. `npm test` passa;
2. a página abre sem erro fatal de JavaScript;
3. cadastro/importação e seleção funcionam;
4. preview A4 renderiza header, cards e footer;
5. página e data são calculadas automaticamente;
6. impressão/PDF A4 é inspecionada ao menos em uma página cheia e uma página parcial;
7. importação CSV funciona sem depender da biblioteca Excel externa.

## Dependência externa atual

A leitura de XLS/XLSX/XLSM usa SheetJS via jsDelivr no `index.html`. Se esse recurso externo falhar, o restante do aplicativo e a importação CSV continuam disponíveis. Não tratar a indisponibilidade do CDN como corrupção do acervo local.

Antes de endurecer Content Security Policy, lembrar que a política precisa permitir explicitamente esse script ou a dependência deve ser vendorizada no repositório.

## Rollback

Preferir rollback para um deploy anteriormente validado ou revert Git no repositório. Não fazer correções diretamente na cópia publicada que não existam no GitHub, pois isso quebra a rastreabilidade do deploy.

## Campos de ambiente a registrar após a vinculação

```text
Netlify project name: PENDING
Netlify project/site id: PENDING
Default netlify.app URL: PENDING
Production branch: main
Custom domain: PENDING
Git continuous deployment: PENDING READBACK
Deploy Previews: PENDING READBACK
```

`PENDING` significa informação ainda não comprovada, não ausência do recurso.

## Referências operacionais

- Netlify Docs — Deploy from repository: https://docs.netlify.com/start/quickstarts/deploy-from-repository/
- Netlify Docs — Build configuration: https://docs.netlify.com/build/configure-builds/overview/
- Netlify Docs — File-based configuration (`netlify.toml`): https://docs.netlify.com/build/configure-builds/file-based-configuration/
- Netlify Docs — Production deploys: https://docs.netlify.com/deploy/deploy-types/production-deploy/
