# Scorva — CLAUDE.md

Multi-league sports stats web app (NBA, NFL, NHL). Data flows: ESPN API → PostgreSQL → Express backend → React frontend.

## Commands
```bash
# Frontend
cd frontend && npm run dev        # dev server
cd frontend && npm run build      # production build
cd frontend && npm test           # run all frontend tests (Vitest)
cd frontend && npm run test:watch # watch mode
cd frontend && npm run test:coverage
cd frontend && npm run verify     # lint + test + build (also what CI runs)

# Backend
cd backend && npm run dev         # dev server (nodemon + pino-pretty)
cd backend && npm run start       # start server (production)
cd backend && npm run live-sync   # run live sync worker locally
cd backend && npm test            # run all tests
cd backend && npm test -- <pat>   # run matching tests
cd backend && npm run test:coverage
cd backend && npm run lint           # eslint src/
cd backend && npm run verify         # lint + test

# Prisma
cd backend && node_modules/.bin/prisma generate          # after schema changes
cd backend && node_modules/.bin/prisma migrate dev --name <desc>
cd backend && node_modules/.bin/prisma migrate deploy    # production
```

## Architecture
```
Route (routes/) → Controller (controllers/) → Service (services/) → DB (db/db.js)
```
- **Routes**: thin — only delegates to controller, no logic
- **Controllers**: extracts params/query, calls service, sends response, catches errors
- **Services**: raw SQL via `pg` Pool (`pool.query()`), returns plain data
- **DB**: `backend/src/db/db.js` — `pg` Pool singleton

IMPORTANT: All packages use ESM (`"type": "module"`). Always use `.js` extensions in imports.

## Reference docs

| Doc | Read when… |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | data flow, live sync, SSE, Redis, game columns, auth, AI/chat, RAG |
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI — design tokens, component patterns, Tailwind v4 |
| [`docs/file-map.md`](docs/file-map.md) | finding any file in the codebase |
| [`docs/api-reference.md`](docs/api-reference.md) | looking up an endpoint or frontend route |
| [`docs/conventions.md`](docs/conventions.md) | middleware order, validation rules, new endpoint checklist |
| [`docs/testing.md`](docs/testing.md) | writing frontend Vitest tests |
| [`backend/__tests__/README.md`](backend/__tests__/README.md) | writing backend Jest/Supertest tests |
