# Backend Tests

Comprehensive test suite for Scorva backend services and API endpoints.

> **Note:** Frontend tests use a separate framework (Vitest + Testing Library).
> See `frontend/src/__tests__/` and [`docs/testing.md`](../../docs/testing.md) for frontend testing guidance.

## Overview

This test suite covers:

- **API Routes**: All endpoints in `/api`
- **Database Layer**: Connection and query operations
- **Data Population Services**: Mapping and upsert utilities
- **Cache Module**: Redis caching layer unit tests
- **Service Unit Tests**: Individual service logic (AI summary)
- **Integration Tests**: Full app behavior

## Test Structure

```
backend/__tests__/
├── setup.js                          # Global test configuration
├── helpers/
│   └── testHelpers.js               # Mock utilities and fixtures
├── routes/
│   ├── teams.test.js                # GET /:league/teams
│   ├── players.test.js              # GET /:league/players
│   ├── games.test.js                # GET /:league/games
│   ├── gameInfo.test.js             # GET /:league/games/:gameId
│   ├── playerInfo.test.js           # GET /:league/players/:playerId
│   ├── standings.test.js            # GET /:league/standings
│   ├── seasons.test.js              # GET /:league/seasons
│   ├── search.test.js               # GET /search
│   ├── aiSummary.test.js            # GET /games/:id/ai-summary (requireAuth)
│   ├── favorites.test.js            # GET|POST|DELETE /favorites/* (requireAuth)
│   ├── user.test.js                 # GET|PATCH /user/profile, DELETE /user/account
│   ├── webhooks.test.js             # POST /webhooks/supabase-auth
│   └── live.test.js                 # GET /live/:league/games + /:gameId (SSE)
├── services/
│   └── aiSummaryService.test.js     # AI summary service unit tests
├── cache/
│   └── cache.test.js                # Redis cache module unit tests
├── db/
│   └── db.test.js                   # Database connection tests
├── populate/
│   ├── mapStatsToSchema.test.js     # Stats mapping tests
│   ├── upsertPlayer.test.js         # Player upsert tests
│   ├── upsertTeam.test.js           # Team upsert tests
│   ├── upsertGame.test.js           # Game upsert (incl. current_period/clock fields)
│   ├── upsertStat.test.js           # Stat upsert tests
│   ├── eventProcessor.test.js       # Event processing pipeline tests
│   └── liveSync.test.js             # Live sync worker: upsertGameScoreboard
└── integration/
    └── app.test.js                  # Full app integration tests
```

## Running Tests

### Install Dependencies

```bash
cd backend
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

Coverage reports will be generated in `backend/coverage/`.

## Writing Tests

### Using Test Helpers

```javascript
import {
  createMockPool,
  fixtures,
  mockRequest,
  mockResponse,
} from "../helpers/testHelpers.js";

// Create mock database
const mockPool = createMockPool();

// Generate test data
const team = fixtures.team({ name: "Custom Team" });
const player = fixtures.player({ position: "G" });
const game = fixtures.game({ homescore: 110 });

// Mock Express req/res
const req = mockRequest({ params: { league: "nba" } });
const res = mockResponse();
```

### Testing Routes

```javascript
import request from "supertest";
import express from "express";
import myRouter from "../../src/routes/myRouter.js";

const app = express();
app.use("/api", myRouter);

const response = await request(app)
  .get("/api/nba/endpoint")
  .query({ param: "value" });

expect(response.status).toBe(200);
expect(response.body).toEqual(expectedData);
```

### Mocking Database

```javascript
import { jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";

const mockPool = createMockPool();

// Mock successful query
mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

// Mock error
mockPool.query.mockRejectedValue(new Error("DB error"));
```

## Test Coverage Goals

- **Routes**: 100% - All endpoints tested with success, error, and edge cases
- **Services**: 90%+ - Core business logic thoroughly tested
- **Utilities**: 95%+ - Mapping and transformation functions covered
- **Integration**: Key workflows validated end-to-end

## Key Test Patterns

### 1. Success Cases

Test happy path with valid inputs and expected outputs.

### 2. Error Handling

Test database errors, invalid inputs, and edge cases.

### 3. Parameter Validation

Test different league parameters, query params, and route params.

### 4. Data Transformation

Test mapping functions with various input formats and edge cases.

### 5. SSE Endpoints

Test SSE controllers directly using mock req/res objects (EventEmitter-based client for LISTEN/NOTIFY). Supertest is not used for SSE — `res.write`, `res.writeHead`, and `res.end` are mocked as `jest.fn()`. The mock `listenClient` is a Node.js `EventEmitter` so `notification` events can be simulated.

### 8. liveSync worker tests

`liveSync.js` imports the shared pool from `db/db.js` (not `pg` directly). Mock it with:

```javascript
let mockPoolInstance;
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => {
  mockPoolInstance = { connect: jest.fn(), end: jest.fn(), query: jest.fn() };
  return { default: mockPoolInstance };
});
```

Do **not** mock `pg` — liveSync no longer creates its own `Pool`.

### 7. Season-Aware Route Tests

Route tests for `games`, `standings`, and `playerInfo` must mock `../../src/cache/seasons.js` with `jest.unstable_mockModule()` so `getCurrentSeason()` never calls `pool.query` in tests:

```javascript
jest.unstable_mockModule("../../src/cache/seasons.js", () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));
```

### 6. Integration

Test full request-response cycles with middleware.

## Common Test Scenarios

### Route Tests

- ✅ Returns correct data for valid requests
- ✅ Handles empty results gracefully
- ✅ Returns appropriate errors for failures
- ✅ Works with different league parameters
- ✅ Validates query parameters
- ✅ Covers search-specific behavior such as SQL ordering and date parsing for exact and partial game-date lookups
- ✅ Auth-gated routes (favorites, ai-summary): mock `requireAuth` to inject `req.user = { id: "test-uuid" }` and test 401 enforcement separately

### Service Tests

- ✅ Processes data correctly
- ✅ Handles null/undefined values
- ✅ Maps all required fields
- ✅ Returns expected format
- ✅ Throws errors for invalid inputs

### Database Tests

- ✅ Executes queries with correct parameters
- ✅ Handles connection errors
- ✅ Returns properly formatted results
- ✅ Uses parameterized queries to prevent SQL injection

## CI/CD Integration

Tests should be run as part of CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    cd backend
    npm install
    npm test

- name: Check coverage
  run: |
    cd backend
    npm run test:coverage
```

## Debugging Tests

### Run Specific Test File

```bash
npm test -- teams.test.js
```

### Run Tests Matching Pattern

```bash
npm test -- --testNamePattern="should return all teams"
```

### Verbose Output

```bash
npm test -- --verbose
```

## Dependencies

- **jest**: Test framework
- **supertest**: HTTP assertion library
- **@jest/globals**: Jest globals for ES modules

## Notes

- Tests use ES modules (`type: "module"` in package.json)
- Database is mocked to avoid external dependencies
- Tests run in isolated environment (`NODE_ENV=test`)
- Console methods are mocked to reduce noise

## Troubleshooting

### Import Errors

Make sure all imports use `.js` extensions:

```javascript
import myModule from "./myModule.js";
```

### Mock Not Working

Ensure `jest.unstable_mockModule()` is called before importing:

```javascript
jest.unstable_mockModule("../../src/db/db.js", () => ({
  default: mockPool,
}));

const module = await import("../../src/db/db.js");
```

### Test Timeout

Increase timeout in jest.config.js or per test:

```javascript
jest.setTimeout(30000); // 30 seconds
```

## Future Improvements

- [ ] Add E2E tests with real database (test container)
- [ ] Add performance/load testing
- [ ] Add mutation testing
- [ ] Increase coverage to 95%+
- [ ] Add visual regression tests for error responses
- [ ] Add contract tests for external APIs
