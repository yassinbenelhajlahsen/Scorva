# Plan: 30s Live Sync Worker — ESPN → Postgres (Scores + Clock + Stats)

## What this solves

`upsert.js` runs on a schedule (not continuously), so live game scores/stats sit stale
between runs. This plan adds a persistent worker that polls ESPN every 30s **only while
games are live**, writes fresh scores, player stats, and — new — the current period and
clock into Postgres.

---

## ESPN fields available for live games

The scoreboard endpoint (`/scoreboard`) returns per-event:

| ESPN field | Example value | Meaning |
|---|---|---|
| `event.status.type.description` | `"IN"` | live / scheduled / final |
| `event.status.period` | `3` | current period number |
| `event.status.displayClock` | `"2:34"` | time remaining in current period |

These are already fetched inside `eventProcessor.js` but `period` and `displayClock`
are currently discarded. The summary endpoint (`/summary?event=<id>`) is used for
per-player box score stats and is called once per live game per tick.

---

## Database changes (write side)

### New columns on `games`

| Column | Type | Meaning |
|---|---|---|
| `current_period` | `Int?` | current period/quarter number (null when not live) |
| `clock` | `String?` | time remaining in current period e.g. `"2:34"` (null when not live) |

When a game goes Final, both columns are set to `null` by `upsertGame`.

### Prisma schema (`backend/prisma/schema.prisma`)

Add inside `model games`:
```prisma
current_period  Int?
clock           String?
```

### Migration

```bash
cd backend && node_modules/.bin/prisma migrate dev --name add_live_clock_fields
```

### `upsertGame.js` (modified)

The `INSERT ... ON CONFLICT DO UPDATE` statement gains two more columns:
```sql
current_period = EXCLUDED.current_period,
clock          = EXCLUDED.clock
```

The `gamePayload` shape gains:
```js
{ ..., currentPeriod: number | null, clock: string | null }
```

---

## `eventProcessor.js` (modified)

Extract the two new fields right after the existing status line (line 387):

```js
// existing
const status = event.status?.type?.description ?? null;

// new — only meaningful when status === 'IN'
const currentPeriod = event.status?.period ?? null;
const clock         = event.status?.displayClock ?? null;
```

Add to `gamePayload` (line 475 block):
```js
currentPeriod,
clock,
```

This change applies to both `upsert.js` (the existing scheduled run) and `liveSync.js`
(the new worker) since both call `processEvent()`.

---

## `liveSync.js` — the 30s worker

**File:** `backend/src/populate/liveSync.js`

### Startup logic

```
1. For each league (nba, nfl, nhl):
     fetch scoreboard → collect events where status === 'IN'
2. If total live events === 0 → log "No live games" and exit (no interval opened)
3. Otherwise → start setInterval(tick, 30_000)
```

### Each tick

```
1. Re-fetch scoreboard for leagues that had live games in the previous tick
2. Filter to status === 'IN' events
3. If none remain → clearInterval + pool.end() + process.exit(0)
4. For each live event (batch of 5, matching existing pattern):
     a. processEvent(client, event, leagueSlug)
        — this upserts scores, quarters, clock, current_period, and stats
        — uses the same pipeline as upsert.js; no new code paths needed
5. Release client back to pool
```

### Exit handling

```js
process.on('SIGTERM', () => { clearInterval(handle); pool.end(); });
process.on('SIGINT',  () => { clearInterval(handle); pool.end(); });
```

### What it does NOT do

- Does not fetch player details from ESPN (same skip logic as upsert.js for already-cached players)
- Does not touch scheduled or Final games
- Does not replace `upsert.js` — that keeps running for schedule transitions and non-live updates

### File shape

```js
import { pool } from '../db/db.js';
import { processEvent } from './src/eventProcessor.js';

const LEAGUES = [
  { slug: 'nba', sport: 'basketball', league: 'nba' },
  { slug: 'nfl', sport: 'football',   league: 'nfl' },
  { slug: 'nhl', sport: 'hockey',     league: 'nhl' },
];
const SCOREBOARD_URL = (sport, league) =>
  `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`;
const INTERVAL_MS = 30_000;

async function fetchLiveEvents(sport, leagueSlug) {
  const res  = await fetch(SCOREBOARD_URL(sport, leagueSlug));
  const data = await res.json();
  return (data.events ?? []).filter(
    e => e.status?.type?.description === 'IN'
  );
}

async function tick(liveLeagues) {
  const client = await pool.connect();
  try {
    const stillLive = [];
    for (const { slug, sport } of liveLeagues) {
      const events = await fetchLiveEvents(sport, slug);
      if (events.length) stillLive.push({ slug, sport });
      // process in batches of 5 (matches existing upsert.js pattern)
      for (let i = 0; i < events.length; i += 5) {
        await Promise.all(
          events.slice(i, i + 5).map(e => processEvent(client, e, slug))
        );
      }
    }
    return stillLive; // caller uses this to decide whether to keep going
  } finally {
    client.release();
  }
}

async function main() {
  // Initial pass
  let liveLeagues = [];
  for (const { slug, sport } of LEAGUES) {
    const events = await fetchLiveEvents(sport, slug);
    if (events.length) liveLeagues.push({ slug, sport });
  }

  if (!liveLeagues.length) {
    console.log('No live games. Exiting.');
    await pool.end();
    return;
  }

  console.log(`Live games found. Starting 30s sync for: ${liveLeagues.map(l => l.slug).join(', ')}`);
  liveLeagues = await tick(liveLeagues); // first tick immediately

  if (!liveLeagues.length) { await pool.end(); return; }

  const handle = setInterval(async () => {
    liveLeagues = await tick(liveLeagues);
    if (!liveLeagues.length) {
      console.log('All games finished. Exiting.');
      clearInterval(handle);
      await pool.end();
    }
  }, INTERVAL_MS);

  process.on('SIGTERM', () => { clearInterval(handle); pool.end(); });
  process.on('SIGINT',  () => { clearInterval(handle); pool.end(); });
}

main().catch(err => { console.error(err); process.exit(1); });
```

---

## Backend service layer (read side)

### `gamesService.js` + `gameInfoService.js` (modified)

Add `current_period` and `clock` to every `SELECT` that returns game rows. No new
queries needed — just add the columns to existing `SELECT` lists.

Example:
```sql
SELECT g.id, g.homescore, g.awayscore, g.status,
       g.current_period, g.clock,   -- new
       ...
FROM games g
WHERE ...
```

The API response shape already passes the full game object to the frontend; adding
two nullable fields is non-breaking.

---

## Railway deployment

Add a second Railway service inside the existing Scorva project:

| Setting | Value |
|---|---|
| Source | Same GitHub repo |
| Root directory | `backend` |
| Start command | `node src/populate/liveSync.js` |
| Restart policy | `Always` (Railway restarts it if it crashes) |
| Environment | Copy or share the same env var group as the API service |
| PORT binding | None — Railway detects no PORT and treats it as a worker |

The worker process exits cleanly when no live games remain. Railway's `Always` restart
policy will bring it back on the next deploy or if it crashes unexpectedly. Because it
exits on its own when done, it won't idle and burn resources between games.

---

## Frontend

### Display clock + period on `GamePage.jsx`

When `status === 'IN'`:
```
Q3  ·  2:34 remaining         ← current_period + clock from DB
```

Render next to or below the Live pill. Use the existing `text-text-tertiary` style.
Zero extra API calls — the data is already in the game object returned by `GET /api/:league/games/:gameId`.

Logic:
```js
const periodLabel = getPeriodLabel(game.current_period, league);
// NBA/NFL → "Q1"/"Q2"/"Q3"/"Q4"/"OT"
// NHL     → "P1"/"P2"/"P3"/"OT"

{isLive && game.clock && (
  <span className="text-text-tertiary text-sm">
    {periodLabel} · {game.clock} remaining
  </span>
)}
```

Add `getPeriodLabel(period, league)` to `frontend/src/utilities/formatters.js`.

### `GameCard.jsx`

Show a condensed version below the score when live:
```
● LIVE  Q3  2:34
```

Same data, zero extra cost — already in the games list response.

---

## Implementation order

1. `backend/prisma/schema.prisma` — add `current_period`, `clock`
2. Run migration (`prisma migrate dev --name add_live_clock_fields`)
3. `backend/src/populate/src/eventProcessor.js` — extract + pass `currentPeriod`, `clock`
4. `backend/src/populate/src/upsertGame.js` — write new columns in upsert SQL
5. `backend/src/populate/liveSync.js` — new worker file
6. `backend/src/services/gamesService.js` + `gameInfoService.js` — add columns to SELECTs
7. `frontend/src/utilities/formatters.js` — add `getPeriodLabel()`
8. `frontend/src/pages/GamePage.jsx` — render period + clock when live
9. `frontend/src/components/cards/GameCard.jsx` — condensed live clock display
10. Deploy `liveSync.js` as Railway worker service

---

## Verification

- With a live game in DB, run `node src/populate/liveSync.js` → ESPN called every 30s,
  `current_period` and `clock` updating in Postgres (`SELECT clock, current_period FROM games WHERE status='IN'`)
- No live games → process exits immediately, no intervals opened
- Game goes Final → worker detects `stillLive` is empty after that tick, exits cleanly
- `GET /api/nba/games/:id` on a live game returns `{ clock: "2:34", current_period: 3, ... }`
- GamePage shows "Q3 · 2:34 remaining" next to the Live pill; GameCard shows "● LIVE  Q3 2:34"
- After game ends, `clock` and `current_period` are null in DB, frontend hides the clock line
