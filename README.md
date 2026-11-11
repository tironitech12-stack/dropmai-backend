# Dropmai Backend

API NestJS + Prisma/PostgreSQL da plataforma Dropmai (separada do frontend).

## Stack

- NestJS 11 + TypeScript
- Prisma 6 + PostgreSQL
- Auth stub (cookie `dropmai_session`)
- Sync Xnamai via Mercos_Adaptor (preferido) ou BI Backend

## Rodar

```bash
cp .env.example .env
npm install
npm run start:dev
```

Health: `GET http://localhost:4000/health`

Sem Postgres, deixe `DROPMAI_USE_MOCK=true` (lojas/produtos em memória + mock Xnamai).

### Com PostgreSQL

```bash
# ajuste DATABASE_URL e DROPMAI_USE_MOCK=false
npx prisma migrate deploy
npx prisma db seed   # quando configurado
npm run start:dev
```

## Rotas principais

| Método | Rota | Auth |
|---|---|---|
| GET | `/health` | — |
| POST | `/api/v1/auth/login` | — |
| GET | `/api/v1/auth/me` | cookie |
| GET/POST | `/api/v1/stores` | sim |
| GET | `/api/v1/stores/:id/products` | sim |
| POST | `/api/v1/sync/xnamai` | sim |
| GET/POST | `/api/v1/stores/:id/domains` | sim |
| GET | `/api/v1/stores/:id/marketplaces` | stub |
| GET | `/api/v1/public/stores/:slug` | público |
| GET | `/api/v1/public/stores/:slug/products` | público |

## Sync Xnamai

1. `MERCOS_ADAPTOR_URL` + `MERCOS_ADAPTOR_API_KEY` → `GET /v1/products`
2. Senão `XNAMAI_BI_URL` + key/bearer → `GET /api/v1/products`
3. Senão mock tipado

Não armazene tokens Mercos neste serviço — só a chave do Adaptor.

## Render

Bind em `0.0.0.0:$PORT` (já no `main.ts`). Filesystem efêmero — use Postgres gerenciado.
