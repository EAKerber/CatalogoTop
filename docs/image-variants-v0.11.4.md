# v0.11.4 — Image Variants & Variation Bundle

## Objetivo

O recorte adiciona representações visuais alternativas do mesmo produto sem transformar o CatalogoTop em um editor de imagens ou em um gerador de IA embutido.

A regra central é preservar a autoridade factual do produto e separar claramente **imagem original**, **alternativas reutilizáveis do produto**, **variações comerciais** e **derivados editoriais locais do catálogo**.

## Contrato de domínio — schema 7

### Original canônico

`product.image` continua sendo a imagem original/canônica do produto.

Ela não é substituída quando o usuário escolhe outra imagem no catálogo e não é sobrescrita pela importação de resultados externos. Ausência de seleção ou uma seleção obsoleta sempre resolve de volta para o Original.

### Galeria reutilizável do produto

`product.imageGallery` contém representações fiéis e reutilizáveis do mesmo produto.

Cada entrada possui `id`, `label`, `image` e proveniência opcional. A galeria é materializada pelo mesmo `AssetClient`/AssetStore content-addressed usado pela imagem principal.

Ela é diferente de `product.variants`: `variants` continua representando cores/acabamentos e pode renderizar uma grade comercial com várias imagens simultâneas. Os dois conceitos não devem ser mesclados.

### Derivados locais do catálogo

`catalog.presentation.imageVariants[productId]` contém imagens derivadas que pertencem ao catálogo em elaboração.

Resultados importados pelo Variation Bundle entram somente nesse mapa. A importação não promove automaticamente o asset para `Product.imageGallery`, não altera `product.image` e não publica o produto no ProductStore.

Uma promoção futura para a galeria compartilhada deve ser uma ação explícita do usuário, não um efeito colateral da importação.

### Seleção editorial

`catalog.presentation.imageSelections[productId]` é um override esparso com `source` e `id`.

- ausência do override = Original;
- `source: product` = item de `Product.imageGallery`;
- `source: catalog` = item de `presentation.imageVariants`;
- referência inválida/obsoleta = fallback explícito para Original.

Na V1 atual a seleção é por produto porque o `CatalogDocument` materializa uma única ocorrência editorial de cada produto. A V2 pode migrar essa escolha para uma chave de placement quando usos múltiplos se tornarem um caso suportado.

### Enquadramento

`presentation.imageFrames` permanece independente da imagem escolhida.

O pipeline efetivo é:

`CatalogDocument → imagem selecionada → image framing → text fit / preview / print`

Trocar Original/alternativa/derivado não altera fit, zoom ou foco.

## Interface manual

Na etapa **Apresentação** do cadastro, `Imagens alternativas` permite adicionar imagens, editar labels e remover itens da `Product.imageGallery`.

No inspector contextual do catálogo, usos com imagem única recebem navegação compacta `‹ / › / Original`, miniatura, posição e origem da imagem.

Cards que já usam imagens de `product.variants` como grade comercial não recebem esse seletor de imagem principal, evitando duas autoridades visuais concorrentes no mesmo card.

## Request Bundle

Em **Dados → Imagens → Exportar pacote de variações…**, o editor gera um ZIP versionado para processamento externo.

O pacote contém:

- `manifest.json` — contrato autoritativo;
- `context/layout.json` — contexto estrutural materializado;
- `README.txt` — política resumida e paved path do consumidor;
- `tools/materialize-sources.py` — helper sem dependências de terceiros para materializar `remote-url` em arquivos locais;
- `sources/...` — originais canônicos deduplicados por SHA-256 quando o navegador consegue ler os bytes.

Quando CORS impede embedding, `source.mode=remote-url` continua apontando para a fonte canônica. O consumidor deve materializar esses bytes antes de editar; uma visualização obtida pela web não é substituto para o pixel source. O helper suporta download HTTP direto e também `plan` → downloader da plataforma → `ingest` para sandboxes cujo runtime local não possui rede. Ele gera índices auxiliares não autoritativos e preserva `manifest.json`, `requestId`, `jobId` e `usageSignature`.

### Placements suportados na V1

- Card: `card:<productId>`;
- membro de Collection: `collection:<blockId>:member:<productId>`.

As chaves derivam do modelo materializado, nunca da posição no DOM.

Table não gera job de imagem neste primeiro recorte. Cards que exibem uma grade de imagens comerciais também são ignorados e aparecem no relatório do pacote.

### Job e assinatura

Cada job inclui, entre outros campos:

- `jobId`;
- `productId`;
- `placementKey`;
- `usageSignature`;
- contexto de uso (`contentPreset`, ênfase, largura e Collection quando aplicável);
- dimensões medidas do holder renderizado;
- enquadramento atual;
- SHA-256 e referência do `product.image` canônico.

`usageSignature` liga o resultado ao contexto material do job: produto, placement, uso, target e hash da fonte.

`requestId` identifica o conjunto material do pedido. Metadados informativos/voláteis, como `catalog.createdAt`, continuam no manifest para contexto, mas **não entram no hash**. Alterar target, source ou contexto material continua invalidando a assinatura/pedido.

## Política de transformação externa

Transformações permitidas no primeiro contrato:

- upscale;
- pequena rotação;
- foco/reframe;
- limpeza ou expansão de fundo;
- fundo branco;
- correção de contraste/brilho/cor;
- limpeza de artefatos;
- edição que preserve identidade e geometria.

São explicitamente incompatíveis com o contrato:

- reimaginar a forma do produto;
- inventar ou remover peças;
- adicionar objetos estranhos;
- substituir modelo/identidade por aproximação.

O bundle não transporta fatos comerciais desnecessários para a tarefa de imagem.

## Result Bundle e importação fail-closed

Em **Dados → Imagens → Importar resultado de variações…**, o pacote externo é tratado como entrada não confiável.

O leitor ZIP possui limites de tamanho/quantidade e rejeita, entre outros casos:

- path traversal ou caminho absoluto;
- entradas duplicadas;
- ZIP64/multidisk;
- arquivo criptografado;
- método de compressão desconhecido;
- symlink Unix;
- CRC inconsistente.

O resultado aceita somente raster passivo PNG, JPEG ou WebP. MIME é verificado pelos bytes e, quando declarado, SHA-256 precisa coincidir.

Antes de qualquer preparação, upload ou mutação, o pacote inteiro valida:

- kind/version;
- `requestId`;
- `jobId`;
- `productId`;
- `placementKey`;
- `usageSignature`;
- MIME/hash do asset;
- lista de transformações permitidas;
- capacidade de variantes locais.

Depois da validação integral, duplicatas já importadas são removidas do subconjunto que precisa de upload. Os assets novos são preparados e enviados ao AssetStore. Antes do commit, o pedido atual é recalculado novamente; se o catálogo mudou durante os awaits, nenhum estado editorial é aplicado.

O commit aceito acontece em uma única mutação de `presentation.imageVariants`. Não existe importação parcial do estado. Um blob content-addressed já enviado pode ficar órfão se o contexto mudar durante o upload, mas não há mutação de catálogo nesse caso.

## Proveniência e idempotência

Derivados externos guardam proveniência suficiente para rastrear:

- request/job/signature/placement;
- hash da fonte;
- hash e MIME do resultado recebido;
- transformações declaradas;
- gerador, quando informado.

Reimportar o mesmo resultado no mesmo contexto é idempotente e não gera novo upload nem nova variante.

A importação não seleciona automaticamente a imagem nova. O usuário continua vendo o Original até escolher explicitamente a derivada pelo mesmo ciclo do inspector.

## Persistência e backup na V1

A base de produtos e assets continua usando ProductStore/AssetStore remoto. O catálogo em elaboração permanece estado local de sessão da V1.

O backup JSON serializa o estado completo e preserva:

- `Product.imageGallery`;
- `presentation.imageVariants` e proveniência;
- `presentation.imageSelections`;
- `presentation.imageFrames`.

A sessão local deliberadamente não duplica a base remota de produtos, mas preserva o estado de apresentação do catálogo em elaboração.

Isso **não é** a solução futura de catálogos salvos. Persistência remota/filesystem de catálogos e a Biblioteca planejada pertencem à V2.

## Gates

O recorte é protegido por fixtures de schema/domínio, storage, backup round-trip, ZIP writer/reader, Request Bundle e Result Bundle, além dos browser gates que cobrem:

- Original → galeria → derivado local → Original;
- framing independente;
- Card e Collection;
- grade comercial preservada;
- preview = print;
- exportação real do Request Bundle sem mutação de estado;
- importação transacional do Result Bundle;
- dedupe precoce;
- seleção manual da derivada importada;
- resultado stale rejeitado antes de mutação.

## Fora de escopo

- geração de imagens dentro do CatalogoTop;
- gallery/asset manager amplo;
- promoção automática de derivado para ProductStore;
- persistência remota de catálogos;
- filesystem/Biblioteca V2;
- placement genérico para múltiplos usos do mesmo produto;
- geração de variantes para Table;
- redesign estrutural dos templates ou renderer legado.
