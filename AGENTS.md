# AGENTS.md — CatalogoTop

## Missão

Manter o CatalogoTop como um gerador de catálogo **simples, determinístico e orientado a produtos**.

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

## Estado atual

Recorte inicial: cadastro manual, importação CSV/Excel, seleção, três templates, paginação A4, impressão/PDF e backup JSON.
