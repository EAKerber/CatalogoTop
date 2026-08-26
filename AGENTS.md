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
- Não reintroduzir editor livre, drag-and-drop, layers ou posicionamento arbitrário sem decisão explícita de produto.
- Produto e apresentação permanecem separados.
- Não inventar preço, especificação, disponibilidade ou qualquer outro fato comercial.
- Código e descrição são a validação mínima para importação.
- Colunas desconhecidas de planilha devem ser preservadas como especificações quando possível, não descartadas silenciosamente.
- Header/footer são componentes compartilhados. Templates não devem copiá-los.
- Paginação deve derivar do contrato do template, das categorias, da ordem factual da seleção e da geometria declarada das unidades editoriais.
- Conteúdo, ênfase visual e largura são eixos independentes. `Destaque` não altera ordem nem largura; largura é modelada por slots (`simple=1`, `wide=2`, `full=todos`).
- `Hero` não é primitiva estrutural. Estado legado `emphasis: hero` deve migrar deterministicamente para `Destaque visual + Linha inteira`, sem regra especial de paginação ou reordenação.
- O planner não deve inferir importância a partir da geometria nem geometria a partir da importância. Um card largo pode ser visualmente normal e um Destaque pode ocupar um único slot.
- `Collection` e `Table` são blocos editoriais locais, nunca produtos remotos. Ambos contêm somente produtos selecionados de uma única categoria e não escrevem no ProductStore.
- Coleções e tabelas só podem consumir membros contíguos na ordem factual da categoria. Agrupar/desagrupar não pode alterar `selectedIds`; bloco inválido deve falhar para cards individuais, nunca ocultar produto.
- Um produto não pode pertencer simultaneamente a `Collection` e `Table`. Em estado importado conflitante, o materializador deve resolver deterministicamente sem duplicar nem esconder produto.
- `Collection` é full-width top-level e atômica entre páginas, usa 2–4 colunas internas e no máximo 12 membros. Membros só recebem overrides locais discretos de largura e ênfase.
- `Table` é full-width top-level e fragmentável entre páginas. O cabeçalho tabular deve repetir em continuações. A fragmentação é calculada no modelo antes do DOM e nunca pode duplicar `orderedIds` ou `selectedCount`.
- `Table` usa somente colunas conhecidas e dados factuais existentes. Campos comerciais ausentes permanecem vazios; não sintetizar medidas, preços ou referências.
- Profundidade máxima de blocos = 1. Não criar container genérico nem permitir nesting para acomodar casos futuros; novos tipos top-level exigem um caso real e contrato explícito.
- `Card`, `Collection` e `Table` são o vocabulário estrutural preferido. Antes de criar um quarto primitivo, validar casos reais que não caibam nesses três.
- A ordem exibida no compositor, no preview e no PDF deve derivar do mesmo `CatalogDocument`; `selectedIds` continua sendo estado factual/local e não deve ser mutado apenas para "parecer" uma ordem editorial.
- Número de página e data de criação precisam ser calculados, nunca digitados em cada página.
- O pipeline de documento é `state → CatalogDocument → preview / print`. Preview pode conter chrome editorial auxiliar; o documento print contém somente `.catalog-page`.
- O botão de PDF não deve imprimir a aplicação inteira. A impressão deve usar documento/iframe isolado e stylesheet de print dedicado.
- CSS de shell/mobile não pode conter regras de A4, compositor ou `@media print`; CSS do compositor deve responder à largura real do painel quando a limitação for de container, não ao viewport.
- O preview pode aplicar zoom visual, mas a folha materializada e o documento print permanecem A4 físico `210 × 297 mm`.
- No preview touch, o container pode conter overscroll horizontal para inspecionar zoom, mas deve preservar pan/scroll vertical da página; não capturar o gesto vertical iniciado sobre a folha A4.
- Mudanças que afetem impressão A4 devem ser verificadas por preview e por gate Chromium que compare páginas lógicas com páginas físicas.
- Elementos institucionais essenciais do PDF não podem depender de "gráficos de fundo" do navegador; use bordas/SVG para linhas e sinais críticos.
- Patches derivados de `MutationObserver` no compositor precisam ser idempotentes: não remover e recriar badges/controles quando o estado efetivo não mudou. Observadores da lista devem acompanhar a menor fronteira DOM necessária para evitar ciclos de feedback entre extensões.
- Exclusão de produto deve usar uma operação de domínio única. Ela remove o produto da base, seleção, overrides e memberships; `Collection`/`Table` com menos de dois membros é dissolvida. Não duplicar lógica de limpeza entre formulário e biblioteca.
- Assets gerenciados são content-addressed e imutáveis; exclusão de produto não apaga automaticamente blobs potencialmente compartilhados.
- Mantenha o aplicativo utilizável sem build obrigatório para o frontend; Functions Netlify podem usar dependências instaladas no deploy.
- Categorias funcionam como pastas de primeiro nível para navegação; não introduzir árvore hierárquica genérica sem um caso real que a justifique.
- No cadastro manual, categoria deve ser escolhida ou criada pelo mesmo campo sobrescrevível; não criar um CRUD paralelo de pastas vazias enquanto isso não for necessário.
- Presets de conteúdo, ênfase, largura e blocos pertencem ao catálogo local, nunca ao produto remoto. `Visual` e `Simples` são os defaults atuais para cards sem override.
- Netlify está autorizado como backend **estreito** para a base compartilhada de produtos e assets. Não promover seleção atual, template escolhido, estado de UI ou catálogo em elaboração a estado remoto sem decisão explícita.
- Produtos remotos usam snapshot revisionado e escrita protegida; não fazer overwrite silencioso quando `expectedRevision` divergir.
- Deploy Preview nunca deve gravar no store global de produção. Produção usa store global; previews/branches usam store ligado ao deploy.
- Leitura da base pode ser pública; escrita deve exigir sessão curta validada no servidor. Segredos nunca entram no repositório ou bundle do navegador.
- Campos específicos da conta Netlify (site id, URL, domínio, previews) só podem ser documentados após readback; não inferir valores.

## Estado atual

Recorte v0.8 consolidado: cadastro/importação e ProductStore remoto v0.7, categorias por páginas, composição editorial determinística, `CatalogDocument` materializado, impressão isolada com gate Chromium A4, preview mobile com Fit/zoom e scroll touch validado.

Recorte v0.9 consolidado na `main`: `Hero` estrutural foi substituído por largura explícita em slots. `Destaque` é somente visual; `Simples`, `Largo` e `Linha inteira` controlam geometria independentemente. Estado legado de Hero migra para `Destaque visual + Linha inteira`.

Recorte v0.10.1 consolidado na `main`: `Collection` é o segundo primitivo top-level, full-width e atômico entre páginas, com grade local de 2–4 colunas, temas claro/escuro, presets Visual/Compacto/Comercial, overrides locais e paginação por `rowSpan`. Ver `docs/collection-block-v0.10.1.md`.

Recorte v0.10.2 em promoção: `Table` é o terceiro primitivo top-level, full-width e fragmentável com cabeçalho repetido, fontes Produtos/Linhas comerciais, colunas conhecidas e exclusão direta segura na biblioteca. A branch foi reconciliada sobre a `main` após a promoção de Collection e os patches DOM de blocos foram tornados idempotentes para eliminar ciclos entre observadores. Ver `docs/table-block-v0.10.2.md`.

Primeira convergência com o Gerador V1: biblioteca institucional de ícones reaproveitada em `src/icons.js`; normalização/compilação determinística permanecem como princípios, sem portar o editor genérico.
