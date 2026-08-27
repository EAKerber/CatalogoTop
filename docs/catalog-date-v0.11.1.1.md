# v0.11.1.1 — Data automática do catálogo

## Objetivo

Eliminar a data estática herdada da sessão de edição. A data exibida no catálogo e no PDF acompanha o dia atual por padrão, com uma sobrescrição explícita e local quando for necessário publicar um catálogo com outra data.

## Contrato de estado

- `catalog.dateOverride` é o único estado persistido de sobrescrição e usa `YYYY-MM-DD`.
- `catalog.createdAt` continua sendo a data efetiva consumida pelo renderer legado, mas é derivada novamente ao normalizar o estado.
- `dateOverride === ''` significa modo automático: `createdAt` representa o dia atual.
- Um `dateOverride` válido produz o `createdAt` correspondente e sobrevive a backup/importação.
- Um `createdAt` legado sem `dateOverride` não é interpretado como intenção editorial; ao abrir o catálogo ele volta ao modo automático.
- Novo catálogo limpa qualquer override e retorna ao modo automático.

## UX

O controle permanece compacto no bloco de metadados do compositor. O resumo mostra `Hoje · dd/mm/aaaa` no modo automático ou somente a data quando há sobrescrição.

Ao abrir o controle há duas ações:

1. `Hoje` — restaura o acompanhamento automático;
2. `Escolher outra data` — usa o `input[type=date]` nativo do navegador.

Não existe biblioteca de calendário, modal pesado ou calendário próprio. O popover serve apenas como superfície pequena para escolher entre `Hoje` e uma data explícita.

## Atualização automática

Enquanto o catálogo estiver em modo automático, a data é recalculada ao normalizar o estado e a UI agenda uma atualização após a virada local da meia-noite. Assim uma aba mantida aberta não conserva a data do dia anterior.

## Print

Preview e PDF recebem a mesma data efetiva através de `catalog.createdAt`. O popover, o picker e demais chrome do editor não entram no documento impresso.

## Limites

- A data é estado local do catálogo; não pertence ao ProductStore remoto.
- O override é somente data, sem hora ou timezone editorial configurável.
- O recorte não altera paginação, ordem editorial, Card, Collection, Table ou enquadramento de imagens.

## Gates

- `scripts/catalog-date-fixture.mjs`: normalização, data local automática, override date-only e formatação sem deslocamento de timezone.
- `scripts/browser-date-gate.mjs`: data antiga volta para hoje, override chega ao preview/PDF, backup normalizado preserva override, retorno a `Hoje` restaura o modo automático e o print permanece sem chrome.
