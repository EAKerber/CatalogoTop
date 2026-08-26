# Arquitetura — recorte inicial

## Objetivo

Substituir o paradigma de editor visual livre por um pipeline curto e previsível:

`ProductSource → ProductRegistry → Selection → Template → A4 Pages → Print/PDF`

A unidade autoral é o **produto**; a unidade de layout é o **template**. O usuário não manipula coordenadas, layers, grid ou drag-and-drop.

## Relação com o Gerador V1

O repositório `EAKerber/Gerador_de_catalogos_v1_AI` é usado somente como fonte de leitura. A baseline auditada nesta fase é `main@050589347e55613182a00ed1e22f6efd2f1a2540`.

Não há objetivo de portar o editor. Cada reutilização precisa sobreviver à pergunta: ela melhora `produto → seleção → template → página` sem trazer de volta árvore genérica ou geometria livre?

A decisão módulo a módulo está em `docs/reuse-from-gerador-v1.md`.

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

A primeira reutilização direta de código é `src/icons.js`, um subconjunto da biblioteca institucional de `app/catalog-icons.js` do V1.

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

Esse modelo é deliberadamente menor que `CatalogSource 1.1.0`. Atributos, destaques, aplicações, variantes e linhas comerciais só devem ganhar campos próprios quando templates ou planilhas reais exigirem distinção semântica. Até lá, `specs` funciona como envelope conservador de dados adicionais.

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

Essa decisão é compatível com a biblioteca de assets do V1, mas evita portá-la antes de existir pressão real de capacidade ou necessidade de importação em lote de imagens.

## Publicação

O aplicativo continua executável sem build obrigatório. Para Netlify, `netlify.toml` usa `npm test` apenas como gate e publica a raiz estática. Detalhes operacionais e campos pendentes de readback ficam em `docs/netlify.md`.

## Próximos recortes plausíveis

- entrada rápida por colagem tabular, adaptada do fluxo do catálogo de produtos do V1;
- importação em lote de imagens por nome/código;
- ordenação explícita da seleção;
- preflight de impressão específico para cards/páginas;
- templates de capa e páginas especiais;
- exportação PDF programática caso a impressão do navegador se mostre insuficiente;
- persistência IndexedDB para acervos grandes;
- schema de importação configurável por fornecedor/planilha;
- evolução seletiva de `specs` para campos semânticos apenas quando houver uso real.
