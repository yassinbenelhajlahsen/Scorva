# Player Awards — Design Spec

**Date:** 2026-04-28
**Status:** Approved, ready for implementation plan
**Scope:** Surface career awards (MVP, All-Star, All-NBA, etc.) on `PlayerPage` across NBA, NFL, and NHL, sourced from ESPN's awards API.

## Goals

- Show a player's career honors on their page in a way that feels earned, not like metadata.
- Single source of truth in our DB so reads are fast and offline-resilient (no per-request ESPN calls).
- Idempotent, season-scoped seed script so we can re-run safely after each season's awards are announced.

## Non-Goals

- Importing historical players who never appeared in our DB (e.g., Wilt Chamberlain). Award rows that don't match an existing `players` row are logged and dropped.
- Team-level awards (NBA Champion, Stanley Cup, Super Bowl Champion) — see Open Questions; these may not be in ESPN's awards index. If absent, defer to a follow-up that derives championships from final-game data.
- Live updates / scheduled cron. Annual manual re-run after the season ends.
- Per-season filtering on the UI. Career honors are global to the player.

## Award Scope

| League | Set | Awards |
|---|---|---|
| NBA  | C (full) | MVP, Finals MVP, Champion, All-Star, All-NBA (1st/2nd/3rd), All-Defensive (1st/2nd), ROY, DPOY, 6MOY, MIP, Scoring Leader |
| NFL  | B        | MVP, Super Bowl Champion, Super Bowl MVP, Pro Bowl, All-Pro (1st/2nd) |
| NHL  | B        | Hart, Stanley Cup, Conn Smythe, All-Star, First/Second All-Star Team, Calder |

## Data Source

**ESPN Core API.** Per-league, per-season index endpoint:

```
https://sports.core.api.espn.com/v2/sports/{sport}/leagues/{league}/seasons/{year}/awards
```

Each entry is a `$ref` to an individual award. The award object exposes:

```json
{
  "id": "33",
  "name": "MVP",
  "description": "NBA Most Valuable Player",
  "winners": [
    { "athlete": { "$ref": ".../athletes/{espnAthleteId}?..." }, "team": { "$ref": "..." } }
  ]
}
```

ESPN athlete IDs in the URL map directly to `players.espn_playerid` (already keyed `(espn_playerid, league)`).

### Verified Working
- NBA `/seasons/2024/awards` returned 20 awards including MVP, ROY, 6MOY (confirmed during brainstorm).
- NFL `/seasons/2023/awards` returned 9 awards.
- NHL `/seasons/2024/awards` returned 14 awards.

### Open Questions
- All-Star *game selections* (vs. All-Star *team awards*): may not be in this endpoint. Verify during initial seed; if absent, log and revisit.
- Championships (Champion / Stanley Cup / Super Bowl Champion): same uncertainty. If absent, derive from existing playoff/final games in a follow-up.

## Storage

### Schema

```sql
CREATE TABLE player_awards (
  id          SERIAL PRIMARY KEY,
  player_id   INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  league      VARCHAR(10) NOT NULL,        -- 'nba' | 'nfl' | 'nhl'
  season      VARCHAR(10) NOT NULL,        -- e.g. '2025-26', '2024'
  award_type  VARCHAR(50) NOT NULL,        -- canonical key, see taxonomy below
  award_name  VARCHAR(100) NOT NULL,       -- ESPN display name, e.g. 'Most Valuable Player'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT player_awards_unique UNIQUE (player_id, league, season, award_type)
);

CREATE INDEX player_awards_player_idx ON player_awards (player_id);
CREATE INDEX player_awards_league_season_idx ON player_awards (league, season);
```

Migration file: `backend/prisma/migrations/<ts>_add_player_awards/migration.sql`.

### Award Type Taxonomy

Defined in `backend/src/ingestion/awards/awardTypeMap.js`. Per-league mapping from ESPN award name → canonical type + tier.

| canonical | tier | NBA | NFL | NHL |
|---|---|---|---|---|
| `mvp` | standard | "MVP" | "MVP" | "Hart Trophy" |
| `champion` | championship | (derived/skip) | (derived/skip) | (derived/skip) |
| `finals_mvp` | championship | "Finals MVP" | — | — |
| `super_bowl_mvp` | championship | — | "Super Bowl MVP" | — |
| `conn_smythe` | championship | — | — | "Conn Smythe Trophy" |
| `roy` | standard | "Rookie of the Year" | — | — |
| `dpoy` | standard | "Defensive Player of the Year" | — | — |
| `mip` | standard | "Most Improved Player" | — | — |
| `sixth_man` | standard | "Sixth Man of the Year" | — | — |
| `all_nba_first` / `all_nba_second` / `all_nba_third` | standard | "All-NBA First/Second/Third Team" | — | — |
| `all_defensive_first` / `all_defensive_second` | standard | "All-Defensive First/Second Team" | — | — |
| `scoring_champ` | standard | "Scoring Leader" | — | — |
| `all_pro_first` / `all_pro_second` | standard | — | "All-Pro First/Second Team" | — |
| `pro_bowl` | standard | — | "Pro Bowl" | — |
| `all_star` | standard | NBA All-Star game selection | — | NHL All-Star game selection |
| `nhl_all_star_first` / `nhl_all_star_second` | standard | — | — | "First/Second All-Star Team" |
| `calder` | standard | — | — | "Calder Trophy" |

ESPN names not in the map are logged as `unmapped` and skipped (forward-compatible — adding new awards = mapping update, not code change).

`champion` is a single canonical type used across all three leagues; the `league` column on the row disambiguates it (NBA Champion vs. Super Bowl Champion vs. Stanley Cup). Same for `all_star` (NBA vs. NHL).

## Ingestion

### CLI

`backend/src/ingestion/seedAwards.js`. Runs from repo via `node backend/src/ingestion/seedAwards.js [flags]`.

```
# Default: prints help, exits (no accidental backfill)
node backend/src/ingestion/seedAwards.js

# Single season, one league
node backend/src/ingestion/seedAwards.js --league nba --season 2025-26
node backend/src/ingestion/seedAwards.js --league nfl --season 2024
node backend/src/ingestion/seedAwards.js --league nhl --season 2024-25

# Single season, all leagues (script translates per-league internally)
node backend/src/ingestion/seedAwards.js --season 2025-26

# Full historical backfill (explicit, scary flag)
node backend/src/ingestion/seedAwards.js --backfill
node backend/src/ingestion/seedAwards.js --backfill --league nba

# Dry run — compute and log, no DB writes
node backend/src/ingestion/seedAwards.js --season 2025-26 --dry-run
```

### Behavior

- **Help-on-empty:** No flags → print usage and exit. Prevents accidental full backfills.
- **Backfill termination:** Walks ESPN seasons descending from current. Stops on first season returning a 404 or empty `items[]`. Auto-detects ESPN's history depth.
- **Season string format:** User-facing format follows DB convention per league: NBA/NHL = `"YYYY-YY"`, NFL = `"YYYY"`. `seasonTranslator.js` maps to ESPN's numeric year (NBA `"2025-26"` → `2026`, NFL `"2024"` → `2024`, NHL `"2025-26"` → `2026`).
- **Player matching:** ESPN athlete ID parsed from the `$ref` URL. Looked up via `players` where `espn_playerid = ? AND league = ?`. **No fuzzy name fallback** — wrong matches are worse than missing data.
- **Idempotency:** `INSERT ... ON CONFLICT (player_id, league, season, award_type) DO NOTHING`. Re-runs are safe.
- **Dry run:** All ESPN fetches happen; DB writes are skipped. Summary still prints.

### Logging

All warnings logged via existing `pino` logger with structured fields:

| condition | level | fields |
|---|---|---|
| ESPN award name not in `awardTypeMap` | `warn` | `{league, season, espnAwardId, espnName}` |
| Athlete in `winners` not in DB | `warn` | `{league, season, awardType, espnAthleteId}` |
| ESPN 5xx after 3 retries | `error` | `{league, season, awardId, status}` |
| ESPN 404 on season index | `info` | `{league, season}` (treated as end-of-history during backfill) |

### Summary Output

After completion, print a summary table:

```
Awards seed complete.
  inserted:   42
  skipped:    18    (already in DB)
  unmatched:  3     (athlete not in players table)
  unmapped:   1     (award name not in taxonomy)
  errors:     0
  duration:   12.3s

Unmatched athletes:
  [nba/2024]  athlete=4123456 award=mvp
  ...

Unmapped awards:
  [nba/2024]  espnId=999 name="Some New Award"
```

In dry-run mode, prefix the summary with `[DRY RUN — no DB writes]`.

### Error Handling

- **ESPN 404 (season index):** during `--backfill`, signals end of history → stop. During single `--season`, log and exit gracefully with appropriate exit code.
- **ESPN 5xx:** retry with exponential backoff (3 attempts, 250ms / 1s / 4s). Then mark the specific award as failed and continue. Don't abort the whole run.
- **DB conflict on unique key:** counted as `skipped`. Not an error.
- **Unknown award name:** counted as `unmapped`. Skipped. Logged. Continue.
- **Unmatched athlete:** counted as `unmatched`. Skipped. Logged. Continue.

## Read Path

### Service

Extend the existing `getNbaPlayer` / `getNflPlayer` / `getNhlPlayer` queries in `backend/src/services/players/playerDetailService.js`. Add an `'awards'` field to the `json_build_object` payload using a correlated subquery that pre-groups by `award_type`:

```sql
'awards', COALESCE((
  SELECT json_agg(award_group ORDER BY tier_rank, award_type)
  FROM (
    SELECT
      pa.award_type AS type,
      MAX(pa.award_name) AS label,
      COUNT(*)::INT AS count,
      json_agg(pa.season ORDER BY pa.season DESC) AS seasons,
      CASE
        WHEN pa.award_type IN ('champion', 'finals_mvp', 'super_bowl_mvp', 'conn_smythe')
          THEN 'championship'
        ELSE 'standard'
      END AS tier,
      CASE
        WHEN pa.award_type IN ('champion', 'finals_mvp', 'super_bowl_mvp', 'conn_smythe')
          THEN 0 ELSE 1
      END AS tier_rank
    FROM player_awards pa
    WHERE pa.player_id = p.id AND pa.league = $1
    GROUP BY pa.award_type
  ) AS award_group
), '[]'::json)
```

Resulting payload:

```json
"awards": [
  { "type": "champion", "label": "Champion", "count": 4, "tier": "championship", "seasons": ["2019-20", "2015-16", "2012-13", "2011-12"] },
  { "type": "finals_mvp", "label": "Finals MVP", "count": 4, "tier": "championship", "seasons": ["..."] },
  { "type": "mvp", "label": "Most Valuable Player", "count": 4, "tier": "standard", "seasons": ["..."] },
  { "type": "all_star", "label": "All-Star", "count": 19, "tier": "standard", "seasons": ["..."] }
]
```

### Cache

Bump `CACHE_VERSION` in `backend/src/cache/cache.js` so existing `playerDetail:*` keys invalidate on deploy. Awards are part of the player detail cache (TTL: 2m current season, 30d past).

## UI

### Component

`frontend/src/components/cards/PlayerAwardsCard.jsx`. Mounted in `PlayerPage.jsx` between the `PlayerAvgCard` and the "Recent Performances" section.

### Visual Spec — Trophy Case (Direction 1)

**Container**
```
bg-surface-elevated border border-white/[0.08] rounded-2xl p-6
shadow-[0_4px_20px_rgba(0,0,0,0.3)]
```

**Section header**
- Text: "Career Honors"
- Class: `text-xs uppercase tracking-[0.14em] text-text-tertiary mb-5`

**Chip layout**
- Desktop: `flex flex-wrap gap-3`
- Mobile: `flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-5 px-5 pb-1` (no wrap, edge-to-edge scroll)

**Each chip (`<button>` for click → popover)**
```
bg-surface-overlay border border-white/[0.08] rounded-xl
px-5 py-4 min-w-[100px] flex flex-col items-start gap-1
transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]
hover:-translate-y-0.5 hover:border-white/[0.14]
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
```

- Numeral (count): `text-3xl font-semibold tabular-nums text-text-primary leading-none`
- Label: `text-[10px] uppercase tracking-[0.12em] text-text-tertiary leading-tight`

**Championship tier override**
- Numeral color: `#d4af37` (gold)
- Hover shadow: `shadow-[0_0_24px_rgba(212,175,55,0.18)]`
- Inline `★` glyph after label text (visually subtle, same color as label)

**Stagger entrance**
- Reuse `containerVariants` + `itemVariants` from `frontend/src/utils/motion.js` (`y: 12→0`, `staggerChildren: 0.06`)

**Popover (click on chip)**
- Prefer Radix Popover if available; otherwise a custom anchored panel
- Content: `<h4>{label}</h4>` + comma-separated seasons in `tabular-nums`, sorted DESC
- Background: `bg-surface-overlay border border-white/[0.14] rounded-xl px-4 py-3`
- Max-width: `max-w-[280px]`

**Empty state**
- Component returns `null` if `awards?.length === 0`. No "no awards yet" message.

**Sort order**
- Server already returns `tier='championship'` first, then standard. Component renders in array order.

### Skeleton

Add 3 placeholder chips to `PlayerPageSkeleton.jsx`:

```jsx
<div className="flex flex-wrap gap-3 mb-12">
  {[0, 1, 2].map(i => (
    <Skeleton key={i} className="h-[88px] w-[100px] rounded-xl" />
  ))}
</div>
```

Skeleton rendered in the same slot the real card occupies.

### Mount Point in `PlayerPage.jsx`

Inserted between the `<PlayerAvgCard>` block and the "Recent Performances" `<div>`:

```jsx
{/* existing PlayerAvgCard wrapper */}

<PlayerAwardsCard awards={playerData.awards} />

{/* existing Recent Performances section */}
```

## Testing

### Backend (Jest)

- `backend/__tests__/ingestion/awardTypeMap.test.js` — full mapping table per league, ensures every ESPN-known name we care about resolves.
- `backend/__tests__/ingestion/seasonTranslator.test.js` — NBA `"2025-26"` → `2026`, NFL `"2024"` → `2024`, NHL `"2025-26"` → `2026`. Edge: invalid format throws.
- `backend/__tests__/ingestion/seedAwards.test.js` — integration with mocked ESPN responses (using `nock` or fetch mock):
  - Happy path: 1 season, all known awards, all matched players → correct insert count.
  - Dry run: same setup, 0 DB writes, summary still printed.
  - Idempotency: run twice, second run reports all `skipped`.
  - Unmatched athlete: ESPN returns athlete ID we don't have → `unmatched` warning + counter.
  - Unmapped award: ESPN returns unknown award name → `unmapped` warning + counter.
  - 404 on season index during backfill: terminates loop cleanly.
  - 5xx with retry: succeeds on retry.
- `backend/__tests__/services/playerDetailService.test.js` — extend existing tests to assert `awards` field shape returned in JSON.

### Frontend (Vitest + React Testing Library)

- `frontend/src/__tests__/components/PlayerAwardsCard.test.jsx`:
  - Renders `null` when `awards` is empty or undefined.
  - Renders chip per award type with correct count + label.
  - Championship tier chips have gold class applied.
  - Click chip opens popover with seasons; ESC / outside-click closes.
  - Stagger animation present (motion mock pattern from existing tests).
- `PlayerPage.jsx` integration: snapshot/render test confirms card mounts between avg card and Recent Performances.

## Rollout

1. Migration applied (manually if shadow DB issues; `prisma migrate resolve --applied`).
2. `CACHE_VERSION` bumped.
3. Backend service + ingestion + tests merged.
4. Run seed: start with `--dry-run --backfill` for one league, review summary, then real backfill.
5. Frontend component + tests merged.
6. Verify on production player pages (LeBron, Mahomes, McDavid as smoke tests).

## File Inventory

**New**
- `backend/prisma/migrations/<ts>_add_player_awards/migration.sql`
- `backend/src/ingestion/seedAwards.js`
- `backend/src/ingestion/awards/espnAwardsClient.js`
- `backend/src/ingestion/awards/awardTypeMap.js`
- `backend/src/ingestion/awards/seasonTranslator.js`
- `backend/__tests__/ingestion/awardTypeMap.test.js`
- `backend/__tests__/ingestion/seasonTranslator.test.js`
- `backend/__tests__/ingestion/seedAwards.test.js`
- `frontend/src/components/cards/PlayerAwardsCard.jsx`
- `frontend/src/__tests__/components/PlayerAwardsCard.test.jsx`

**Modified**
- `backend/prisma/schema.prisma` (add `player_awards` model + relation on `players`)
- `backend/src/services/players/playerDetailService.js` (add `awards` subquery to all 3 league functions)
- `backend/src/cache/cache.js` (bump `CACHE_VERSION`)
- `backend/__tests__/services/playerDetailService.test.js`
- `frontend/src/pages/PlayerPage.jsx` (mount card)
- `frontend/src/components/skeletons/PlayerPageSkeleton.jsx` (add awards skeleton)
