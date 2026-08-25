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
- Paginação deve derivar do contrato do template e da ordem da seleção.
- Número de página e data de criação precisam ser calculados, nunca digitados em cada página.
- Mudanças que afetem impressão A4 devem ser verificadas em preview e em `@media print`.
- Mantenha o aplicativo utilizável sem build obrigatório.
- Netlify é uma camada de publicação do site estático, não justificativa para introduzir backend ou estado remoto. O contrato atual está em `netlify.toml` e `docs/netlify.md`.
- Campos específicos da conta Netlify (site id, URL, domínio, previews) só podem ser documentados após readback; não inferir valores.

## Estado atual

Recorte inicial: cadastro manual, importação CSV/Excel, seleção, três templates, paginação A4, impressão/PDF e backup JSON.

Primeira convergência com o Gerador V1: biblioteca institucional de ícones reaproveitada em `src/icons.js`; normalização/compilação determinística permanecem como princípios, sem portar o editor genérico.
