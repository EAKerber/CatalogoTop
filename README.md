# CatalogoTop

Gerador simplificado de catálogos A4 para a Top Mobili.

A aplicação parte de um princípio deliberadamente menor que um editor livre: **produtos são cadastrados/importados, organizados por categoria, selecionados e materializados em um documento A4 determinístico**. Card, Collection e Table formam o vocabulário estrutural atual; cabeçalho, rodapé, paginação e data são componentes compartilhados.

## Fluxo atual

1. Cadastre produtos manualmente ou importe CSV/XLSX/XLS/XLSM.
2. Organize e navegue os produtos por categorias.
3. Selecione os produtos que farão parte do catálogo.
4. Ajuste Card, Collection ou Table pelo inspector contextual e escolha o template.
5. Quando útil, escolha entre a imagem Original, alternativas reutilizáveis do produto ou derivados locais do catálogo.
6. Revise a paginação A4 e use **Gerar PDF / Imprimir**.

A base compartilhada de produtos e os assets content-addressed ficam no backend Netlify. O catálogo **em elaboração** mantém seu estado editorial na sessão local da V1 e pode ser exportado/importado como backup JSON completo.

Essa sessão/backup não é a solução futura de catálogos salvos. Persistência remota de catálogos, filesystem e Biblioteca pertencem à V2.

## Produtos e categorias

A base de produtos possui uma navegação lateral por **pastas de categoria**. No cadastro manual, o campo Categoria é obrigatório e usa um seletor sobrescrevível (`datalist`): o usuário pode escolher uma categoria existente ou digitar um nome novo; a pasta passa a existir quando o produto é salvo.

Produtos importados sem categoria são normalizados para `Sem categoria`, evitando itens órfãos fora da navegação. Neste recorte, `Subcategoria` continua sendo metadado e não cria uma árvore de pastas aninhada.

O contrato e os limites dessa metáfora estão em [`docs/category-browser.md`](docs/category-browser.md).

## Documento editorial

`selectedIds` representa membership do catálogo. A ordem editorial é mantida separadamente em `catalog.presentation.order` e resolvida por `CatalogOrder` antes de `CatalogDocument`.

O documento materializado suporta três primitivas top-level:

- **Card** — unidade individual, com conteúdo, ênfase e largura independentes;
- **Collection** — agrupamento visual full-width e atômico entre páginas;
- **Table** — agrupamento tabular full-width, fragmentável entre páginas com cabeçalho repetido.

Preview e impressão partem da mesma materialização. O documento de impressão é isolado da UI do editor e permanece A4 físico `210 × 297 mm`.

## Imagens e variantes

`product.image` é sempre o **Original canônico**. `product.imageGallery` guarda imagens alternativas fiéis e reutilizáveis do mesmo produto. Isso é separado de `product.variants`, que continua significando cores/acabamentos comerciais e pode renderizar uma grade de imagens.

No catálogo, `presentation.imageSelections` escolhe de forma esparsa Original/galeria/derivado local, enquanto `presentation.imageFrames` controla enquadramento sem destruir o asset. Uma seleção ausente ou obsoleta volta deterministicamente ao Original.

O cadastro permite adicionar/remover/rotular imagens alternativas. Para usos de imagem única, o inspector oferece navegação compacta `‹ / › / Original`. A imagem efetiva é resolvida antes do framing, com paridade entre preview e PDF.

O contrato completo está em [`docs/image-variants-v0.11.4.md`](docs/image-variants-v0.11.4.md).

## Variation Bundle

O menu **Dados → Imagens** permite um fluxo externo/offline para produzir derivados fiéis sem embutir geração de IA no editor:

1. **Exportar pacote de variações…** gera um ZIP com manifest versionado, contexto do layout, medidas renderizadas, framing, fonte canônica e hashes SHA-256.
2. Um agente/processo externo produz imagens preservando identidade e geometria do produto.
3. **Importar resultado de variações…** valida o ZIP integralmente antes de preparar/uploadar qualquer asset e aplica resultados aceitos em uma única mutação local do catálogo.

Resultados externos entram somente em `presentation.imageVariants`. Eles **não** substituem `product.image`, não são promovidos automaticamente para `Product.imageGallery`, não publicam ProductStore e não são auto-selecionados.

O importador aceita somente PNG/JPEG/WebP e verifica pacote, paths, CRC, MIME por bytes, SHA-256, request/job/placement/signature e transformações permitidas. Resultado stale ou incompatível falha fechado.

## Importação de produtos

Campos reconhecidos por aliases em português:

- `codigo` / `sku` / `referencia` → código;
- `descricao` / `produto` / `nome` → descrição;
- `categoria`, `subcategoria`, `preco`, `status`, `imagem`, `observacoes`;
- qualquer outra coluna não vazia é preservada como **especificação** do produto.

Código e descrição são obrigatórios. Linhas inválidas são reportadas antes da confirmação da importação.

O arquivo [`examples/produtos-modelo.csv`](examples/produtos-modelo.csv) contém apenas o cabeçalho-base, sem inventar dados comerciais.

## Templates

A versão atual inclui:

- **Técnico 2×4**;
- **Compacto 3×4**;
- **Destaque 2×3**.

Um template altera densidade/tratamento visual dentro do contrato atual. Ele **não duplica** cabeçalho ou rodapé institucional.

## Dados, storage e backup

O ProductStore remoto usa snapshot revisionado e escrita protegida por sessão curta. Assets são imutáveis e content-addressed no AssetStore.

O menu **Dados** concentra:

- importação de produtos e CSV modelo;
- exportação/importação do Variation Bundle;
- exportação/importação de backup JSON.

O backup JSON serializa o estado completo e, no schema 7, preserva `Product.imageGallery`, `presentation.imageVariants`, proveniência, `imageSelections` e `imageFrames`. Ao importar um backup, a publicação remota opcional continua limitada à base de produtos; o estado editorial do catálogo não é promovido ao ProductStore.

## Relação com o Gerador V1

O projeto `EAKerber/Gerador_de_catalogos_v1_AI` foi auditado como fonte somente leitura, na baseline `main@050589347e55613182a00ed1e22f6efd2f1a2540`.

O CatalogoTop não é um fork do editor. Reaproveita apenas componentes e princípios que sobrevivem à simplificação. A primeira reutilização concreta foi o subconjunto da biblioteca vetorial institucional em `src/icons.js`; normalização, compilação determinística e preflight de impressão permanecem princípios, sem portar o editor genérico.

A matriz de decisão está em [`docs/reuse-from-gerador-v1.md`](docs/reuse-from-gerador-v1.md).

## Execução local

Não há build obrigatório para o frontend. Sirva a pasta por HTTP e abra `index.html`.

```bash
python -m http.server 8000
```

A importação Excel usa SheetJS 0.18.5 via CDN. CSV e o restante da aplicação continuam funcionais sem essa dependência externa.

## Netlify

O repositório inclui `netlify.toml` para manter o deploy estático e usar `npm test` como gate de publicação:

```toml
[build]
  command = "npm test"
  publish = "."
```

A política operacional está em [`docs/netlify.md`](docs/netlify.md).

## Validação

```bash
npm test
```

O gate Node cobre sintaxe e contratos de domínio/storage/ZIP/bundle, incluindo migração schema 7 e round-trip de backup. O workflow `.github/workflows/browser-print.yml` executa a suíte Chromium de A4 e interações, incluindo imagem/framing, exportação do Request Bundle e importação transacional do Result Bundle.

Os dois gates devem permanecer verdes antes de promover mudanças funcionais para `main`.

## Estrutura principal

- `index.html` — shell e bootstrap explícito da aplicação;
- `src/core.js` — estado, migração schema 7 e normalização;
- `src/product-store.js` / `src/asset-client.js` — produtos compartilhados e assets;
- `src/catalog-order.js` / `src/catalog-document.js` — ordem e documento materializado;
- `src/catalog-renderer.js` / `src/print.js` — preview e documento de impressão;
- `src/composition.js` — apresentação local e contratos de imagem;
- `src/presentation-actions.js` — mutações editoriais;
- `src/variation-bundle.js` — Request Bundle;
- `src/zip-store.js` / `src/zip-reader.js` — fronteira ZIP;
- `src/variation-result.js` — validação/staging/commit de resultados;
- `docs/image-variants-v0.11.4.md` — contrato de variantes e bundle;
- `AGENTS.md` — guardrails e estado operacional do produto.
