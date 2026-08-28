# v0.11.2 — enquadramento editorial de imagem

## Objetivo

Ativar a reserva `catalog.presentation.imageFrames` como estado editorial local para ajustar a imagem principal de um produto sem alterar o asset, o ProductStore ou a geometria estrutural do catálogo.

## Fronteira do recorte

O enquadramento é associado ao `productId` e atua somente dentro da caixa visual já resolvida por Card ou Collection.

Frame canônico efetivo:

```js
{
  fit: 'contain' | 'cover',
  zoom: 1 .. 2.4,
  x: 0 .. 100,
  y: 0 .. 100
}
```

Padrão implícito:

```js
{ fit: 'contain', zoom: 1, x: 50, y: 50 }
```

O padrão não ocupa persistência. `imageFrames` continua esparso.

## Autoridade

- `PresentationActions.setImageFrame(productId, patch)` é a mutação editorial canônica.
- `PresentationActions.resetImageFrame(productId)` remove o override.
- `ImageFraming.normalizeImageFrame()` normaliza e limita valores.
- `ImageFraming.applyImageFrames(root, state)` aplica o frame após a materialização do renderer canônico.

Nenhuma dessas operações publica no ProductStore.

## Superfície de edição

O inspector contextual expõe:

- **Conter / Preencher**;
- **Zoom**;
- **Horizontal**;
- **Vertical**;
- **Redefinir enquadramento**.

Não existe drag/pan direto sobre a folha A4 neste incremento. Isso preserva o contrato de touch: o gesto vertical iniciado sobre a folha continua pertencendo ao scroll do preview.

## Card e Collection

O mesmo frame por produto é aplicado à imagem principal quando o produto aparece como:

- Card com imagem principal simples;
- membro visual de Collection.

Um Card que materializa uma grade de imagens de variantes **não** recebe um único frame aplicado a todas as fotos. O inspector informa que o enquadramento individual de variantes está fora deste recorte.

## Não objetivos

O v0.11.2 não:

- altera bytes, URL ou metadados do asset;
- altera dados do produto remoto;
- cria crop destrutivo;
- cria geometria livre sobre o A4;
- cria um quarto primitivo estrutural;
- enquadra imagens de variantes individualmente;
- adiciona gestos de pan/zoom sobre o preview;
- altera `quantityPrice`, preço, Table ou schema v6.

## Preview e print

O frame é aplicado na etapa `finalizePresentation()` do renderer canônico. Portanto preview e HTML de impressão partem da mesma decisão editorial.

A aplicação usa propriedades visuais não estruturais:

- `object-fit`;
- `object-position`;
- `transform: scale(...)`;
- `transform-origin`.

A caixa do componente não muda de tamanho e permanece sujeita ao layout Card/Collection já resolvido.

## Gates

### Node

`scripts/image-framing-fixture.mjs` cobre:

- normalização e clamps;
- persistência apenas em `presentation.imageFrames`;
- ausência de mutação do produto;
- reset e estado padrão esparso.

### Browser

`scripts/browser-image-framing-gate.mjs` cobre:

- edição pelo inspector;
- aplicação visual em Card;
- aplicação visual em membro de Collection;
- produto/URL original imutável;
- Card com grade de variantes sem frame único enganoso;
- paridade preview/print;
- reset visual e persistente.

## Compatibilidade

`imageFrames` já existia como reserva no schema/presentation antes deste incremento. O recorte ativa sua semântica sem subir a versão do schema e sem alterar `CatalogDocument`, `CatalogOrder`, membership ou primitives Card/Collection/Table.
