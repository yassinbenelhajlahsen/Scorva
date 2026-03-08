# Scorva Security Audit Report

**Date:** 2026-03-08
**Scope:** Full codebase — backend, frontend, configuration, and deployment
**Severity Levels:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

The codebase follows solid security practices overall — parameterized SQL queries, proper auth middleware, no hardcoded secrets in source, and good `.gitignore` coverage. However, there are several medium-severity issues around input validation, missing security headers, verbose error logging, and a weak SSL configuration that should be addressed.

**Findings:** 0 Critical, 2 High, 7 Medium, 5 Low, 3 Info

---

## HIGH Severity

### H1. `defaultLeague` input not validated — potential stored XSS / data corruption
**File:** `backend/src/controllers/userController.js:21`
**File:** `backend/src/services/userService.js:11-19`

The `PATCH /api/user/profile` endpoint accepts `defaultLeague` from the request body and stores it directly in the database via `COALESCE($4, default_league)` with **no validation** against the allowed set (`nba`, `nfl`, `nhl`). An authenticated user can set `defaultLeague` to any arbitrary string.

**Impact:** While the frontend has a dropdown restricting values, a direct API call can inject any value. This data is later returned via `GET /user/profile` and consumed by the frontend, which uses it to construct URL paths (`/${defaultLeague}`). An attacker could set it to a malicious string.

**Fix:** Validate `defaultLeague` against `["nba", "nfl", "nhl"]` in the controller before passing it to the service.

---

### H2. `teamId` and `season` query params passed to SQL without type validation
**File:** `backend/src/controllers/gamesController.js:8`
**File:** `backend/src/services/gamesService.js:38-40`

`teamId` from `req.query` is passed directly into the SQL query. While it is parameterized (safe from SQL injection), it's never validated as an integer. If a non-numeric string is passed, PostgreSQL will throw an error that is caught and returned as a 500, leaking information about the expected type in server logs.

Similarly, `season` is passed without format validation. The `gameId` parameter in `gameInfoController.js:10` is also passed directly to queries without integer validation.

**Fix:** Parse and validate `teamId` and `gameId` as integers, and `season` against expected format (e.g., year string) in controllers before passing to services.

---

## MEDIUM Severity

### M1. No security headers configured
**File:** `backend/src/index.js`

The Express app does not set any security headers:
- No `X-Content-Type-Options: nosniff`
- No `X-Frame-Options: DENY`
- No `Strict-Transport-Security` (HSTS)
- No `X-XSS-Protection`
- No `Content-Security-Policy`
- No `Referrer-Policy`

**Fix:** Add `helmet` middleware or manually set these headers.

---

### M2. SSL `rejectUnauthorized: false` in production database connection
**File:** `backend/src/db/db.js:9-11`

```js
ssl: process.env.NODE_ENV === "production"
  ? { rejectUnauthorized: false }
  : false,
```

In production, SSL certificate verification is disabled. This means the app will connect to any PostgreSQL server presenting any certificate, making it vulnerable to man-in-the-middle attacks on the database connection.

**Fix:** Use `{ rejectUnauthorized: true }` and provide the CA certificate, or use Railway's internal networking which doesn't require SSL.

---

### M3. Verbose `console.error(err)` in controllers leaks full stack traces
**Files:** Multiple controllers — `userController.js:14,28,42`, `favoritesController.js:20,31,42,53,64,84`, `searchController.js:14`, `gamesController.js:14`, `gameInfoController.js:24`, `standingsController.js:14`, etc.

Many catch blocks do `console.error(err)` which logs the full error object including stack traces to stdout/stderr. In a cloud environment (Railway), these logs may be accessible to anyone with dashboard access and could reveal:
- Database table/column names
- File paths on the server
- SQL query structure on malformed input

While the HTTP responses are properly sanitized (returning generic error messages), the server logs are overly verbose.

**Fix:** Use the structured `log()` helper from `middleware/index.js` instead of raw `console.error`, and only log `err.message` rather than the full error object in production.

---

### M4. SSE endpoints have no authentication or rate limiting
**File:** `backend/src/index.js:46` — SSE routes mounted before `generalLimiter`
**File:** `backend/src/controllers/liveController.js`

The SSE live endpoints (`/api/live/:league/games` and `/api/live/:league/games/:gameId`) are:
1. Mounted before the general rate limiter (intentional for long-lived connections)
2. Not protected by any authentication
3. Each connection acquires a PostgreSQL connection via `pool.connect()` for `LISTEN`

An attacker could open many SSE connections to exhaust the PostgreSQL connection pool (default 10 connections), causing a denial of service for all other API endpoints.

**Fix:** Add a separate, stricter rate limiter for SSE connections (e.g., max 5 concurrent per IP), or implement connection counting per IP.

---

### M5. Webhook endpoint lacks rate limiting
**File:** `backend/src/index.js:40` — webhook route mounted before rate limiter
**File:** `backend/src/routes/webhooks.js`

The Supabase webhook endpoint (`POST /api/webhooks/supabase-auth`) is mounted before the general rate limiter. While it validates the webhook secret, an attacker who discovers the secret (or brute-forces it) could spam the endpoint to perform rapid database writes.

**Fix:** Apply a moderate rate limiter to the webhook endpoint as defense in depth.

---

### M6. Webhook secret comparison vulnerable to timing attack
**File:** `backend/src/controllers/webhooksController.js:6`

```js
if (!secret || req.headers.authorization !== secret) {
```

The webhook secret is compared using `!==` (standard string equality). This is theoretically vulnerable to timing-based attacks where an attacker measures response times to guess the secret character by character. While practically difficult to exploit over a network, it violates cryptographic best practices.

**Fix:** Use `crypto.timingSafeEqual(Buffer.from(req.headers.authorization), Buffer.from(secret))` for constant-time comparison.

---

### M7. `express.json()` has no body size limit
**File:** `backend/src/index.js:37`

```js
app.use(express.json());
```

No `limit` option is set, so Express uses the default of 100kb. While this is reasonable, it should be explicitly set to prevent unexpected changes in Express defaults. For the webhook endpoint specifically, a tighter limit would be appropriate.

**Fix:** Explicitly set `express.json({ limit: '50kb' })` or appropriate limit.

---

## LOW Severity

### L1. CORS allowlist includes local network IP
**File:** `backend/src/middleware/index.js:70-72`

```js
"http://192.168.1.68:5173",
"http://192.168.1.68:5174",
"http://192.168.1.68:5175",
```

Local network IPs are in the CORS allowlist. While these are only accessible on the local network, they should be removed in production or conditionally included only in development.

**Fix:** Conditionally include local IPs only when `NODE_ENV !== 'production'`.

---

### L2. `parseInt()` without radix or NaN check on route params
**File:** `backend/src/controllers/favoritesController.js:27,37,48,60`

```js
const playerId = parseInt(req.params.playerId);
```

If `playerId` is not a valid number, `parseInt` returns `NaN`, which gets passed to the SQL query. PostgreSQL will reject it, but it wastes a database round-trip and produces a 500 error instead of a clean 400.

**Fix:** Validate with `Number.isFinite(parseInt(x, 10))` and return 400 if invalid.

---

### L3. Search endpoint has no length limit on `term`
**File:** `backend/src/controllers/searchController.js:4`
**File:** `backend/src/services/searchService.js:52-58`

The search term is not length-limited. A very long search string (e.g., thousands of characters) passed via `ILIKE '%...%'` could cause PostgreSQL to do unnecessary work.

**Fix:** Truncate or reject search terms longer than a reasonable limit (e.g., 200 characters).

---

### L4. AI summary leaks configuration state to client
**File:** `backend/src/controllers/aiSummaryController.js:48-55`

```js
if (!process.env.OPENAI_API_KEY) {
  return res.json({
    summary: "AI summary unavailable for this game.",
    reason: "OpenAI API key not configured",
    ...
  });
}
```

The response includes `reason: "OpenAI API key not configured"` which tells an attacker about the server's configuration state.

**Fix:** Return a generic "unavailable" message without revealing the specific reason.

---

### L5. Account deletion order could leave orphaned auth users
**File:** `backend/src/controllers/userController.js:33-44`

The current order is: delete Supabase auth user first, then delete DB row. If the DB delete fails after the auth user is deleted, the user's auth account is gone but their DB data (including favorites) remains orphaned.

**Fix:** Reverse the order — delete DB row first (which is easier to recreate), then delete the auth user. Or wrap in a transaction for the DB part and have a cleanup job for edge cases.

---

## INFO

### I1. No `.env` files committed — GOOD
The `.gitignore` properly excludes `.env`, `.env.local`, `.env.*.local`. Only `.env.example` files exist in the repo with placeholder values. No real secrets found in source.

### I2. Frontend environment variables are safe
Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_API_URL` are exposed to the frontend. The publishable key is designed for client-side use (Supabase anon key). No secret keys are exposed.

### I3. SQL queries use parameterized statements throughout — GOOD
All SQL queries across all services use `$1, $2, ...` parameterized queries via `pg`. No string concatenation for SQL values was found. The search service properly uses `ILIKE $1` with parameterized wildcards.

---

## Recommendations Summary

| Priority | Finding | Fix Effort |
|----------|---------|------------|
| HIGH | H1: Validate `defaultLeague` input | Small |
| HIGH | H2: Validate numeric route/query params | Small |
| MEDIUM | M1: Add security headers (helmet) | Small |
| MEDIUM | M2: Fix SSL `rejectUnauthorized` | Small |
| MEDIUM | M3: Reduce error log verbosity | Medium |
| MEDIUM | M4: Rate-limit SSE connections | Medium |
| MEDIUM | M5: Rate-limit webhook endpoint | Small |
| MEDIUM | M6: Use timing-safe webhook secret comparison | Small |
| MEDIUM | M7: Explicit JSON body size limit | Small |
| LOW | L1: Remove local IPs from prod CORS | Small |
| LOW | L2: Validate parseInt results | Small |
| LOW | L3: Limit search term length | Small |
| LOW | L4: Don't leak config state in AI response | Small |
| LOW | L5: Fix account deletion order | Small |
