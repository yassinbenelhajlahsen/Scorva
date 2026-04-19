# Plan: Injury Tools for the AI Agent

Add structured injury lookups to the chat agent so it stops falling back to `web_search` for questions it can answer from our own synced data.

## Goal

The agent currently has 14 tools (`backend/src/services/ai/chat/toolDefinitions.js`). For injury questions ("is Luka playing tonight?", "who's on the IR for the Rangers?", "how banged up is the Celtics roster?") it calls `web_search`, which hits Tavily, is slow, and returns prose the model has to parse. We already sync injuries league-wide (`backend/src/ingestion/syncInjuries.js`) — this plan exposes that data as first-class tools.

## New tools

### 1. `get_team_injuries`

Returns the currently injured roster for a single team, including each player's season averages so the agent can reason about production impact.

**Params**
- `league` (required): `"nba" | "nfl" | "nhl"`
- `teamId` (required): integer
- `season` (optional): `"YYYY-YY"`, defaults to current via `toolsService.js:42-45`

**Response shape**
```json
{
  "team": { "id": 2, "name": "Boston Celtics", "shortName": "BOS" },
  "asOf": "2026-04-19T14:32:00Z",
  "count": 3,
  "players": [
    {
      "id": 12345,
      "name": "Jayson Tatum",
      "position": "SF",
      "status": "out",
      "statusDescription": "Right knee soreness",
      "statusUpdatedAt": "2026-04-18T19:30:00Z",
      "seasonAverages": { "points": 27.1, "rebounds": 8.4, "assists": 4.9, "minutes": 35 },
      "gamesPlayed": 68
    }
  ]
}
```

`asOf` = `MAX(status_updated_at)` across returned rows, so the agent can quote freshness.

### 2. `get_league_injuries`

Cross-team view for "who's hurt in the NBA right now?" questions.

**Params**
- `league` (required)
- `status` (optional): filter to one of `out`, `ir`, `doubtful`, `questionable`, `day-to-day`, `suspended`. Omit for all.
- `minPopularity` (optional, default 0): use `players.popularity` (`schema.prisma:63`) to avoid returning 200 bench-warmers
- `limit` (optional, default 25, max 50)

**Response**: flat list of `{ player, team, status, statusDescription, statusUpdatedAt }`, sorted by popularity desc then status severity.

### 3. `get_player_status`

Tiny focused tool — single player, no season stats. Useful when the agent already has a `playerId` from context (`agentService.js:12-50` resolves pronouns to the current page entity, so "is he playing?" becomes a cheap lookup instead of a full `get_player_detail` round-trip).

**Params**
- `league` (required)
- `playerId` (required)

**Response**: `{ id, name, status, statusDescription, statusUpdatedAt }` or `{ status: "active" }` for healthy players.

## Implementation

### Files to add

- `backend/src/services/ai/chat/tools/injuries.js` — exports `getTeamInjuries`, `getLeagueInjuries`, `getPlayerStatus`. Follows the pattern in `tools/teamStats.js`: raw SQL via `pool`, return plain objects or `{ error: "..." }`.

### Files to edit

- `backend/src/services/ai/chat/toolDefinitions.js` — append three entries to `TOOL_DEFINITIONS` (array at line 1). Match the existing JSON-schema shape; enum the `status` field on `get_league_injuries`.
- `backend/src/services/ai/chat/toolsService.js` — import the three handlers, add three cases to the `switch` at line 47. Follow the same `args.season` defaulting pattern already in place.

### SQL sketch for `get_team_injuries`

Join `players` (for injury columns) → `stats` (for season averages) → `games` (to filter to current season, `Final%`, regular/makeup). Aggregate per player. Use the league-aware minutes filter from `tools/teamStats.js:38-40` so we don't average over DNPs.

### SQL for `get_league_injuries`

Single query on `players` filtered by `league` + `status IS NOT NULL`, joined to `teams` for names, ordered by `popularity DESC, status`, with `LIMIT`. No stat join — this is a roster-level view, not a production view.

### SQL for `get_player_status`

`SELECT status, status_description, status_updated_at, name FROM players WHERE id = $1 AND league = $2`. Return `status: "active"` if the column is `NULL`.

## Agent prompt updates

`backend/src/services/ai/chat/agentService.js` builds the system prompt. Add a short directive near the tool guidance:

> For injury or availability questions, prefer `get_team_injuries`, `get_league_injuries`, or `get_player_status` over `web_search`. Use `web_search` only for timelines, return dates, or reporter context the database doesn't store.

Also: when the current page context is a player page, nudge the agent to call `get_player_status` before answering "is he playing?" style questions.

## Caching

Reuse `cached(...)` from `backend/src/cache/cache.js` with short TTLs:

- `get_team_injuries`: 120s
- `get_league_injuries`: 120s
- `get_player_status`: 60s

Sync worker runs on its own cadence — short TTLs keep the agent aligned without re-running SQL per token.

## Testing

- Unit tests in `backend/__tests__/services/ai/chat/tools/injuries.test.js`:
  - team with no injuries → `count: 0, players: []`
  - team with mixed statuses → correct shape, sorted as expected
  - league filter by `status=out` → excludes `questionable`
  - `get_player_status` on a healthy player → `status: "active"`
  - `get_player_status` on unknown `playerId` → `{ error }`
- Integration test in `agentService` test suite: mock ESPN-injured state, ask "is Tatum playing?", assert the agent picked `get_player_status` (or `get_team_injuries`), not `web_search`.

## Keep `web_search`

Not replacing it. Injury tools return structured current status; `web_search` still owns:

- Estimated return dates ("when will he be back?")
- Trade rumors, contract news
- Beat-reporter context the DB doesn't ingest

The system prompt should make that division of labor explicit.
