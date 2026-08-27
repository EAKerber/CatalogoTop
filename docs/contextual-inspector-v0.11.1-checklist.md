# v0.11.1 — Acceptance checklist

- [x] `selectedIds` separado de `presentation.order`.
- [x] migração local v4 → v5 preserva a ordem anterior.
- [x] `CatalogOrder` resolve ordem antes do `CatalogDocument`.
- [x] Collection/Table são unidades atômicas de reorder.
- [x] reorder entre categorias é rejeitado.
- [x] busca textual desabilita handles.
- [x] preview seleciona Card, Collection, membro e Table.
- [x] lista seleciona/navega sem usar checkbox como efeito colateral.
- [x] inspector centraliza propriedades de Card/Collection/member/Table.
- [x] managers editoriais paralelos de Collection/Table removidos.
- [x] `PresentationActions` centraliza mutações editoriais.
- [x] edição/reorder não altera `selectedIds`.
- [x] exclusão limpa ordem editorial.
- [x] Browser Print Gate não depende da localização dos controles do editor.
- [x] Browser Inspector Gate cobre inspector, reorder, print limpo e touch vertical.
- [x] `presentation.imageFrames` continua reservado, sem interpretação neste recorte.
