# AGENTS.md — CatalogoTop

## Missão

Manter o CatalogoTop como um gerador de catálogo **simples, determinístico e orientado a produtos**.

## Repositórios e proveniência

- Este repositório, `EAKerber/CatalogoTop`, é o alvo de desenvolvimento.
- `EAKerber/Gerador_de_catalogos_v1_AI` é fonte de referência **somente leitura** neste trabalho. Não escrever, abrir branches ou alterar PRs nele sem nova autorização explícita.
- Ao reaproveitar código ou contrato do Gerador V1, registrar a origem e manter apenas a parte necessária ao paradigma simplificado.
- A auditoria inicial de reuso está em `docs/reuse-from-gerador-v1.md`.

## Guardrails

- Mudanças funcionais devem ser desenvolvidas em branch dedicada e promovidas por PR/gates; evitar commits diretos na `main` mesmo quando o recorte parecer pequeno.
- Não reintroduzir editor livre, drag-and-drop sobre o A4, layers ou posicionamento arbitrário sem decisão explícita de produto.
- Produto e apresentação permanecem separados.
- Não inventar preço, especificação, disponibilidade ou qualquer outro fato comercial.
- Código e descrição são a validação mínima para importação.
- Colunas desconhecidas de planilha devem ser preservadas como especificações quando possível, não descartadas silenciosamente.
- Header/footer são componentes compartilhados. Templates não devem copiá-los.
- No header da aplicação, estado de sincronização permanece visível; importação, modo da importação, CSV modelo, utilidades de imagem e backup são ações secundárias agrupadas no menu `Dados`.
- Paginação deve derivar do contrato do template, das categorias, da ordem editorial efetiva e da geometria declarada das unidades editoriais.
- `selectedIds` representa somente membership local: quais produtos pertencem ao catálogo. Não usar `selectedIds` como mecanismo de reorder.
- `catalog.presentation.order` representa somente ordem editorial persistida. Não usar `presentation.order` para incluir/remover membership.
- A ordem efetiva é resolvida por `CatalogOrder` antes do `CatalogDocument`; nunca criar ciclo `CatalogDocument → corrigir selectedIds → obter ordem`.
- `ComposerSelection` é estado efêmero da UI e não pode entrar em backup, ProductStore, `CatalogDocument` ou print.
- Conteúdo, ênfase visual e largura são eixos independentes. `Destaque` não altera ordem nem largura; largura é modelada por slots (`simple=1`, `wide=2`, `full=todos`).
- `Hero` não é primitiva estrutural. Estado legado `emphasis: hero` deve migrar deterministicamente para `Destaque visual + Linha inteira`, sem regra especial de paginação ou reordenação.
- O planner não deve inferir importância a partir da geometria nem geometria a partir da importância. Um card largo pode ser visualmente normal e um Destaque pode ocupar um único slot.
- `Collection` e `Table` são blocos editoriais locais, nunca produtos remotos. Ambos contêm somente produtos selecionados de uma única categoria e não escrevem no ProductStore.
- Coleções e tabelas só podem consumir membros contíguos na ordem editorial efetiva da categoria. Agrupar/desagrupar não pode alterar membership; bloco inválido deve falhar para cards individuais, nunca ocultar produto.
- Reorder só existe pela lista. `Collection` e `Table` são unidades atômicas de reorder; membros não podem ser movidos individualmente para fora do bloco por drag.
- Reorder entre categorias é proibido no recorte atual. Busca textual ativa deve desabilitar reorder para evitar mover uma projeção parcial ambígua.
- Um produto não pode pertencer simultaneamente a `Collection` e `Table`. Em estado importado conflitante, o materializador deve resolver deterministicamente sem duplicar nem esconder produto.
- `Collection` é full-width top-level e atômica entre páginas, usa 2–4 colunas internas e no máximo 12 membros. Membros só recebem overrides locais discretos de largura e ênfase.
- `Table` é full-width top-level e fragmentável entre páginas. O cabeçalho tabular deve repetir em continuações. A fragmentação é calculada no modelo antes do DOM e nunca pode duplicar `orderedIds` ou `selectedCount`.
- `Table` usa somente colunas conhecidas e dados factuais existentes. Campos comerciais ausentes permanecem vazios; não sintetizar medidas, preços ou referências.
- Profundidade máxima de blocos = 1. Não criar container genérico nem permitir nesting para acomodar casos futuros; novos tipos top-level exigem um caso real e contrato explícito.
- `Card`, `Collection` e `Table` são o vocabulário estrutural preferido. Antes de criar um quarto primitivo, validar casos reais que não caibam nesses três.
- A ordem exibida na lista, no preview e no PDF deve derivar da mesma `CatalogOrder` consumida pelo `CatalogDocument`.
- Número de página é sempre calculado. A data do catálogo acompanha o dia local atual por padrão; somente `catalog.dateOverride` pode congelá-la explicitamente em outra data. Um `createdAt` legado não deve ser tratado como override implícito.
- O pipeline de documento é `state → CatalogOrder → CatalogDocument → preview / print`. Preview pode conter chrome editorial auxiliar; o documento print contém somente `.catalog-page`.
- `Composition.normalizePresentation`, `CatalogDocument.build` e `src/catalog-renderer.js` são as autoridades únicas de apresentação, materialização e render editorial. Módulos de Collection/Table não podem substituir essas funções por wrapping/monkey patch.
- O bootstrap editorial deve ser explícito no `index.html`; módulos de ordenação, controles ou UI não devem carregar scripts/CSS como efeito colateral.
- Trocas de aba materializadas por `App.switchTab` devem publicar `catalogotop:tab-changed` depois da atualização de tab/panel; chrome reparentado ou global deve reagir a esse lifecycle, não inferir transições por CSS ou posição DOM.
- Estilos estruturais do inspector pertencem a stylesheets estáticos. `PresentationActions` pode aplicar estado visual ao target, mas não deve injetar CSS em runtime.
- `renderSelection()` é a autoridade da lista `#selectableProducts`. Badges, ordem efetiva e handles de reorder devem nascer do render explícito; propriedades editoriais do objeto selecionado pertencem ao inspector contextual. Não reintroduzir `MutationObserver` para redecorar/reordenar essa lista.
- `PresentationActions` é a fronteira para mutações editoriais disparadas pelo inspector/lista. Não duplicar mutações equivalentes em managers paralelos de Collection/Table.
- Patches derivados de `MutationObserver` em outras superfícies precisam ser idempotentes e observar a menor fronteira DOM possível. Não observar e escrever indiscriminadamente sobre a mesma árvore.
- O botão de PDF não deve imprimir a aplicação inteira. A impressão deve usar documento/iframe isolado e stylesheet de print dedicado.
- CSS de shell/mobile não pode conter regras de A4, compositor ou `@media print`; CSS do compositor deve responder à largura real do painel quando a limitação for de container, não ao viewport.
- O preview pode aplicar zoom visual, mas a folha materializada e o documento print permanecem A4 físico `210 × 297 mm`.
- No preview touch, o container pode conter overscroll horizontal para inspecionar zoom, mas deve preservar pan/scroll vertical da página; seleção editorial por tap não pode capturar `pointerdown`/`touchstart` da folha A4.
- Mudanças que afetem impressão A4 devem ser verificadas por preview e por gate Chromium que compare páginas lógicas com páginas físicas.
- O Browser Print Gate é autoridade de documento físico/A4/scroll touch; o Browser Inspector Gate é autoridade das interações de seleção, inspector e reorder. Não manter controles/atributos editoriais obsoletos apenas para satisfazer o gate físico.
- Elementos institucionais essenciais do PDF não podem depender de "gráficos de fundo" do navegador; use bordas/SVG para linhas e sinais críticos.
- Exclusão de produto deve usar uma operação de domínio única. Ela remove o produto da base, membership, ordem editorial, overrides e memberships de blocos; `Collection`/`Table` com menos de dois membros é dissolvida. Não duplicar lógica de limpeza entre formulário e biblioteca.
- Assets gerenciados são content-addressed e imutáveis; exclusão de produto não apaga automaticamente blobs potencialmente compartilhados.
- Mantenha o aplicativo utilizável sem build obrigatório para o frontend; Functions Netlify podem usar dependências instaladas no deploy.
- Categorias funcionam como pastas de primeiro nível para navegação; não introduzir árvore hierárquica genérica sem um caso real que a justifique.
- No cadastro manual, categoria deve ser escolhida ou criada pelo mesmo campo sobrescrevível; não criar um CRUD paralelo de pastas vazias enquanto isso não for necessário.
- Presets de conteúdo, ênfase, largura, ordem e blocos pertencem ao catálogo local, nunca ao produto remoto. `Visual` e `Simples` são os defaults atuais para cards sem override.
- Enquadramento de imagem pertence à apresentação local (`presentation.imageFrames`), não ao asset/produto remoto. O renderer aplica o frame de forma não destrutiva ao uso editorial suportado; não promover esse estado ao ProductStore.
- `product.image` é o Original canônico e fallback de imagem. Escolhas editoriais, imports e derivados nunca podem sobrescrevê-lo silenciosamente.
- `product.imageGallery` contém somente alternativas fiéis e reutilizáveis aprovadas para o produto. Ela é semanticamente separada de `product.variants`, que continua representando cores/acabamentos comerciais.
- `presentation.imageVariants` contém derivados locais do catálogo. Importar um Result Bundle não promove automaticamente esses derivados para `Product.imageGallery`, não altera o produto remoto e não publica ProductStore.
- `presentation.imageSelections` é um override editorial esparso. Ausência ou referência obsoleta deve resolver deterministicamente para o Original. A seleção da imagem e `presentation.imageFrames` permanecem eixos independentes.
- A imagem escolhida é resolvida antes do framing e preview/print devem usar a mesma resolução. Cards com grade de imagens comerciais não devem receber simultaneamente um seletor concorrente de imagem principal.
- Chaves de placement do Variation Bundle devem derivar do modelo materializado (`CatalogDocument`), nunca da posição no DOM. A V1 suporta `card:<productId>` e `collection:<blockId>:member:<productId>`.
- `usageSignature` deve cobrir o contexto material do job: produto, placement, uso, target e hash da fonte. `requestId` não deve depender de metadados informativos/voláteis como `catalog.createdAt`; mudanças materiais de target/source/contexto continuam invalidando o pedido.
- `source.mode=remote-url` é apenas um locator canônico quando CORS impede embedding. O Request Bundle deve carregar um paved path de materialização local dos bytes; preview/web lookup não substitui pixel source, e consumidor sem capacidade de ingerir pixels reais deve falhar explicitamente em vez de aproximar a identidade do produto.
- ZIP de resultado externo é entrada não confiável. Validar pacote inteiro, paths, limites, CRC/compressão suportada, MIME pelos bytes, SHA-256, request/job/product/placement/signature e transformações permitidas antes de preparar, enviar ou mutar estado.
- Result Bundle aceita somente raster passivo PNG/JPEG/WebP no primeiro contrato. Não executar nem importar HTML/JS/SVG ativo por esse fluxo.
- A importação de Result Bundle pode solicitar sessão de escrita exclusivamente para armazenar blobs no AssetStore. Ela não pode usar essa sessão para publicar a base de produtos.
- Depois de uploads assíncronos, recalcular/revalidar o pedido antes do commit. Se o contexto mudou, falhar fechado sem mutação editorial; um blob content-addressed já enviado pode ficar órfão, mas não deve provocar importação parcial.
- O commit de resultado aceito deve ser uma única mutação em `presentation.imageVariants`. Reimport idêntico é idempotente; imagem nova não deve ser auto-selecionada.
- Backup JSON da V1 preserva estado completo, inclusive galeria, variantes locais, proveniência, seleções e framing. A sessão local de catálogo em elaboração não deve ser confundida com persistência futura de catálogos salvos.
- Persistência remota/filesystem de catálogos e a futura Biblioteca pertencem à V2. Não consolidar `localStorage` como solução de biblioteca/persistência de catálogos.
- Netlify está autorizado como backend **estreito** para a base compartilhada de produtos e assets. Não promover seleção atual, template escolhido, estado de UI ou catálogo em elaboração a estado remoto sem decisão explícita.
- Produtos remotos usam snapshot revisionado e escrita protegida; não fazer overwrite silencioso quando `expectedRevision` divergir.
- Deploy Preview nunca deve gravar no store global de produção. Produção usa store global; previews/branches usam store ligado ao deploy.
- Leitura da base pode ser pública; escrita deve exigir sessão curta validada no servidor. Segredos nunca entram no repositório ou bundle do navegador.
- Campos específicos da conta Netlify (site id, URL, domínio, previews) só podem ser documentados após readback; não inferir valores.

## Estado atual

Recorte v0.8 consolidado: cadastro/importação e ProductStore remoto v0.7, categorias por páginas, composição editorial determinística, `CatalogDocument` materializado, impressão isolada com gate Chromium A4, preview mobile com Fit/zoom e scroll touch validado.

Recorte v0.9 consolidado na `main`: `Hero` estrutural foi substituído por largura explícita em slots. `Destaque` é somente visual; `Simples`, `Largo` e `Linha inteira` controlam geometria independentemente. Estado legado de Hero migra para `Destaque visual + Linha inteira`.

Recorte v0.10.1 consolidado na `main`: `Collection` é o segundo primitivo top-level, full-width e atômico entre páginas, com grade local de 2–4 colunas, temas claro/escuro, presets Visual/Compacto/Comercial, overrides locais e paginação por `rowSpan`. Ver `docs/collection-block-v0.10.1.md`.

Recorte v0.10.2 consolidado na `main`: `Table` é o terceiro primitivo top-level, full-width e fragmentável com cabeçalho repetido, fontes Produtos/Linhas comerciais, colunas conhecidas e exclusão direta segura na biblioteca. A reconciliação também tornou idempotentes os patches DOM de Collection/Table, eliminando o ciclo entre observadores identificado pelo Browser Print Gate. Ver `docs/table-block-v0.10.2.md`.

Recorte v0.11.0 consolidado na `main`: `Composition`, `CatalogDocument` e o renderer editorial são fronteiras explícitas; wrappers globais, carregamento editorial dinâmico e observers de decoração de `#selectableProducts` foram removidos. Ver `docs/editor-runtime-boundaries-v0.11.0.md`.

Recorte v0.11.0.1 consolidado na `main`: o estado de sincronização permanece sempre visível e as ações secundárias de importação/backup/CSV foram consolidadas no menu `Dados`, sem alterar os contratos operacionais. Ver `docs/header-data-menu-v0.11.0.1.md`.

Recorte v0.11.1 consolidado na `main`: `selectedIds` representa membership, `presentation.order` representa ordem editorial persistida, `CatalogOrder` resolve a sequência antes do `CatalogDocument`, o preview seleciona Card/Collection/member/Table para um inspector contextual e o reorder acontece exclusivamente pela lista com Collection/Table como unidades atômicas. Ver `docs/contextual-inspector-v0.11.1.md`.

Recorte v0.11.1.1 consolidado na `main`: a data do catálogo acompanha o dia local atual por padrão e aceita um override date-only por um controle compacto `Hoje / escolher outra data`, sem alterar ProductStore ou o documento estrutural. Ver `docs/catalog-date-v0.11.1.1.md`.

Recorte v0.11.2 consolidado na `main`: enquadramento de imagem é apresentação local não destrutiva em `presentation.imageFrames`, com controles contextuais de fit/zoom/foco e paridade preview/print para usos suportados. Ver `docs/image-framing-v0.11.2.md` e os recortes de ergonomia v0.11.2.x.

Recorte v0.11.3.0 consolidado na `main`: comandos compactos do compositor, atalhos de Collection/Table e histórico editorial efêmero com undo/redo foram introduzidos sem alterar schema, ProductStore, `CatalogDocument` ou A4. Ver `docs/editor-shortcuts-history-v0.11.3.0.md`.

Recorte v0.11.3.1 consolidado na `main`: corrige o lifecycle de tabs usado pelo history mobile e reduz autoridades redundantes de runtime. `App.switchTab` publica `catalogotop:tab-changed`; CSS de comandos e framing usa bootstrap/stylesheet estático; browser gate cobre Catálogo → Produtos/Templates em mobile; `runtime-boundaries-fixture` impede regressão desses contratos. Ver `docs/editor-shortcuts-history-v0.11.3.0.md`.

Recorte v0.11.4 em estabilização: schema 7 introduz `Product.imageGallery`, seleção editorial e derivados locais sem substituir `product.image`; o inspector permite ciclar Original/alternativas/derivados; o Variation Bundle exporta request ZIP com contexto material e importa result ZIP fail-closed, transacional e local-only. Preview/print, framing, backup round-trip, ZIP e segurança possuem gates dedicados. Ver `docs/image-variants-v0.11.4.md`.

Primeira convergência com o Gerador V1: biblioteca institucional de ícones reaproveitada em `src/icons.js`; normalização/compilação determinística permanecem como princípios, sem portar o editor genérico.
