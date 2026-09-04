# Netlify — publicação e storage do CatalogoTop

## Objetivo

Publicar o CatalogoTop preservando frontend simples e estático e hospedar as authorities remotas provider-scoped já estabelecidas pelo produto.

O contrato versionado em `netlify.toml` permanece:

```toml
[build]
  command = "npm test"
  publish = "."
```

O deploy serve diretamente `index.html` e os assets estáticos do repositório. Functions vivem em `netlify/functions`, diretório padrão da plataforma, e são empacotadas durante o deploy.

## Regra operacional principal

**Git state e deploy state são authorities diferentes.**

Um merge em `v2` prova somente a promoção Git. Antes de validar visualmente uma mudança hospedada, confirmar no Netlify:

1. contexto do deploy (`Production`, branch deploy ou Deploy Preview);
2. branch servida;
3. SHA servido;
4. status `ready/published` do deploy esperado.

Não usar “o PR foi mergeado” como evidência de que a URL de Production já contém aquele runtime.

## Linha V2 corrente

Para a revisão corrente da linha V2, a **production branch pretendida é `v2`**.

Isso é uma convenção operacional do ambiente de revisão, não uma promoção de `v2` para `main` nem uma decisão de release da V2.

- `main` continua a authority Git da V1 estável;
- `v2` continua a branch principal de evolução/revisão V2;
- apontar o ambiente Netlify de revisão para `v2` não muda essa separação;
- nenhuma operação Netlify está implícita por um merge Git.

### Incidente de drift observado em 2026-09-03

Durante validação manual, a UI publicada não refletia mudanças já promovidas em `v2`. A inspeção manual da interface Netlify mostrou que Production ainda estava apontada para a feature branch antiga `feat/v2-r4a-template-contract-binding`; por isso novos merges em `v2` não apareciam na URL de Production.

Na mesma inspeção, branch deploys foram configurados para aceitar branches do repositório. Isso ajuda a obter URLs de branch, mas **não altera sozinho a production branch**.

A lição operacional é bounded: antes de concluir que uma mudança Git “não funcionou”, comparar branch+SHA do deploy. Não acoplar runtime Git a Netlify nem automatizar promoção de Production sem decisão própria.

## Readback histórico V1 — 2026-08-25/26

O seguinte estado foi lido pela integração Netlify durante a estabilização V1 e deve ser tratado como registro histórico, não como configuração corrente presumida:

- projeto: `topcatalogos`;
- site id: `236cbacf-54ac-4167-9e50-83c078357bb8`;
- URL de produção: `https://topcatalogos.netlify.app`;
- branch de produção naquele momento: `main`;
- Git continuous deployment: ativo;
- Deploy Previews: ativos;
- build command efetivo: `npm test`;
- publish directory efetivo: `.`;
- forms: não habilitados;
- custom domain: ainda não registrado naquele readback.

O primeiro production deploy útil após a promoção do PR #1 publicou `main@a7a8fcc83c2ea0a0774719db6126164045127f9e` com estado `ready`. Deploy Previews foram comprovados repetidamente nos recortes posteriores.

Campos específicos da conta Netlify devem continuar sendo documentados como **estado observado em data explícita**. Não transformar um readback antigo em “estado atual” por inferência.

## Storage e isolamento

Os providers V2 permanecem independentes mesmo quando compartilham a plataforma Netlify.

Princípios:

- produção usa store global quando o provider assim define;
- Deploy Preview/branch deploy usa store ligado ao deploy e nunca deve gravar no store global de produção;
- writes revisionados não podem sobrescrever silenciosamente uma revisão divergente;
- assets gerenciados permanecem content-addressed e imutáveis;
- sessão de escrita é curta e validada no servidor;
- segredos nunca entram no repositório nem no bundle do navegador;
- estado editorial efêmero não vira authority remota apenas porque Netlify já hospeda outros providers.

As authorities V2 detalhadas estão em `docs/v2/START-HERE.md`.

## Autorização de escrita — contrato herdado

Não há API key, OAuth ou segredo de sessão para configurar no frontend.

A frase compartilhada forte é verificada por um valor scrypt versionado no código. O verifier é público e não revela a frase, embora permita tentativa offline; por isso a frase deve continuar longa e exclusiva do CatalogoTop.

Após a validação, a Function gera um token aleatório de 256 bits e grava apenas o SHA-256 desse token no store de sessões, com expiração curta. O token bruto volta ao browser apenas por cookie `HttpOnly`, `Secure`, `SameSite=Strict` e `Path=/api`.

`GET /api/write-session` consulta o cookie/store e permite reconhecer a sessão já aberta sem pedir novamente a frase durante sua validade.

### Aprendizado do primeiro teste manual

O primeiro Deploy Preview do v0.7 revelou duas falhas que os testes estáticos não capturaram: o cliente consultava `GET /api/write-session`, mas a Function inicialmente não implementava readback coerente da sessão; além disso, a primeira implementação dependia de variáveis de ambiente que não estavam materializadas no projeto apesar do retorno de upsert da integração.

A correção removeu essa dependência: sessões passaram a usar tokens aleatórios armazenados no próprio Blob store e a Function de sessão ganhou `GET` funcional. Esse caso permanece histórico útil para evitar regressão equivalente.

## Rotas e providers

As rotas concretas evoluíram além do primeiro recorte V1; consultar o runtime e os documentos V2 específicos antes de assumir que a lista histórica abaixo é exaustiva.

Contrato inicial comprovado:

- `GET /api/products` — leitura pública da base;
- `PUT /api/products` — escrita revisionada, exige sessão;
- `GET /api/write-session` — estado da sessão atual;
- `POST /api/write-session` — valida frase e emite cookie curto;
- `POST /api/assets` — upload gerenciado, exige sessão;
- `GET /api/assets/sha256/<hash>` — leitura pública de asset imutável.

A V2 adicionou authorities próprias para catálogos salvos, AssetIndex e templates. Shared UI/plataforma não implica shared revision/store.

## Continuous deployment

### V2 review

A convenção atual é revisar a linha V2 a partir de deploy associado à branch `v2`.

Antes de usar a URL de Production como prova de runtime:

- confirmar branch `v2`;
- confirmar o SHA esperado;
- confirmar que o deploy concluiu;
- em caso de dúvida, usar uma URL de branch/preview explicitamente identificada em vez de inferir o conteúdo de Production.

### V1 histórico

Durante a estabilização V1, pushes promovidos para `main` geravam production deploys e PRs contra `main` geravam Deploy Previews. Esse fluxo é histórico da V1 e não deve ser transplantado automaticamente para a linha V2.

## Dependência externa de planilha

A leitura de XLS/XLSX/XLSM usa SheetJS via jsDelivr no `index.html`. Se esse recurso externo falhar, o restante do aplicativo e a importação CSV continuam disponíveis.

## Rollback

Código: preferir rollback para deploy anteriormente validado ou revert Git.

Dados: não editar stores/blobs de produção manualmente como procedimento normal. Restauração de dados precisa preservar a authority/revision específica do provider e deve ser uma operação explícita e auditável.

## Checklist antes de atribuir um problema ao código

```text
[ ] Git branch/SHA esperado está correto?
[ ] O deploy observado é Production, branch deploy ou Deploy Preview?
[ ] Branch do deploy coincide com a branch que contém a mudança?
[ ] SHA do deploy coincide com o commit esperado?
[ ] Build/deploy terminou com sucesso?
[ ] Um hard refresh ainda reproduz o problema?
```

Só depois desses checks comparar runtime/DOM com o código promovido.
