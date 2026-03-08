# Plan: Add `type` Enum Column to Games Table

## Problem

The current `game_label` string column is used as the sole signal for game classification. Frontend components (`GameCard.jsx`, `GamePage.jsx`) derive game type by string-matching:

```javascript
const isPlayoff = !!game.game_label &&
  game.game_label.toLowerCase() !== "preseason" &&
  !game.game_label.toLowerCase().includes("makeup");
const isChampionship =
  label.includes("nba finals") ||
  label.includes("stanley cup") ||
  label.includes("super bowl");
```

This is fragile — any game with a non-null `game_label` that wasn't explicitly excluded renders as a playoff game. The NBA In-Season Tournament is a real example: those games have notes/headlines from ESPN but are regular season games, so they'd incorrectly show the playoff badge.

Backend services also use `game_label IS NULL` to filter regular season games:

```sql
AND g.game_label IS NULL
```

This works today but breaks silently if any non-playoff game ever gets a label.

Additionally, `game_label` contains meaningful display text (`"NBA Finals - Game 1"`, `"Wild Card Round"`, `"Super Bowl LIX"`) that is currently discarded after the boolean check — it is never shown in the UI.

## Solution

Add a `type` column with a fixed set of values to drive all classification logic. `game_label` stays as the **display field** and will now be shown in the UI alongside the badge. The `type` column becomes the single source of truth for logic.

### Enum values

| Value | Meaning |
|---|---|
| `regular` | Regular season game |
| `preseason` | Preseason game |
| `playoff` | Postseason, non-championship round |
| `final` | Championship game (NBA Finals, Stanley Cup Finals, Super Bowl) |
| `makeup` | Rescheduled/makeup game |
| `other` | All-Star, Pro Bowl, skills events, In-Season Tournament knockouts, etc. |

---

## Step 0 — Verify ESPN API Structure (Run Locally First)

The sandbox used during planning does not have internet access. **Run these curls on a local machine before implementing anything.** The results confirm what `season.type` values ESPN uses and whether certain game types (In-Season Tournament, All-Star, Pro Bowl) get a distinct type or just a `notes` headline.

```bash
ESPN="https://site.api.espn.com/apis/site/v2/sports"
JQ='.events[] | {name, date, season_type: .season.type, season_slug: .season.slug, notes: (.competitions[0].notes // [])}'

# NBA
curl -s "$ESPN/basketball/nba/scoreboard?dates=20251007" | jq "$JQ"   # Preseason
curl -s "$ESPN/basketball/nba/scoreboard?dates=20251121" | jq "$JQ"   # In-Season Tournament group stage
curl -s "$ESPN/basketball/nba/scoreboard?dates=20251217" | jq "$JQ"   # In-Season Tournament knockout/final
curl -s "$ESPN/basketball/nba/scoreboard?dates=20260308" | jq "$JQ"   # Regular season
curl -s "$ESPN/basketball/nba/scoreboard?dates=20260216" | jq "$JQ"   # All-Star

# NFL
curl -s "$ESPN/football/nfl/scoreboard?dates=20250811" | jq "$JQ"     # Preseason
curl -s "$ESPN/football/nfl/scoreboard?dates=20251109" | jq "$JQ"     # Regular season (Week 10)
curl -s "$ESPN/football/nfl/scoreboard?dates=20260111" | jq "$JQ"     # Wild Card
curl -s "$ESPN/football/nfl/scoreboard?dates=20260118" | jq "$JQ"     # Divisional
curl -s "$ESPN/football/nfl/scoreboard?dates=20260125" | jq "$JQ"     # Conference Championship
curl -s "$ESPN/football/nfl/scoreboard?dates=20260201" | jq "$JQ"     # Pro Bowl
curl -s "$ESPN/football/nfl/scoreboard?dates=20260209" | jq "$JQ"     # Super Bowl

# NHL
curl -s "$ESPN/hockey/nhl/scoreboard?dates=20250928" | jq "$JQ"       # Preseason
curl -s "$ESPN/hockey/nhl/scoreboard?dates=20260308" | jq "$JQ"       # Regular season
curl -s "$ESPN/hockey/nhl/scoreboard?dates=20260201" | jq "$JQ"       # All-Star
```

**Key questions to answer before writing any code:**

1. Do In-Season Tournament games have `season_type: 2` (regular) or `3` (postseason)? Do they have `notes`?
   - If they have `season_type: 2` and a notes headline, they currently get excluded from standings and player stats (`game_label IS NULL` is false) — which is wrong. The `type` column fixes this by letting them be `regular`.
   - If they have `season_type: 3`, they'd need to be `other` so they don't pollute playoff counts.
2. Do NBA/NHL All-Star games use `season_type: 4` or something else?
3. Does the NFL Pro Bowl / skills events get a distinct `season_type`?
4. Do makeup games appear with a special season type, or only via a `notes` headline?

The classification logic in `eventProcessor.js` (Step 3) must be adjusted based on these answers.

---

## Current Implementation Facts (Confirmed by Code Review)

### Preseason games are NOT skipped at ingest

All games regardless of season type flow through `eventProcessor.js` → `upsertGame.js` → DB. There is no filtering in `upsert.js` or `historicalUpsert.js` by season type. Preseason is tagged with `game_label = 'Preseason'` but is still stored like any other game.

### Standings are currently protected

`standingsService.js` uses `AND g.game_label IS NULL` in its JOIN to filter to regular season only. After this change it becomes `AND g.type = 'regular'`. Net effect on standing calculations: none.

```sql
-- Before
AND g.game_label IS NULL

-- After
AND g.type = 'regular'
```

### Player stats and averages are currently protected

`playerInfoService.js` uses `AND g.game_label IS NULL` in **6 places** — two per league (NBA, NFL, NHL):
- Most recent 12 games shown on the player profile
- Season average calculations

All 6 become `AND g.type = 'regular'`. Net effect on player records: none.

### Games list shows all game types (correct, no change)

`gamesService.js` has no type-based filtering. Preseason, playoffs, All-Star all appear in the games list. This is intentional and stays as-is.

---

## Step 1 — Prisma Schema

**File:** `backend/prisma/schema.prisma`

Add the enum and column. The default of `regular` ensures any backlog rows not yet updated are safe.

```prisma
enum GameType {
  preseason
  regular
  playoff
  final
  makeup
  other
}

model games {
  // ... existing fields ...
  game_label  String?
  type        GameType @default(regular)  // NEW
}
```

---

## Step 2 — Migration: Add Column + Backfill Legacy Data

Run:
```bash
cd backend && node_modules/.bin/prisma migrate dev --name add_game_type
```

Then **before deploying to production**, run this query against the DB to inspect every distinct `game_label` value that currently exists:

```sql
SELECT DISTINCT game_label, COUNT(*) as count
FROM games
WHERE game_label IS NOT NULL
GROUP BY game_label
ORDER BY game_label;
```

Use those results to confirm the CASE statement below covers all values correctly (especially anything that might incorrectly fall into `'playoff'`). Then run the backfill:

```sql
UPDATE games SET type = CASE
  -- Championships (check before generic playoff catch-all)
  WHEN LOWER(game_label) LIKE '%nba finals%'    THEN 'final'
  WHEN LOWER(game_label) LIKE '%stanley cup%'   THEN 'final'
  WHEN LOWER(game_label) LIKE '%super bowl%'    THEN 'final'

  -- Preseason
  WHEN LOWER(game_label) = 'preseason'          THEN 'preseason'

  -- Makeup games
  WHEN LOWER(game_label) LIKE '%makeup%'        THEN 'makeup'

  -- All-Star / Pro Bowl / skills (adjust patterns based on curl output)
  WHEN LOWER(game_label) LIKE '%all-star%'      THEN 'other'
  WHEN LOWER(game_label) LIKE '%all star%'      THEN 'other'
  WHEN LOWER(game_label) LIKE '%pro bowl%'      THEN 'other'
  WHEN LOWER(game_label) LIKE '%skills%'        THEN 'other'

  -- In-Season Tournament (adjust based on curl output)
  -- Use 'regular' if ESPN marks these as season_type 2 (so they count in stats/standings)
  -- Use 'other' if ESPN marks them as season_type 3
  WHEN LOWER(game_label) LIKE '%nba cup%'       THEN 'other'
  WHEN LOWER(game_label) LIKE '%in-season%'     THEN 'other'
  WHEN LOWER(game_label) LIKE '%in season%'     THEN 'other'

  -- Regular season: null label
  WHEN game_label IS NULL                       THEN 'regular'

  -- Anything else non-null = playoff round
  ELSE                                               'playoff'
END;
```

> Add this UPDATE directly inside the generated Prisma migration SQL file so it runs atomically with the column creation on `prisma migrate deploy` in production.

---

## Step 3 — eventProcessor.js: Derive `type` at Ingest

**File:** `backend/src/populate/src/eventProcessor.js` (~line 474)

Below where `gameLabel` is set, add `gameType` derivation. Exact string patterns for the notes-based checks (All-Star, In-Season Tournament, etc.) must be confirmed against the ESPN curl output from Step 0.

```javascript
const gameLabel =
  event.season?.type === 1
    ? 'Preseason'
    : (event.competitions?.[0]?.notes?.[0]?.headline || null);

// Derive structured type from ESPN season type + notes headline
const headline = (gameLabel || '').toLowerCase();
let gameType;

if (event.season?.type === 1) {
  gameType = 'preseason';
} else if (event.season?.type === 3) {
  // Postseason — check if it's the championship round
  if (
    headline.includes('nba finals') ||
    headline.includes('stanley cup') ||
    headline.includes('super bowl')
  ) {
    gameType = 'final';
  } else {
    gameType = 'playoff';
  }
} else {
  // season.type === 2 (regular) or unknown
  if (headline.includes('makeup')) {
    gameType = 'makeup';
  } else if (
    headline.includes('all-star') ||
    headline.includes('all star') ||
    headline.includes('pro bowl') ||
    headline.includes('skills')
  ) {
    gameType = 'other';
  } else if (
    headline.includes('nba cup') ||
    headline.includes('in-season') ||
    headline.includes('in season')
  ) {
    // 'other' or 'regular' — confirm via curl (Step 0)
    // If In-Season Tournament group play counts in standings, use 'regular'
    // If knockout rounds should be excluded, use 'other'
    gameType = 'other';
  } else {
    gameType = 'regular';
  }
}
```

Add `gameType` to the `gamePayload` object.

---

## Step 4 — upsertGame.js: Include `type` in Upsert

**File:** `backend/src/populate/src/upsertGame.js`

Add `type` to three places: the INSERT column list, the `ON CONFLICT DO UPDATE` SET clause, and the values array. `gamePayload.gameType` flows in from `eventProcessor.js`.

```sql
INSERT INTO games (..., game_label, type, ...)
VALUES (..., $N, $N+1::\"GameType\", ...)
ON CONFLICT (espnid) DO UPDATE SET
  ...,
  game_label = EXCLUDED.game_label,
  type       = EXCLUDED.type,
  ...
```

> Note: if using a native Postgres enum (`GameType`), the value must be cast on insert. Alternatively, define `type` as `VARCHAR(20) NOT NULL DEFAULT 'regular'` in the migration (bypassing the Prisma enum) for simpler raw SQL compatibility — discuss before implementing.

---

## Step 5 — Backend Services: Replace `game_label IS NULL` → `type = 'regular'`

### standingsService.js

One location. No change to query logic — just the filter condition.

```sql
-- Before
AND g.game_label IS NULL

-- After
AND g.type = 'regular'
```

### playerInfoService.js

Six locations (two per `getNbaPlayer`, `getNflPlayer`, `getNhlPlayer`). Same replacement in each. Player season averages and recent game history only reflect regular season games.

---

## Step 6 — Expose `type` in API Responses

### gameInfoService.js

Add `gameType` to the `JSON_BUILD_OBJECT` for all three league functions. Already exposes `gameLabel`.

```sql
-- Add alongside existing gameLabel:
'gameLabel', g.game_label,
'gameType',  g.type
```

### gamesService.js

Check whether the query uses `SELECT g.*` (which would auto-include `type` after migration) or an explicit column list (needs `g.type` added). The frontend `GameCard` receives data from this service.

### favoritesService.js

Add `g.type` to the recent team games SELECT (currently includes `g.game_label`).

---

## Step 7 — Frontend: Use `type` for Logic, Display `game_label` as Text

> Note on field name casing: `gameInfoService.js` returns camelCase (`gameLabel`, `gameType`) used by `GamePage`. `gamesService.js` returns snake_case (`game_label`, `game_type` or `type`) used by `GameCard`. Confirm casing from the API response before writing frontend code.

### GameCard.jsx

Replace string-matching with direct type checks, and render `game_label` as visible text:

```javascript
// Before
const isPlayoff = !!game.game_label &&
  game.game_label.toLowerCase() !== "preseason" &&
  !game.game_label.toLowerCase().includes("makeup");
const isChampionship =
  label.includes("nba finals") ||
  label.includes("stanley cup") ||
  label.includes("super bowl");

// After
const isPlayoff = game.type === 'playoff' || game.type === 'final';
const isChampionship = game.type === 'final';
```

Display `game.game_label` text in the card (e.g., below team names) when present and game is not regular/preseason.

### GamePage.jsx

Same logic replacement using `game.gameType`. Display `game.gameLabel` prominently in the game header — e.g., `"NBA Finals - Game 1"` rendered near the playoff logo.

---

## Step 8 — Tests

- **`backend/__tests__/populate/upsertGame.test.js`** — add `gameType` to test payloads; test that `type` is included in the INSERT and ON CONFLICT SET
- **`backend/__tests__/routes/`** — update any tests that assert on API response shapes to include `type`/`gameType`
- **`backend/__tests__/services/standingsService.test.js`** — verify `type = 'regular'` filter (if test mocks query)
- **Frontend `GameCard` and `GamePage` tests** — add `type`/`gameType` field to mock game data

---

## What Does NOT Change

- `game_label` column stays — it becomes the display field
- `gamesService.js` has no type-based filtering — all game types remain visible in game lists
- Playoff badge images (`NBAPlayoff.png`, `NBAFinal.png`, etc.) are unchanged
- `upsert.js`, `historicalUpsert.js`, `liveSync.js` entry points are unchanged — only `eventProcessor.js` and `upsertGame.js` change for ingestion
- Preseason games continue to be ingested and shown in the games list
- Team win/loss records and player season averages are unaffected (same logical filter, just expressed via `type = 'regular'` instead of `game_label IS NULL`)
