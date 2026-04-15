# NHL Playoffs Bracket — Implementation Plan

## Context

Scorva today has a fully-featured NBA playoffs tab on `LeaguePage` (bracket, projected mode, play-in, tests, caching) — but nothing equivalent for NHL. NHL users only see `games` + `standings`. This plan adds a parallel NHL playoffs tab that respects NHL-specific bracket rules (divisional matchups + wild cards), applies the official NHL tiebreaker cascade exactly, and renders through a generalized frontend that drops NBA's play-in block.

Scope boundary: 2013-14 onward only (current wild-card format). Pre-2014 seasons and the 2019-20 bubble render a graceful "unsupported" message rather than attempting a different format.

Note: **first implementation step** is to copy this plan to `NHL-PLAYOFF-PLAN.md` at the repo root as the user requested (plan mode forbids writing anywhere else for now).

## Design Decisions (user-approved)

| Area | Decision |
|---|---|
| Division storage | Add `teams.division TEXT` + one-time SQL seed (mirrors how `conf` works today) |
| Tiebreaker compliance | Full official NHL cascade — regulation wins → ROW → H2H points (home-and-home rule) → goal differential → goals for |
| Season scope | 2013-14 onward; earlier + 2019-20 return `{unsupported: true}` |
| Frontend | Generalize: rename `useNbaPlayoffs` → `usePlayoffs`, broaden `enabled`, parameterize finals label from `league` |

## Implementation Steps

### 0. Seed the NHL-PLAYOFF-PLAN.md
- Copy this plan to `/Users/yassin/work/Scorva/NHL-PLAYOFF-PLAN.md` (user deliverable).

### 1. Pre-flight DB verification (read-only)
Before writing the seed migration, run:
```sql
SELECT id, espnid, name, shortname, conf FROM teams WHERE league='nhl' ORDER BY name;
SELECT DISTINCT status FROM games WHERE league='nhl' AND status ILIKE 'Final%';
```
Confirm all 32 current NHL `espnid` values, and verify that `status` values for completed games are strictly `'Final'`, `'Final/OT'`, `'Final/SO'` (no free-text variants). If variants exist, note them before proceeding.

### 2. Schema: add `teams.division`
- Edit `backend/prisma/schema.prisma:121-142` — add `division String?` to the `teams` model.
- New migration `backend/prisma/migrations/20260415000000_add_teams_division/migration.sql`:
  ```sql
  ALTER TABLE teams ADD COLUMN division TEXT;
  ```
- Run `npx prisma migrate deploy` (or apply SQL manually + `prisma migrate resolve --applied` per project convention documented in memory).
- Run `npx prisma generate` to regenerate client.

### 3. Seed NHL conf + division
- New migration `backend/prisma/migrations/20260415000001_seed_nhl_conf_division/migration.sql`:
  ```sql
  -- Atlantic (Eastern)
  UPDATE teams SET conf='east', division='atlantic'
    WHERE league='nhl' AND espnid IN (<BOS,BUF,DET,FLA,MTL,OTT,TBL,TOR>);
  -- Metropolitan (Eastern)
  UPDATE teams SET conf='east', division='metropolitan'
    WHERE league='nhl' AND espnid IN (<CAR,CBJ,NJD,NYI,NYR,PHI,PIT,WSH>);
  -- Central (Western)
  UPDATE teams SET conf='west', division='central'
    WHERE league='nhl' AND espnid IN (<CHI,COL,DAL,MIN,NSH,STL,UTA,WPG>);
  -- Pacific (Western)
  UPDATE teams SET conf='west', division='pacific'
    WHERE league='nhl' AND espnid IN (<ANA,CGY,EDM,LAK,SJS,SEA,VAN,VGK>);
  ```
- **Use `'east'`/`'west'` (short form) to match NBA** — the codebase already filters on lowercase short strings (see `playoffsService.js:111`, `standingsService.js:70`).
- Fill `espnid` values from the pre-flight query in step 1. Do NOT guess.

### 4. Backend: extract shared helpers
- New file `backend/src/services/standings/_playoffsCommon.js` — extract from `playoffsService.js`:
  - `pairKey` (L19), `isFinalStatus` (L15), `buildSeries` (L38-107), `serializeSeries` (L328-370), `emptySeries` (L372-384), `emptyConfBlock` (L386-398), `padConfBlock` (L400-409), `clearDownstream` logic (L783-796).
- Update `playoffsService.js` to import these.
- **Do not touch NBA-only logic** (`R1_SEED_PAIRS`, `classifyPlayIn`, `fillPlayInTier2`, `inferSeedsFromR1`, `reassignSeedsFromMatchups`, `mergeR1WithCanonicalOrder`, `computeStandingsSeeds`, `derivePlayoffs`, `getNbaPlayoffs`) — they stay in `playoffsService.js`.
- Run `npm test` in backend — existing `playoffsService.test.js` must still pass (regression gate).

### 5. Backend: NHL tiebreaker branch
In `backend/src/utils/tiebreaker.js`:
- Extend `buildH2HMatrix(games, confByTeamId)` to also track per-opponent `otLosses`, `soLosses`, plus per-team `regWins`, `otWins`, `soWins`, `gf`, `ga`. Gate all new fields behind a `league` param so NBA path stays byte-identical.
- New `nhlResolveGroup(group, matrix)` implementing the 5-step cascade:
  1. `regWins` desc
  2. `row` (regulation + OT wins) desc
  3. H2H points — each pairwise game awards 2 pts for win, 1 for OT/SO loss, 0 for regulation loss. Apply home-and-home rule: when team A and team B have unequal game counts (typically from play-at-neutral-site or scheduling), drop the earliest-played home game of the team with more home games.
  4. `goalDiff = gf - ga` (overall) desc
  5. `gf` (overall) desc
  6. fallback: `team.id` (deterministic)
- Modify `resolveGroup` and `sortWithTiebreakers` signatures to take `league`; branch to `nhlResolveGroup` when `league === "nhl"`. NBA path unchanged.
- `primaryValue` stays as-is — `ptsPct` is already correct.
- Update `standingsService.js:98` call site to pass `league`.
- Update `getRegularSeasonGames` SQL at `standingsService.js:14` to also SELECT `status` (required for RW/ROW/H2H-points derivation).

### 6. Backend: standings column additions
- Edit `backend/src/services/standings/standingsService.js:38-55` SELECT and GROUP BY to include `t.division`. No other shape change.

### 7. Backend: new `nhlPlayoffsService.js`
Create `backend/src/services/standings/nhlPlayoffsService.js`:

```
getNhlPlayoffs(season):
  1. resolvedSeason = season || getCurrentSeason("nhl")
  2. if seasonYear < 2014 or season === "2019-20":
       return { season, unsupported: true }
  3. cached("playoffs:nhl:${resolvedSeason}", isCurrent ? 30s : 30d, deriveNhlPlayoffs)

deriveNhlPlayoffs(season):
  - fetchPlayoffGames(season): SELECT ... WHERE league='nhl' AND season=$1 AND type IN ('playoff','final') ORDER BY date ASC
  - getStandings("nhl", season) + getRegularSeasonGames("nhl", season)
  - Build teamsById with {conf, division, wins, losses, otl, ptsPct, pointDiff, confWinPct} + compute per-team {regWins, otWins, soWins, row, gf, ga} from raw h2h games
  - For each conference (east, west):
      * Group by division → sort each division with NHL tiebreaker → top 3 per division
      * Collect remaining conference teams → sort → top 2 = [WC1, WC2] (WC1 is better)
      * divA, divB = two divisions; compare A1 vs B1 via tiebreaker → swap so A is "better"
      * Construct canonical R1 in locked order:
          slot 0: A1 vs WC2   (top half)
          slot 1: A2 vs A3    (top half)
          slot 2: B2 vs B3    (bottom half)
          slot 3: B1 vs WC1   (bottom half)
      * Assign display seeds: A1=1, B1=2, A2=3, A3=4, B2=5, B3=6, WC1=7, WC2=8
  - Match actual playoff games to bracket slots by participant set (not by date):
      * For each series in buildSeries(): check which R1 slot's {teamA.id, teamB.id} matches → that's the R1 slot
      * Semis: series whose teams are winners of R1 slots (0,1) → top semi; winners of (2,3) → bottom semi
      * Conf Final: remaining intra-conference series not yet classified
  - Finals: allSeries.filter(s => s.hasFinalTypeGame) — single series, same as NBA
  - Projected mode (no games rows): return bracket with empty series slots pre-populated with canonical R1 pairings
  - Cross-conference non-final series → log warn + skip
  - Teams missing division/conf → return { isProjected: true, warning: 'division_data_missing' } early with empty bracket

Return shape:
  { season, isProjected, playIn: null, bracket: { eastern: {r1[4], semis[2], confFinals[1]}, western: {r1[4], semis[2], confFinals[1]}, finals: [Series] } }
  OR
  { season, unsupported: true }
```

### 8. Backend: controller + cache invalidation
- `backend/src/controllers/standings/playoffsController.js:4-18` — dispatch:
  ```js
  if (league === "nba") return res.json(await getNbaPlayoffs(season));
  if (league === "nhl") return res.json(await getNhlPlayoffs(season));
  return res.status(400).json({ error: "Playoffs bracket is only available for NBA and NHL" });
  ```
- `backend/src/ingestion/pipeline/upsert.js` — find existing `invalidatePattern("playoffs:nba:*")` call and add conditional `"playoffs:nhl:*"` when `league === "nhl"`. Also add an NHL cleanup call mirroring the existing NBA pattern:
  ```js
  if (league === "nhl") {
    try {
      await cleanupClinchedPlayoffGames(pool, "nhl");
    } catch (err) {
      log.error({ err, league }, "failed cleaning up clinched playoff games");
    }
  }
  ```
- `backend/src/ingestion/pipeline/liveSync.js` — add `invalidatePattern("playoffs:nhl:*")` when `league === "nhl"`.
- `backend/src/ingestion/cleanup/cleanupClinchedPlayoffGames.js` — extend to accept a `league` param (currently hardcoded to `'nba'`). Replace the hardcoded `WHERE league = 'nba'` filters with a parameterized `$1` binding and pass `league` through. Series clinch threshold is the same (4 wins) for NHL.
- Update `backend/__tests__/ingestion/upsert.test.js`: `invalidatePattern` is currently called 11 times — adding `playoffs:nhl:*` brings it to 12. Also assert `cleanupClinchedPlayoffGames` is called once for NHL (in addition to the existing assertion for NBA).

### 9. Frontend: generalize hook + labels
- New `frontend/src/constants/leagueLabels.js`:
  ```js
  export const LEAGUE_LABELS = {
    nba: { finals: "NBA Finals", round1: "First Round", semis: "Conf. Semis", confFinal: "Conf. Finals", playoffsSupported: true, playInSupported: true },
    nhl: { finals: "Stanley Cup Final", round1: "First Round", semis: "Second Round", confFinal: "Conf. Finals", playoffsSupported: true, playInSupported: false },
  };
  ```
- Rename `frontend/src/hooks/data/useNbaPlayoffs.js` → `usePlayoffs.js`. Change `enabled: league === "nba"` → `enabled: LEAGUE_LABELS[league]?.playoffsSupported === true`.
- Update `frontend/src/components/playoffs/PlayoffsBracket.jsx`:
  - L4: import `usePlayoffs` (not `useNbaPlayoffs`).
  - L36-39 `ConferenceColumn.columns`: read titles from `LEAGUE_LABELS[league]`.
  - L68 `FinalsSection`: replace hardcoded `"NBA Finals"` with `LEAGUE_LABELS[league].finals`.
  - After L87: add `if (data?.unsupported) return <div className="text-center text-text-tertiary py-20 text-sm">Bracket format unsupported for this season.</div>`
  - L104-112: gate `<PlayInSection>` with `{LEAGUE_LABELS[league].playInSupported && playIn && (...)}`.
  - Thread `league` prop into `FinalsSection` and `ConferenceColumn`.
- Update `frontend/src/components/skeletons/PlayoffsSkeleton.jsx` — same hardcoded "NBA Finals" string should read from `LEAGUE_LABELS[league]` (accept `league` prop; default to NBA for back-compat).
- `frontend/src/pages/LeaguePage.jsx`:
  - L44: `if (!LEAGUE_LABELS[league]?.playoffsSupported) return false;` (after importing `LEAGUE_LABELS`).
  - L55-59 tabs ternary: `LEAGUE_LABELS[league]?.playoffsSupported ? (showPlayoffsTab ? ["games","standings","playoffs"] : ["games","standings"]) : ["games","standings"]`.
  - `minGamesPlayed >= 80` threshold still works (NHL plays 82 games too).

### 10. Tests
- New `backend/__tests__/services/nhlPlayoffsService.test.js` following `playoffsService.test.js` pattern. Minimum viable cases:
  1. Projected bracket when no playoff games — verify 4 R1 slots per conference in locked A1/WC2, A2/A3, B2/B3, B1/WC1 order.
  2. Tiebreaker: two teams tied on `ptsPct` → higher `regWins` wins.
  3. Tiebreaker: tied on ptsPct + regWins → higher ROW wins.
  4. Tiebreaker: tied through ROW → H2H points decide; include a pair with unequal home-and-home counts.
  5. Both wild cards from same division → R1 still valid, no crash, correct matchups.
  6. Seasons `"2013-13"` (any pre-2014) and `"2019-20"` both return `{unsupported: true}` with no DB calls.
  7. Mid-playoffs partial: 3 R1 series complete, 1 ongoing, no semis — verify structure.
  8. Completed playoffs: full bracket with Stanley Cup Final (`type='final'`) — verify `finals[0].isComplete`.
- Extend `backend/__tests__/utils/tiebreaker.test.js` (create if absent) with one test per NHL cascade step.
- No frontend tests required (matches NBA precedent — memory notes no existing playoff FE tests).

## Critical Files

**New:**
- `backend/prisma/migrations/20260415000000_add_teams_division/migration.sql`
- `backend/prisma/migrations/20260415000001_seed_nhl_conf_division/migration.sql`
- `backend/src/services/standings/_playoffsCommon.js`
- `backend/src/services/standings/nhlPlayoffsService.js`
- `backend/__tests__/services/nhlPlayoffsService.test.js`
- `frontend/src/constants/leagueLabels.js`
- `frontend/src/hooks/data/usePlayoffs.js` (renamed from `useNbaPlayoffs.js`)
- `/Users/yassin/work/Scorva/NHL-PLAYOFF-PLAN.md`

**Modified:**
- `backend/prisma/schema.prisma:121-142` (add `division`)
- `backend/src/services/standings/playoffsService.js` (extract shared helpers)
- `backend/src/services/standings/standingsService.js:14, 38-55, 98` (add `status` + `division` to SELECT; pass league to sort)
- `backend/src/utils/tiebreaker.js` (NHL cascade branch)
- `backend/src/controllers/standings/playoffsController.js:4-18` (NHL dispatch)
- `backend/src/ingestion/pipeline/upsert.js` (add `playoffs:nhl:*` invalidation + NHL cleanup call)
- `backend/src/ingestion/pipeline/liveSync.js` (add `playoffs:nhl:*` invalidation)
- `backend/src/ingestion/cleanup/cleanupClinchedPlayoffGames.js` (extend for NHL via `league` param)
- `backend/__tests__/ingestion/upsert.test.js` (bump expected invalidate count)
- `frontend/src/pages/LeaguePage.jsx:44, 55-59`
- `frontend/src/components/playoffs/PlayoffsBracket.jsx:4, 36-39, 68, 83, 104-112`
- `frontend/src/components/skeletons/PlayoffsSkeleton.jsx` (read label from `LEAGUE_LABELS`)

**Deleted:**
- `frontend/src/hooks/data/useNbaPlayoffs.js` (replaced by `usePlayoffs.js`)

## Reused Existing Code

- `backend/src/utils/tiebreaker.js` — `primaryValue` already correct for NHL (`ptsPct`)
- `backend/src/cache/cache.js` — `cached(key, ttl, fn)` wrapper
- `backend/src/cache/seasons.js` — `getCurrentSeason(league)`
- `backend/src/services/standings/standingsService.js` — `getStandings`, `getRegularSeasonGames` (already NHL-aware)
- `frontend/src/api/playoffs.js` — already league-parameterized (`/api/${league}/playoffs`)
- `frontend/src/lib/query.js` — `queryKeys.playoffs(league, season)` already league-keyed
- `frontend/src/components/playoffs/SeriesCard.jsx` — fully league-agnostic, no changes

## Verification

1. Run `cd backend && npm test` — all existing NBA playoff tests pass after the helper extraction; new NHL tests pass.
2. Run `cd backend && npm run lint` and `cd frontend && npm run verify` — both clean.
3. Apply migrations. Verify `SELECT COUNT(*) FROM teams WHERE league='nhl' AND division IS NOT NULL` returns 32.
4. Start backend + frontend (`cd backend && npm run dev`, `cd frontend && npm run dev`).
5. Visit `/league/nhl`:
   - Current season (mid-RS): no `playoffs` tab yet (below 80-games threshold). Verify `/league/nba` still unchanged.
   - Switch to a past NHL season with known completed playoffs (e.g. `2022-23`): full bracket renders, Stanley Cup Final at top with "Stanley Cup Final" heading, 4/2/1 rounds per conf, no play-in block.
   - Verify bracket structure: Atlantic top 3 + Metro top 3 + 2 WCs = 8 per conference; matchups follow A1-vs-WC2 / B1-vs-WC1 rule.
   - Switch to `2019-20`: renders "Bracket format unsupported for this season."
   - Switch to `2012-13`: same unsupported message.
6. Hit API directly:
   - `GET /api/nhl/playoffs?season=2022-23` → verify shape `{ season, isProjected: false, playIn: null, bracket: { eastern, western, finals } }`
   - `GET /api/nhl/playoffs?season=2019-20` → `{ season: "2019-20", unsupported: true }`
   - `GET /api/nba/playoffs` (regression) → unchanged from today.
7. Run `cd frontend && npm run verify` (CI's full gate: lint + test + build).

## Risks & Follow-ups

- **Status text variants** — if step 1 turns up `'Final (OT)'` or similar free-text statuses, the NHL tiebreaker derivations break. Extend detection before proceeding.
- **ESPN id drift** — seed uses current `espnid` values. New franchises or relocations require re-running the seed. `upsertTeam.js` should eventually populate `conf`/`division` at ingest time; left as follow-up technical debt.
- **NBA refactor regression** — extracting shared helpers into `_playoffsCommon.js` is the highest-risk change. Run `playoffsService.test.js` before and after the extraction; commit the extraction separately for clean revert if needed.
- **Tiebreaker H2H home-and-home** — the unequal-home-games adjustment is rarely triggered in practice but must be correct to match nhl.com standings. One dedicated test case is the minimum bar.
- **`teams.conf` naming** — plan uses `'east'`/`'west'` short form to match NBA. Any existing NHL rows with the capitalized `'Eastern'`/`'Western'` (flagged in memory from test fixture) must be overwritten by the seed migration — use `UPDATE teams SET conf='east' WHERE league='nhl' AND division IN ('atlantic','metropolitan')` pattern which overwrites whatever was there.
