# Dropmai — modelo de dados

Schema Prisma vive em **`Dropmai_Backend/prisma/schema.prisma`** (não no frontend).

## Entidades

- **User / Account / StoreMember** — vendedor e papéis por loja
- **Store** — `slug` único (= subdomínio), `status` DRAFT|ACTIVE|SUSPENDED
- **CustomDomain** — domínio, `verificationStatus`, `isPrimary`
- **Supplier** — seed `code=xnamai`
- **Product / ProductVariant** — catálogo canônico importado do fornecedor
- **StoreProduct** — listing do vendedor (preço, markup, `publishedOnSite`)
- **MarketplaceAccount** — credenciais placeholder ML/Shopee/Amazon por loja
- **MarketplaceListing** — StoreProduct ↔ marketplace + `externalListingId` + `syncStatus`
- **Order / OrderItem** — canais STOREFRONT | MERCADO_LIVRE | SHOPEE | AMAZON | MANUAL
- **CatalogSyncRun** — auditoria de sync de fornecedor

## Mapeamento Xnamai → Product

| Dropmai | Mercos Adaptor | BI `/api/v1/products` |
|---|---|---|
| `externalId` | `id` | `mercos_id` / `id` |
| `sku` | `codigo` | `code` |
| `title` | `nome` | `name` |
| `costPrice` | `preco_tabela` | `list_price` / `price` |
| `stock` | `saldo_estoque` | `stock` |
| `imageHashes` | `imagens` / hashes | — |
| `active` | `ativo` | `active` |

`StoreProduct.sellPrice` inicia com markup **35%** sobre `costPrice`.

## Projetos

- Backend aplica migrations e expõe REST
- Frontend consome JSON; sem Prisma no front
