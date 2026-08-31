# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu três marcos estruturais:

- **R1 — Product Library Foundation**: ProductSnapshot v2, árvore provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas;
- **R3 — Asset Library**: AssetIndex independente, inventory/usage autoritativos, provider `Imagens`, labels, pastas, busca/filtros, upload standalone deduplicado e reuso no Cadastro.

Authority atual após R3b:

- `v2@193c65b3d976983867484014118c84cd360f0c2c`;
- `main` permanece linha V1 estável e não é destino rotineiro de desenvolvimento V2.

**Não há recorte funcional ativo após este closeout.** O próximo ponto de planejamento direcional é R4 — Constrained Template System 2.0; ele não está autorizado apenas por aparecer no roadmap.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/ROADMAP.md` — dependências e sequência de produto;
3. `docs/v2/R3-CLOSEOUT.md` — estado fechado da Asset Library e decisões de lifecycle;
4. `docs/v2/R2-CLOSEOUT.md` — estado fechado de Saved Catalog Documents;
5. intents `R1-*`, `R2-*`, `R3A-*`, `R3B-*` quando precisar entender decisões históricas específicas.

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
- O pipeline A4 continua `state -> CatalogOrder -> CatalogDocument -> preview/print`.
- Assets gerenciados são content-addressed e imutáveis. Metadata/organização não altera bytes nem hash.
- Uso de assets deriva de ProductSnapshot/CatalogSnapshot persistidos, nunca do Core local.
- `Sem uso` é informação de accounting, não autorização para exclusão física.
- Não existe delete físico/garbage collection de blobs na implementação R3 fechada.
- Upload standalone reutiliza `AssetClient.prepareImage` + `/api/assets`; não cria segundo armazenamento.
- Se blob subir e indexação falhar, preservar o blob e o candidate local; não compensar com delete.
- Deploy Preview/branch nunca grava no store global de produção.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.

## Backup legado

O backup JSON continua sendo transporte compatível do estado monolítico legado e passa por `Core.migrate`. Importá-lo limpa a identidade de catálogo salvo, portanto a composição restaurada volta como sessão não salva e pode ser persistida pelo CatalogStore.

O backup não é uma authority V2. Produto remoto pertence ao ProductStore; catálogo salvo ao CatalogStore; metadata de imagem ao AssetIndexStore; bytes ao AssetStore.

## Próximo ponto de decisão — R4

O roadmap aponta **R4 — Constrained Template System 2.0** como próximo marco direcional.

Antes de implementar R4, revisar explicitamente:

- contrato atual de `templates.js` e sua relação com CatalogDocument/renderer;
- quais aspectos institucionais pertencem ao template versus header/footer compartilhados;
- migração dos templates V1 existentes;
- fronteira entre tokens/layout permitido e edição livre proibida;
- impacto em preview/print e necessidade de gates físicos próprios;
- como Template resources entram na Biblioteca sem compartilhar revision authority com Produtos/Catálogos/Imagens.

Nenhuma dessas direções autoriza free-form HTML/CSS/JS, XY layout arbitrário ou reabertura implícita do renderer.
