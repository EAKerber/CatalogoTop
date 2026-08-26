# Reaproveitamento seletivo do Gerador V1

## Fonte auditada

Repositório somente leitura: `EAKerber/Gerador_de_catalogos_v1_AI`.

Baseline observado: `main@050589347e55613182a00ed1e22f6efd2f1a2540`.

A intenção desta auditoria não é portar o editor antigo. É identificar peças que permanecem úteis quando a unidade principal deixa de ser um componente editável e passa a ser um produto selecionável.

## Decisão arquitetural

O CatalogoTop mantém o pipeline:

`ProductSource → ProductRegistry → Selection → Template → A4 Pages → Print/PDF`

Qualquer recurso do Gerador V1 só entra se reduzir trabalho ou aumentar determinismo sem reintroduzir edição espacial livre.

## Componentes avaliados

### `app/product-catalog.js` — REAPROVEITAR CONCEITOS

Útil:

- inventário de produtos separado da apresentação;
- seleção em lote;
- entrada tabular rápida;
- produto como entidade reutilizável;
- possibilidade de subcatálogos/filtros sem duplicar produto.

Não portar:

- vínculo direto com componentes arbitrários no canvas;
- card alvo e overrides locais do editor;
- ações que materializam estruturas editáveis no documento genérico.

O CatalogoTop já implementa inventário + seleção de forma menor. Entrada rápida por colagem é candidata a próximo recorte, pois preserva o paradigma atual.

### `app/catalog-source.js` — REAPROVEITAR CONTRATOS DE DADOS, COM REDUÇÃO

Útil:

- normalização antes de renderizar;
- valores comerciais separados de atributos semânticos;
- chaves estáveis;
- não descartar dados adicionais;
- papel explícito para arte principal.

Não portar agora:

- `variants`, `commercialRows`, `legendDefinitions` e múltiplos papéis de asset completos enquanto não houver caso real que exija essa profundidade.

No CatalogoTop, colunas desconhecidas são atualmente preservadas em `specs[]`. Isso é deliberadamente menos expressivo, mas evita perda silenciosa. O schema deve crescer somente quando templates reais precisarem distinguir, por exemplo, especificações técnicas de aplicações ou destaques.

### `app/catalog-compiler.js` — REAPROVEITAR DETERMINISMO, NÃO A ÁRVORE GENÉRICA

Útil:

- mesma entrada + mesmo template deve produzir a mesma organização;
- validação antes da materialização;
- decisões explícitas em vez de heurísticas escondidas.

Não portar:

- canonicalização de IDs de componentes do canvas;
- criação recursiva de moléculas/slots;
- reparos geométricos de um editor livre.

No CatalogoTop, o equivalente do compilador é intencionalmente pequeno: resolver seleção → dividir por `perPage` → renderizar páginas completas.

### `app/catalog-icons.js` — REAPROVEITADO

Foi reaproveitado um subconjunto da biblioteca vetorial canônica para o rodapé:

- localização;
- WhatsApp;
- qualidade;
- estoque;
- entrega rápida;
- atendimento;
- calendário.

O subconjunto vive em `src/icons.js`, com proveniência explícita, em vez de manter desenhos SVG paralelos dentro do renderer.

### `styles/tokens.css` — REAPROVEITAR COMO REFERÊNCIA DE IDENTIDADE

Útil:

- vermelho de marca e escala de neutros;
- famílias tipográficas fallback;
- tokens de página A4 e espaçamento.

Não portar o sistema inteiro por enquanto. O CatalogoTop mantém uma folha CSS única para reduzir superfície operacional, mas os valores canônicos do V1 devem orientar a convergência visual.

### `app/print-export.js` — REAPROVEITAR GATE/PREFLIGHT

Útil:

- separar estado de edição de estado de impressão;
- validar antes de abrir o diálogo de impressão;
- limpar estado transitório depois do print.

O CatalogoTop já usa CSS de impressão A4. Um preflight pequeno, específico para páginas/cards e sem dependência do validator genérico, é candidato de curto prazo.

### `app/asset-library.js` + `app/asset-storage.js` — ADIAR

IndexedDB e biblioteca de assets resolvem o limite de imagens grandes e reuso de arte, mas acrescentam estado e migrações.

Enquanto o acervo real couber no fluxo atual, manter imagem por URL/data URL. Promover IndexedDB apenas quando o limite de `localStorage` aparecer como problema concreto ou quando a importação em lote de imagens for priorizada.

### `app/document-store.js`, `app/inspector.js`, `app/interactions.js`, `app/layout-engine.js` — NÃO PORTAR

Esses módulos existem para o paradigma que está sendo abandonado: árvore genérica, seleção de componentes, drag/resize, autoridade de layout e reflow espacial.

Portá-los recriaria a maior parte da complexidade que o CatalogoTop pretende remover.

## Resultado da primeira rodada

Reaproveitado em código:

1. biblioteca de ícones institucionais do rodapé;
2. princípios de separação produto/apresentação e normalização já presentes no recorte inicial;
3. validação antes de publicação, agora também usada como build gate da Netlify.

Reaproveitado como direção, não como código copiado:

1. CatalogSource reduzido;
2. compilação determinística;
3. tokens de identidade;
4. print preflight;
5. futura biblioteca de assets quando houver necessidade real.

## Regra para próximos ports

Antes de importar um módulo do V1, responder:

1. ele serve ao fluxo `produto → seleção → template → página`?
2. funciona sem coordenadas livres ou árvore genérica?
3. reduz trabalho recorrente do usuário?
4. mantém dados comerciais rastreáveis e sem inferência?
5. consegue ser testado isoladamente?

Se a resposta não for majoritariamente sim, o recurso permanece no V1 e não entra no CatalogoTop.
