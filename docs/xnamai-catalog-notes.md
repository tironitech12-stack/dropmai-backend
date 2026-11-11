---
cursor:
  subagentId: "bc-89711a3d-270f-5d03-91b5-86ebc1425142"
---

# Notas brutas — catálogo Xnamai (BI Backend + Mercos_Adaptor)

Explorado em 2026-11-11. Apps de origem **somente leitura**.

## Caminhos

- BI Backend: `D:\Documents_Old\xNamai\Chatbô\Xnamai_BI_Backend`
- Mercos_Adaptor: `D:\Documents_Old\xNamai\Chatbô\Mercos_Adaptor`

## Mercos_Adaptor

- FastAPI, auth interna `X-API-Key`
- `GET /v1/products` → recurso Mercos `produtos` (paginação `alterado_apos` / `nextCursor`)
- `GET /v1/products/{id}` detalhe
- Também: categories, price-tables, product-prices, customers, orders, users…
- Env do consumidor: `MERCOS_ADAPTOR_URL`, `MERCOS_ADAPTOR_API_KEY`
- **Não** colocar tokens Mercos no Dropmai

## Xnamai_BI_Backend

- Consome o Adaptor e persiste espelho analítico
- Tabela SQLAlchemy `products`:
  - `mercos_id`, `code`, `name`, `category_id`/`category_mercos_id`, `unit`
  - `list_price`, `minimum_price`, `stock`, `active`, `raw` JSON, timestamps
- API: `GET /api/v1/products?limit=` → `{ id, code, name, stock, price, active }`
- Auth: `Depends(auth)` — JWT Bearer e/ou `X-API-Key` (`BI_API_KEY`); login em `/api/v1/auth`
- Sync mapeia Mercos: `codigo`, `nome`, `categoria_id`, `unidade`, `preco_tabela`, `preco_minimo`, `saldo_estoque`, `ativo`, `ultima_alteracao`
- ERP isolado (`app/erp`, desligado por padrão) tem mapeamento mais rico: NCM, pesos, `image_hashes`, variantes (`variacoes`/`variantes`)

## Imagens

Mercos entrega hashes (`imagens` / `imagens_hash` / `hashes_imagens`), não URLs públicas. BI analytics não expõe imagens no endpoint simples. Dropmai guarda `imageHashes` e `imageUrls` (vazio até haver CDN/resolução).

## Caminho limpo para Dropmai

1. Preferir **Mercos_Adaptor** `GET /v1/products` (fonte + cursor incremental)
2. Fallback **BI** `GET /api/v1/products` se Adaptor indisponível
3. Offline: mock tipado no Dropmai
4. Upsert em `Supplier(xnamai)` → `Product` / `ProductVariant`
5. Seller publica via `StoreProduct`

Não depender do módulo ERP do BI para o MVP (está `ERP_ENABLED=false`).
