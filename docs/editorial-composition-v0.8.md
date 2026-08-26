# v0.8 — Composição editorial determinística

## Objetivo

Evoluir o catálogo de uma grade de cards uniformes para uma composição editorial discreta, preservando o princípio central do CatalogoTop: não reintroduzir editor livre, drag-and-drop, coordenadas arbitrárias ou resize manual.

A composição pertence ao catálogo em elaboração, não ao produto remoto. O `ProductStore` continua armazenando fatos do produto; escolhas como “destaque”, “visual” ou “hero” são estado local do catálogo.

## Regressão de impressão observada

O PDF manual usado como referência de regressão continha duas páginas lógicas (`01 / 02` e `02 / 02`), mas quatro páginas físicas: conteúdo nas páginas físicas 1 e 3 e páginas vazias intercaladas. Isso indicava fragmentação de impressão, não erro da paginação por categoria.

O v0.8 adiciona um print guard específico para Chromium:

- `@page` continua A4 sem margem;
- a folha impressa usa `210mm × 296mm`, reservando 1 mm contra arredondamento de `297mm + break-after`;
- `break-inside: avoid-page` é explícito;
- divisores de categoria não participam da árvore impressa;
- preview perde `gap`, margem e overflow na impressão.

Esse guard deve ser validado novamente em PDF real. O teste estrutural evita regressão do contrato CSS, mas não substitui o gate visual em Chromium.

## Estado local de apresentação

`catalog.presentation`:

```json
{
  "distribution": "balanced",
  "typography": "neutral",
  "itemStyles": {
    "product-id": {
      "contentPreset": "visual",
      "emphasis": "normal"
    }
  }
}
```

Esse objeto fica no estado editorial local e no backup do catálogo. Não é enviado ao endpoint compartilhado de produtos.

## Presets de conteúdo

`Visual` passa a ser o padrão de cards sem override. A escala de densidade explícita é:

- `visual`: imagem/variações dominantes, sem specs, notas ou tabela;
- `essential`: identificação + imagem + preço, removendo detalhes secundários;
- `standard`: equilíbrio anterior entre imagem, identificação, specs e preço;
- `detailed`: amplia specs, variações e linhas comerciais;
- `technical`: prioriza specs e tabela comercial;
- `commercial`: prioriza preço/tabela e reduz specs secundárias;
- `auto`: decide entre presets por regras determinísticas.

O modo `auto` não usa IA. Regras atuais:

- tabela com 3+ linhas ou 5+ specs → `technical`;
- tabela presente ou 3–4 specs → `detailed`;
- produto com preço, sem tabela e até 1 spec → `commercial`;
- 4+ variações ou 2+ imagens de variação, sem tabela → `visual`;
- conteúdo simples → `visual`.

## Ênfase e prioridade automática

- `normal`: largura base do template;
- `feature`: ocupa 4 de 6 colunas;
- `hero`: ocupa 6 de 6 colunas.

A composição automática prioriza destaques no topo de cada categoria antes do packing: `hero` primeiro, depois `feature`, depois cards normais. A ordem original continua estável dentro de cada grupo de prioridade.

Isso é uma regra do catálogo, não do produto remoto. Um produto só sobe quando recebeu ênfase naquele catálogo.

A micrograde interna possui seis colunas. Os templates continuam definindo densidade vertical e largura normal:

- template de 3 colunas → card normal usa 2/6;
- template de 2 colunas → card normal usa 3/6.

Não há coordenadas salvas. O planner calcula `row`, `start` e `span` de forma determinística a cada render.

## Distribuição

### Compacta

Mantém a largura base do template e aceita espaço residual na última linha quando necessário.

### Balanceada

Redistribui apenas linhas de cards normais para consumir as seis colunas. Exemplos:

```text
5 cards em template 3 colunas
[2][2][2]
[ 3 ][ 3 ]
```

```text
7 cards em template 3 colunas
[2][2][2]
[ 3 ][ 3 ]
[ 3 ][ 3 ]
```

### Editorial

Usa o mesmo preenchimento determinístico da distribuição balanceada, respeita `feature`/`hero` e aplica ritmo visual mais amplo. Após priorizar destaques no topo, um `feature` pode usar `4 + 2` com um card normal para fechar a linha.

## Paginação

A paginação deixa de ser apenas `chunk(perPage)`. Para templates reais, o planner ordena os destaques dentro da categoria, adiciona produtos e calcula quantas linhas físicas a composição exige. Quando a próxima adição ultrapassa `template.rows`, abre nova página da mesma categoria.

As garantias anteriores permanecem:

- uma página nunca mistura categorias;
- categoria nova sempre começa em nova página;
- ordem das categorias segue a primeira aparição na seleção;
- dentro da categoria, `hero` e `feature` sobem de forma estável antes dos normais;
- numeração de páginas permanece global.

Para compatibilidade de fixtures antigas, `buildCategoryPages(state, number)` preserva o contrato legado de `perPage` numérico.

## Tipografia

A tipografia é global ao catálogo e afeta somente os cards. Header, footer, marca e metadados institucionais permanecem estáveis.

Presets iniciais:

- `neutral`: escala atual;
- `technical`: família condensada/fallback Arial, tracking menor e números tabulares;
- `editorial`: títulos serifados com dados técnicos em sans-serif.

Não existe seleção arbitrária de fonte por card neste recorte.

## UI

Na barra de composição do catálogo:

- template;
- distribuição;
- tipografia;
- mostrar preços.

Cada produto selecionado ganha dois controles pequenos:

- conteúdo (`Visual`, `Essencial`, `Padrão`, `Detalhado`, `Técnico`, `Comercial`, `Auto`);
- ênfase (`Normal`, `Destaque`, `Hero`).

Produtos não selecionados não exibem esses controles.

Também existe uma faixa `Aplicar a todos os selecionados` com dois comandos independentes: aplicar um preset de conteúdo em lote e aplicar uma ênfase em lote. Os comandos não alteram o `ProductStore` remoto.

## Header responsivo

Em tablet/mobile o header mantém duas linhas lógicas:

1. marca + dois grupos de utilidades com scroll horizontal próprio;
2. `Produtos / Catálogo / Templates` isolados em três colunas iguais.

O objetivo é impedir overlap dos botões sem empurrar as tabs para uma terceira linha ou misturá-las às ações de importação/backup. Em telas muito estreitas, o nome `CatalogoTop` é ocultado e a marca vira o ponto de ancoragem visual da primeira linha.

## Fora do recorte

- drag-and-drop;
- resize livre;
- coordenadas persistidas;
- fonte arbitrária por card;
- sequência/grupo genérico ocupando múltiplos produtos;
- page builder manual;
- sincronização remota do layout editorial.

A primeira sequência multi-produto continua deliberadamente adiada até os presets e o planner de seis colunas passarem por gate visual real.

## Gates

Automáticos:

- sintaxe JS;
- planner preenche linhas balanceadas sem `grid-auto-flow: dense`;
- `hero` e `feature` são priorizados no topo mantendo estabilidade por prioridade;
- `feature + normal` pode formar `4 + 2`;
- `hero` ocupa linha inteira;
- `Visual` é o padrão de cards sem override;
- `Essencial` e `Detalhado` existem como limites explícitos de densidade;
- `Auto` é determinístico;
- aplicação em lote altera apenas `catalog.presentation`;
- header mobile mantém tabs isoladas na linha inferior e scroll horizontal nas utilidades;
- paginação considera linhas, não apenas `perPage` nominal;
- print guard de 296 mm permanece presente.

Manuais:

- gerar PDF com 1, 2, 3, 5, 7 e 10 produtos;
- confirmar que N páginas lógicas geram N páginas físicas;
- verificar cards `Visual`, `Essencial`, `Detalhado`, `Técnico`, `Comercial`, `Destaque` e `Hero`;
- testar aplicar conteúdo/ênfase em lote;
- validar header em 360–639 px sem overlap;
- confirmar ausência de colisões e cortes;
- avaliar se o preenchimento vertical reduz espaço morto sem transformar cards simples em blocos exageradamente grandes.
