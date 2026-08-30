# CatalogoTop V1 — Stable boundary

Status: **1.0.0**

## Included

A V1 estável preserva o fluxo de cadastro/importação de produtos, composição determinística em Card/Collection/Table, templates atuais, framing de imagem, imageGallery reutilizável, backup da sessão editorial e geração A4/PDF.

## External image variations retired from V1

O experimento de Image Variation Request/Result permanece no código e no schema como compatibilidade reservada, mas **não é uma funcionalidade exposta da V1 estável**.

- a seção `Dados → Imagens` fica literalmente `hidden`;
- `product.image` e `product.imageGallery` permanecem válidos;
- `presentation.imageFrames` permanece válido;
- entradas `presentation.imageVariants` com `provenance.kind = external-variation` são removidas na normalização da sessão;
- seleções que apontavam para esses derivados externos voltam ao fallback Original;
- variantes catalog-local de outra proveniência e seleções de `product.imageGallery` não são removidas;
- blobs já enviados ao AssetStore são imutáveis/content-addressed e podem permanecer órfãos; a V1 não inventa um GC destrutivo sem autoridade de referência global.

Os campos `imageVariants`/`imageSelections` não são removidos do schema 7. Essa decisão é intencional para permitir uma futura capability compatível sem migração destrutiva.

## Why it is retired

O teste end-to-end mostrou que produzir uma derivada realmente útil exige mais do que transformações mínimas de imagem. O caso-alvo inclui decisões semânticas como usar a geometria do placement, orientar o produto para aproveitar um card largo, escolher composição/rotação/foco e aumentar qualidade sem inventar um produto diferente. Esse problema precisa de contrato e avaliação próprios antes de voltar ao paved path.

A V2 pode evoluir normalmente sem depender dessa capability.
