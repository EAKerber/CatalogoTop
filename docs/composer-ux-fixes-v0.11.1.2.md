# v0.11.1.2 — correções de composição e encoding

Este patch corrige três problemas observados após a consolidação do inspector contextual, sem alterar os primitivos estruturais nem antecipar `presentation.imageFrames` / v0.11.2.

## Membership e marcação para blocos

`selectedIds` continua significando exclusivamente:

```text
quais produtos pertencem ao catálogo
```

O checkbox da lista continua sendo a ação de inclusão/remoção do catálogo.

A criação de Collection/Table não deriva mais dos checkboxes marcados. A lista mantém uma seleção estrutural efêmera separada (`BlockSelection`), acionada por `Marcar` nos produtos que já pertencem ao catálogo e ainda não pertencem a outro bloco.

Essa marcação:

- não entra em `selectedIds`;
- não é persistida;
- não entra em backup, ProductStore, `CatalogDocument` ou print;
- é limpa quando o produto deixa de ser elegível, quando o bloco é criado ou quando a projeção da lista muda por busca/filtro.

Os comandos de membership foram renomeados na UI para deixar a fronteira explícita:

- `Incluir visíveis no catálogo`;
- `Esvaziar catálogo`.

## Ordem interna de Collection/Table

Collection/Table continuam unidades atômicas perante os demais itens do catálogo: mover um bloco no reorder top-level move todos os seus membros juntos, e membros não podem ser arrastados para fora do bloco.

Passa a existir, porém, reorder **interno** do próprio bloco. Cada membro expõe controles discretos de subir/descer dentro de sua Collection/Table.

O reorder interno:

```text
lista
→ PresentationActions.moveBlockMember()
→ CatalogOrder.moveBlockMember()
→ presentation.order
→ CatalogDocument
```

Ele preserva:

- `selectedIds`;
- membership do bloco;
- contiguidade do bloco;
- categoria;
- atomicidade top-level.

Ele altera somente a ordem efetiva dos membros dentro daquele trecho contíguo.

## Encoding de CSV

CSV deixa de depender de `File.text()` como única decodificação.

A leitura passa a operar sobre bytes:

1. BOM UTF-16LE/UTF-16BE quando presente;
2. UTF-8 estrito;
3. fallback Windows-1252 quando os bytes não formam UTF-8 válido.

Isso cobre arquivos comuns exportados por ferramentas legadas/Windows e preserva caracteres como `ç`, `ã`, `ó` e outros acentos.

O caractere de substituição `�` já persistido não é reparado genericamente: depois que o byte original foi perdido, não existe reconstrução determinística. Registros já corrompidos devem ser corrigidos/reimportados a partir da fonte original ou de um valor explicitamente conhecido.

## Gates

Cobertura adicionada:

- fixture de encoding com `Corrediça` / `CORREDIÇAS` em UTF-8 e Windows-1252;
- fixture pura de reorder interno em Collection/Table;
- Browser Grouping UX Gate para separar membership de marcação estrutural e verificar reorder interno chegando ao `CatalogDocument`.

## Fora de escopo

- mudar a geometria A4;
- permitir retirar membros de um bloco por reorder;
- reorder entre categorias;
- novo primitivo estrutural;
- persistir seleção estrutural;
- `presentation.imageFrames` / enquadramento de imagem.
