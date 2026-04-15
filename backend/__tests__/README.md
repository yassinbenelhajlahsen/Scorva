# Backend Tests

Comprehensive test suite for Scorva backend services and API endpoints.

> **Note:** Frontend tests use a separate framework (Vitest + Testing Library).
> See `frontend/src/__tests__/` and [`docs/testing.md`](../../docs/testing.md) for frontend testing guidance.

## Overview

This test suite covers:

- **API Routes**: All endpoints in `/api`
- **Core Services**: All business logic services (games, search, favorites, standings, player/game detail, user)
- **Chat Services**: Agent loop, tool execution, history, embeddings
- **Ingestion Pipeline**: ESPN event processing, upsert functions, live sync, stat mapping
- **Utilities**: Date parsing, slug resolution, date formatting
- **Cache Module**: Redis caching layer + seasons helper
- **Database Layer**: Connection, query operations, notification bus
- **Middleware**: Auth JWT verification
- **Integration Tests**: Full app behavior

## Test Structure

```
backend/__tests__/
├── setup.js                              # Global test configuration
├── helpers/
│   └── testHelpers.js                   # createMockPool(), fixtures
├── routes/
│   ├── aiSummary.test.js                # GET /games/:id/ai-summary (requireAuth)
│   ├── chat.test.js                     # POST /chat (requireAuth + rate limits)
│   ├── favorites.test.js                # GET|POST|DELETE /favorites/* (requireAuth)
│   ├── gameDates.test.js                # GET /:league/games/dates
│   ├── gameInfo.test.js                 # GET /:league/games/:gameId
│   ├── games.test.js                    # GET /:league/games
│   ├── live.test.js                     # GET /live/:league/games + /:gameId (SSE)
│   ├── news.test.js                     # GET /news (limit param, error handling)
│   ├── playerInfo.test.js               # GET /:league/players/:slug
│   ├── players.test.js                  # GET /:league/players
│   ├── plays.test.js                    # GET /:league/games/:gameId/plays
│   ├── search.test.js                   # GET /search
│   ├── seasons.test.js                  # GET /:league/seasons
│   ├── standings.test.js                # GET /:league/standings
│   ├── teams.test.js                    # GET /:league/teams
│   ├── user.test.js                     # GET|PATCH /user/profile, DELETE /user/account
│   ├── webhooks.test.js                 # POST /webhooks/supabase-auth
│   └── winProbability.test.js           # GET /:league/games/:eventId/win-probability
├── controllers/
│   └── headToHeadController.test.js    # Compare H2H controller validation + routing
├── services/
│   ├── aiSummaryService.test.js         # AI summary generation + data building
│   ├── chatAgentService.test.js         # Agent loop, tool calls, summarization
│   ├── chatHistoryService.test.js       # Conversation persistence
│   ├── chatToolsService.test.js         # 13 tool definitions + executeTool dispatch
│   ├── embeddingService.test.js         # pgvector embedding + semantic search
│   ├── favoritesService.test.js         # ensureUser, getFavorites, CRUD, checkFavorites
│   ├── gameDetailService.test.js        # getNbaGame/getNflGame/getNhlGame, cacheIf
│   ├── gamesService.test.js             # getGames (all branches), getGameDates
│   ├── headToHeadService.test.js        # Head-to-head game history (chat tool)
│   ├── compareHeadToHead.test.js       # Compare feature H2H service (teams + players)
│   ├── newsService.test.js              # ESPN news fetch, filtering, caching
│   ├── playerComparisonService.test.js  # Side-by-side player stats
│   ├── playerDetailService.test.js      # getNbaPlayer/getNflPlayer/getNhlPlayer, TTL
│   ├── playersService.test.js           # Player list queries
│   ├── playsService.test.js             # Play-by-play retrieval + ESPN proxy
│   ├── searchService.test.js            # ILIKE stage 1 + fuzzy stage 2 fallback
│   ├── seasonsService.test.js           # Season list queries
│   ├── semanticSearchService.test.js    # Embedding-based game search
│   ├── nhlPlayoffsService.test.js        # getNhlPlayoffs — unsupported seasons, projected bracket, tiebreakers, partial/complete bracket
│   ├── standingsService.test.js         # getStandings, season-aware TTL
│   ├── statLeadersService.test.js       # Stat leader queries + validation
│   ├── teamStatsService.test.js         # Team aggregate stats
│   ├── teamsService.test.js             # Team list queries
│   ├── userService.test.js              # getUser, updateUser, deleteUser
│   ├── webSearchService.test.js         # Tavily API integration
│   └── winProbabilityService.test.js    # ESPN win probability proxy + caching
├── ingestion/
│   ├── commonMappings.test.js           # Shared mapping utilities
│   ├── espnImage.test.js                # ESPN CDN URL rewriting
│   ├── eventProcessor.test.js           # ESPN ingest pipeline (30+ cases)
│   ├── liveSync.test.js                 # Live game sync worker
│   ├── mapStatsToSchema.test.js         # NBA/NFL/NHL stat field mapping
│   ├── refreshPopularity.test.js        # Player popularity UPDATE
│   ├── upsert.test.js                   # Scheduled upsert orchestration
│   ├── upsertGame.test.js               # Game upsert with winner/OT logic
│   ├── upsertPlayer.test.js             # Player upsert with preserveExistingTeam
│   ├── upsertPlays.test.js              # Play-by-play upsert
│   ├── upsertStat.test.js               # Stat upsert with TD/minutes parsing
│   └── upsertTeam.test.js               # Team upsert
├── utils/
│   ├── dateParser.test.js               # tryParseDate — all formats + season-aware year
│   ├── pgDateToString.test.js           # UTC date formatting
│   ├── slugResolver.test.js             # Slug/numeric ID resolution
│   └── tiebreaker.test.js               # NHL cascade, NBA division-leader bonus, OT-loss tracking, ptsPct sort
├── middleware/
│   ├── auth.test.js                     # requireAuth — JWT verification via Supabase
│   └── rateLimiters.test.js             # Rate limiter configuration tests
├── cache/
│   ├── cache.test.js                    # Redis cached(), invalidate(), no-op mode
│   └── seasons.test.js                  # getCurrentSeason()
├── db/
│   ├── db.test.js                       # PG pool connection
│   └── notificationBus.test.js          # LISTEN/NOTIFY bus lifecycle
├── controllers/
│   └── chatController.test.js           # streamChat — input validation + SSE streaming
└── integration/
    └── app.test.js                      # Full app middleware + routing
```

**Total: 72 test files.**

## Running Tests

```bash
cd backend
npm test                          # run all tests
npm test -- <pattern>             # run matching tests (e.g. npm test -- gamesService)
npm run test:watch
npm run test:coverage             # output to backend/coverage/
```

## Writing Tests

### Core pattern (ESM + mocked DB)

```javascript
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

// MUST call jest.unstable_mockModule BEFORE dynamic import
const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const { myFunction } = await import(resolve(__dirname, "../../src/services/{domain}/myService.js"));

describe("myService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns rows", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const result = await myFunction("nba");
    expect(result).toEqual([{ id: 1 }]);
  });
});
```

### Season-aware services (games, standings, playerDetail)

Mock `cache/seasons.js` so `getCurrentSeason()` never hits the DB:

```javascript
const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));
```

### Services that use `cached()` — testing TTL and cacheIf

When you need to assert TTL values or inspect the `cacheIf` predicate, mock `cache/cache.js` as a passthrough and capture args:

```javascript
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn, _opts) => fn());

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

// After calling the service function:
const [key, ttl, , opts] = mockCached.mock.calls[0];
expect(ttl).toBe(300);
expect(opts.cacheIf({ game: { status: "Final" } })).toBe(true);
```

When you only care about the DB query results and not TTL/cacheIf, you can skip mocking `cache.js` entirely — without `REDIS_URL`, `cached()` is a no-op that calls the queryFn directly.

### Auth middleware

Mock `@supabase/supabase-js` before importing `auth.js`. The Supabase client is created at module scope so the mock must be registered first:

```javascript
const mockGetUser = jest.fn();

jest.unstable_mockModule("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

const { requireAuth } = await import(resolve(__dirname, "../../src/middleware/auth.js"));
```

**Important:** call `mockGetUser.mockReset()` in `beforeEach` (in addition to `jest.clearAllMocks()`) to clear the `mockResolvedValueOnce` queue. Unconsumed `mockOnce` values bleed into subsequent tests.

### Route tests

```javascript
import request from "supertest";
import express from "express";

let app;
beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use("/api", myRouter);
  jest.clearAllMocks();
});

it("returns 200", async () => {
  mockPool.query.mockResolvedValueOnce({ rows: [...] });
  const res = await request(app).get("/api/nba/endpoint");
  expect(res.status).toBe(200);
});
```

Auth-gated routes: mock `requireAuth` to inject `req.user`:

```javascript
jest.unstable_mockModule("../../src/middleware/auth.js", () => ({
  requireAuth: jest.fn((req, _res, next) => {
    req.user = { id: "test-uuid" };
    next();
  }),
}));
```

### SSE endpoints

Don't use supertest. Mock `res.write`, `res.writeHead`, `res.end` as `jest.fn()`. Use a Node.js `EventEmitter` as the mock PG listen client so `notification` events can be simulated:

```javascript
import { EventEmitter } from "events";
const mockListenClient = new EventEmitter();
mockListenClient.query = jest.fn();
mockListenClient.release = jest.fn();
```

### liveSync worker tests

`liveSync.js` imports the shared pool from `db/db.js` (not `pg` directly). Mock it with the absolute path:

```javascript
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({
  default: mockPoolInstance,
}));
```

## Key Assertions

```javascript
// Return value
expect(result).toEqual(expectedObject);
expect(result).toBeNull();

// SQL structure
expect(mockPool.query).toHaveBeenCalledWith(
  expect.stringContaining("WHERE league = $1"),
  ["nba", "2025-26"]
);

// Call count
expect(mockPool.query).toHaveBeenCalledTimes(2);

// Nth call
expect(mockPool.query).toHaveBeenNthCalledWith(2, expect.any(String), params);
```

## Test Coverage Goals

- **Routes**: 100% — all endpoints with success, error, and edge cases
- **Services**: 100% — all services have dedicated unit tests
- **Utilities**: 100% — all utility functions covered
- **Ingestion**: 95%+ — all upsert, mapping, and processing functions
- **Infrastructure**: cache, DB pool, notification bus

## Debugging

```bash
npm test -- gamesService               # run one file by name pattern
npm test -- --testNamePattern="date"   # run tests matching name
npm test -- --verbose                  # verbose output
npm test -- --detectOpenHandles        # find leaked async handles
```

## Dependencies

- **jest** + **@jest/globals**: test framework (ESM mode via `--experimental-vm-modules`)
- **supertest**: HTTP assertion for route tests
- All DB/cache/external deps are mocked — no real connections in tests
