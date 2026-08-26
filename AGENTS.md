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
- Paginação deve derivar do contrato do template, das categorias e da ordem da seleção.
- Ênfase editorial é exceção explícita à ordem interna: dentro de uma categoria, `Hero` e `Destaque` podem subir ao topo de forma estável antes dos cards normais; não reordenar por outros critérios implícitos.
- Número de página e data de criação precisam ser calculados, nunca digitados em cada página.
- Mudanças que afetem impressão A4 devem ser verificadas em preview e em `@media print`.
- Mantenha o aplicativo utilizável sem build obrigatório para o frontend; Functions Netlify podem usar dependências instaladas no deploy.
- Categorias funcionam como pastas de primeiro nível para navegação; não introduzir árvore hierárquica genérica sem um caso real que a justifique.
- No cadastro manual, categoria deve ser escolhida ou criada pelo mesmo campo sobrescrevível; não criar um CRUD paralelo de pastas vazias enquanto isso não for necessário.
- Cards continuam sendo a unidade principal de apresentação. Variações de cor, especificações e tabelas devem caber no contrato do card/template antes de criar novos componentes complexos.
- Presets de conteúdo e ênfase pertencem ao catálogo local, nunca ao produto remoto. `Visual` é o default atual para cards sem override; ajustes em lote só alteram `catalog.presentation`.
- Netlify está autorizado como backend **estreito** para a base compartilhada de produtos e assets. Não promover seleção atual, template escolhido, estado de UI ou catálogo em elaboração a estado remoto sem decisão explícita.
- Produtos remotos usam snapshot revisionado e escrita protegida; não fazer overwrite silencioso quando `expectedRevision` divergir.
- Deploy Preview nunca deve gravar no store global de produção. Produção usa store global; previews/branches usam store ligado ao deploy.
- Assets gerenciados são objetos imutáveis/content-addressed. Não reintroduzir Base64 como formato normal de persistência de imagens.
- Leitura da base pode ser pública; escrita deve exigir sessão curta validada no servidor. Segredos nunca entram no repositório ou bundle do navegador.
- Campos específicos da conta Netlify (site id, URL, domínio, previews) só podem ser documentados após readback; não inferir valores.

## Estado atual

Recorte v0.7 consolidado: cadastro manual, importação CSV/Excel, categorias como pastas, seleção, três templates, cards com múltiplas cores e tabela comercial, paginação A4 orientada por categoria, impressão/PDF, backup JSON, ProductStore remoto via Netlify Functions + Blobs, cache local IndexedDB, sessão compartilhada de escrita, revisionamento e assets de imagem separados do JSON.

Recorte em desenvolvimento v0.8: composição editorial determinística em micrograde de seis colunas, presets de conteúdo e tipografia, ênfase `Destaque/Hero`, aplicação em lote, prioridade automática de destaques no topo e correção da regressão de páginas físicas vazias no Chromium.

Primeira convergência com o Gerador V1: biblioteca institucional de ícones reaproveitada em `src/icons.js`; normalização/compilação determinística permanecem como princípios, sem portar o editor genérico.
