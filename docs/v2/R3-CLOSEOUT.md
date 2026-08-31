# CatalogoTop V2 — R3 Asset Library closeout

## Resultado

R3 está encerrado após R3a + R3b em `v2@193c65b3d976983867484014118c84cd360f0c2c`.

O objetivo foi atendido sem substituir o AssetStore content-addressed nem introduzir lifecycle destrutivo de blobs: imagens gerenciadas agora são recursos descobríveis, nomeáveis, pesquisáveis, organizáveis e reutilizáveis por uma authority de índice separada.

## Capacidades entregues

### R3a — inventory e reuse foundation

- `AssetIndexSnapshot v1` / `AssetIndexStore` com revisão, cache, expectedRevision, readback e conflito próprios;
- Blob store de índice separado dos bytes;
- `/api/asset-inventory` read-only derivado de ProductSnapshot + CatalogSnapshot + metadata física;
- inventory = assets indexados ∪ hashes gerenciados encontrados por usage autoritativo;
- provider `Imagens` dentro da Biblioteca;
- labels humanas;
- picker Cadastro → Biblioteca → Cadastro reutilizando a mesma URL SHA-256 sem novo upload;
- nenhuma revisão de ProductStore/CatalogStore acoplada ao índice.

### R3b — organização e ingest

- `AssetQuery` com busca, pasta/subpastas, `Sem pasta` e `Todos | Em uso | Sem uso`;
- folders provider-scoped usando o schema v1 já reservado;
- criar/renomear/mover/excluir somente pasta vazia;
- multiseleção e batch move em uma revisão do AssetIndex;
- adoção no índice de asset antes descoberto somente por usage, sem copiar/re-enviar bytes;
- upload standalone reutilizando `AssetClient.prepareImage` + `/api/assets`;
- deduplicação física por hash preservada;
- reupload de hash já indexado não renomeia, move nem duplica metadata humana;
- projeção local de metadata pending sem inventar usages locais;
- mobile `Pastas | Imagens`, mantendo Imagens como view inicial/picker;
- gate browser R3b integrado à regressão física completa.

## Authorities consolidadas

```text
AssetStore
  bytes imutáveis content-addressed por sha256

AssetIndexStore / AssetIndexSnapshot
  label + organização + revisão de metadata

AssetUsage / asset-inventory
  ProductSnapshot + CatalogSnapshot persistidos -> referências por hash
```

ProductStore, CatalogStore e AssetIndexStore continuam domínios de revisão independentes. Compartilhar write-session não compartilha revisão ou ownership.

## Decisões consolidadas

1. SHA-256 é identidade física estável do asset gerenciado.
2. Mover/renomear organização não altera hash, URL ou bytes.
3. Usage é projeção derivada; não persistir contador que fique stale.
4. Usage de Biblioteca nunca deriva do Core/session local.
5. Um asset descoberto por usage pode ser adotado no índice sem upload.
6. Upload standalone não cria segundo armazenamento; reutiliza `/api/assets`.
7. Falha depois de upload físico não deve ser compensada por delete de blob; o resultado seguro é blob órfão + candidate de metadata preservado quando aplicável.
8. `Sem uso` significa apenas ausência de referências autoritativas correntes conhecidas. Não é prova de que o blob pode ser apagado.
9. R3 não introduz `DELETE /api/assets` nem garbage collection.

## Auditoria de encerramento

O critério de R3 foi revisado após a promoção de R3b:

- adicionar asset: coberto;
- descobrir assets pré-R3 por usage: coberto;
- nomear/renomear metadata humana: coberto;
- buscar por label/hash/path/owner: coberto;
- organizar em árvore e mover em batch: coberto;
- distinguir em uso/sem uso por snapshots persistidos: coberto;
- reutilizar no Cadastro sem duplicar bytes: coberto;
- deduplicar reupload: coberto;
- preservar ProductStore/CatalogStore/A4: coberto pelos gates completos.

Não foi encontrada uma necessidade funcional concreta que justifique um R3c destrutivo. Garbage collection permanece uma decisão futura condicionada a política explícita de retenção/limpeza, não uma pendência automática de R3.

## Gates de fechamento

R3b foi promovido pelo PR #58 com head `56b206900318ce9f5e3cf2256992cc9464d0cfe8` após:

- Validate push #991 — success;
- Browser Print Gate push #802 — success;
- Validate PR #992 — success;
- Browser Print Gate PR #803 — success;
- `behind_by=0` contra `v2`;
- mergeability confirmada;
- squash com expected head SHA.

Merge resultante: `v2@193c65b3d976983867484014118c84cd360f0c2c`.

`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` permaneceu intocada.

## Próximo ponto de decisão

O próximo marco direcional do roadmap é **R4 — Constrained Template System 2.0**.

R4 não é iniciado por este closeout. Ele deve começar por uma revisão/planejamento explícitos do contrato atual de templates, renderer e dependências institucionais antes de qualquer implementação.
