# AlexMultMarcas · Loja de roupas

Loja de roupas com catálogo, carrinho e finalização do pedido pelo WhatsApp,
mais um painel administrativo para cadastrar produtos (com foto JPG/PNG),
acompanhar o relatório de vendas e enviar a nota de compra ao cliente.

## Páginas

| Rota | O que é |
| --- | --- |
| `/` | Loja: catálogo, carrinho e checkout |
| `/admin` | Painel administrativo (senha `alex2025`) |

## Como funciona

- `index.html` + `assets/store.js` — catálogo com busca e categorias, carrinho
  (guardado no navegador), checkout e nota de compra.
- `admin.html` + `assets/admin.js` — login, cadastro/edição/exclusão de produtos
  com foto, relatório de vendas com filtro de período e exportação em CSV.
- `assets/common.js` — dinheiro, carrinho, textos do pedido/nota e links do WhatsApp.
- `server/` — API em Node (sem dependências): catálogo, pedidos e administração.

## Rodando

O ambiente é definido por `docker-compose.base44.yml` (repositório de configuração
do Base44): nginx na porta 3000 servindo o site e encaminhando `/api/` e `/uploads/`
para a API Node. Os dados (produtos, pedidos e fotos) ficam no volume `store-data`.

## Ajustes rápidos

- **Senha da administração:** `alex2025` (padrão em `server/index.js`, variável `ADMIN_PASSWORD`).
- **WhatsApp que recebe os pedidos:** `5521968015350` (variável `STORE_WHATSAPP`).
- **Nome da loja:** `AlexMultMarcas` (variável `STORE_NAME`).
