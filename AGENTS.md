# AGENTS.md — CatalogoTop

## Missão

Manter o CatalogoTop como um gerador de catálogo **simples, determinístico e orientado a produtos**.

## Repositórios e proveniência

- Este repositório, `EAKerber/CatalogoTop`, é o alvo de desenvolvimento.
- `EAKerber/Gerador_de_catalogos_v1_AI` é fonte de referência **somente leitura** neste trabalho. Não escrever, abrir branches ou alterar PRs nele sem nova autorização explícita.
- Ao reaproveitar código ou contrato do Gerador V1, registrar a origem e manter apenas a parte necessária ao paradigma simplificado.
- A auditoria inicial de reuso está em `docs/reuse-from-gerador-v1.md`.

## Guardrails

- Não reintroduzir editor livre, drag-and-drop, layers ou posicionamento arbitrário sem decisão explícita de produto.
- Produto e apresentação permanecem separados.
- Não inventar preço, especificação, disponibilidade ou qualquer outro fato comercial.
- Código e descrição são a validação mínima para importação.
- Colunas desconhecidas de planilha devem ser preservadas como especificações quando possível, não descartadas silenciosamente.
- Header/footer são componentes compartilhados. Templates não devem copiá-los.
- Paginação deve derivar do contrato do template, das categorias, da ordem da seleção e, quando aplicável, do planner editorial determinístico.
- Número de página e data de criação precisam ser calculados, nunca digitados em cada página.
- Mudanças que afetem impressão A4 devem ser verificadas em preview e em `@media print`.
- O print guard de Chromium pode reservar até 1 mm da altura física para impedir páginas fantasmas; não remover sem repetir o gate PDF que compara páginas lógicas e físicas.
- Mantenha o aplicativo utilizável sem build obrigatório para o frontend; Functions Netlify podem usar dependências instaladas no deploy.
- Categorias funcionam como pastas de primeiro nível para navegação; não introduzir árvore hierárquica genérica sem um caso real que a justifique.
- No cadastro manual, categoria deve ser escolhida ou criada pelo mesmo campo sobrescrevível; não criar um CRUD paralelo de pastas vazias enquanto isso não for necessário.
- Cards continuam sendo a unidade principal de apresentação. Variações de cor, especificações e tabelas devem caber no contrato do card/template antes de criar novos componentes complexos.
- Presets de conteúdo, ênfase, distribuição e tipografia pertencem ao catálogo local, não ao `ProductStore` remoto.
- A composição usa micrograde discreta de seis colunas e posições calculadas; não persistir coordenadas, larguras livres ou alturas livres.
- Não usar `grid-auto-flow: dense` ou outra técnica que possa reordenar visualmente a seleção. Preenchimento deve ser calculado preservando ordem.
- `Auto` para conteúdo deve permanecer regra determinística e explicável, sem IA ou heurística externa.
- Netlify está autorizado como backend **estreito** para a base compartilhada de produtos e assets. Não promover seleção atual, template escolhido, estado de UI ou catálogo em elaboração a estado remoto sem decisão explícita.
- Produtos remotos usam snapshot revisionado e escrita protegida; não fazer overwrite silencioso quando `expectedRevision` divergir.
- Deploy Preview nunca deve gravar no store global de produção. Produção usa store global; previews/branches usam store ligado ao deploy.
- Assets gerenciados são objetos imutáveis/content-addressed. Não reintroduzir Base64 como formato normal de persistência de imagens.
- Leitura da base pode ser pública; escrita deve exigir sessão curta validada no servidor. Segredos nunca entram no repositório ou bundle do navegador.
- Campos específicos da conta Netlify (site id, URL, domínio, previews) só podem ser documentados após readback; não inferir valores.

## Estado atual

Recorte v0.7 consolidado: cadastro/importação, categorias como pastas, seleção e paginação por categoria, três templates, cards com variações/tabela comercial, Netlify ProductStore + Blobs, cache IndexedDB, sessão compartilhada de escrita, revisionamento e assets de imagem separados do JSON.

Recorte em desenvolvimento v0.8: composição editorial determinística com presets de conteúdo (`Auto`, `Padrão`, `Visual`, `Técnico`, `Comercial`), ênfase discreta (`Normal`, `Destaque`, `Hero`), distribuição (`Compacta`, `Balanceada`, `Editorial`), tipografia global de cards, micrograde de seis colunas e correção de páginas físicas vazias no PDF.

Sequências/grupos multi-produto continuam fora do primeiro corte v0.8 até os presets e o planner passarem pelo gate visual real.

Primeira convergência com o Gerador V1: biblioteca institucional de ícones reaproveitada em `src/icons.js`; normalização/compilação determinística permanecem como princípios, sem portar o editor genérico.
