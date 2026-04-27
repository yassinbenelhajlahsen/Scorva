# Search Improvements — Design

**Date:** 2026-04-27
**Scope:** `backend/src/services/meta/searchService.js` and supporting schema/ingestion
**Goal:** Make game and team-abbreviation queries actually work, expand single-team game discovery to a 3-season window, and improve typo handling.

---

## Problem Statement

The current search service uses a single `ILIKE '%term%'` pass against teams, players, aliases, and games, with a trigram-similarity fallback when results are empty. Five concrete gaps were verified by hitting the local backend:

1. **Matchup queries return nothing.** `"rockets vs lakers"` matches no team or game because the whole phrase is treated as one substring. The games CTE is restricted to `latest_seasons` (current season only) and only matches when one team contains the literal phrase.
2. **Team abbreviations don't work.** No `abbreviation` column exists on `teams`. `LAL` returns "Afflalo" / "Bilal" (substring noise). `GSW`, `KC`, `NYY` return empty. `BOS` never finds the Celtics.
3. **Short queries match player-name substrings as noise.** Anything ≤4 chars hits `%xyz%` false positives because there is no word-boundary or prefix gating.
4. **Game-name direct match is unused.** Typing `"Lakers vs 76ers"` literally cannot find the matching game; the synthesized name `CONCAT(ht.shortname,' vs ',at.shortname)` is built but never compared against the term.
5. **Multi-word typo coverage is partial.** `"warriros"` works (single-word fuzzy). `"lakers vs warriros"` returns empty because fuzzy is single-string-vs-single-name.

Single-team queries also currently surface only the team and a single game from the latest season — too narrow.

---

## Goals

- `"rockets vs lakers"` returns the matchup games + both team cards.
- Team abbreviations (`LAL`, `GSW`, `KC`, `NYY`) match the correct team without polluting results with player substring matches.
- Single-team queries surface the team plus the next 2 upcoming + last 3 past games within a 3-season window (current + 2 previous).
- `"Lakers vs 76ers"` (the synthesized game name) finds that specific game.
- Multi-word typos like `"lakers vs warriros"` resolve correctly.

## Non-Goals

- Full-text-search (`tsvector`) overhaul — overkill for this entity surface area.
- Three-or-more-team comma-separated queries — no UI need.
- Result envelope changes — frontend client stays untouched.
- Cross-season matchup search beyond 3 seasons.

---

## Architecture

Two-phase resolve flow, replacing the current single-query approach:

```
parseSearchTerm(raw)
  └─→ { kind: "matchup" | "single" | "empty", ... }

Phase 1: resolveTeams(token, { league? })
  └─→ cascading lookup: abbreviation → exact name → prefix → substring → fuzzy
       returns Array<{ id, league, score }>

Phase 2: assemble results
  ├─ matchup branch: team entities + games where both teams played, 3-season window
  ├─ single branch:  team entities + players + per-team games (next 2 + last 3)
  └─ empty branch:   []
```

### New / changed files

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `teams.abbreviation String? @db.VarChar(5)` |
| `backend/prisma/migrations/<ts>_add_team_abbreviation/migration.sql` | Add column + lower-case index |
| `backend/src/ingestion/upsert/upsertTeam.js` | Persist `abbreviation` from ESPN payload (uppercased) |
| `backend/src/ingestion/scripts/backfillTeamAbbreviations.js` | One-shot backfill (mirrors `backfillTeamColors.js`) |
| `backend/src/services/meta/searchParser.js` | **NEW** — `parseSearchTerm(raw)` |
| `backend/src/services/meta/teamResolver.js` | **NEW** — `resolveTeams(token, opts)` |
| `backend/src/services/meta/searchService.js` | Rewritten to use parser + resolver + branched assembly |
| `backend/__tests__/services/meta/searchParser.test.js` | **NEW** |
| `backend/__tests__/services/meta/teamResolver.test.js` | **NEW** |
| `backend/__tests__/services/meta/searchService.test.js` | Expanded |

No frontend changes. The search response schema is unchanged.

---

## Component Designs

### 1. Schema — `teams.abbreviation`

```sql
ALTER TABLE teams ADD COLUMN abbreviation VARCHAR(5);
CREATE INDEX idx_teams_abbreviation_lower ON teams (LOWER(abbreviation));
```

Nullable, so the migration applies cleanly before backfill. Backfill runs before any code path consumes the column. Stored uppercased so `LOWER()` comparisons normalize, and any UI use reads as standard "LAL"/"BOS" form. Some ESPN league payloads return lowercase (e.g., NHL `tor`); `upsertTeam.js` will `.toUpperCase()` on insert.

Backfill script: iterates `WHERE espnid IS NOT NULL AND abbreviation IS NULL`, fetches via the cached ESPN team payload, writes back. Same shape as `backfillTeamColors.js`.

Per memory: shadow DB has issues locally — apply SQL manually in dev and run `prisma migrate resolve --applied` if needed.

### 2. `parseSearchTerm(raw)`

Pure function. Returns one of:

```js
{ kind: "matchup", lhs: string, rhs: string }
{ kind: "single",  token: string }
{ kind: "empty" }
```

**Sanitization:**
- Trim, collapse internal whitespace to single spaces.
- Reject (return `empty`) if blank or `length > 200`.
- Both `lhs` / `rhs` / `token` returned in their original case (lowercased only at SQL time via `LOWER()`).

**Separator detection** (priority order, all case-insensitive, surrounding whitespace required so we don't split hyphenated names):
1. ` vs ` / ` vs. `
2. ` v ` / ` v. `
3. ` @ ` / ` at `
4. ` - ` (single dash with surrounding spaces)

Only the first matching separator is honored. Multiple separators → split on first, treat rest as part of `rhs`.

**Partial input:**
- Trailing separator with empty `rhs` → degrade to `{ kind: "single", token: lhs }` (user is mid-typing).
- Leading separator with empty `lhs` → same degrade with `rhs`.

### 3. `resolveTeams(token, { league? })`

Cascading lookup. Returns `Array<{ id, league, score }>` where lower `score` = stronger match. Early-exits when a tier yields ≥ 1 result.

Cascade tiers:

| Tier | Score | SQL predicate | Gate |
|---|---|---|---|
| 1 | 1 | `LOWER(abbreviation) = LOWER($1)` | only if `token.length ≤ 4` |
| 2 | 2 | `LOWER(shortname) = LOWER($1) OR LOWER(name) = LOWER($1)` | always |
| 3 | 3 | `LOWER(shortname) LIKE LOWER($1) \|\| '%' OR LOWER(name) LIKE LOWER($1) \|\| '%'` | always |
| 4 | 4 | `LOWER(shortname) LIKE '%' \|\| LOWER($1) \|\| '%' OR LOWER(name) LIKE …` | only if `token.length ≥ 3` |
| 5 | 5 | `similarity(shortname, $1) > 0.4 OR similarity(name, $1) > 0.4` | always (fuzzy) |

All tiers also require `conf IS NOT NULL` (current behavior — skips defunct/placeholder teams).

Optional `league` filter applied to every tier. Cascade reads cleaner than one big `OR` with case ranking and naturally avoids cross-tier dedup issues. Worst case (no match) is 5 sub-millisecond queries on indexed columns — empty-input cost is acceptable.

### 4. Search service — branch logic

Replaces current single-query body in `searchService.js`.

#### `matchup` branch

```
1. const [lhs, rhs] = await Promise.all([resolveTeams(parsed.lhs), resolveTeams(parsed.rhs)])
2. if (lhs.length === 0 || rhs.length === 0):
     fall back to single-branch with the original raw term
     (so junk like "foo vs bar" still returns whatever fuzzy can find)
3. else:
     run two parallel queries:
       - team entities for [...lhsIds, ...rhsIds]
       - games where (hometeamid IN lhsIds AND awayteamid IN rhsIds)
                  OR (hometeamid IN rhsIds AND awayteamid IN lhsIds)
              AND season IN top-3-seasons-for-league
              AND ht.conf IS NOT NULL AND at.conf IS NOT NULL
     concatenate + dedupe + LIMIT 15
```

Top-3-seasons CTE replaces existing `latest_seasons`:
```sql
WITH top_seasons AS (
  SELECT league, season FROM (
    SELECT league, season,
           ROW_NUMBER() OVER (PARTITION BY league ORDER BY season DESC) AS rn
    FROM (SELECT DISTINCT league, season FROM games) s
  ) t WHERE rn <= 3
)
```

Optional date narrowing: if `tryParseDate(rawTerm)` returns a value, also `AND g.date = $date`. This is mostly free and helps if a user types a date alongside a matchup.

#### `single` branch

```
1. const teamIds = await resolveTeams(parsed.token)
2. parallel:
   a. team entities for teamIds
   b. players query (existing UNION ALL on players + player_aliases)
      - ILIKE on '%token%' with token.length ≥ 3 gate
      - fuzzy fallback (similarity > 0.3) when ILIKE empty
   c. games per team: for each team in teamIds, up to 2 upcoming + 3 past
      within top-3-seasons window
3. concatenate + dedupe + LIMIT 15
```

Per-team game query (single SQL, expressible as a `LATERAL` join over `unnest(teamIds)`):
```sql
SELECT g.id, ht.shortname, at.shortname, g.date, g.league
FROM unnest($1::int[]) AS team_id
JOIN LATERAL (
  (SELECT id, hometeamid, awayteamid, date, league
   FROM games
   WHERE (hometeamid = team_id OR awayteamid = team_id)
     AND season IN (SELECT season FROM top_seasons WHERE league = games.league)
     AND date >= CURRENT_DATE
   ORDER BY date ASC LIMIT 2)
  UNION ALL
  (SELECT id, hometeamid, awayteamid, date, league
   FROM games
   WHERE (hometeamid = team_id OR awayteamid = team_id)
     AND season IN (SELECT season FROM top_seasons WHERE league = games.league)
     AND date < CURRENT_DATE
   ORDER BY date DESC LIMIT 3)
) g ON TRUE
JOIN teams ht ON g.hometeamid = ht.id
JOIN teams at ON g.awayteamid = at.id
WHERE ht.conf IS NOT NULL AND at.conf IS NOT NULL
```

Final form may differ slightly — exact SQL is implementation detail. Plan will pin it.

#### `empty` branch

Return `[]` without hitting the DB.

### 5. Result ordering

Single ORDER BY at the assembly step (after concat + dedupe), cascaded:

1. `score` ASC (resolution tier, where applicable; players default to a fixed mid-tier value, games default to a value lower than their parent team)
2. `type` order: team → player → game (matches current behavior)
3. `popularity` DESC (players)
4. Date proximity to today (games — upcoming first, then most-recent past)
5. `name` ASC

Final `LIMIT 15` retained.

---

## Data Flow

```
GET /api/search?term=rockets vs lakers
  └→ searchController.search(term)
       └→ searchService.search(term)
            ├─ parseSearchTerm("rockets vs lakers") → { kind: "matchup", lhs: "rockets", rhs: "lakers" }
            ├─ Promise.all([resolveTeams("rockets"), resolveTeams("lakers")])
            │     → [[{id: 539, league: "nba", score: 2}], [{id: 527, league: "nba", score: 2}]]
            ├─ Promise.all([
            │     queryTeamEntities([539, 527]),
            │     queryMatchupGames([539], [527], top3Seasons)
            │   ])
            └─ concat + dedupe + order + limit 15
```

For `"lakers"` (single):

```
GET /api/search?term=lakers
  └→ parseSearchTerm("lakers") → { kind: "single", token: "lakers" }
     └→ resolveTeams("lakers") → [{id: 527, league: "nba", score: 2}]
        └→ Promise.all([
              queryTeamEntities([527]),
              queryPlayers("lakers"),     // current behavior, with length-3 substring gate
              queryPerTeamGames([527])     // 2 upcoming + 3 past
           ])
```

For `"LAL"`:

```
parseSearchTerm("LAL") → { kind: "single", token: "LAL" }
  └→ resolveTeams("LAL")  // tier 1 hits → [{id: 527, score: 1}]
     └→ player query gated off (length < 3 substring rule still allows ILIKE since 3==3,
        BUT tier-1 abbreviation match means we already know what they want — players
        will only show if popularity-ordered + token also matches)
```

The player query runs unconditionally in the single branch — it's not skipped. Concern: typing "LAL" still surfaces "Afflalo" via player ILIKE. **Mitigation:** the order step puts team entities first by `score=1`, and `LIMIT 15` is generous, so the Lakers card is always rank 1. Acceptable.

---

## Error Handling

- DB errors propagate to the controller (current behavior).
- `pool.query` failures inside `Promise.all` reject the whole call — no partial results. Same as today.
- The matchup-fallback-to-single path is non-error: `lhs.length === 0` is a normal flow signal, not an exception.
- `tryParseDate` returning `null` is normal — no date filter applied.

---

## Testing Plan

### Unit — `searchParser.test.js`

- Empty / whitespace / >200 chars → `{ kind: "empty" }`
- `"lakers"` → `{ kind: "single", token: "lakers" }`
- `"rockets vs lakers"` → matchup, lhs=rockets, rhs=lakers
- `"Rockets VS Lakers"` (case) → same
- `" vs "` separator vs `" v "` vs `" @ "` vs `" - "` — each splits
- `"Mike Smith-Pelly"` (hyphen *without* surrounding spaces) → single token
- `"lakers vs "` (trailing) → degrades to `single`
- `" vs lakers"` (leading) → degrades to `single` with rhs
- `"lakers vs warriors vs heat"` (multiple seps) → splits on first, rhs = "warriors vs heat"

### Unit — `teamResolver.test.js`

- Tier 1: `"LAL"` resolves to Lakers, length-4 gate triggers
- Tier 1: `"L"` does NOT trigger abbreviation tier (would be too noisy)
- Tier 2: `"Lakers"` exact shortname
- Tier 2: `"Los Angeles Lakers"` exact name
- Tier 3: `"Lake"` prefix → Lakers
- Tier 4: `"Angeles"` substring → Lakers (and other LA teams)
- Tier 4 gate: `"AB"` (length 2) does NOT trigger substring
- Tier 5: `"warriros"` (typo) → fuzzy hits Warriors
- League filter: `resolveTeams("Heat", { league: "nba" })` returns Heat only
- Cascade early-exit: stub the pool, ensure tier 2 hit prevents tiers 3–5 from running
- Empty cascade (`"zzzzz"`) returns `[]` after all 5 tiers exhausted

### Integration — `searchService.test.js`

- `"rockets vs lakers"` → returns ≥ 1 game with both teams + 2 team cards
- `"rockets vs zzzzzz"` → falls back to single-token (returns Rockets + maybe other zzzzzz fuzzy)
- `"lakers"` → returns Lakers card + ≤ 5 games (next 2 + last 3) within 3-season window
- `"LAL"` → Lakers ranked first; players named Afflalo etc. allowed but ranked below
- `"lebron"` → unchanged (popularity ordering)
- `"warriros"` → fuzzy hit Warriors (existing behavior preserved)
- `""` / 201-char string → empty array, no DB call

### Manual smoke (run after deploy)

- `curl 'http://localhost:8080/api/search?term=rockets%20vs%20lakers'` returns matchup games
- `curl '...term=GSW'` returns Warriors first
- `curl '...term=lakers'` returns Lakers + 5 games

---

## Migration Plan

1. **PR 1 — schema + ingestion:** add migration, update `upsertTeam.js`, write backfill script. Ship and run backfill in production.
2. **PR 2 — service rewrite:** add parser, resolver, branched search service, tests. Behind no flag (search is read-only and easy to roll back).
3. Verify on prod with the same curl smoke tests.

Backfill must complete before PR 2 ships, otherwise tier-1 abbreviation matches return empty for unbackfilled rows.

---

## Risks & Tradeoffs

- **Cascade is up to 5 queries on a no-match input.** Each is sub-ms on indexed columns. Worst-case empty-input pay is ~3–5ms. Accepted.
- **Two phases mean two round-trips on matchup queries.** ~5–10ms extra over a single mega-query. Accepted in exchange for code clarity and resolver reusability.
- **`top_seasons` CTE materializes per query.** Could be cached, but it's a tiny scan over a small distinct set. Skip caching for now; revisit if profiling flags it.
- **No fallback for total search failure beyond the matchup→single-token path.** If a user types pure gibberish, they get `[]`. Same as today.
- **Player ILIKE in single branch still has substring noise** (e.g., `"LAL"` returning Afflalo). Mitigated by score-based ordering; not eliminated. Could be tightened later by adding a player-resolver cascade analogous to teams, but YAGNI for now.

---

## Out of Scope / Future

- Full-text search (`tsvector`)
- Player-name resolver cascade (analogous to team cascade)
- Comma-separated multi-entity queries
- Caching the `top_seasons` CTE
- Search result envelope changes / pagination
