# Streaks — Backfill + Player/Team Page UI — Design Spec

**Date:** 2026-04-30
**Status:** Approved (user)
**Builds on:** [`2026-04-30-streak-events-design.md`](2026-04-30-streak-events-design.md) (table + live worker already shipped)

## Problem

Two gaps left after the initial streak-events rollout:

1. The live scan in `backend/src/ingestion/streakEvents.js` only looks at games from the **last 60 days** (`RECENT_WINDOW_DAYS = 60`). A player on a 30-game double-double streak that started opening night gets truncated — only the last 60 days of stats are scanned, so the streak length is undercounted (or missed entirely if its start falls outside the window).
2. Streaks are surfaced in the Reports feed but not on player or team pages, where a fan looking up a specific player/team has no way to see whether they're currently on a streak.

## Solution

- **Replace the rolling 60-day window with a season filter.** The scan reads only games where `g.season = $currentSeason`, which catches arbitrarily long streaks within the season and makes cross-season contamination structurally impossible.
- **Add a one-time backfill script** that runs the same season-filtered scan for an explicit season (default: each league's current season). Idempotent — re-uses the existing upsert/deactivate logic.
- **Embed each subject's top active streak in the player and team detail API responses**, picked by tier priority (rarer streaks beat longer-but-more-common ones).
- **Render an inline `StreakBadge`** next to the name on `PlayerPage` and `TeamPage`, only on the current-season view.

Closed/historical streaks are out of scope; this surfaces only currently-active streaks.

## Why a season filter beats the 60-day window

The 60-day window was a soft proxy for "current season" that worked because every league's offseason is >60 days, so cross-season bleed was accidentally prevented. Switching to `g.season = $X` is:

- **Correct for long streaks.** A 30-game streak from October survives.
- **Correct at season boundaries with no cron.** When a new season starts and has zero games yet, the player's prior-season streak no longer appears in the scan's `active_now` set, so `deactivateMissing` flips `is_active = FALSE` automatically. No end-of-season migration job needed.
- **One fewer magic number.**

## Backend changes

### 1. `backend/src/ingestion/streakEvents.js`

- Remove the `RECENT_WINDOW_DAYS` constant and the `g.date > CURRENT_DATE - INTERVAL '60 days'` clause from all four CTEs (`buildPlayerScanSQL`, `buildTeamScanSQL` for both `won` and `lost` outcomes).
- Add `g.season = $2` (player scan) / `g.season = $2` (team scan) — query parameter list becomes `[league, season, threshold]` instead of `[league, threshold]`.
- `updateStreakEvents(pool, league, { season } = {})` — if `season` not provided, resolves it via `getCurrentSeason(league)` from `backend/src/cache/seasons.js`. Threads through `scanPlayerStreaks` and `scanTeamStreaks`.
- The existing `runUpsert` call site (`backend/src/ingestion/pipeline/upsert.js:75`) is unchanged — it keeps calling `updateStreakEvents(pool, league)` with no season override, so the live job picks up the current season automatically.

### 2. `backend/src/ingestion/scripts/backfillStreaks.js` (new)

Mirrors the existing backfill scripts (`backfillTeamColors.js`, `backfillStatsTeamid.js`) for tooling consistency.

```
node src/ingestion/scripts/backfillStreaks.js [--league nba|nfl|nhl] [--season 2025-26]
```

Behavior:

- Loads `.env` from `backend/.env`, instantiates a standalone `pg.Pool`.
- For each requested league (default: all three), resolves the season (CLI flag wins; otherwise `getCurrentSeason(league)`).
- Calls `updateStreakEvents(pool, league, { season })`. The function's existing transaction + upsert + deactivateMissing handles the rest.
- Logs `{ league, season, active }` per league.
- Idempotent: re-runs converge on the same state.

### 3. `backend/src/services/streaks/streakTiers.js` (new, shared)

Tier rank tables consumed by both player and team detail services:

```js
export const PLAYER_TIER = {
  nba: ["triple-double", "30+ point", "double-double", "20+ point", "10+ assist", "10+ rebound"],
  nfl: ["250+ pass yard", "100+ yard", "2+ pass TD", "2+ TD"],
  nhl: ["multi-point", "goal"],
};

export function tierCaseSql(labels, columnExpr) {
  // returns "CASE columnExpr WHEN 'triple-double' THEN 0 WHEN '30+ point' THEN 1 ... ELSE 99 END"
}
```

`tierCaseSql` injects a deterministic ORDER BY into the player streak fetch. Team streaks don't need a tier table — `win`/`loss` are mutually exclusive on a single team, so the team query just does `ORDER BY length DESC LIMIT 1`.

### 4. Streak service — `backend/src/services/streaks/streaksService.js` (new)

Single service function consumed by both player and team endpoints:

```js
export async function getActiveStreak(league, subjectType, subjectId) {
  // SELECT stat_label, length
  // FROM streak_events
  // WHERE league = $1 AND subject_type = $2 AND subject_id = $3 AND is_active = TRUE
  // ORDER BY <tier CASE expr (player only)> ASC, length DESC
  // LIMIT 1
  // Returns { length, statLabel, subjectType } | null
}
```

For `subject_type = 'player'`, the ORDER BY uses `tierCaseSql(PLAYER_TIER[league], 'stat_label')` followed by `length DESC`. For `subject_type = 'team'`, just `length DESC` (win/loss don't co-occur).

Cached at `streak:{league}:{subjectType}:{subjectId}` with TTL 60s. Invalidated alongside `playerDetail:*` and a new `streak:*` pattern in `runUpsert` after each pipeline pass (so a freshly broken streak disappears within one upsert cycle).

### 5. New endpoints

- `GET /:league/players/:slug/streak` → `{ streak: { length, statLabel, subjectType: 'player' } | null }`
- `GET /:league/teams/:teamId/streak` → `{ streak: { length, statLabel, subjectType: 'team' } | null }`

Routes thin (delegate to controller); controllers resolve slug → ID (player only; team route accepts numeric ID), call `getActiveStreak`, return `{ streak }`.

Player slug resolution uses the existing `slugResolver.js` utility (same pattern as `playerInfoController`).

### 6. Cache invalidation

Add `invalidatePattern("streak:${league}:*")` to the existing block in `backend/src/ingestion/pipeline/upsert.js` (right after the existing `playerDetail:*` invalidation) so streak responses refresh within one upsert cycle.

## Frontend changes

**Numbering:** the four frontend changes are numbered 1–4 below.

### 1. `frontend/src/components/ui/StreakBadge.jsx` (new)

Mirrors the styling conventions of `PlayerStatusBadge` (compact pill, size variants).

```jsx
<StreakBadge streak={{ length, statLabel, subjectType }} size="md" />
```

- `streak == null` → renders nothing (so call sites don't have to guard).
- Player: `🔥 {length}-game {statLabel} streak`
- Team `win`: `🔥 {length}-game win streak`
- Team `loss`: `❄️ {length}-game loss streak`
- Sizes: `md` (default) → `px-3 py-1 text-xs`; `sm` → `px-2 py-0.5 text-[10px]` (matches the `PlayerStatusBadge` `sm` variant used in the favorites panel).

### 2. `frontend/src/hooks/data/useStreak.js` (new)

```js
export function useStreak(league, subjectType, subjectId, { enabled = true } = {}) {
  // useQuery({ queryKey: queryKeys.streak(league, subjectType, subjectId), enabled, staleTime: 30_000 })
  // returns { streak, ... }
}
```

`enabled` lets callers gate the fetch to current-season views.

### 3. `frontend/src/pages/PlayerPage.jsx`

Call `useStreak(league, 'player', playerData?.id, { enabled: viewingCurrentSeason })` and render `<StreakBadge streak={streak} />` next to the existing `PlayerStatusBadge`. Place after the status badge so injury info reads first.

### 4. `frontend/src/pages/TeamPage.jsx`

Call `useStreak(league, 'team', team?.id, { enabled: isCurrentSeason })` where `isCurrentSeason = !selectedSeason || selectedSeason === leagueSeasons[0]`. Render `<StreakBadge streak={streak} />` next to the team name in the header.

## Testing

- **Backend:**
  - Unit test for `streakTiers.tierCaseSql` (deterministic ordering, escapes labels safely).
  - Unit test for `streaksService.getActiveStreak` (player ordering by tier+length; team ordering by length; null when no rows).
  - Route tests for `/:league/players/:slug/streak` and `/:league/teams/:teamId/streak`.
  - Existing `streakEvents` tests continue to pass after the season-filter change (update fixtures to pass a season arg through `updateStreakEvents`).
- **Frontend:**
  - `useStreak.test.js` covering enabled/disabled and successful fetch.
  - `StreakBadge.test.jsx` covering player streak, team win, team loss, and `null` (renders nothing).

Out of scope: end-to-end test of the live scan path (already covered by existing `streakEvents` tests).

## Out of scope

- Closed / historical streaks ("Player had a 6-game DD streak in November that ended Dec 4"). Deferred until there's a UI use case.
- Multi-streak display (more than one pill per subject). Tier priority returns one streak; if the user later wants both "longest" and "most impressive," extend `StreakBadge` to accept an array.
- Showing streak history on a player/team page (best streak this season, last season's longest, etc.).
- Migration of `streak_events` schema (no schema changes; only query and worker logic).

## Migration / rollout

- No schema migration.
- Deploy order: backend changes → run backfill script once per environment → frontend changes (frontend is a no-op until `playerData.streak` / `team.streak` start being populated, but renders cleanly with `null`).
