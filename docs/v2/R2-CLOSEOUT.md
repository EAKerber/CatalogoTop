# CatalogoTop V2 — R2 Saved Catalog Documents closeout

## Resultado

R2 está encerrado após R2a + R2b em `v2@32ca88bae67afc0833ac6d2d14e51ddcf2b31e1d`.

O objetivo original foi atendido: catálogo deixou de ser apenas sessão/browser backup e tornou-se recurso explícito com authority própria, sem acoplar revisão de catálogo ao ProductStore nem reabrir o renderer A4.

## Capacidades entregues

### R2a — authority e lifecycle

- `CatalogSnapshot v1` browser/server;
- `CatalogStore` com revisão, cache, expectedRevision, readback e conflito separados;
- endpoint `/api/catalogs` e Blob store próprios;
- criar/salvar/abrir/duplicar catálogo;
- dirty/saved/new/conflict explícitos;
- stale product references preservadas;
- provider `Catálogos` dentro da Biblioteca;
- sessão/backup legado restaura composição como sessão não salva;
- ProductStore e A4 permaneceram isolados.

### R2b — administração

- árvore provider-scoped de pastas de catálogos;
- consulta recursiva por título/path/referências;
- criar/renomear/mover/excluir pasta vazia;
- multiseleção, mover e excluir catálogos;
- mover preserva ID, timestamps do record, conteúdo editorial e dirty-state;
- excluir o recurso ativo preserva a composição aberta e remove apenas a identidade salva;
- fluxo mobile `Pastas | Catálogos`;
- gate browser dedicado integrado à regressão física completa.

## Decisões consolidadas

1. `catalog.title` é o nome do catálogo. Não existe segundo nome administrativo em R2.
2. `folderId` é metadata organizacional e não faz parte da assinatura editorial dirty.
3. CatalogRecord referencia `selectedIds`; não incorpora Product records.
4. Referências stale são intenção editorial persistida e não são limpas por sincronização de produtos.
5. O Core é sessão materializada; CatalogStore é authority do recurso salvo.
6. Backup JSON legado é transporte/migração compatível, não persistence authority da V2.

## Migração/backup — critério de encerramento

O roadmap pedia migração/import da sessão/backup atual. O contrato mínimo está satisfeito:

- backup passa por `Core.migrate`;
- `backupFile` limpa a identidade do CatalogStore antes da restauração;
- composição importada permanece no Core como sessão não salva;
- salvar em seguida cria nova identidade no CatalogStore;
- abrir um CatalogRecord nunca substitui products/folders do ProductStore.

Não há benefício em criar um R2c apenas para transformar `catalog.title` em metadata paralela ou para inventar outro formato de backup antes de uma necessidade concreta.

## Dívida não bloqueante — restore monolítico de produtos

O backup legado ainda contém produtos + organização + composição. O handler atual faz `Core.setState(parsed)` e somente depois pergunta se os produtos restaurados devem ser publicados no ProductStore.

Consequência: durante essa janela, o Core pode conter uma projeção local de produtos diferente da base remota enquanto o estado visual de ProductStore ainda reflete a última sincronização.

Esta dívida **não invalida R2**, porque:

- o backup é explicitamente legado e compatível;
- publicação de produtos continua opcional e passa exclusivamente pelo ProductStore;
- CatalogStore já separa a identidade editorial corretamente;
- abrir catálogo salvo preserva a product truth corrente.

Ela deve ser tratada em recorte próprio quando houver motivo de produto/UX. Em R3, accounting de uso de assets não pode derivar dessa projeção local: deve usar ProductSnapshot/CatalogSnapshot autoritativos persistidos.

## Gates de fechamento

R2b foi promovido pelo PR #56 com head `cc8174c0a532f8b7639bfba8bd33a6f4e9c8261e` após:

- Validate PR #981 — success;
- Browser Print Gate PR #792 — success;
- `behind_by=0` contra `v2`;
- mergeability confirmada;
- squash com expected head SHA.

Merge resultante: `v2@32ca88bae67afc0833ac6d2d14e51ddcf2b31e1d`.

`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` permaneceu intocada.

## Próximo marco

R3 — Asset Library / reusable media index.

O primeiro corte recomendado é R3a: indexar e reutilizar assets já content-addressed, sem garbage collection e sem substituir o AssetStore existente.
