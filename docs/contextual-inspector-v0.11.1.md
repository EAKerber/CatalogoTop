# v0.11.1 — Inspector contextual e ordem editorial

## Objetivo

Transformar o preview A4 em superfície de seleção editorial e a lista em superfície de membership/navegação/ordenação, sem introduzir canvas livre, coordenadas ou drag sobre a folha.

## Divisão de responsabilidades dos gates

O recorte introduz uma mudança deliberada de UX: controles editoriais por Card deixam de ser repetidos em cada linha da lista e passam ao inspector contextual. Por isso, o gate físico de impressão não deve conhecer a localização de controles da UI do editor.

### Browser Print Gate

É autoridade para:

- materialização lógica do `CatalogDocument`;
- geometria por slots;
- paginação e ordem efetiva recebida pelo documento;
- isolamento do documento print;
- A4 físico;
- Fit/zoom e preservação de scroll vertical touch no preview.

Ele **não** deve exigir seletores de controles editoriais, como `data-card-width`, porque esses seletores pertencem ao chrome da aplicação e podem mudar sem alterar o contrato físico.

### Browser Inspector Gate

O gate específico do v0.11.1 será autoridade para:

- clique no Card/Collection/Table no preview seleciona o target correto;
- inspector mostra e altera propriedades do target selecionado;
- largura de Card é alterada através do inspector e chega ao `CatalogDocument`/preview;
- lista e preview permanecem sincronizados;
- reordenação acontece somente pela lista;
- `Collection` e `Table` se movem como unidades atômicas;
- busca textual desabilita reorder ambíguo;
- `selectedIds` não é usado como efeito colateral para reordenação editorial;
- nenhum chrome de seleção/inspector entra no HTML de impressão;
- gesto vertical iniciado sobre a folha continua rolando a página em touch.

## Regra de sanitização

Quando uma responsabilidade de UX migra entre superfícies, atualizar o gate proprietário da interação em vez de conservar atributos/controles obsoletos apenas para satisfazer um teste anterior.

Neste recorte, a asserção antiga do Browser Print Gate que exigia `data-card-width` na lista foi removida. A cobertura equivalente deve reaparecer no Browser Inspector Gate através do fluxo real `preview → inspector → alteração de largura → CatalogDocument/preview`.

## Estado

Primeiro passo da implementação: fronteira de testes sanitizada. O restante do v0.11.1 ainda precisa materializar `ComposerSelection`, `PresentationActions`, inspector contextual e ordem editorial persistida antes de o novo gate de interação ser habilitado.