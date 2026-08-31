# CatalogoTop V2 — R3a Asset Inventory & Reuse Foundation intent

## Estado de entrada

R1 e R2 estão integrados em `v2`. Produtos e catálogos já são resources explícitos com providers/revisões separados na Biblioteca.

O AssetStore existente já fornece a parte física que R3 precisa preservar:

- blobs content-addressed por SHA-256;
- URLs canônicas `/api/assets/sha256/<hash>`;
- bytes imutáveis;
- deduplicação;
- metadata técnica por hash (`contentType`, bytes, createdAt`);
- store global em produção e deploy-scoped fora de produção;
- upload/materialização protegidos pela write-session.

R3a **não substitui** esse armazenamento. Ele cria a camada de resource/index/reuse em volta dele.

## Objetivo

Provar o menor vertical útil de Asset Library:

1. uma authority revisionada de índice/metadata separada dos blobs;
2. inventário que inclui tanto registros indexados quanto assets gerenciados já referenciados por authorities persistidas;
3. informação de uso derivada de ProductSnapshot + CatalogSnapshot, não do Core local;
4. provider `Imagens` dentro da Biblioteca;
5. reutilização de uma imagem gerenciada no Cadastro sem segundo uploader nem cópia de bytes.

## Authorities

```text
AssetStore
  bytes imutáveis + metadata técnica por sha256

AssetIndexSnapshot v1
  revision/writeId/updatedAt
  folders[]
  assets[]

AssetIndexStore
  expectedRevision / cache / readback / conflict

AssetUsage
  projeção pura de referências autoritativas
  ProductSnapshot + CatalogSnapshot -> usages por hash
```

ProductStore, CatalogStore e AssetIndexStore são authorities independentes. Compartilhar a mesma write-session não compartilha revisão.

## AssetIndexSnapshot v1

```text
AssetIndexSnapshot
  schemaVersion: 1
  revision
  writeId
  updatedAt
  folders[]
  assets[]

AssetRecord
  id             // `sha256/<hash>`
  sha256         // 64 hex lowercase
  folderId|null
  label
  contentType
  bytes
  createdAt
  updatedAt
```

### Identidade

- `id` deriva do hash e é estável: `sha256/<hash>`.
- A URL física continua `/api/assets/sha256/<hash>`.
- Editar label ou organização nunca altera hash/URL/bytes.
- Um hash só pode existir uma vez no índice.
- `folderId` fica reservado no schema v1 para permitir R3b sem migração estrutural. R3a não precisa expor árvore administrativa.

### Metadata técnica

`contentType`, `bytes` e `createdAt` podem ser enriquecidos a partir da metadata física do AssetStore quando disponíveis. Metadata humana do índice não é authority dos bytes.

## AssetUsage

Usage não é persistido como contador no índice. É projeção derivada para não ficar stale.

R3a reconhece apenas referências conhecidas e contratadas:

### ProductSnapshot

- `product.image`;
- `product.imageGallery[].image`;
- `product.variants[].image`.

### CatalogSnapshot

- `catalog.presentation.imageVariants[productId][].image`.

`imageSelections` e `imageFrames` não são referências de blob independentes; eles apontam para escolhas/framing já resolvidos por outros campos.

A projeção:

- aceita somente URLs gerenciadas `/api/assets/sha256/<hash>`;
- ignora URLs remotas/data URLs;
- nunca faz busca recursiva por strings arbitrárias;
- deduplica o mesmo uso lógico;
- preserva referências stale de catálogo como usage quando a variante salva ainda contém uma URL gerenciada.

Cada uso deve carregar tipo/owner/campo suficiente para UI e accounting futuro, por exemplo:

```text
{
  assetId,
  ownerType: product|catalog,
  ownerId,
  ownerLabel,
  field,
  productId?
}
```

## Inventory

A lista visível de assets é a união:

`AssetIndex.assets ∪ hashes encontrados por AssetUsage`.

Isso permite descobrir assets pré-R3 já em uso sem migração destrutiva ou escrita automática do índice.

Para um asset não indexado:

- identity/hash/url são conhecidos;
- label pode ser um fallback derivado do uso para apresentação, sem persistir automaticamente;
- metadata técnica pode ser carregada quando disponível.

## Store / API

Criar provider separado, inicialmente em Blob store `catalogotop-asset-index`:

- GET público do snapshot corrente;
- PUT same-origin/non-browser + write-session;
- `expectedRevision`;
- history/readback análogo aos stores existentes;
- cache IndexedDB separado;
- conflito fail-closed preservando candidate local.

R3a precisa no mínimo de uma mutação pública de metadata (`setLabel`/upsert record). A UI não constrói snapshots nem chama PUT diretamente.

## Biblioteca > Imagens

Adicionar terceiro provider interno:

`Produtos | Catálogos | Imagens`.

R3a usa lista plana, sem administração de pastas.

Cada item deve oferecer:

- thumbnail pela URL content-addressed;
- label/fallback;
- hash curto;
- formato/tamanho quando conhecidos;
- resumo de usos;
- ação de editar label;
- ação contextual `Usar imagem` somente quando a Biblioteca foi aberta por um picker.

Busca por:

- label;
- hash;
- código/nome do produto que usa o asset;
- título do catálogo que usa o asset.

## Reutilização no Cadastro

O picker atual de imagem continua sendo a única entrada de upload.

Adicionar `Escolher da Biblioteca` próximo ao picker. O fluxo:

1. usuário está criando/editando produto;
2. abre Biblioteca > Imagens em modo de seleção efêmero;
3. escolhe um asset gerenciado;
4. retorna ao Cadastro;
5. formulário digitado permanece intacto;
6. preview/campo passam a usar a URL `/api/assets/sha256/<hash>`;
7. salvar produto segue o fluxo ProductStore atual.

Selecionar uma imagem existente não faz upload e não duplica blob.

O contexto de picker é estado de UI efêmero e não entra em ProductSnapshot, CatalogSnapshot, AssetIndexSnapshot ou backup.

## Exclusão / garbage collection

Fora de R3a.

Não criar endpoint de delete de blob e não reutilizar exclusão de metadata como delete físico. Um blob pode ser compartilhado por vários products/catalogs ou ficar temporariamente órfão.

Garbage collection só pode ser considerado após accounting autoritativo suficientemente comprovado e um contrato explícito de retenção.

## Dívida de backup

Backup legado pode materializar produtos localmente diferentes do ProductStore antes de uma publicação opcional. Por isso AssetUsage autoritativo nunca deriva de `Core.getState()` no backend/Library inventory; deriva dos snapshots persistidos.

## Gates mínimos

1. normalização de managed URL <-> hash/id;
2. AssetIndex rejeita hash duplicado, hash inválido e folderId inválido;
3. revisão/cache/conflito do índice são independentes de ProductStore/CatalogStore;
4. usage reconhece somente os campos contratados e deduplica;
5. mesmo hash usado por dois produtos e um catálogo resulta em um asset com três usos;
6. URL remota/data URL não entra no inventário de assets gerenciados;
7. índice + usage formam inventário único sem exigir migração automática;
8. editar label altera somente AssetIndex revision;
9. nenhum path de R3a chama delete do AssetStore;
10. browser: inventory -> busca/usage -> label -> iniciar/continuar Cadastro -> escolher asset -> voltar sem perder formulário -> salvar produto -> mesma URL/hash;
11. mobile sem overflow e provider Imagens acessível;
12. Browser Print Gate completo continua verde.

## Fora de escopo

- árvore/pastas administrativas de assets;
- upload standalone pela Biblioteca;
- bulk move/delete;
- delete físico / garbage collection;
- migrar consumers para IDs abstratos diferentes do hash;
- logo institucional dedicada;
- asset picker generalizado dentro do Catálogo;
- Template 2.0;
- mudanças de renderer/paginação A4.
