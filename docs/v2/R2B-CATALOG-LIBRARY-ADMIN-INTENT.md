# CatalogoTop V2 — R2b Catalog Library Administration intent

## Estado de entrada

R2a está integrado em `v2` com `CatalogSnapshot v1`, `CatalogStore`, endpoint `/api/catalogs`, cache/revision próprios, save/open/duplicate e provider `Catálogos` dentro da Biblioteca. R2b parte dessa authority já provada e não altera o renderer A4.

## Objetivo

Completar a administração dos catálogos salvos na Biblioteca usando o `FolderTree` já estabilizado, sem criar uma árvore global nem acoplar revisão de catálogo à revisão de produtos.

R2b transforma a lista plana de catálogos em uma superfície de administração com:

- árvore provider-scoped de pastas;
- escopo recursivo e busca;
- seleção múltipla;
- mover catálogos;
- excluir catálogos;
- criar, renomear, mover e excluir pasta vazia;
- comportamento mobile `Pastas | Catálogos` coerente com Product Library.

## Invariantes

1. `CatalogSnapshot` permanece schema v1. `folders[]` e `CatalogRecord.folderId` já existem e são suficientes.
2. `FolderTree` é vocabulário puro compartilhado; a árvore de catálogos pertence somente ao `CatalogSnapshot`.
3. Mover catálogo altera apenas `folderId`. Não altera ID, conteúdo editorial, `CatalogRecord.updatedAt` nem dirty-state.
4. Renomear/mover pasta altera apenas metadata organizacional do provider e não torna catálogo aberto dirty.
5. O nome do catálogo continua sendo `catalog.title`, conteúdo editorial editado na aba Catálogo. R2b não cria um segundo nome administrativo concorrente.
6. Pasta só pode ser excluída quando não contém subpastas nem catálogos.
7. Excluir um catálogo salvo remove somente o recurso do `CatalogSnapshot`. Não apaga produtos, assets ou outros catálogos.
8. Se o recurso atualmente aberto for excluído, o conteúdo materializado no `Core` permanece intacto; somente a identidade salva é limpa. A composição passa a ser uma sessão local não salva.
9. Operações administrativas usam a revisão/PUT do `CatalogStore`; nunca chamam `ProductStore.publishCurrent()` nem alteram a revisão de produtos.
10. Conflitos continuam fail-closed e preservam o candidate local no cache, como em R2a.

## Consulta

`CatalogQuery` é uma consulta pura análoga a `ProductQuery`, mas provider-specific. Ela suporta:

- todos os catálogos quando não há pasta selecionada;
- pasta direta ou recursiva;
- busca accent-insensitive por título;
- path de pasta;
- IDs de produtos referenciados, inclusive referências stale preservadas.

Pasta inexistente deve falhar fechado em vez de virar consulta global.

## Fronteira de Store

A UI não monta snapshots nem chama `/api/catalogs` diretamente. `CatalogStore` oferece mutações explícitas para:

- `createFolder`;
- `renameFolder`;
- `moveFolder`;
- `deleteEmptyFolder`;
- `moveCatalogs`;
- `deleteCatalogs`.

Essas operações reutilizam `publishCandidate`, revision/readback/cache/conflito do provider de catálogos.

## UX alvo

Desktop:

```text
Biblioteca > Catálogos
  Pastas                       Catálogos
  Todos os catálogos           busca / contador
  ├─ Clientes                  seleção / mover / excluir
  │  └─ 2026                   lista de recursos
  └─ Arquivo
```

Mobile mantém o provider `Catálogos` e adiciona switch interno `Pastas | Catálogos`, sem nova aba top-level.

## Fora do R2b

- Asset Library;
- Template 2.0;
- renderer/paginação A4;
- autosave por keystroke;
- merge automático de conflitos;
- lixeira/soft-delete;
- revisão individual por CatalogRecord;
- árvore global compartilhada entre providers;
- renome administrativo separado de `catalog.title`.

## Gates

1. `CatalogQuery` cobre escopo recursivo/direct, busca e fail-closed.
2. Mover catálogo preserva ID, timestamps do record e assinatura editorial.
3. Mover catálogo ativo mantém `isDirty() === false`.
4. Pasta ocupada ou com descendentes não pode ser excluída.
5. Excluir catálogo ativo limpa identidade, preserva `Core` e deixa a sessão dirty/não salva.
6. Operações administrativas não publicam ProductStore.
7. Browser cobre árvore profunda, move, busca, delete-empty, multiseleção, exclusão do ativo e fluxo mobile.
8. Browser Print Gate completo permanece verde.
