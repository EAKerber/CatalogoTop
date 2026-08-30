# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline imutável de produção: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Regra de separação

- `main` representa a V1 estável publicada e não deve receber desenvolvimento da V2 por rotina.
- `v2` é a linha de evolução arquitetural/produto.
- compatibilidade de dados com a V1 é prioridade; compatibilidade com implementações internas específicas da V1 não é obrigação quando houver migração determinística superior.
- o fluxo externo de geração/importação de derivados de imagem permanece aposentado na linha principal; pesquisa ocorre isoladamente em `research/semantic-image-variation-v2`.

## Primeiro recorte autorizado — V2-R1 Product Library Foundation

Objetivo: evoluir a organização/autoria de produtos sem reabrir o renderer A4.

### Navegação-alvo

`Cadastro | Catálogo | Biblioteca`

- **Cadastro**: criar/ver/editar/duplicar um produto; consulta contextual de produtos existentes no ramo atual.
- **Catálogo**: composição editorial do catálogo corrente; preservar motor V1 durante R1.
- **Biblioteca**: árvore/filesystem lógico, navegação, seleção múltipla e operações de gestão/destrutivas.

### Fundação de domínio

Introduzir uma única autoridade pura de árvore, inicialmente para produtos:

```text
Folder
  id
  parentId
  name
```

Produtos passam a possuir `folderId` estável. O root `Produtos` pode ser virtual (`parentId = null`). Mover/renomear pasta modifica metadados, nunca identidade de produto.

Operações esperadas da autoridade `FolderTree`:

- normalize
- childrenOf / descendantsOf / ancestorsOf / pathOf
- createFolder
- renameFolder
- moveFolder
- deleteEmptyFolder

Guards:

- sem ciclos;
- parent existente;
- IDs estáveis;
- nome não vazio;
- irmãos sem nomes normalizados duplicados;
- exclusão de pasta não vazia proibida no primeiro recorte.

### ProductSnapshot v2

Preferência inicial: evoluir o snapshot revisionado já comprovado do ProductStore, em vez de criar um LibraryStore monolítico prematuramente.

```text
ProductSnapshot v2
  schemaVersion: 2
  revision
  writeId
  updatedAt
  folders[]
  products[] -> folderId
```

Manter `expectedRevision`, write-session, readback, cache offline e AssetStore existentes.

### Compatibilidade V1

No primeiro recorte, `folderId` vira a autoridade nova; `category` / `subcategory` permanecem como espelhos de compatibilidade enquanto renderer/composição V1 ainda os consomem.

Migração de snapshot antigo deve ser determinística: a mesma árvore textual precisa produzir os mesmos folderIds em clientes distintos. Não gerar UUIDs aleatórios durante leitura de ProductSnapshot v1.

CSV/XLSX continua aceitando Categoria/Subcategoria e resolve/cria o caminho correspondente.

### Uma única consulta recursiva

Criar uma primitiva de domínio compartilhada por Cadastro, Biblioteca e futuramente seleção do Catálogo:

```text
ProductQuery({ products, folders, folderId, recursive: true, text })
```

Selecionar uma pasta inclui descendentes por padrão. Não criar interpretações independentes de “esta pasta e subpastas”.

### `Usar como base`

Operação de domínio explícita, sem clone do DOM:

- novo `id`;
- `code` vazio/novo e obrigatório;
- preserva `folderId`, descrição, specs, dados comerciais e referências de assets conforme contrato;
- não cria vínculo permanente com o produto original;
- assets content-addressed podem ser compartilhados, sem duplicar blobs.

Código exatamente duplicado continua erro forte. Nome semelhante pode ser aviso, não bloqueio.

## Gates mínimos do R1

1. migração textual legada → árvore determinística → serialize/reload → mesmos IDs;
2. consulta recursiva em profundidade > 2;
3. mover subárvore preserva folder/product IDs e recalcula espelhos legados;
4. clone cria nova identidade sem duplicar blobs;
5. Browser desktop/mobile: pasta → existentes → usar como base → salvar → Biblioteca → mover → Cadastro;
6. regressão V1: o mesmo estado editorial materializa o mesmo `CatalogDocument`/paginação antes e depois da migração organizacional.

## Fora de escopo do R1

- persistência de catálogos salvos;
- Template visual 2.0;
- Collection 2.0 / Callout;
- asset manager genérico;
- geração de imagem externa/generativa;
- refatoração do renderer A4;
- remoção definitiva de `category/subcategory`.

O recorte seguinte natural é **V2-R2 — Saved Catalog Documents**, já sobre a Biblioteca/folder semantics estabilizadas.
