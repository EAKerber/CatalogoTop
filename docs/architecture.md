# Arquitetura — recorte inicial

## Objetivo

Substituir o paradigma de editor visual livre por um pipeline curto e previsível:

`ProductSource → ProductRegistry → Selection → Template → A4 Pages → Print/PDF`

A unidade autoral é o **produto**; a unidade de layout é o **template**. O usuário não manipula coordenadas, layers, grid ou drag-and-drop.

## Componentes reaproveitados conceitualmente

Mesmo com a simplificação, alguns princípios do editor maior continuam úteis:

- dados de produto separados da apresentação;
- normalização de entrada antes do render;
- template registrado por contrato, não HTML ad hoc;
- paginação determinística;
- componentes compartilhados para header/footer;
- export/backup round-trip;
- ausência de dados comerciais inventados;
- validação mínima automatizada antes de publicar mudanças.

O que foi deliberadamente removido neste recorte: editor livre, drag-and-drop, resize, layers, snap, componentes arbitrários e um schema de autoria genérico.

## Modelo de produto

```js
{
  id,
  code,
  description,
  category,
  subcategory,
  price,
  status,
  notes,
  image,
  specs: [{ label, value }],
  updatedAt
}
```

Colunas importadas que não pertencem ao núcleo são convertidas para `specs`, preservando informação sem exigir migração de schema a cada nova característica comercial.

## Modelo de catálogo

```js
{
  title,
  templateId,
  showPrices,
  createdAt
}
```

`createdAt` pertence ao catálogo, não à página; todas as páginas de uma mesma composição exibem a mesma data.

## Contrato do template

```js
{
  id,
  name,
  description,
  columns,
  rows,
  perPage,
  className
}
```

O renderer resolve a seleção, divide em `perPage`, cria páginas A4 completas, insere header/footer compartilhados e numera `pagina atual / total`.

## Importação

CSV é parseado localmente. Excel é convertido para uma matriz usando SheetJS e passa pelo mesmo normalizador de linhas. Código e descrição são obrigatórios.

A planilha não é fonte de layout; é somente fonte de dados.

## Persistência

A primeira versão usa `localStorage` por simplicidade e mantém backup JSON completo. Imagens em data URL aumentam o uso de armazenamento; se o volume real justificar, o passo natural é mover blobs para IndexedDB sem alterar o modelo de produto nem o renderer.

## Próximos recortes plausíveis

- importação em lote de imagens por nome/código;
- ordenação explícita da seleção;
- templates de capa e páginas especiais;
- exportação PDF programática caso a impressão do navegador se mostre insuficiente;
- persistência IndexedDB para acervos grandes;
- schema de importação configurável por fornecedor/planilha.
