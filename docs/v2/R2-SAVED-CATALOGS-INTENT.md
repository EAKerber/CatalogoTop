# CatalogoTop V2 — R2 Saved Catalog Documents intent

## Estado de entrada

R1 está integrado em `v2` com o shell final `Cadastro | Catálogo | Biblioteca`, ProductSnapshot v2 e Product Library estabilizados. R2 parte dessa base sem reabrir o renderer A4.

## Objetivo de R2

Transformar o catálogo corrente em um recurso explícito, identificável, salvável e reabrível sem tornar a sessão do navegador nem o ProductStore a autoridade do documento editorial.

A Biblioteca continua sendo uma superfície visual única, mas catálogos pertencem a um provider e a uma revisão próprios.

```text
Biblioteca UI
  ├─ Product provider  -> ProductStore / ProductSnapshot
  └─ Catalog provider  -> CatalogStore / CatalogSnapshot
```

Salvar ou mover um catálogo não deve criar conflito de revisão no ProductStore. Alterar produtos não deve reescrever automaticamente um catálogo salvo.

## Contrato do recurso

`CatalogSnapshot v1` é o snapshot revisionado do provider de catálogos:

```text
CatalogSnapshot v1
  schemaVersion: 1
  revision
  writeId
  updatedAt
  folders[]
  catalogs[]

CatalogRecord
  id
  folderId | null
  createdAt
  updatedAt
  selectedIds[]
  catalog
    title
    templateId
    showPrices
    dateOverride
    createdAt
    presentation
```

### Authorities

- `CatalogSnapshot` normaliza/valida identidade e conteúdo salvo.
- `CatalogStore` possui revision/readback/cache do provider de catálogos.
- `FolderTree` continua sendo vocabulário puro compartilhado, mas a árvore de catálogos pertence ao snapshot de catálogos e não à árvore de produtos.
- `Core` continua sendo a sessão de edição materializada; ele não vira o banco de catálogos salvos.
- `ProductStore` continua autoridade de produtos/pastas de produto e não participa da revisão de catálogo.

## Separação entre documento e produto

Um CatalogRecord referencia produtos por `selectedIds`, mas não incorpora nem duplica Product records.

Abrir um catálogo deve aplicar apenas seu estado editorial à sessão corrente. `products[]` e `folders[]` de produto presentes no Core não podem ser substituídos pelo registro salvo.

### Referências stale são preservadas

Se um produto referenciado por um catálogo salvo deixar de existir na base de produtos, o CatalogRecord mantém o ID. A materialização atual pode ignorar o item indisponível e um futuro Preflight pode reportá-lo, mas abrir/sincronizar produtos não deve apagar silenciosamente a intenção editorial persistida.

## Dirty / saved

Dirty é comparação do conteúdo editorial corrente com o último CatalogRecord salvo/aberto.

A assinatura de conteúdo considera:

- `selectedIds`;
- `catalog.title`;
- template;
- preços;
- data/override;
- presentation.

Não considera metadata de recurso como revision, writeId, updatedAt ou `folderId`. Mover um catálogo na Biblioteca não torna seu documento editorial dirty.

## R2a — primeiro corte vertical

R2a deve provar a authority separada ponta a ponta com o menor produto utilizável:

- `CatalogSnapshot v1` browser + validação server;
- endpoint `/api/catalogs` com GET público e PUT protegido pela sessão de escrita já existente;
- `expectedRevision`, history, readback e preservação de conflito em store separado;
- cache local separado do cache de produtos;
- `CatalogStore` browser;
- salvar o catálogo corrente;
- abrir catálogo salvo;
- duplicar como nova identidade;
- provider `Catálogos` dentro da Biblioteca;
- estado explícito `Novo / Salvo / Alterações locais / Conflito`;
- backup/import legado continua funcionando e pode originar uma sessão ainda não salva.

Pastas de catálogo podem entrar no corte seguinte se adicioná-las junto ao primeiro vertical aumentar desnecessariamente o risco de UI. O schema já reserva `folders[]` e `folderId` para evitar migração estrutural posterior.

## Fora do R2a

- nenhuma mudança no ProductStore revision;
- nenhuma refatoração do renderer/paginação A4;
- nenhum snapshot de produto dentro de CatalogRecord;
- nenhuma sincronização automática do catálogo a cada keystroke;
- nenhum merge automático de dois documentos editoriais conflitantes;
- nenhuma remoção silenciosa de selectedIds stale;
- Asset Library/Template 2.0 permanecem R3/R4.

## Gates mínimos

1. CatalogRecord round-trip preserva selectedIds, presentation e identidade sem products/folders de produto;
2. abrir record em Core preserva a base de produtos/pastas corrente, inclusive selectedIds stale;
3. duplicar gera nova identidade sem alterar o original;
4. folderId de catálogo inválido falha fechado;
5. CatalogStore usa revisão própria e endpoint próprio;
6. conflito 409 preserva alteração local e não recarrega silenciosamente;
7. browser: editar catálogo -> salvar -> novo -> abrir -> conteúdo restaurado;
8. browser: duplicar -> duas identidades independentes;
9. regressão A4 completa permanece verde.
