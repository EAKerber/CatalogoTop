# CatalogoTop

Gerador simplificado de catálogos A4 para a Top Mobili.

A aplicação parte de um princípio deliberadamente menor que um editor livre: **produtos são cadastrados/importados, selecionados e distribuídos automaticamente em cards por templates determinísticos**. Cabeçalho, rodapé, paginação e data de criação são componentes padrão compartilhados por todas as páginas.

## Fluxo atual

1. Cadastre produtos manualmente ou importe CSV/XLSX/XLS/XLSM.
2. Selecione os produtos que farão parte do catálogo.
3. Dê um título à categoria e escolha um template.
4. Revise a paginação A4 gerada automaticamente.
5. Use **Gerar PDF / Imprimir**.

O estado é salvo no `localStorage` e pode ser exportado/importado como backup JSON.

## Importação

Campos reconhecidos por aliases em português:

- `codigo` / `sku` / `referencia` → código;
- `descricao` / `produto` / `nome` → descrição;
- `categoria`, `subcategoria`, `preco`, `status`, `imagem`, `observacoes`;
- qualquer outra coluna não vazia é preservada como **especificação** do produto.

Código e descrição são obrigatórios. Linhas inválidas são reportadas antes da confirmação da importação.

O arquivo [`examples/produtos-modelo.csv`](examples/produtos-modelo.csv) contém apenas o cabeçalho-base, sem inventar dados comerciais.

## Templates

A primeira versão inclui:

- **Técnico 2×4** — 8 cards por página;
- **Compacto 3×4** — 12 cards por página;
- **Destaque 2×3** — 6 cards por página.

Um template altera densidade e tratamento do card. Ele **não duplica** o cabeçalho/rodapé institucional.

## Relação com o Gerador V1

O projeto `EAKerber/Gerador_de_catalogos_v1_AI` foi auditado como fonte somente leitura, na baseline `main@050589347e55613182a00ed1e22f6efd2f1a2540`.

O CatalogoTop não é um fork do editor. Reaproveita apenas componentes e princípios que sobrevivem à simplificação. A primeira reutilização concreta é o subconjunto da biblioteca vetorial institucional em `src/icons.js`; conceitos de normalização, compilação determinística, tokens e preflight de impressão são mantidos seletivamente.

A matriz de decisão está em [`docs/reuse-from-gerador-v1.md`](docs/reuse-from-gerador-v1.md).

## Execução local

Não há build obrigatório. Sirva a pasta por HTTP e abra `index.html`.

```bash
python -m http.server 8000
```

A importação Excel usa SheetJS 0.18.5 via CDN. CSV e o restante da aplicação continuam funcionais sem essa dependência externa.

## Netlify

O repositório inclui `netlify.toml` para manter o deploy estático e usar `npm test` como gate de publicação:

```toml
[build]
  command = "npm test"
  publish = "."
```

A política operacional, campos pendentes de readback e checklist de Deploy Preview/produção estão em [`docs/netlify.md`](docs/netlify.md).

## Validação

```bash
npm test
```

O teste é propositalmente leve e sem dependências: verifica sintaxe JavaScript e contratos estáticos essenciais, incluindo A4, templates, importação, biblioteca de ícones e configuração Netlify.

## Estrutura

- `index.html` — shell da aplicação;
- `styles.css` — UI, templates e impressão A4;
- `src/core.js` — estado, persistência e normalização;
- `src/importer.js` — CSV/Excel e mapeamento de colunas;
- `src/templates.js` — registro de templates;
- `src/icons.js` — subconjunto vetorial institucional reaproveitado do V1;
- `src/render.js` — paginação e componentes A4;
- `src/app.js` — interação da interface;
- `assets/logo-top-mobili.svg` — wordmark vetorial baseado na referência fornecida;
- `docs/architecture.md` — decisões e limites do paradigma simplificado;
- `docs/reuse-from-gerador-v1.md` — auditoria do que portar e do que rejeitar;
- `docs/netlify.md` — contrato de deploy e operação Netlify;
- `netlify.toml` — configuração versionada de publicação.
