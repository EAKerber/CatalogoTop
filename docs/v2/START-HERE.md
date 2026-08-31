# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 já concluiu dois marcos estruturais:

- **R1 — Product Library Foundation**: ProductSnapshot v2, árvore provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas dentro da Biblioteca.

Authority atual de desenvolvimento após R2b:

- `v2@32ca88bae67afc0833ac6d2d14e51ddcf2b31e1d`;
- `main` permanece linha V1 estável e não é destino rotineiro de desenvolvimento V2.

O recorte ativo seguinte é **R3a — Asset Inventory & Reuse Foundation**.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/ROADMAP.md` — dependências e sequência de produto;
3. `docs/v2/R2-CLOSEOUT.md` — estado fechado de Saved Catalog Documents e dívidas não bloqueantes;
4. `docs/v2/R3A-ASSET-INVENTORY-REUSE-INTENT.md` — contrato do recorte ativo;
5. intents anteriores quando precisar entender decisões históricas específicas (`R1-*`, `R2-*`, `R2B-*`).

## Authorities V2

```text
Biblioteca UI
  ├─ Produtos   -> ProductStore / ProductSnapshot
  ├─ Catálogos  -> CatalogStore / CatalogSnapshot
  └─ Imagens    -> R3a: AssetIndexStore / AssetIndexSnapshot

Bytes de imagem -> AssetStore content-addressed (sha256), imutável
```

`FolderTree` é vocabulário puro reutilizável, não uma authority global. Cada provider mantém sua própria namespace e revisão.

## Invariantes

- Produto e apresentação permanecem separados.
- Resource identity permanece estável através de move/rename organizacional.
- Revisions são provider-scoped; não criar um conflito global de Biblioteca.
- O Core é sessão materializada de edição, não banco autoritativo de recursos.
- O pipeline A4 continua `state -> CatalogOrder -> CatalogDocument -> preview/print`; R3a não reabre renderer/paginação.
- Assets gerenciados são content-addressed e imutáveis. Metadata/organização não altera bytes nem hash.
- Nenhum garbage collection de blobs pode ocorrer sem accounting explícito de referências autoritativas.
- Deploy Preview/branch nunca grava no store global de produção.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.

## Backup legado

O backup JSON continua sendo transporte compatível do estado monolítico legado e passa por `Core.migrate`. Importá-lo limpa a identidade de catálogo salvo, portanto a composição restaurada volta como sessão não salva e pode ser persistida pelo CatalogStore.

O backup não é uma terceira authority. Produto remoto continua pertencendo ao ProductStore; catálogo salvo continua pertencendo ao CatalogStore. A diferença temporária entre produtos importados localmente e ProductStore está registrada em `R2-CLOSEOUT.md` como dívida não bloqueante.

## Recorte ativo — R3a

R3a deve transformar o AssetStore já existente em uma biblioteca utilizável **sem substituir o armazenamento content-addressed**. O primeiro vertical introduz índice/metadata, inventário derivado de usos autoritativos, provider `Imagens` na Biblioteca e reutilização de uma imagem gerenciada no Cadastro.

Fora deste recorte: árvore administrativa completa de assets, upload standalone pela Biblioteca, bulk operations, garbage collection, Asset IDs abstratos diferentes do hash, Template 2.0 e qualquer refatoração do A4.
