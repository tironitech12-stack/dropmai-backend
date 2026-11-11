# Dropmai — contexto do projeto

## Visão

Dropmai é uma plataforma tipo Dropify para o Paulo Regis Tironi (DESKTOP-79V9UO5):

1. Vendedor cria **loja própria** (`minhaloja.dropmai.com.br`)
2. Anexa **domínio customizado** (`lojadoze.com.br`)
3. Publica produtos de fornecedores na vitrine
4. Depois publica nos marketplaces (Mercado Livre, Shopee, Amazon)

**Xnamai é o fornecedor #1** (catálogo B2B via Mercos).

## Arquitetura (corrigida — NÃO monolito)

Dois projetos irmãos sob `D:\Documents_Old\xNamai\Chatbô\`:

| Projeto | Pasta | Stack |
|---|---|---|
| API | `Dropmai_Backend` | NestJS 11 + Prisma 6 + PostgreSQL |
| UI | `Dropmai_Frontend` | Next.js 15 App Router + TypeScript + Tailwind |

O monolito experimental foi arquivado em `Dropmai_monolith_archive` (e/ou `Dropmai` marcado ARCHIVED se o rename falhou por lock).

Frontend fala com o backend via `NEXT_PUBLIC_API_URL` (padrão `http://localhost:4000`).

## Decisões

| Tema | Decisão |
|---|---|
| Forma | **Dois repositórios** (front + back) |
| DB | PostgreSQL + Prisma no Backend; schema multi-tenant com `storeId` |
| Auth | Cookie stub no Backend; Frontend espelha cookie no host local |
| Sync | `XnamaiCatalogAdapter` no Backend → Mercos_Adaptor / BI / mock |
| Idioma UI | pt-BR |
| Fontes BI/Adaptor | Somente leitura |

## Como rodar

```bash
# Terminal 1
cd Dropmai_Backend && npm install && npm run start:dev

# Terminal 2
cd Dropmai_Frontend && npm install && npm run dev
```

## Fora do MVP atual

- OAuth real dos marketplaces
- Checkout/pagamento na vitrine
- Verificação DNS completa
- Clerk / Auth.js em produção
