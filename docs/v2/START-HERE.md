# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu três marcos estruturais relevantes:

- **R1 — Product Library Foundation**: ProductSnapshot v2, árvore provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas;
- **R3a — Asset Inventory & Reuse Foundation**: AssetIndex independente, inventory derivado de usages autoritativos, provider `Imagens`, labels e reuso content-addressed no Cadastro.

Authority de entrada do recorte atual:

- `v2@a4a577c98bba5855dd578a730b3b345e7fba0be2`;
- `main` permanece linha V1 estável e não é destino rotineiro de desenvolvimento V2.

O recorte ativo é **R3b — Asset Organization & Ingest**.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/ROADMAP.md` — dependências e sequência de produto;
3. `docs/v2/R3A-ASSET-INVENTORY-REUSE-INTENT.md` — fundação já entregue de Asset Library;
4. `docs/v2/R3B-ASSET-ORGANIZATION-INGEST-INTENT.md` — contrato do recorte ativo;
5. `docs/v2/R2-CLOSEOUT.md` e intents anteriores quando precisar de decisões históricas específicas.

## Authorities V2

```text
Biblioteca UI
  ├─ Produtos   -> ProductStore / ProductSnapshot
  ├─ Catálogos  -> CatalogStore / CatalogSnapshot
  └─ Imagens    -> AssetIndexStore / AssetIndexSnapshot

Bytes de imagem -> AssetStore content-addressed (sha256), imutável
Usage de imagem -> projeção de ProductSnapshot + CatalogSnapshot persistidos
```

`FolderTree` é vocabulário puro reutilizável, não uma authority global. Cada provider mantém namespace e revisão próprios.

## Invariantes

- Produto e apresentação permanecem separados.
- Resource identity permanece estável através de move/rename organizacional.
- Revisions são provider-scoped; não criar um conflito global de Biblioteca.
- O Core é sessão materializada de edição, não banco autoritativo de recursos.
- O pipeline A4 continua `state -> CatalogOrder -> CatalogDocument -> preview/print`; R3b não reabre renderer/paginação.
- Assets gerenciados são content-addressed e imutáveis. Metadata/organização não altera bytes nem hash.
- Uso de assets deriva de ProductSnapshot/CatalogSnapshot persistidos, nunca do Core local.
- `Sem uso` é informação de accounting, não autorização para exclusão física.
- Nenhum garbage collection de blobs ocorre em R3b.
- Upload standalone reutiliza `AssetClient.prepareImage` + `/api/assets`; não cria segundo armazenamento.
- Se blob subir e indexação falhar, preservar o blob e o candidate local; não compensar com delete.
- Deploy Preview/branch nunca grava no store global de produção.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.

## Backup legado

O backup JSON continua sendo transporte compatível do estado monolítico legado e passa por `Core.migrate`. Importá-lo limpa a identidade de catálogo salvo, portanto a composição restaurada volta como sessão não salva e pode ser persistida pelo CatalogStore.

O backup não é uma authority V2. Produto remoto pertence ao ProductStore; catálogo salvo ao CatalogStore; metadata de imagem ao AssetIndexStore; bytes ao AssetStore.

## Recorte ativo — R3b

R3b torna `Biblioteca > Imagens` operacional para administração cotidiana sem introduzir lifecycle destrutivo:

- pastas provider-scoped;
- busca/escopo recursivo e `Sem pasta`;
- filtro `Todos | Em uso | Sem uso`;
- multiseleção e move em batch;
- adoção de assets descobertos por usage ao serem organizados;
- upload standalone com deduplicação física existente;
- projeção local de metadata pending;
- mobile `Pastas | Imagens`, mantendo Imagens como view inicial/picker.

Fora deste recorte: delete físico, garbage collection, Asset IDs abstratos diferentes do hash, Template 2.0 e mudanças A4.
