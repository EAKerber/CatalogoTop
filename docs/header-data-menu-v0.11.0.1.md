# v0.11.0.1 — Consolidação das utilidades do header

## Objetivo

Reduzir o ruído visual do header sem alterar os contratos de importação, backup ou sincronização. O estado da base compartilhada permanece visível; ações ocasionais de dados passam a um único menu contextual.

## Decisão de produto

O header diferencia **informação operacional persistente** de **ações secundárias**:

- `#productSyncStatus` continua sempre visível e mantém o comportamento atual de atualizar/reconciliar a base ao ser acionado;
- `Importar produtos`, modo da importação, CSV modelo, `Exportar backup` e `Importar backup` ficam agrupados em `Dados`;
- o modo `Mesclar por código / Substituir base` é apresentado dentro do menu porque configura a próxima importação e não é uma ação primária isolada.

## Contrato de compatibilidade

Os IDs usados pelo runtime permanecem idênticos:

- `importProductsFile`;
- `importMode`;
- `productSyncStatus`;
- `btnExportBackup`;
- `backupFile`.

Nenhum dado muda de autoridade e nenhuma operação de domínio é duplicada.

## Interação

O menu usa `details/summary` como primitiva nativa. Um helper pequeno fecha o menu ao clicar fora, pressionar Escape, concluir seleção de arquivo ou acionar uma ação que encerra a interação.

Em tablet/mobile o header passa a ter duas colunas lógicas na primeira linha (`marca | sincronização + Dados`) e as três tabs ocupam a segunda linha. O popover não participa do layout A4 e não entra no documento de impressão.

## Fora de escopo

- mudança no protocolo de sincronização;
- mudança em ProductStore;
- mudança no formato de backup/importação;
- inspector contextual;
- seleção pelo preview;
- enquadramento de imagem.
