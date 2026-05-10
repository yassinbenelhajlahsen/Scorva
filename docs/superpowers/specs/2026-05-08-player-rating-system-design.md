# Player Rating System — Design Spec

**Date:** 2026-05-08
**Status:** Approved (user, Sections 1–6)
**Scope:** NBA only. NFL and NHL deferred to later phases (see Phasing).

## Problem

Scorva surfaces per-game stat lines (`StatCard`, `TopPerformerCard`) and recent results, but has no synthesized signal for *how good a performance was*. A 32/8/6 line in a blowout reads identically to a 32/8/6 line in a tight game where two of those buckets came in the clutch. There's no leaderboard to answer "best individual performances over the last 7 days?" beyond raw stat sorts that ignore game state.

Inspired by [Real App's rating system](https://docs.realapp.link/basics/real-rating-system) — closeness of game, time of game, importance of plays, distance, GW plays — we want a per-play, per-player rating that aggregates to a per-game number and feeds a 7-day leaderboard. Real's exact coefficients are proprietary; we re-derive a comparable approach using the data ESPN gives us.

## Solution

Three components:

1. **Plays enrichment.** Stop deleting non-scoring plays after Final. Capture per-play participants from ESPN. Capture shot distance via coordinates.
2. **Rating engine.** For each play, for each participant, compute a value: `base_value(play_type, role) + WPA_WEIGHT × wpa_delta × team_sign`, clamped to `[-10.0, +10.0]`. Sum to per-game, sum again to per-7-day.
3. **Surfaces.** Per-game grade (calibrated `0.0–10.0` from the open-ended raw sum) shown on `StatCard` and `TopPerformerCard`. New "Top Performances" component on Homepage with two tabs: best single-game performances (Best Games) and 7-day cumulative leaderboard (Last 7 Days).

The rating is naturally context-aware via WPA (Win Probability Added): a clutch GW shot in a tied game registers very differently from the same shot in a blowout, because the win-probability shift is much larger.

## Scope

**In scope (NBA v1):**
- Schema changes: `stats.rating` column, `play_participants`, `play_ratings` tables, `plays.shot_distance_ft` column
- Ingestion: drop non-scoring play cleanup, capture participants + distance, recompute rating per liveSync cycle
- Rating engine module
- Backfill for current NBA season
- API: new `GET /:league/top-performances` endpoint; `rating` field added to existing game-detail and player-detail responses
- UI: rating chip on `StatCard` (S-B placement), `TopPerformerCard` (T-D placement), new `TopPerformancesCard` component on Homepage (H-C layout)

**Out of scope:**
- NFL and NHL (separate phases — see Phasing)
- Storylines / "what to watch tonight" feature (originally bundled with grades; deferred)
- Per-play rating breakdown tooltip on `StatCard` ("why this rating?") — possible v2 polish
- Minutes-played normalization (Real doesn't do it)
- Letter grades / percentile chrome (compute layer is open-ended; cosmetic chrome can be added without re-rating)
- Rating-aware features that don't ship in v1: clutch-play leaderboards, "biggest plays of the night", shot heatmaps using the captured coordinates
- Player streak detection at moment-of-shot (Real factor; would require in-game per-player shooting state tracker)
- Defender impact on contested shots that don't result in a block (no participant data for it)
- Plus/minus-style credit for being on the floor during a run — only explicit play participants are credited

## Architecture

```
ESPN play-by-play (summary endpoint — has plays + winprobability)
        │
        ▼
liveSync (every ~30s during live; runUpsert post-Final)
        │
        ▼
upsertPlay()  ── existing
upsertPlayParticipants()  ── NEW (writes to play_participants)
        │
        ▼
plays + play_participants
        │
        ▼ ┌─ winprobability[] (joined to plays via playId)
        │ │
        ▼ ▼
ratingEngine.recomputeGame(gameId)  ── NEW
        │     • per play, per participant, per role
        │     • base_value(play_type, role) + WPA contribution
        │     • clamp to [-10.0, +10.0] per play
        │
        ▼
play_ratings  (per-play breakdown, debuggable, recomputable)
        │
        ▼ aggregate per (player, game)
        │
        ▼
stats.rating  (open-ended raw sum, ~10–30 typical, 40+ elite)
        │
        ▼ ─────────────────┬──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
StatCard chip       TopPerformerCard      Homepage:
(grade only,        (grade only,          "Top Performances"
 raw hidden)         raw hidden)           tab 1: Best Games   → GamePage
                                           tab 2: Last 7 Days  → PlayerPage
                                          (raw cumulative shown)
```

## Schema

```sql
-- backend/prisma/migrations/20260508000000_add_player_rating_system/migration.sql

ALTER TABLE stats ADD COLUMN rating NUMERIC(6,1);

ALTER TABLE plays ADD COLUMN shot_distance_ft SMALLINT;

CREATE TABLE play_participants (
  id              SERIAL PRIMARY KEY,
  play_id         INT NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL,
  espn_athlete_id VARCHAR(20),
  UNIQUE (play_id, player_id, role)
);
CREATE INDEX play_participants_player_idx ON play_participants(player_id);

CREATE TABLE play_ratings (
  id             SERIAL PRIMARY KEY,
  play_id        INT NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  player_id      INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id        INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  role           VARCHAR(20) NOT NULL,
  base_value     NUMERIC(4,1) NOT NULL,
  wpa_delta      NUMERIC(5,4),
  weighted_value NUMERIC(4,1) NOT NULL,
  UNIQUE (play_id, player_id, role)
);
CREATE INDEX play_ratings_player_game_idx ON play_ratings(player_id, game_id);
CREATE INDEX play_ratings_game_value_idx  ON play_ratings(game_id, weighted_value DESC);
```

**Notes:**
- `play_participants` is captured by ingestion (factual, from ESPN). `play_ratings` is computed (derived). Splitting them keeps re-ratings cheap if the formula changes — re-derive `play_ratings` from `play_participants + plays + winprob` without re-fetching ESPN.
- `stats.rating` is intentionally denormalized (could be derived by aggregating `play_ratings`) — the denormalization makes the 7-day leaderboard query fast (single `SUM(s.rating)`).
- `play_ratings` row volume at NBA scale: ~250 plays × 1–3 participants per game × 1230 regular-season games ≈ 600k rows/season. Manageable.
- Calibrated grade (`0.0–10.0`) is **not** stored — computed at the API/UI layer via `ratingDisplay.gradeFromRaw(raw) = max(0, min(10, raw / 5.5))`. Curve is tunable post-launch without backfill.
- The migration includes the existing migration-style `prisma migrate resolve --applied` workflow noted in `CLAUDE.md` (shadow DB has issues locally; apply SQL manually + mark resolved).

## Ingestion

**A. Drop non-scoring play cleanup.** Remove the `cleanupNonScoringPlays(pool, league)` call at `backend/src/ingestion/pipeline/upsert.js:83`. The function file stays (in case of league-scoped cleanup later for non-NBA leagues); just not invoked. All NBA plays — scoring and non — persist permanently.

**B. Capture participants + distance.** Extend `upsertPlay` (or wherever plays are written by the ingestion pipeline; see `backend/src/ingestion/upsert/`) to:
1. Compute `shot_distance_ft` via coordinates (function below) and write to `plays.shot_distance_ft`.
2. For each `participants[]` entry on the ESPN play, infer role from play type + text content, and write a `play_participants` row.

**Distance extractor (coords-only):** ESPN normalizes coordinates so the offensive basket is always at `(25, 0)`, regardless of which team is shooting (verified empirically across both home and away shots in the same game; avg ±0.7 ft difference vs. ESPN's text-stated distance). FT plays carry garbage sentinel coordinates (`-2147483xxx`) and yield `NULL`.

```js
function extractShotDistance(play) {
  if (!play.shootingPlay) return null;
  if (/free throw/i.test(play.text)) return null;
  const c = play.coordinate;
  if (!c || c.x < -1000 || c.y < -1000) return null;     // FT garbage sentinel
  const dist = Math.round(Math.sqrt((c.x - 25) ** 2 + c.y ** 2));
  return dist > 0 && dist < 90 ? dist : null;             // sanity bounds
}
```

**Role inference table.** ESPN's `participants[]` does NOT include a `type` field (verified across 462 plays in a real NBA game). Roles are derived from `play.type.text` + `text` content. The clean invariant: **`participants[0]` is always the primary actor of the play type** (the player whose play this is, matching `team.id`). `participants[1]`, when present, is the secondary actor whose role is read from text content.

| `play.type.text` class | text contains | participants[0] | participants[1] |
|---|---|---|---|
| Made shot (Jump/Layup/Dunk/Hook/Tip/etc.) | `(X assists)` | scorer | assister |
| Made shot | — | scorer | — |
| Missed shot | `blocks` | shot_attempter | blocker |
| Missed shot | — | shot_attempter | — |
| Free Throw - X of Y, made | — | scorer | — |
| Free Throw - X of Y, missed | — | shot_attempter | — |
| Defensive/Offensive Rebound | — | rebounder | — |
| Lost Ball / Bad Pass / OOB Turnover | `(X steals)` | turnover_committer | stealer |
| Lost Ball / Bad Pass / OOB Turnover | — | turnover_committer | — |
| Personal/Shooting/Loose Ball/Offensive Foul | — | foul_committer | — |
| Substitution / Timeout / End Period / Jump Ball | — | (skip — not rated) | — |

`type.text` may contain newline characters (e.g., `"Bad Pass\nTurnover"`). Normalize with `text.replace(/\s+/g, ' ').trim()` before matching.

The ESPN `team.id` on the play is the offense/possession team. For block rows, `participants[1]` (the blocker) belongs to the opposing team. For steals, `participants[1]` (stealer) belongs to the opposing team. This is used to compute the `team_sign` for WPA contribution (see Engine section).

Mapping config lives at: `backend/src/ingestion/mappings/nbaPlayRoles.js`.

**C. Recompute trigger.** Each `liveSync` cycle that touches an NBA game's plays calls `ratingEngine.recomputeGame(gameId)`. Strategy: idempotent full-recompute per game (single transaction):

```sql
-- All four statements run in a single transaction.
DELETE FROM play_ratings WHERE game_id = $1;

INSERT INTO play_ratings (play_id, player_id, game_id, role, base_value, wpa_delta, weighted_value)
  SELECT ... FROM plays JOIN play_participants ... LEFT JOIN winprob_for_game ...
  WHERE plays.gameid = $1;

-- Reset first so players who lost their participant attribution don't keep stale ratings.
UPDATE stats SET rating = NULL WHERE gameid = $1;

UPDATE stats SET rating = sub.total
FROM (
  SELECT player_id, SUM(weighted_value) AS total
  FROM play_ratings
  WHERE game_id = $1
  GROUP BY player_id
) sub
WHERE stats.playerid = sub.player_id AND stats.gameid = $1;
```

Cheap at NBA scale (~250 plays per game). Idempotent — safe to re-run after live updates. Final-game upsert path runs the same recompute. Players in `stats` who had no rated plays this game (e.g., DNP, only sub-out events) keep `rating = NULL` and are excluded from leaderboards via `WHERE s.rating IS NOT NULL`.

**D. Backfill.** One-time script `backend/src/ingestion/scripts/backfillPlayerRatings.js`:
1. For each NBA game in the current season with `status ILIKE '%final%'` and existing plays
2. Re-fetch plays from ESPN summary endpoint (gets back the non-scoring plays we deleted, where ESPN still serves them)
3. Run the same ingestion path → `play_participants` + `recomputeGame` → updates `stats.rating`

Past seasons are out of scope: most games' non-scoring plays are unrecoverable, and the 7-day leaderboard only needs recent games. PlayerPage game logs for past seasons will display ratings only on games where data is available; nulls render no chip.

**E. Cleanup ordering.** `cleanupClinchedPlayoffGames` deletes whole games — `ON DELETE CASCADE` on `plays` propagates through to `play_participants` and `play_ratings`. No new cleanup logic needed. (It only deletes scheduled clinched games anyway, which have no plays.)

## Rating engine

**Module:** `backend/src/services/games/ratingEngine.js`

**Public API:**
```js
ratingEngine.recomputeGame(gameId)       // idempotent full recompute, used by liveSync + backfill
ratingEngine.gradeFromRaw(raw)           // 0.0-10.0 calibration helper for API serializers
```

**Per-play, per-participant formula:**
```
weighted_value  = clamp(base_value + wpa_contribution, -10.0, +10.0)
base_value      = NBA_BASE_WEIGHTS[role][play_subtype]   // see table
wpa_contribution = WPA_WEIGHT × wpa_delta × team_sign
team_sign       = +1 if play moved player's team's win prob up, -1 otherwise
```

**Initial NBA base weights (v1, tunable):**

| Role | Subtype | base_value |
|---|---|---|
| scorer | made 3-pointer | `+1.5 + 0.02 × max(0, distance - 23)` (capped at +3.0) |
| scorer | made 2-pointer | `+1.0 + 0.02 × distance` (capped at +2.0) |
| scorer | made FT | `+0.4` |
| shot_attempter | missed 3pt | `-0.5` |
| shot_attempter | missed 2pt | `-0.5` |
| shot_attempter | missed FT | `-0.3` |
| assister | — | `+0.7` |
| rebounder | offensive | `+0.6` |
| rebounder | defensive | `+0.3` |
| stealer | — | `+1.0` |
| blocker | — | `+0.7` |
| turnover_committer | — | `-1.0` |
| foul_committer | shooting foul | `-0.5` |
| foul_committer | non-shooting | `-0.2` |

`distance` reads from `plays.shot_distance_ft`; `NULL` distance treats the bonus as `0`.

**WPA constants:**
- `WPA_WEIGHT = 30`. So a play that shifts win prob by 0.05 contributes ±1.5; a clutch play shifting by 0.30 contributes ±9.0, plenty to push past the +10 clamp.
- `wpa_delta` is `currentPlay.homeWinPercentage − previousPlay.homeWinPercentage`. Sourced from ESPN's `winprobability[]` array (already fetched and cached by `winProbabilityService.js`); join to plays via `playId`. Plays without matched winprob (e.g., before the model warms up) have `wpa_delta = NULL` → engine falls back to `base_value` only.
- `team_sign`: `+1` if the participant's team is home and `wpa_delta > 0`, or away and `wpa_delta < 0`. `-1` for the opposite.

**Calibration curve (display only, not stored):**
```js
gradeFromRaw(raw) = Math.max(0, Math.min(10, raw / 5.5));
```
Starting point. Sanity check after backfill: log per-game rating distributions; if median elite-game (top 1%) raw doesn't map to grade 9.0–9.9, tune `WPA_WEIGHT` or base values, or adjust the divisor in `gradeFromRaw`. This is a tuning task.

**Worked example — Lillard logo-3 buzzer-beater (made 3pt, distance ≈ 30 ft):**
- base = `1.5 + 0.02 × (30 - 23) = 1.64`
- WPA shift `+0.62` (home prob 12% → 74%); player on home team → `team_sign = +1` → `wpa_contribution = +18.6`
- raw = `1.64 + 18.6 = 20.24` → clamp to `+10.0`. Perfect 10. ✓

**Worked example — routine made 2 in Q1 of tied game (distance ≈ 8 ft):**
- base = `1.0 + 0.02 × 8 = 1.16`
- WPA shift `+0.02` → `wpa_contribution = +0.6`
- raw = `+1.76`. Solid but unspectacular. ✓

**Worked example — bad turnover at 95% home win prob, late, by away player:**
- base = `-1.0`
- home prob 95% → 99%; away player → `team_sign = -1` → `wpa_contribution = 30 × 0.04 × (-1) = -1.2`
- raw = `-2.2`. Modest negative. ✓

## API

**New endpoint — Top Performances feed**

```
GET /:league/top-performances?days=7&type=<games|cumulative>&limit=5

# type=games — best single performances in window (Tab 1 → click row → GamePage)
{
  type: "games",
  days: 7,
  performances: [
    {
      player:    { id, name, slug, imageUrl, position, team: { id, abbreviation, logo, primary_color } },
      game:      { id, date, opponent: { id, abbreviation, logo }, isHome, result },
      rating:        47.3,                  // raw open-ended sum
      ratingGrade:   8.6,                   // computed via ratingEngine.gradeFromRaw, 0.0-10.0
      stats:     { points, rebounds, assists }
    }, ...
  ]
}

# type=cumulative — sum over window per player (Tab 2 → click row → PlayerPage)
{
  type: "cumulative",
  days: 7,
  performances: [
    {
      player:        { ...same shape... },
      totalRating:   234.7,
      gamesPlayed:   5,
      avgPerGame:    47.0,
      bestGame:      { gameId, rating, opponentAbbreviation }
    }, ...
  ]
}
```

**Driving SQL (type=games):**
```sql
-- Use COALESCE(s.teamid, p.teamid) — matches the existing gameDetailService convention,
-- preserving team-at-game-time for traded players (per MEMORY.md note on stats.teamid).
SELECT s.playerid, s.gameid, s.rating,
       p.name, p.image_url, p.position,
       g.date, g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
       s.points, s.rebounds, s.assists,
       t.id   AS team_id,
       t.abbreviation, t.logo_url, t.primary_color
FROM stats s
JOIN games   g ON g.id = s.gameid
JOIN players p ON p.id = s.playerid
JOIN teams   t ON t.id = COALESCE(s.teamid, p.teamid)
WHERE g.league = $1
  AND g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - $2::int
  AND g.status ILIKE '%final%'
  AND g.type IN ('regular','playoff','final','makeup')
  AND s.rating IS NOT NULL
ORDER BY s.rating DESC, s.playerid ASC      -- id tiebreaker for determinism
LIMIT $3;
```
For `type=cumulative`: same `WHERE`, `GROUP BY s.playerid`, `ORDER BY SUM(s.rating) DESC`, with `MAX(s.rating)` and `argmax(s.gameid, s.rating)` for `bestGame`.

**Extended endpoints — `rating` + `ratingGrade` added to existing payloads:**
- `GET /:league/games/:gameId` — each player's stats object on the boxscore. Live games show the latest computed rating (recomputed per liveSync cycle); Final games are stable.
- `GET /:league/players/:slug` — game log rows include `rating`. Bonus surface for PlayerPage's game log table beyond the three required components.

**Routes/controllers/services placement:**
- Route: `backend/src/routes/games/topPerformances.js`
- Controller: `backend/src/controllers/games/topPerformancesController.js`
- Service: `backend/src/services/games/topPerformancesService.js`

**Caching:**
- `top-performances`: 60s TTL via existing `cached()` helper. Key: `top-performances:{league}:{type}:{days}:{limit}`. Short TTL because the 7-day window almost always contains today's live games (which finalize during the day).
- Game detail / player detail: existing TTLs unchanged. The new `rating` field rides along.

**Filter / edge cases:**
- `s.rating IS NOT NULL` excludes games we haven't rated yet (pre-rollout backfill incomplete; non-NBA leagues until those phases land).
- `g.type` filter excludes preseason/exhibition; matches existing `gamesService` convention.
- Date filter uses ET (matching `slateDate.js` convention). The 7-day window is consistent with how Scorva already thinks about "today".
- Live games are excluded from `top-performances` via `WHERE g.status ILIKE '%final%'` (Final-only leaderboard, agreed). Live ratings still appear on `StatCard` and `TopPerformerCard` directly via game-detail. **Superseded 2026-05-09:** live games are now included in `/:league/top-performances` across all three types (`performances`, `rankings`, `plays`). Rows expose `game.isLive`, `game.homeScore`, `game.awayScore`; `result` is forced `null` for live rows so a provisional W/L isn't shown. Frontend rows render a `LIVE` pill in place of the W/L badge. See `docs/ARCHITECTURE.md` §Player Ratings caveats.

## UI surfaces

All chosen variants from the visual design exploration session. **Raw rating is hidden everywhere except the Last 7 Days cumulative tab** on the Homepage component.

**StatCard chip — variant S-B**
- File: `frontend/src/components/cards/StatCard.jsx`
- Position: absolute top-left of the card (`absolute top-3 left-3 flex flex-col items-start`)
- Stacked elements:
  - Label `<span>` `text-[9px] uppercase tracking-widest text-text-tertiary font-medium`: literal text `Rating`
  - Value `<span>` `text-accent font-bold text-2xl tabular-nums leading-none`: grade number (one decimal, no `/10` suffix, no raw shown)
- Renders only when `player.rating != null`; chip is omitted entirely otherwise (e.g., live game before first rating compute, or a game pre-backfill).

**TopPerformerCard chip — variant T-D**
- File: `frontend/src/components/cards/TopPerformerCard.jsx`
- Right-info zone splits into two flex children separated by a vertical divider (`border-l border-white/[0.08]`):
  - Left child (`flex-1`): existing player info — name, position, stat blocks. Stat row compresses from the current 4-stat layout to a tighter inline row (same vertical height).
  - Right child (`shrink-0 pl-3 flex flex-col items-center`): rating column
    - Value `<span>` `text-accent font-black text-3xl tabular-nums leading-none`: grade number
    - Label `<span>` `text-[9px] uppercase tracking-widest text-text-tertiary mt-1`: literal `Rating`
- Left slab (avatar + "Top Performer" label) unchanged.
- Renders rating column only when `player.rating != null`.

**Homepage `TopPerformancesCard` — variant H-C**
- New file: `frontend/src/components/cards/TopPerformancesCard.jsx`
- Mounted on `Homepage.jsx` between `<NewsSection />` and the Today's Games section.
- League scope for v1: NBA-only. Component takes a `league` prop (`"nba"`); when NFL/NHL phase lands, a league switcher gets added (matches the existing Homepage league tabs pattern).
- Outer card: `bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 max-w-[1200px]`
- Header row: `Top Performances` left, `Last 7 Days` subtitle right
- Two pill tabs: `Best Games` (default) / `Last 7 Days`. Active = `bg-accent text-white`.
- **Hero row (#1):**
  - Team-color gradient background derived from `player.team.primary_color`: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, transparent 100%)`, border `1px solid ${color}40`
  - `#1` in `text-accent font-black text-3xl`
  - 56×56 avatar with `ring-2 ring-accent/40`
  - Name (bold) + meta line: `32/12/9 · vs LAL · May 5` for Best Games; `5 GP · avg 46.9` for Last 7 Days
  - Right-side big number: grade for Best Games; total cumulative raw for Last 7 Days
- **Compact rows (#2–#5):**
  - Rank, 28×28 avatar, name (truncate), small meta, right-aligned number
- Hover: `hover:bg-surface-overlay` on row backgrounds
- Click target:
  - Best Games row → `/${league}/games/${gameId}`
  - Last 7 Days row → `/${league}/players/${playerSlug}`
- Hooks: `useTopPerformances(league, days, type, limit)` — TanStack Query hook against `/${league}/top-performances?...`.
- Skeleton: `frontend/src/components/skeletons/TopPerformancesCardSkeleton.jsx` (matches the layout — hero row + 4 compact rows).

**Helper module (frontend & backend):**
- Backend: `backend/src/services/games/ratingEngine.js` exports `gradeFromRaw(raw)`. Used by API serializers in `top-performances`, game-detail, and player-detail responses to populate `ratingGrade`.
- Frontend: no separate helper. The grade comes pre-computed from the API. (Avoids duplicating the calibration curve.)

## Phasing

**v1 — NBA, this spec.**

**v2 — NFL.** Adds:
- `nflPlayRoles.js` mapping (passer/rusher/receiver/tackler/sacker/intercepter)
- `nflWeights.js` (passing yards, rushing yards, TDs, INTs, sacks, etc.)
- ESPN's `winprobability[]` is already supported by `winProbabilityService.js` for NFL; reuse the same mechanism.

**v3 — NHL.** Adds:
- `nhlPlayRoles.js` mapping (goal scorer / assister / shot taker / goalie)
- `nhlWeights.js` (goals, assists, saves, shots-on-goal, hits, blocks, PIM)
- **Synthesized winprob.** ESPN does NOT ship winprobability for NHL. New module: `nhlWinProbModel.js` — simple logistic on score margin + period + time + empty-net flag. Or: ship NHL with non-WPA weighting initially and add WPA later as a second pass.

The engine module (`ratingEngine.js`) is built generic from day one — takes `(play, formulaConfig, winprobFn)` — so v2/v3 add config files + a per-league WPA strategy variant without engine changes.

**Storylines feature** (originally bundled with grades in the "Tonight on Scorva" framing) is fully deferred. May revisit after this ships.

## Open questions / future work

- **Backfill horizon.** Spec says "current NBA season only". If we later want all-time rating support, we'd need to keep all `plays` (already done after the cleanup undo), and we'd lose any pre-rollout games' non-scoring plays permanently. Document this in `docs/ARCHITECTURE.md` so the constraint is visible.
- **Calibration tuning.** The `WPA_WEIGHT = 30` and `gradeFromRaw` divisor `5.5` are starting points. The implementation plan should include a tuning task: after the first week of backfilled data, plot rating distributions, eyeball outliers, and pick final values.
- **"Why this rating?" tooltip.** Per-play breakdown UX (clutch GW play / steal at high leverage / etc.) is a natural v2 polish using `play_ratings`. Out of scope for v1 but the data layer supports it.
- **Coordinates.** We extract `shot_distance_ft` but not the raw `coordinate.x/y`. If shot heatmaps become a feature, add `coordinate_x SMALLINT, coordinate_y SMALLINT` columns to `plays` then.
- **Negative game ratings.** `stats.rating` can be negative for genuinely bad performances. Display via `gradeFromRaw` floors at 0 for the chip (chip never reads negative). The leaderboard query filters to top-down by `s.rating DESC` so negatives never appear in top performances. PlayerPage game logs may show a `0.0` chip for a negative-raw game — acceptable for v1; revisit if it confuses users.
- **Recompute coupling with `liveSync`.** First implementation should run `recomputeGame` synchronously inside the upsert transaction. If it ever slows the live cycle measurably, move to a debounced async job (`setImmediate` or a small queue). At ~250 plays per game and pure SQL, this is unlikely to matter at v1 scale.

## References

- Real App rating system: https://docs.realapp.link/basics/real-rating-system
- Existing winprob service: `backend/src/services/games/winProbabilityService.js`
- Existing plays cleanup: `backend/src/ingestion/cleanup/cleanupPlays.js` (function retained but call removed)
- Plays schema: `backend/prisma/schema.prisma` model `plays`
- ESPN summary endpoint shape: `summary?event=<eventId>` returns `plays[]` (top-level) and `winprobability[]` (top-level), joinable via `playId`
