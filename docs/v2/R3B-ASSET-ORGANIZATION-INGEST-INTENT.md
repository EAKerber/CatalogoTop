# CatalogoTop V2 — R3b Asset Organization & Ingest intent

## Estado de entrada

R3a foi integrado em `v2@a4a577c98bba5855dd578a730b3b345e7fba0be2`.

A fundação já existente é preservada:

- bytes no `AssetStore` continuam content-addressed por SHA-256, imutáveis e deduplicados;
- `AssetIndexSnapshot v1` já possui `folders[]` e `AssetRecord.folderId`, portanto R3b não exige bump de schema;
- `AssetIndexStore` é a única authority de metadata/organização;
- usage continua derivado de ProductSnapshot + CatalogSnapshot persistidos, nunca do Core local;
- `Biblioteca > Imagens` já permite descobrir, nomear e reutilizar assets gerenciados.

## Objetivo

Transformar a fundação R3a em uma biblioteca operacional de imagens sem introduzir lifecycle destrutivo:

1. organizar imagens em pastas provider-scoped;
2. buscar por pasta/subpasta e filtrar `Em uso | Sem uso`;
3. mover várias imagens em uma única revisão do AssetIndex;
4. adotar no índice um asset descoberto apenas por usage quando ele for organizado;
5. permitir upload standalone pela Biblioteca reutilizando o mesmo AssetStore/prepareImage;
6. refletir candidates locais pendentes na UI sem falsificar usage autoritativo;
7. preservar o picker Cadastro → Biblioteca → Cadastro.

## Não objetivos

R3b NÃO introduz:

- `DELETE /api/assets`;
- garbage collection;
- exclusão física de blobs;
- interpretação de `Sem uso` como autorização para apagar;
- segunda authority de assets;
- schema v2 do AssetIndex;
- upload alternativo no Cadastro;
- mudanças de renderer/paginação A4;
- Template 2.0.

## Consulta e escopos

Criar `AssetQuery` puro sobre `assets + folders`.

Escopos:

- todos os assets;
- uma pasta e seus descendentes;
- virtual `Sem pasta` (`folderId == null`);
- filtro de usage `all | used | unused`.

Busca textual inclui label, hash, content-type, path da pasta e labels/IDs dos usos autoritativos.

## Projeção local

`/api/asset-inventory` continua sendo a projeção autoritativa de usage e disponibilidade conhecida no servidor.

A UI pode sobrepor somente metadata do `AssetIndexStore.getSnapshot()` sobre esse payload para representar:

- labels locais ainda pendentes;
- moves locais ainda pendentes;
- assets recém-enviados cujo blob já existe mas cujo índice ainda não foi confirmado.

A sobreposição NÃO cria usages locais e NÃO deriva usage do Core.

Se um upload físico concluir e a publicação do índice falhar, o blob pode permanecer órfão. Não compensar apagando bytes.

## Mutações do AssetIndexStore

Todas passam pelo mesmo `publishCandidate` revisionado:

- `createFolder({name, parentId})`;
- `renameFolder(id, name)`;
- `moveFolder(id, parentId)`;
- `deleteEmptyFolder(id)`;
- `moveAssets(items, folderId)`;
- `registerAssets(records, {folderId})`.

### Move/adoption

`moveAssets` aceita recursos já indexados e recursos apenas descobertos por inventory/usage.

- recurso indexado: altera somente `folderId`;
- recurso descoberto: cria AssetRecord com o mesmo hash/URL e metadata disponível, já no destino;
- nenhum caso copia/reenvia bytes;
- batch inteiro publica uma única revisão.

### Register/upload

Upload standalone:

`file -> AssetClient.prepareImage -> AssetClient.uploadBlobDetailed -> AssetIndexStore.registerAssets`

Para hash novo:

- label inicial pode derivar do filename sem extensão;
- pasta selecionada pode ser aplicada;
- metadata técnica retornada pelo upload pode preencher o record.

Para hash já indexado:

- permanece um único record;
- não renomear;
- não mover;
- não sobrescrever metadata humana existente apenas por reupload.

## Biblioteca > Imagens

Desktop:

- árvore à esquerda;
- cards/recursos à direita;
- mesma linguagem estrutural de Produtos/Catálogos.

Árvore:

- `Todas as imagens`;
- `Sem pasta` virtual;
- folders recursivos;
- criar/renomear/mover/excluir somente pasta vazia.

Recursos:

- busca;
- filtro `Todos | Em uso | Sem uso`;
- multiseleção;
- selecionar visíveis/limpar;
- destino + mover selecionadas;
- `+ Adicionar imagens`;
- editar nome;
- `Usar imagem` quando em picker mode.

Mobile:

- `Pastas | Imagens`;
- `Imagens` é a view inicial;
- picker sempre abre diretamente em `Imagens`;
- selecionar pasta leva à lista de imagens;
- sem overflow horizontal.

## Exclusão

A única operação destrutiva de R3b é excluir pasta comprovadamente vazia.

Um asset `Sem uso` pode continuar necessário por backup, referência externa, trabalho ainda não salvo ou política futura. R3b apenas torna a ausência de usos autoritativos visível.

## Gates

### Domain/static

1. query recursiva por pasta;
2. `Sem pasta` correto;
3. filtros used/unused usam somente `asset.usages` autoritativo;
4. create/rename/move folder rejeitam ciclos e siblings duplicados via FolderTree;
5. delete de pasta ocupada falha fechado;
6. move preserva hash/id/label/metadata e altera somente folderId;
7. mover asset descoberto o adota no índice sem alterar bytes;
8. batch move = uma candidate/revisão;
9. register duplicado não cria segundo record nem renomeia/move existente;
10. upload helper detalhado preserva compatibilidade de `uploadBlob()`;
11. nenhuma mutação chama ProductStore publish/CatalogStore publish/delete físico.

### Browser

Gate dedicado `browser-asset-library-admin-gate.mjs`:

1. inventory com assets vindos de produto e catálogo;
2. criar pastas aninhadas;
3. mover/adotar asset descoberto;
4. busca recursiva;
5. rename/move pasta;
6. pasta ocupada não exclui;
7. upload standalone de imagem;
8. reupload dos mesmos bytes deduplica e não cria segundo record;
9. asset novo aparece `Sem uso`;
10. reutilizar no Cadastro e salvar produto;
11. após save, inventory mostra `Em uso` sem revisão adicional do AssetIndex;
12. mobile `Pastas | Imagens` sem overflow;
13. regressão física completa continua verde.

## Critério de encerramento de R3

Após R3b, fazer auditoria curta. Se descobrir/nomear/buscar/organizar/adicionar/reutilizar assets estiver estável e usage autoritativo estiver claro, R3 pode fechar sem implementar GC.

Um R3c destrutivo só é justificável diante de necessidade concreta de retenção/limpeza, não apenas porque um recurso aparece `Sem uso`.
