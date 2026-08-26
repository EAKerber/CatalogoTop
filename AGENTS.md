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
- `Collection` é um bloco editorial local, não um produto. Ele contém apenas produtos selecionados de uma única categoria, não pode conter outro bloco e não escreve no ProductStore.
- Coleções só podem consumir membros contíguos na ordem factual da categoria. Agrupar/desagrupar não pode alterar `selectedIds`; bloco inválido deve falhar para cards individuais, nunca ocultar produto.
- No v0.10.1 uma coleção é full-width top-level, atômica entre páginas, usa 2–4 colunas internas e no máximo 12 membros. Membros só recebem overrides locais discretos de largura e ênfase.
- Profundidade máxima de blocos = 1. Não criar container genérico nem permitir nesting para acomodar casos futuros; novos tipos top-level precisam de contrato explícito (`Table` é o próximo candidato previsto).
- A ordem exibida no compositor, no preview e no PDF deve derivar do mesmo `CatalogDocument`; `selectedIds` continua sendo estado factual/local e não deve ser mutado apenas para "parecer" uma ordem editorial.
- Número de página e data de criação precisam ser calculados, nunca digitados em cada página.
- O pipeline de documento é `state → CatalogDocument → preview / print`. Preview pode conter chrome editorial auxiliar; o documento print contém somente `.catalog-page`.
- O botão de PDF não deve imprimir a aplicação inteira. A impressão deve usar documento/iframe isolado e stylesheet de print dedicado.
- CSS de shell/mobile não pode conter regras de A4, compositor ou `@media print`; CSS do compositor deve responder à largura real do painel quando a limitação for de container, não ao viewport.
- O preview pode aplicar zoom visual, mas a folha materializada e o documento print permanecem A4 físico `210 × 297 mm`.
- No preview touch, o container pode conter overscroll horizontal para inspecionar zoom, mas deve preservar pan/scroll vertical da página; não capturar o gesto vertical iniciado sobre a folha A4.
- Mudanças que afetem impressão A4 devem ser verificadas por preview e por gate Chromium que compare páginas lógicas com páginas físicas.
- Elementos institucionais essenciais do PDF não podem depender de "gráficos de fundo" do navegador; use bordas/SVG para linhas e sinais críticos.
- Mantenha o aplicativo utilizável sem build obrigatório para o frontend; Functions Netlify podem usar dependências instaladas no deploy.
- Categorias funcionam como pastas de primeiro nível para navegação; não introduzir árvore hierárquica genérica sem um caso real que a justifique.
- No cadastro manual, categoria deve ser escolhida ou criada pelo mesmo campo sobrescrevível; não criar um CRUD paralelo de pastas vazias enquanto isso não for necessário.
- `Card`, `Collection` e futuramente `Table` são o vocabulário estrutural preferido. Variações de cor, especificações e tabelas devem caber nesses contratos antes de criar novos componentes complexos.
- Presets de conteúdo, ênfase, largura e blocos pertencem ao catálogo local, nunca ao produto remoto. `Visual` e `Simples` são os defaults atuais para cards sem override.
- Netlify está autorizado como backend **estreito** para a base compartilhada de produtos e assets. Não promover seleção atual, template escolhido, estado de UI ou catálogo em elaboração a estado remoto sem decisão explícita.
- Produtos remotos usam snapshot revisionado e escrita protegida; não fazer overwrite silencioso quando `expectedRevision` divergir.
- Deploy Preview nunca deve gravar no store global de produção. Produção usa store global; previews/branches usam store ligado ao deploy.
- Assets gerenciados são objetos imutáveis/content-addressed. Não reintroduzir Base64 como formato normal de persistência de imagens.
- Leitura da base pode ser pública; escrita deve exigir sessão curta validada no servidor. Segredos nunca entram no repositório ou bundle do navegador.
- Campos específicos da conta Netlify (site id, URL, domínio, previews) só podem ser documentados após readback; não inferir valores.

## Estado atual

Recorte v0.8 consolidado: cadastro/importação e ProductStore remoto v0.7, categorias por páginas, composição editorial determinística, `CatalogDocument` materializado, impressão isolada com gate Chromium A4, preview mobile com Fit/zoom e scroll touch validado.

Recorte v0.9 em promoção: substituir a semântica estrutural de `Hero` por largura explícita em slots. `Destaque` passa a ser somente visual; `Simples`, `Largo` e `Linha inteira` controlam geometria de forma independente e preservam a ordem factual da seleção. O estado legado de Hero migra para `Destaque visual + Linha inteira`.

Recorte v0.10.1 em desenvolvimento sobre a fundação v0.9: adicionar `Collection` como bloco visual composto full-width, com grade local de 2–4 colunas, temas claro/escuro, presets Visual/Compacto/Comercial, overrides locais de largura/ênfase e paginação atômica por `rowSpan`. Ver `docs/collection-block-v0.10.1.md`.

Primeira convergência com o Gerador V1: biblioteca institucional de ícones reaproveitada em `src/icons.js`; normalização/compilação determinística permanecem como princípios, sem portar o editor genérico.
