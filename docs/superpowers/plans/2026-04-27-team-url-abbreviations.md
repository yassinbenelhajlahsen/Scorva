# Team URL Abbreviations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace long team-name slugs in URLs (`/nba/teams/los-angeles-lakers`) with the existing `teams.abbreviation` column (`/nba/teams/lal`).

**Architecture:** Add a centralized `teamUrl(league, team)` frontend helper. Update `useTeam`'s slug resolver to match abbreviation (lowercase) with the existing slug branches kept as fallback (no redirects). Backend exposes the already-populated `abbreviation` column in three additional SELECTs (game detail, player detail, favorites) — `getTeamsByLeague` already returns it via `SELECT *`. Bump `CACHE_VERSION` at the end so cached entries pick up the new shape immediately.

**Tech Stack:** React 19, React Router 7, TanStack Query v5, Vitest (frontend); Node.js + Express, raw `pg` SQL, Jest (backend); Redis cache with versioned keys.

**Spec:** `docs/superpowers/specs/2026-04-27-team-url-abbreviations-design.md`

---

## File Structure

**Created:**
- `frontend/src/utils/teamUrl.js` — single helper that builds a team URL from `(league, team)`
- `frontend/src/__tests__/utilities/teamUrl.test.js` — unit tests for the helper

**Modified — frontend:**
- `frontend/src/hooks/data/useTeam.js` — resolver matches abbreviation
- `frontend/src/__tests__/hooks/useTeam.test.js` — extra resolver cases
- `frontend/src/pages/LeaguePage.jsx`
- `frontend/src/pages/PlayerPage.jsx`
- `frontend/src/pages/ComparePage.jsx`
- `frontend/src/components/game/GameMatchupHeader.jsx`
- `frontend/src/components/favorites/FavoriteTeamsSection.jsx`

**Modified — backend:**
- `backend/src/services/games/gameDetailQueryBuilder.js`
- `backend/src/services/players/playerDetailService.js`
- `backend/src/services/user/favoritesService.js`
- `backend/src/cache/cache.js` — bump `CACHE_VERSION`

**Not modified (verified):**
- `backend/src/services/teams/teamsService.js` — `getTeamsByLeague` uses `SELECT *`, already returns `abbreviation`. Confirmed in Task 4.

---

## Task 1: Create `teamUrl` helper

**Files:**
- Create: `frontend/src/utils/teamUrl.js`
- Test: `frontend/src/__tests__/utilities/teamUrl.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/utilities/teamUrl.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import teamUrl from "../../utils/teamUrl.js";

describe("teamUrl", () => {
  it("uses lowercased abbreviation when present", () => {
    expect(teamUrl("nba", { abbreviation: "LAL", name: "Los Angeles Lakers" }))
      .toBe("/nba/teams/lal");
  });

  it("handles already-lowercase abbreviation", () => {
    expect(teamUrl("nfl", { abbreviation: "kc", name: "Kansas City Chiefs" }))
      .toBe("/nfl/teams/kc");
  });

  it("falls back to slugified name when abbreviation missing", () => {
    expect(teamUrl("nba", { name: "Los Angeles Lakers" }))
      .toBe("/nba/teams/los-angeles-lakers");
  });

  it("falls back to slugified name when abbreviation is empty string", () => {
    expect(teamUrl("nhl", { abbreviation: "", name: "Boston Bruins" }))
      .toBe("/nhl/teams/boston-bruins");
  });

  it("returns /:league/teams/ when team has neither abbreviation nor name", () => {
    expect(teamUrl("nba", {})).toBe("/nba/teams/");
  });

  it("tolerates a null team", () => {
    expect(teamUrl("nba", null)).toBe("/nba/teams/");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- teamUrl`
Expected: All tests FAIL with `Cannot find module '../../utils/teamUrl.js'` or similar resolve error.

- [ ] **Step 3: Implement the helper**

Create `frontend/src/utils/teamUrl.js`:

```javascript
import slugify from "./slugify.js";

export default function teamUrl(league, team) {
  const abbr = (team?.abbreviation || "").toLowerCase();
  const id = abbr || slugify(team?.name || "");
  return `/${league}/teams/${id}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- teamUrl`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/teamUrl.js frontend/src/__tests__/utilities/teamUrl.test.js
git commit -m "feat(frontend): add teamUrl helper for abbreviation-based URLs"
```

---

## Task 2: Update `useTeam` resolver to match abbreviation

**Files:**
- Modify: `frontend/src/hooks/data/useTeam.js:11-17`
- Modify: `frontend/src/__tests__/hooks/useTeam.test.js`

- [ ] **Step 1: Add failing tests for abbreviation resolution**

Open `frontend/src/__tests__/hooks/useTeam.test.js`. Update `mockLakers` and `mockTeamList` (lines 20–24) to include `abbreviation`:

```javascript
const mockLakers = { id: 17, name: "Los Angeles Lakers", shortname: "Lakers", abbreviation: "LAL" };
const mockTeamList = [
  mockLakers,
  { id: 2, name: "Golden State Warriors", shortname: "Warriors", abbreviation: "GS" },
];
```

Then add three new tests inside the `describe("useTeam", () => { ... })` block, immediately after the existing `it("resolves team from slug match", ...)` test:

```javascript
  it("resolves team from lowercase abbreviation match", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "lal", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.team).toEqual(mockLakers));
  });

  it("resolves team from uppercase abbreviation in URL (case-insensitive)", async () => {
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "LAL", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.team).toEqual(mockLakers));
  });

  it("falls back to slug match when abbreviation does not match", async () => {
    // Existing slug fallback path — kept so missed link sites still resolve.
    getTeams.mockResolvedValue(mockTeamList);
    getTeamGames.mockResolvedValue(mockGames);
    getStandings.mockResolvedValue(mockStandings);

    const { result } = renderHook(
      () => useTeam("nba", "los-angeles-lakers", "2024-25"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.team).toEqual(mockLakers));
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd frontend && npm test -- useTeam`
Expected: The two new abbreviation tests FAIL with `result.current.team` being `null` and an error like `Team not found.` The slug-fallback test should still pass (existing behavior).

- [ ] **Step 3: Update the resolver in `useTeam.js`**

In `frontend/src/hooks/data/useTeam.js`, replace the `queryFn` body inside `teamQuery` (lines 11–17) so the slug-match block matches abbreviation first, then the existing slug branches:

```javascript
    queryFn: async ({ signal }) => {
      const teamList = await getTeams(league, { signal });
      const param = (teamId || "").toLowerCase();
      const found = teamList.find((t) =>
        (t.abbreviation || "").toLowerCase() === param ||
        slugify(t.name) === param ||
        slugify(t.shortname || "") === param
      );
      if (!found) throw new Error("Team not found.");
      return found;
    },
```

- [ ] **Step 4: Run all useTeam tests to verify they pass**

Run: `cd frontend && npm test -- useTeam`
Expected: PASS — all existing tests + the 3 new ones (abbreviation lowercase, abbreviation uppercase, slug fallback).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useTeam.js frontend/src/__tests__/hooks/useTeam.test.js
git commit -m "feat(frontend): resolve team from abbreviation in useTeam"
```

---

## Task 3: Expose `abbreviation` in backend SELECTs

This task makes three backend services include `abbreviation` in their existing SELECTs / JSON shapes. The column already exists in `teams`. No migration, no ingest. Each step is a small, independent edit.

**Files:**
- Modify: `backend/src/services/games/gameDetailQueryBuilder.js:96-118`
- Modify: `backend/src/services/players/playerDetailService.js` (three `'team', json_build_object` blocks around lines 27, 140, 233)
- Modify: `backend/src/services/user/favoritesService.js:45-52`

- [ ] **Step 1: Add `abbreviation` to game detail JSON shape**

In `backend/src/services/games/gameDetailQueryBuilder.js`, find the `'homeTeam', json_build_object(...)` block (starts around line 96). Add `'abbreviation', ht.abbreviation,` immediately after the `'name'` line. Do the same for the `'awayTeam'` block (starts around line 111) — add `'abbreviation', at.abbreviation,` after the `'name'` line.

After the change the `info` blocks should look like:

```javascript
  'homeTeam', json_build_object(
    'info', json_build_object(
      'id', ht.id,
      'name', ht.name,
      'abbreviation', ht.abbreviation,
      'shortName', ht.shortname,
      // …existing fields unchanged
    ),
    'players', (${playerSubquery("g.hometeamid")})
  ),
  'awayTeam', json_build_object(
    'info', json_build_object(
      'id', at.id,
      'name', at.name,
      'abbreviation', at.abbreviation,
      'shortName', at.shortname,
      // …existing fields unchanged
    ),
    'players', (${playerSubquery("g.awayteamid")})
  ),
```

- [ ] **Step 2: Add `abbreviation` to player detail team JSON shape (3 query variants)**

In `backend/src/services/players/playerDetailService.js`, there are three `'team', json_build_object(...)` blocks (NBA / NFL / NHL variants). Each looks like:

```javascript
      'team', json_build_object(
        'id', t.id,
        'name', t.name,
        'shortName', t.shortname,
        'location', t.location,
        'logoUrl', t.logo_url
      ),
```

In each of the three blocks, add `'abbreviation', t.abbreviation,` after the `'name'` line:

```javascript
      'team', json_build_object(
        'id', t.id,
        'name', t.name,
        'abbreviation', t.abbreviation,
        'shortName', t.shortname,
        'location', t.location,
        'logoUrl', t.logo_url
      ),
```

The blocks appear at approximately lines 27, 140, and 233. All three must be updated — leaving any out means PlayerPage's "current team" link falls back to slug for that league.

- [ ] **Step 3: Add `abbreviation` to favorites teams query**

In `backend/src/services/user/favoritesService.js`, the favorited-teams query (lines 45–52) currently selects:

```javascript
      pool.query(
        `SELECT t.id, t.name, t.shortname, t.location, t.logo_url, t.record, t.league
         FROM user_favorite_teams uft
         JOIN teams t ON uft.team_id = t.id
         WHERE uft.user_id = $1
         ORDER BY uft.created_at DESC`,
        [userId]
      ),
```

Add `t.abbreviation` to the SELECT list:

```javascript
      pool.query(
        `SELECT t.id, t.name, t.abbreviation, t.shortname, t.location, t.logo_url, t.record, t.league
         FROM user_favorite_teams uft
         JOIN teams t ON uft.team_id = t.id
         WHERE uft.user_id = $1
         ORDER BY uft.created_at DESC`,
        [userId]
      ),
```

- [ ] **Step 4: Run backend tests to verify nothing broke**

Run: `cd backend && npm test`
Expected: PASS — all existing backend tests still pass. None of these tests assert exact column lists or JSON keys, so the additions are non-breaking.

If a test fails, read the failure carefully — it almost certainly means a snapshot or strict shape assertion, which should be updated to allow the new field rather than removing the change.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/gameDetailQueryBuilder.js \
        backend/src/services/players/playerDetailService.js \
        backend/src/services/user/favoritesService.js
git commit -m "feat(backend): expose teams.abbreviation in game/player/favorites SELECTs"
```

---

## Task 4: Verify `getTeamsByLeague` already returns `abbreviation`

`backend/src/services/teams/teamsService.js:17-29` uses `SELECT *`, so `abbreviation` should automatically be included in the team list response. This task is a verification, not a code change — confirm before relying on it from the frontend.

**Files:**
- Read-only: `backend/src/services/teams/teamsService.js`

- [ ] **Step 1: Spot-check the SQL**

Run: `grep -n "SELECT" backend/src/services/teams/teamsService.js | head -3`
Expected output includes a line like `19: SELECT *` inside `getTeamsByLeague`.

- [ ] **Step 2: Smoke-test the live endpoint**

Start the backend (in another terminal): `cd backend && npm run dev`

In a new terminal, run:

```bash
curl -s http://localhost:3000/api/nba/teams | head -c 2000
```

(Use whatever port the backend listens on locally — check `backend/src/index.js` if 3000 is wrong.)

Expected: The first team object in the JSON includes `"abbreviation": "..."` with a non-empty uppercase string. If it does not appear:

- The cache may be serving a stale entry that was populated before this work — proceed to Task 6 (bump `CACHE_VERSION`) and re-test.
- If still missing, double-check the column is actually present and populated: `psql $DATABASE_URL -c "SELECT id, name, abbreviation FROM teams WHERE league='nba' LIMIT 3"`.

- [ ] **Step 3: No commit (verification only)**

This task does not produce a commit.

---

## Task 5: Update frontend link sites to use `teamUrl`

Each call site below currently builds a team URL with `slugify(team.name)`. Replace each with `teamUrl(league, team)` so the URL uses the abbreviation. `FavoriteTeamsSection` also has a hover prefetch keyed off the slug — that key must change in lockstep with the URL or the prefetched cache entry won't match.

**Files:**
- Modify: `frontend/src/pages/LeaguePage.jsx:200`
- Modify: `frontend/src/pages/PlayerPage.jsx:239`
- Modify: `frontend/src/pages/ComparePage.jsx:578, 604, 614`
- Modify: `frontend/src/components/game/GameMatchupHeader.jsx:43, 147`
- Modify: `frontend/src/components/favorites/FavoriteTeamsSection.jsx:18, 28, 32`

- [ ] **Step 1: `LeaguePage.jsx`**

Open `frontend/src/pages/LeaguePage.jsx`. Add the import alongside the other utils imports near the top of the file:

```javascript
import teamUrl from "../utils/teamUrl.js";
```

At line 200, replace:

```javascript
            to={buildSeasonUrl(`/${league}/teams/${slugify(team.name)}`, selectedSeason)}
```

with:

```javascript
            to={buildSeasonUrl(teamUrl(league, team), selectedSeason)}
```

- [ ] **Step 2: `PlayerPage.jsx`**

Open `frontend/src/pages/PlayerPage.jsx`. Add:

```javascript
import teamUrl from "../utils/teamUrl.js";
```

At line 239, replace:

```javascript
                to={buildSeasonUrl(`/${league}/teams/${slugify(team.name)}`, selectedSeason)}
```

with:

```javascript
                to={buildSeasonUrl(teamUrl(league, team), selectedSeason)}
```

- [ ] **Step 3: `ComparePage.jsx`**

Open `frontend/src/pages/ComparePage.jsx`. Add:

```javascript
import teamUrl from "../utils/teamUrl.js";
```

At line 578, replace:

```javascript
          <Link to={buildSeasonUrl(`/${league}/teams/${slugify(player.team.name)}`, season)} className="flex items-center justify-center gap-1.5 mt-1 hover:text-accent transition-colors duration-200">
```

with:

```javascript
          <Link to={buildSeasonUrl(teamUrl(league, player.team), season)} className="flex items-center justify-center gap-1.5 mt-1 hover:text-accent transition-colors duration-200">
```

At line 604, replace:

```javascript
      <Link to={buildSeasonUrl(`/${league}/teams/${slugify(team.name)}`, season)}>
```

with:

```javascript
      <Link to={buildSeasonUrl(teamUrl(league, team), season)}>
```

At line 614, replace:

```javascript
        <Link to={buildSeasonUrl(`/${league}/teams/${slugify(team.name)}`, season)} className="text-base sm:text-lg font-bold text-text-primary hover:text-accent transition-colors duration-200">
```

with:

```javascript
        <Link to={buildSeasonUrl(teamUrl(league, team), season)} className="text-base sm:text-lg font-bold text-text-primary hover:text-accent transition-colors duration-200">
```

- [ ] **Step 4: `GameMatchupHeader.jsx`**

Open `frontend/src/components/game/GameMatchupHeader.jsx`. Add:

```javascript
import teamUrl from "../../utils/teamUrl.js";
```

`homeTeam.info` / `awayTeam.info` now include `abbreviation` (added in Task 3 Step 1). At line 43, replace the home team link:

```javascript
            to={`/${league}/teams/${slugify(homeTeam.info.name)}`}
```

with:

```javascript
            to={teamUrl(league, homeTeam.info)}
```

At line 147, replace the away team link:

```javascript
            to={`/${league}/teams/${slugify(awayTeam.info.name)}`}
```

with:

```javascript
            to={teamUrl(league, awayTeam.info)}
```

There are two prefetch `queryKey` calls (lines 47 and 151 per the earlier grep) that key on `slugify(homeTeam.info.name)` / `slugify(awayTeam.info.name)`. These keys must match the URL parameter the resolver sees, and the URL parameter is now the lowercase abbreviation produced by `teamUrl`.

Replace `slugify(homeTeam.info.name)` everywhere it appears in this file (both inside `queryKeys.team(...)` and inside `queryFns.team(...)` for the home prefetch) with `teamUrl(league, homeTeam.info).split("/").pop()`. Do the same for `slugify(awayTeam.info.name)` using `awayTeam.info`.

`teamUrl(league, team).split("/").pop()` reuses the helper to derive the same id the URL uses — guaranteed to match what the resolver in `useTeam` looks up.

After this change, `slugify` is no longer imported by `GameMatchupHeader.jsx`. Remove its import line if it exists.

- [ ] **Step 5: `FavoriteTeamsSection.jsx`**

Open `frontend/src/components/favorites/FavoriteTeamsSection.jsx`.

Replace the import on line 5:

```javascript
import slugify from "../../utils/slugify.js";
```

with:

```javascript
import teamUrl from "../../utils/teamUrl.js";
```

At line 18, replace:

```javascript
          const teamSlug = slugify(team.name);
```

with:

```javascript
          const url = teamUrl(team.league, team);
          const teamSlug = url.split("/").pop();
```

This computes the URL once via the helper and derives the lookup id from it — guaranteed to match what `useTeam`'s resolver sees. The existing `teamSlug` variable name is preserved so the prefetch `queryKey` on line 32 still references it without further changes.

At line 28, replace:

```javascript
                  to={`/${team.league}/teams/${teamSlug}`}
```

with:

```javascript
                  to={url}
```

Confirm `slugify` has no remaining references in the file (`grep -n slugify frontend/src/components/favorites/FavoriteTeamsSection.jsx`). The import was removed at the top of this step; if grep returns any matches, restore the import. It should not — the only previous use was on line 18.

- [ ] **Step 6: Run frontend verify**

Run: `cd frontend && npm run verify`
Expected: PASS — lint clean, all tests pass, build succeeds.

- [ ] **Step 7: Manual smoke test**

Start the backend and frontend dev servers. Click through:
1. Homepage / LeaguePage → click any team card → URL is `/{league}/teams/{lowercase-abbr}` (e.g., `/nba/teams/lal`), TeamPage renders correctly.
2. Open a GamePage → click home team in matchup header → same URL shape, page loads.
3. Open a PlayerPage → click the player's team → same URL shape, page loads.
4. Open ComparePage with a team → click the team hero → same URL shape.
5. Open the favorites panel → click a favorited team → same URL shape, hover over the same team in the panel and confirm in DevTools Network that the prefetch matches the eventual page query (no double-fetch).
6. Manually paste an old slug URL like `/nba/teams/los-angeles-lakers` into the address bar → page still loads (slug fallback in `useTeam`).

If any link still produces a slug-based URL, find the call site and convert it.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/LeaguePage.jsx \
        frontend/src/pages/PlayerPage.jsx \
        frontend/src/pages/ComparePage.jsx \
        frontend/src/components/game/GameMatchupHeader.jsx \
        frontend/src/components/favorites/FavoriteTeamsSection.jsx
git commit -m "feat(frontend): use abbreviation in team URLs via teamUrl helper"
```

---

## Task 6: Bump `CACHE_VERSION`

Backend changes alter the JSON shape of cached entries (`gameDetail:*` cached up to 30d, `playerDetail:*` cached 2m–30d, `teams:*` cached 24h). Old cached values lack `abbreviation`. The `useTeam` slug fallback means stale cache doesn't break links — but it does mean the URL stays in old slug form until cache expires. Bumping `CACHE_VERSION` invalidates everything immediately on deploy.

**Files:**
- Modify: `backend/src/cache/cache.js:20`

- [ ] **Step 1: Bump the version**

In `backend/src/cache/cache.js`, find:

```javascript
export const CACHE_VERSION = 4;
```

Change to:

```javascript
export const CACHE_VERSION = 5;
```

- [ ] **Step 2: Run backend tests**

Run: `cd backend && npm test`
Expected: PASS. Cache tests should automatically use the bumped version (the value is read at module load).

- [ ] **Step 3: Commit**

```bash
git add backend/src/cache/cache.js
git commit -m "chore(cache): bump CACHE_VERSION for team abbreviation field"
```

---

## Task 7: Final verify

- [ ] **Step 1: Run full frontend verify**

Run: `cd frontend && npm run verify`
Expected: PASS — lint, tests, build all green.

- [ ] **Step 2: Run full backend verify**

Run: `cd backend && npm run verify`
Expected: PASS — lint and tests green.

- [ ] **Step 3: One final manual smoke test**

With both servers restarted (so the new `CACHE_VERSION` takes effect and Redis cache misses on the first request), repeat the manual smoke test from Task 5 Step 7. Confirm:
- Team URLs are abbreviation-based everywhere.
- Old slug URLs still resolve (slug fallback works).
- Hover prefetch in `FavoriteTeamsSection` and `GameMatchupHeader` doesn't trigger a second fetch when navigating to the team page (DevTools Network tab — only one team-list fetch + one team-games fetch should happen).

- [ ] **Step 4: No commit (verification only)**

---

## Self-Review Notes

Spec coverage check (each spec section maps to a task):

- "URL shape `/{league}/teams/{lowercase-abbreviation}`" → Tasks 1 (helper), 2 (resolver), 5 (link sites)
- "Centralized URL builder `teamUrl`" → Task 1
- "`useTeam` resolver matches abbreviation with slug fallback" → Task 2
- "All link sites updated" → Task 5 (each file from spec covered)
- "Backend SELECTs expose `abbreviation`" → Task 3 (game detail, player detail, favorites) + Task 4 (verify teams list passthrough)
- "No migration / no ingest" → not a task (intentional non-action)
- "Out of scope: player URLs, game URLs, compare URL, redirects" → no tasks for these (correctly absent)

Implicit additions (not in spec but necessary):
- `CACHE_VERSION` bump (Task 6) — needed because `gameDetail` and `playerDetail` are cached and would serve old shape; documented in MEMORY.md as the convention for breaking shape changes
- Hover prefetch `queryKey` updates in `FavoriteTeamsSection` and `GameMatchupHeader` (Task 5 Steps 4 and 5) — must match the URL the resolver sees, otherwise prefetched data caches under a stale key

No placeholders. Every step contains the exact code/command to run.
