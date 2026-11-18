# Dropmai Backend

API NestJS + Prisma/PostgreSQL da plataforma Dropmai (separada do frontend).

## Stack

- NestJS 11 + TypeScript
- Prisma 6 + PostgreSQL
- Auth com cookie assinado `dropmai_session` (`dm1.<payload>.<hmac>`)
- Google OAuth (troca de `code` → tokens → userinfo → upsert `User`/`Account`)
- Sync Xnamai via Mercos_Adaptor (preferido) ou BI Backend

## Rodar

```bash
cp .env.example .env
npm install
npm run start:dev
```

Health: `GET http://localhost:4000/health`

Sem Postgres, deixe `DROPMAI_USE_MOCK=true` (lojas/produtos em memória + mock Xnamai). Login/register/Google ainda emitem sessão assinada, mas **não** gravam `User` no banco.

### Com PostgreSQL (persistência real)

```bash
# DATABASE_URL real + DROPMAI_USE_MOCK=false
npx prisma migrate deploy
npm run start:dev
```

Com DB ativo:

- `POST /api/v1/auth/register` cria `User` com `passwordHash` (scrypt)
- `POST /api/v1/auth/login` valida hash e devolve sessão com `user.id` real
- `GET /api/v1/auth/google/callback` troca o code, upsert `User` + `Account(provider=google)` e redireciona ao frontend `/auth/callback#session=...`
- Lojas usam `StoreMember.userId` = esse `user.id`

## Variáveis de ambiente

| Var | Obrigatória | Notas |
|---|---|---|
| `DATABASE_URL` | para persistir | Postgres. Placeholder `USER:PASSWORD@` é ignorado salvo `DROPMAI_FORCE_DB=true` |
| `DROPMAI_USE_MOCK` | recomendada | `false` para gravar User/Account/StoreMember |
| `SESSION_SECRET` | produção | HMAC das sessões; sem ela cai no secret de dev |
| `FRONTEND_URL` | OAuth | ex. `https://dropmai.vercel.app` |
| `PUBLIC_API_URL` | OAuth | ex. `https://dropmai-backend.onrender.com` |
| `GOOGLE_CLIENT_ID` | Google | Console Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Google | |
| `GOOGLE_REDIRECT_URI` | Google | deve bater com a URI autorizada |
| `CORS_ORIGINS` | opcional | merge com localhost + dropmai.vercel.app |
| `MERCOS_ADAPTOR_*` / `XNAMAI_BI_*` | sync | ver seção Sync |

## Rotas principais

| Método | Rota | Auth |
|---|---|---|
| GET | `/health` | — |
| POST | `/api/v1/auth/login` | — (persiste/lê User se DB) |
| POST | `/api/v1/auth/register` | — (cria User se DB) |
| GET | `/api/v1/auth/google` | OAuth start (501 se envs ausentes) |
| GET | `/api/v1/auth/google/callback` | troca code + upsert + bridge session |
| GET | `/api/v1/auth/me` | cookie assinado |
| GET/POST | `/api/v1/stores` | sim (`user.id` / StoreMember) |
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

## CORS / Render

Por padrão o backend libera `http://localhost:3000`, `http://127.0.0.1:3000` e `https://dropmai.vercel.app` (com `credentials: true` para cookie).

No Render, defina (ou confirme):

```text
CORS_ORIGINS=https://dropmai.vercel.app,http://localhost:3000
DROPMAI_USE_MOCK=false
DATABASE_URL=postgresql://...
SESSION_SECRET=<longo-aleatorio>
FRONTEND_URL=https://dropmai.vercel.app
PUBLIC_API_URL=https://dropmai-backend.onrender.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://dropmai-backend.onrender.com/api/v1/auth/google/callback
```

Origens extras (previews Vercel) podem ser acrescentadas em `CORS_ORIGINS`.

## Render

Bind em `0.0.0.0:$PORT` (já no `main.ts`). Filesystem efêmero — use Postgres gerenciado.
