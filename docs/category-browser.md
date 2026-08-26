# Categorias como pastas

## Intenção

A base de produtos usa **categoria** como a primeira camada de organização visual, semelhante a pastas de um filesystem, sem transformar o aplicativo em um gerenciador hierárquico complexo.

## Comportamento atual

- cada produto pertence a uma categoria;
- no cadastro manual, **Categoria** é obrigatória;
- o campo usa um `datalist`: o usuário pode escolher uma categoria existente ou simplesmente digitar um nome novo;
- a nova categoria passa a existir quando o produto é salvo; não há cadastro separado de pasta vazia;
- produtos importados sem categoria são normalizados para `Sem categoria`, evitando itens órfãos fora da navegação;
- a lateral da base lista `Todos os produtos` e uma pasta para cada categoria, com contagem;
- clicar numa pasta reaproveita o filtro de categoria já existente, sem introduzir um segundo mecanismo de busca;
- `Subcategoria` continua sendo metadado do produto neste recorte e não cria níveis aninhados de pasta.

## Decisão de escopo

Por enquanto, categorias não possuem ID próprio, cor, ícone customizável, permissões, drag-and-drop, ordenação manual nem hierarquia arbitrária. O valor canônico continua sendo `product.category`.

Isso é deliberado: a metáfora de pasta serve para **navegar e cadastrar com menos atrito**, não para recriar um filesystem completo.

Se uma necessidade real de hierarquia surgir, o próximo passo deverá partir de exemplos concretos (por exemplo `Ferragens > Corrediças > Telescópicas`) e decidir se `subcategory` é suficiente antes de introduzir uma árvore genérica.
