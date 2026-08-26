# v0.7 — ProductStore remoto e assets gerenciados

## Objetivo

Compartilhar a base de produtos entre poucos consumidores sem transformar o CatalogoTop em uma aplicação multiusuário complexa. A aplicação continua local-first para composição de catálogo, mas a coleção de produtos passa a ter uma autoridade remota estreita em Netlify Functions + Blobs.

## Boundary de estado

Compartilhado remotamente:

- produtos;
- revisões da base de produtos;
- assets de imagem gerenciados.

Permanece local ao navegador:

- seleção atual do catálogo;
- template escolhido;
- catálogo em elaboração;
- filtros e estado de UI.

Esse boundary evita que uma pessoa compondo um catálogo altere a seleção de outra pessoa.

## API

### `GET /api/products`

Leitura pública. Retorna:

```json
{
  "schemaVersion": 1,
  "revision": 12,
  "updatedAt": "2026-08-26T00:00:00.000Z",
  "writeId": "...",
  "products": []
}
```

### `PUT /api/products`

Exige sessão de escrita. O cliente envia `expectedRevision`, `writeId` e `products`. Se a revisão não coincide, o servidor responde `409` e não sobrescreve silenciosamente.

Antes de gravar a nova revisão, o snapshot anterior é preservado em `history/NNNNNNNN`. Uma colisão detectada no readback também preserva o candidato em `conflicts/...`.

### `GET /api/write-session`

Informa se o cookie atual possui uma sessão de escrita válida. Isso permite que o browser reconheça uma sessão já aberta sem pedir novamente a frase.

### `POST /api/write-session`

Recebe a frase compartilhada. A frase não é persistida no navegador nem no repositório. O servidor compara via scrypt + `timingSafeEqual` contra um verificador público de alta entropia versionado no código. Se válida, gera um token aleatório de 256 bits, grava apenas o hash desse token no Blob store de sessões e devolve o token em cookie de uma hora com `HttpOnly`, `Secure` e `SameSite=Strict`.

Não há segredo de sessão ou API key em variável de ambiente. A segurança depende da frase compartilhada forte; o verifier scrypt no repositório permite tentativa offline, por isso a frase gerada não deve ser substituída por senha curta ou reutilizada de outro serviço.

### `POST /api/assets`

Exige sessão de escrita. Recebe bytes de imagem já preparados pelo browser. O servidor calcula SHA-256 e grava o asset por conteúdo; uploads idênticos são deduplicados.

### `GET /api/assets/sha256/<hash>`

Leitura pública e cache imutável. Produtos guardam apenas a URL relativa do asset.

## Netlify Blobs

Produção usa stores globais com consistência forte:

- `catalogotop-products`;
- `catalogotop-assets`;
- `catalogotop-sessions`.

Deploy Previews e branch deploys usam stores ligados ao deploy. Testes de PR não podem escrever na base global de produção e também não compartilham sessões com produção.

## Imagens

URL externa continua válida e não é copiada automaticamente.

Upload local segue:

```text
arquivo local
  -> resize no browser (lado maior <= 1800 px)
  -> WebP quando aplicável
  -> POST /api/assets
  -> /api/assets/sha256/<hash>
  -> product.image
```

Data URLs legados encontrados numa migração também são materializados no AssetStore antes do snapshot remoto ser salvo.

Assets não são apagados neste recorte. Histórico recuperável tem prioridade sobre garbage collection prematuro.

## Cache e migração

Produtos compartilhados deixam de ser persistidos normalmente no `localStorage`. O `localStorage` mantém somente estado da sessão editorial. Produtos remotos/cacheados usam IndexedDB.

Na primeira abertura:

1. ler base local legada e cache IndexedDB;
2. consultar remoto;
3. se remoto possui produtos, ele é autoridade;
4. se remoto está vazio e existe base local/cacheada, não publicar automaticamente;
5. mostrar `Local · publicar` e exigir confirmação + sessão de escrita.

Se a rede falhar, o último snapshot IndexedDB permanece utilizável para seleção, composição e impressão. Alterações de produto que falham ao sincronizar também são preservadas no cache local como pendentes.

## Segurança proporcional

- leitura pública;
- escrita protegida por frase compartilhada e sessão curta;
- frase verificada por scrypt + comparação timing-safe;
- token de sessão aleatório; apenas seu SHA-256 é persistido no Blob store;
- cookie HttpOnly/Secure/SameSite=Strict;
- Origin same-site como defesa complementar;
- validação de método e Content-Type;
- limite de tamanho de payload e asset;
- limites estruturais de produtos, variações, tabelas e specs;
- revisionamento obrigatório;
- snapshots de histórico.

Origin não é considerado autenticação. A autoridade real de escrita é o token aleatório emitido após a validação da frase.

## Regressão encontrada no primeiro Deploy Preview

O primeiro teste manual revelou que a autorização estava quebrada funcionalmente: a frase era solicitada repetidamente e writes não chegavam ao ProductStore. A causa foi dupla:

- a implementação inicial não possuía readback correto de sessão em `GET /api/write-session`;
- o verifier/segredo de sessão haviam sido planejados como environment variables, mas o readback do projeto mostrou que as variáveis não estavam materializadas apesar do retorno de upsert da integração.

A correção eliminou a dependência desse setup: o verifier scrypt passou a ser versionado, e a sessão passou a usar token aleatório persistido em Blob. O cliente continua sem conhecer o cookie por ser `HttpOnly`, mas consegue verificar sua validade pelo `GET` de sessão. O fixture passou a exigir explicitamente esse circuito.

## Fora do recorte

- usuários individuais;
- OAuth;
- merge automático entre revisões concorrentes;
- edição offline com fila de operações sem conflito;
- garbage collection de assets;
- backup ZIP autossuficiente com assets;
- banco relacional;
- sincronização da seleção atual do catálogo.

## Próximo gate

Antes de promover para produção:

- CI estrutural verde;
- Deploy Preview sobe Functions e stores isolados;
- GET vazio funciona sem sessão;
- frase incorreta não abre escrita;
- frase correta abre sessão;
- `GET /api/write-session` reconhece a sessão sem nova frase;
- PUT revisão 0 cria revisão 1 no preview;
- GET retorna revisão 1;
- upload e readback de uma imagem funcionam;
- PUT com revisão antiga retorna 409;
- produção não é tocada durante os testes de preview.
