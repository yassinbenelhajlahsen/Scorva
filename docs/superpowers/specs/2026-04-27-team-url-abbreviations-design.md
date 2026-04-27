# Team URL Abbreviations — Design

**Date:** 2026-04-27
**Status:** Approved
**Scope:** Frontend team URLs only (player URLs, game URLs, compare URL out of scope)

## Goal

Replace long team-name slugs in URLs with the existing `teams.abbreviation` column.

- Before: `/nba/teams/los-angeles-lakers`
- After: `/nba/teams/lal`

The `abbreviation` column was added by the prior search-improvements work and is already populated for all ~94 teams across NBA / NFL / NHL.

## Non-goals

- Player URL changes — `/{league}/players/{slugify(name)}` stays as is.
- Game URL changes — `/{league}/games/{numericId}` stays as is.
- Compare URL — remains `/compare` with React Router `location.state`. Refresh-safe today via `window.history.state` (browser preserves it across reloads of the same history entry).
- Old-slug → new-abbr redirects — not adding any. Bookmarks / SEO are explicitly not a concern.
- Database migrations / ingestion changes — column already exists and is populated.

## URL shape

`/{league}/teams/{lowercase-abbreviation}`

- Lowercase in the URL (clean-URL convention). Column stays uppercase in the DB.
- Examples: `/nba/teams/lal`, `/nfl/teams/kc`, `/nhl/teams/bos`.

## Architecture

### Frontend

**1. Centralized URL builder.** New helper at `frontend/src/utils/teamUrl.js`:

```js
import slugify from "./slugify.js";

export default function teamUrl(league, team) {
  const id =
    (team?.abbreviation || "").toLowerCase() ||
    slugify(team?.name || "");
  return `/${league}/teams/${id}`;
}
```

Defensive fallback to `slugify(name)` if a team object somehow lacks `abbreviation`. Should not trigger in practice once backend SELECTs are updated, but keeps any edge case from producing `/{league}/teams/`.

**2. Resolver update in `useTeam`.** `frontend/src/hooks/data/useTeam.js` updates the slug-match block:

```js
const param = teamId.toLowerCase();
const found = teamList.find((t) =>
  (t.abbreviation || "").toLowerCase() === param ||
  slugify(t.name) === param ||
  slugify(t.shortname || "") === param
);
```

The slug branches stay as fallbacks (one extra `||`, no cost) so any internal link missed during the migration still resolves rather than 404ing. URL stays whatever was typed — no redirect to canonical form.

**3. Link sites updated to call `teamUrl(league, team)`.** Each must verify the team object passed in has `abbreviation`:

| File | Line | Notes |
|---|---|---|
| `frontend/src/pages/LeaguePage.jsx` | 200 | Team list grid — team comes from `getTeams(league)` |
| `frontend/src/pages/PlayerPage.jsx` | 239 | Player's current team — needs backend to include team.abbreviation |
| `frontend/src/pages/ComparePage.jsx` | 578 | PlayerHero → player.team link |
| `frontend/src/pages/ComparePage.jsx` | 604, 614 | TeamHero links |
| `frontend/src/components/game/GameMatchupHeader.jsx` | 43, 147 | Home/away team links — needs games service to expose abbr |
| `frontend/src/components/favorites/FavoriteTeamsSection.jsx` | 28, 32 | Link `to=` AND the hover prefetch `queryKey` must use the same value (resolver matches it) |

**Not changed:**
- `frontend/src/pages/TeamPage.jsx:137` — passes `slugify(team.name)` as `state.id1` for compare. That's compare in-memory state, not a URL. Resolver already accepts slug, so no change needed.

### Backend

`abbreviation` is currently in the DB but not exposed by any service. Add it to existing `SELECT` lists (no migration, no ingestion changes):

| File | What to add |
|---|---|
| `backend/src/services/teams/teamsService.js` | `abbreviation` in `getTeamsByLeague` — powers the team list `useTeam` resolves against |
| `backend/src/services/users/favoritesService.js` | `abbreviation` in `getFavorites` team query — favorited teams need it for links |
| `backend/src/services/games/gameDetailQueryBuilder.js` | Add `'abbreviation', ht.abbreviation` to the `homeTeam.info` JSON object (line 96 block) and `'abbreviation', at.abbreviation` to `awayTeam.info` (line 111 block). `GameMatchupHeader.jsx` reads `homeTeam.info.*` / `awayTeam.info.*`. |
| `backend/src/services/players/playerDetailService.js` | Add `'abbreviation', t.abbreviation` to the `'team', json_build_object(...)` block — appears in three query variants (around lines 27, 140, 233). PlayerPage consumes this as `team.abbreviation`. |

**Not changed:** `backend/src/services/games/gamesService.js` (line 33/36 with `home_shortname` / `away_shortname` for the games list / GameCard) — those rows feed game cards which link to games, not teams. No team URL is built from them.

## Data flow (team page load)

1. User clicks team link → `teamUrl(league, team)` produces `/nba/teams/lal`
2. React Router matches `/:league/teams/:teamId` → `TeamPage` mounts
3. `useTeam("nba", "lal", ...)` calls `getTeams("nba")` (cached 24h)
4. Resolver finds team where `abbreviation.toLowerCase() === "lal"`
5. Page renders with the matched team object

## Tests

### Frontend
- `useTeam` resolver tests:
  - matches by abbreviation hit (lowercase URL, uppercase column)
  - matches by slug fallback (legacy slug still resolves)
  - matches by shortname slug (existing behavior preserved)
  - returns "Team not found" when none match
- `teamUrl` helper tests:
  - returns `/nba/teams/lal` when `abbreviation: "LAL"`
  - falls back to slug when `abbreviation` missing/empty
  - lowercases the abbreviation in the URL

### Backend
- No new test coverage required. Existing service tests do not assert exact column lists, so adding `abbreviation` to SELECTs is non-breaking for tests. Spot-check that existing tests still pass.

## Risk and rollout

- **Risk:** abbreviation collisions within a league. The data is already populated; abbreviations are league-scoped (URL prefix is `/{league}/`), so the only collision risk is within one league. Mitigation: spot-check via `SELECT league, abbreviation, COUNT(*) FROM teams GROUP BY 1,2 HAVING COUNT(*) > 1` during implementation. If duplicates exist, fix the data before flipping links.
- **Risk:** a team object passed to `teamUrl` is missing `abbreviation` because a backend SELECT was missed. Mitigation: the helper falls back to `slugify(name)`, so the link still works (just longer). Resolver also accepts slug, so the page still loads.
- **Rollout:** single PR. No feature flag, no staged rollout — internal links only, low blast radius, fallback paths cover the missed-SELECT case.

## Out of scope (explicitly)

Captured here so reviewers can confirm:

- Player URL changes
- Game URL changes
- Compare URL changes (stays `/compare` with state)
- Old-slug redirects
- DB migrations or backfill
