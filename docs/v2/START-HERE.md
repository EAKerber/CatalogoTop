# CatalogoTop V2 — Start Here

Branch principal de evolução: **`v2`**  
Baseline estável V1: **`main@2ad3566033241ce2d8d4effd96d19b8fdbe513c9` / tag `v1.0.0`**.

## Estado atual

A linha V2 concluiu R1, R2, R3 e **R4a — Template Contract & Versioned Binding**.

Authority atual após a promoção do R4a:

- `v2@dc36f31029a7deb2b6bbb3003a8227717c2c1e77`;
- `main` permanece linha V1 estável e não é destino rotineiro de desenvolvimento V2.

Entregas consolidadas:

- **R1 — Product Library Foundation**: ProductSnapshot v2, árvore provider-scoped, Cadastro contextual e Biblioteca de produtos;
- **R2 — Saved Catalog Documents**: CatalogSnapshot/CatalogStore independentes, save/open/duplicate, dirty-state e administração por pastas;
- **R3 — Asset Library**: AssetIndex independente, inventory/usage autoritativos, provider `Imagens`, labels, pastas, busca/filtros, upload standalone deduplicado e reuso no Cadastro;
- **R4a — Template Contract & Versioned Binding**: TemplateContract v1 bounded, built-ins versionados, binding persistido `templateId + templateVersion`, resolução fail-closed, budgets declarativos e chrome institucional app-owned.

## Ordem de leitura

1. `docs/v2/START-HERE.md` — bootstrap e fronteiras atuais;
2. `docs/v2/ROADMAP.md` — dependências e sequência de produto;
3. `docs/v2/R4A-CLOSEOUT.md` — estado fechado do contrato/version binding de templates;
4. `docs/v2/R4A-TEMPLATE-CONTRACT-INTENT.md` — contrato original do recorte;
5. `docs/v2/R3-CLOSEOUT.md` e `docs/v2/R2-CLOSEOUT.md` — authorities já estabilizadas;
6. intents R1/R2/R3 quando precisar entender decisões históricas específicas.

## Authorities V2

```text
Biblioteca UI
  ├─ Produtos   -> ProductStore / ProductSnapshot
  ├─ Catálogos  -> CatalogStore / CatalogSnapshot
  └─ Imagens    -> AssetIndexStore / AssetIndexSnapshot

Bytes de imagem -> AssetStore content-addressed (sha256), imutável
Usage de imagem -> projeção de ProductSnapshot + CatalogSnapshot persistidos
Templates built-in -> TemplateRegistry / TemplateContract versionado, app-owned
```

R4a **não** cria TemplateStore/TemplateSnapshot persistente. Isso pertence ao próximo recorte de templates, caso autorizado.

`FolderTree` é vocabulário puro reutilizável, não uma authority global. Cada provider mantém namespace e revisão próprios.

## Invariantes

- Produto e apresentação permanecem separados.
- Resource identity permanece estável através de move/rename organizacional.
- Revisions são provider-scoped; não criar um conflito global de Biblioteca.
- O Core é sessão materializada de edição, não banco autoritativo de recursos.
- O pipeline A4 continua `state -> CatalogOrder -> CatalogDocument -> preview/print`.
- Catálogos persistem referência exata `templateId + templateVersion`; versão desconhecida falha fechado.
- TemplateContract é data bounded: sem HTML/CSS/JS, selectors, stylesheet URLs ou XY arbitrário.
- Header/footer institucional são primitives app-owned; templates apenas referenciam IDs suportados.
- Preview e print consomem o mesmo CatalogDocument/template resolvido.
- Assets gerenciados são content-addressed e imutáveis. Metadata/organização não altera bytes nem hash.
- Uso de assets deriva de ProductSnapshot/CatalogSnapshot persistidos, nunca do Core local.
- `Sem uso` é accounting, não autorização para exclusão física.
- Deploy Preview/branch nunca grava no store global de produção.
- `main` continua somente leitura para a missão V2 atual até decisão explícita de release.

## Ambiente de teste V2

O projeto Netlify `catalogotop-v2-test` foi re-semeado operacionalmente a partir do ProductSnapshot V1 depois de o acervo V2 de teste ser limpo. A migração foi one-shot e não faz parte do runtime final.

Verificação ao vivo do reseed:

- V1 revision 187 / 25 produtos;
- V2 ProductSnapshot schema 2 / 25 produtos / 3 pastas;
- payload de produto preservado, acrescentando apenas `folderId` derivado pela migração determinística R1;
- 23 referências de imagem não vazias verificadas como disponíveis;
- 0 referências `picsum.photos` remanescentes.

Nenhuma scheduled function ou endpoint de migração permanece ativo após o reseed.

## Backup legado

O backup JSON continua sendo transporte compatível do estado monolítico legado e passa por `Core.migrate`. Importá-lo limpa a identidade de catálogo salvo, portanto a composição restaurada volta como sessão não salva e pode ser persistida pelo CatalogStore.

O backup não é uma authority V2.

## Próximo ponto de decisão — R4b

O próximo recorte direcional é **R4b — Template Library & Immutable Versions**.

Antes de implementar R4b, preservar as fronteiras já provadas:

- TemplateStore/TemplateSnapshot devem ter revisão independente;
- `Biblioteca > Templates` não cria nova tab principal;
- built-ins são fontes imutáveis; edição de um template publicado cria nova versão;
- catálogo só muda de versão por upgrade explícito;
- recursos persistidos continuam sendo apenas dados validados pelo TemplateContract;
- nenhuma reabertura de HTML/CSS/JS arbitrário ou editor XY.

A presença de R4b no roadmap não substitui autorização explícita para o recorte.
