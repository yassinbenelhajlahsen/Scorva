# Team Roster Tab — Design

Add a Roster tab to `TeamPage.jsx`, alongside the existing schedule view, using the same pill-tab UI as `LeaguePage.jsx`. The roster is a simple, clickable list of players for the selected season — no per-player stats in v1.

## Scope

**In scope**
- New tab UI on `TeamPage.jsx` matching `LeaguePage.jsx`'s pill style and slide transition.
- New backend endpoint returning the team's roster for a given season.
- New `RosterGrid` component rendering a card per player.
- Skeleton + error states.
- Lazy-load: roster data fetched only when the Roster tab is active.

**Out of scope (v1)**
- Per-player stats inside the roster card.
- Roster sorting/filtering controls.
- Position-grouped sections.
- URL-persisted tab state (mirror LeaguePage — local state only).

## Data approach

Two queries depending on whether the requested season is the current season:

- **Current / null season** → `SELECT … FROM players WHERE league = $1 AND teamid = $2`. This returns the active roster, including depth/IR/rookies who haven't appeared in a game yet. Players traded mid-season are correctly excluded (their `players.teamid` updates on transaction ingestion).
- **Historical season** → `SELECT DISTINCT players.* FROM stats s JOIN games g ON s.gameid = g.id JOIN players p ON s.playerid = p.id WHERE g.league = $1 AND g.season = $3 AND COALESCE(s.teamid, p.teamid) = $2`. Matches the `COALESCE` pattern already used in `gameDetailService.js` and `playerDetailService.js`. Falls back to `p.teamid` for the ~2,000 NULL-eventid stats rows that can't be backfilled (acknowledged limitation, consistent with rest of codebase).

Returned shape per player (snake_case to match other team/players responses):
```
{
  id, name, position, jerseynum, image_url,
  status, status_description, status_updated_at,
  espn_playerid
}
```
Sorted by `position NULLS LAST, name`.

## Backend

### Route — `backend/src/routes/teams/teams.js`
Add:
```js
router.get("/:league/teams/:teamId/roster", getTeamRoster);
```
Order matters — must be declared before any catch-all on the teams router.

### Controller — `backend/src/controllers/teams/teamsController.js`
New `getTeamRoster(req, res)`:
- Validate `league` (NBA/NFL/NHL allowlist — same as existing controllers).
- Parse `teamId` as integer; reject `NaN` with 400.
- Read `season` from `req.query.season` — pass through if present, else `null`.
- Call service; return JSON array.
- Catch + log via `logger.error` like sibling handlers.

### Service — `backend/src/services/teams/teamsService.js`
New `getTeamRoster(league, teamId, season)`:
- Resolve current season via `getCurrentSeason(league)` from `cache/seasons.js`.
- Determine effective season: `season ?? currentSeason`.
- If `effective === currentSeason`: run the `players WHERE teamid` query.
- Else: run the historical `DISTINCT … FROM stats` query.
- Wrap with `cached(\`roster:${league}:${teamId}:${effective}\`, ttl, …)`:
  - `ttl` = 5 minutes for current season, 30 days for historical (mirrors standings).
- Return `result.rows`.

### Tests — `backend/__tests__/`
Add `roster.test.js` covering:
- Current-season path returns players from `players` table.
- Historical-season path returns DISTINCT from stats with COALESCE.
- Invalid league → 400.
- Invalid teamId → 400.
- Mock `cache/seasons.js` and `cache/cache.js` per existing patterns documented in CLAUDE.md memory.

## Frontend

### API client — `frontend/src/api/teams.js`
Add:
```js
export function getTeamRoster(league, teamId, { season, signal } = {}) {
  return apiFetch(`/api/${league}/teams/${teamId}/roster`, { signal, params: { season } });
}
```

### Query keys — `frontend/src/lib/query.js`
Add:
```js
teamRoster: (league, teamId, season) => ["teamRoster", league, teamId, season],
```

### Hook — `frontend/src/hooks/data/useTeamRoster.js`
New file. Single `useQuery` returning `{ roster, loading, error, retry }`. Accepts an `enabled` flag so the hook only fires when the Roster tab is active. Uses `keepPreviousData` for season changes so the grid doesn't flash.

### Component — `frontend/src/components/team/RosterGrid.jsx`
Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.

Each card (a `Link` to `/${league}/players/${slugify(player.name)}` with season query param via `buildSeasonUrl`):
- Card chrome: `bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5`
- Top: photo (`w-16 h-16 rounded-full object-cover`, `loading="lazy"`, hide on error)
- Right of photo: name (`text-base font-semibold text-text-primary`)
- Below name: `#23 · PG` (jersey + position) in `text-text-tertiary text-xs`
- `PlayerStatusBadge` (`size="sm"`) shown only when `status` is set and non-"available"
- `onMouseEnter` prefetch `queryKeys.player(league, slug, season)` with `staleTime: 10_000`, guarded by `window.matchMedia("(hover: hover)").matches`

Empty state: centered "No roster data for this season."

Stagger animation: reuse `containerVariants` / `itemVariants` from `utils/motion.js`.

### Skeleton — `frontend/src/components/skeletons/RosterGridSkeleton.jsx`
6 placeholder cards in the same grid layout. Photo circle + two skeleton lines.

### Page — `frontend/src/pages/TeamPage.jsx`
Add tab infrastructure copied from `LeaguePage.jsx`:
- `activeTab` state (default `"games"`), `tabDirection`, `tabRefs`, `tabNavRef`, `pillBounds`.
- `useLayoutEffect` to compute pill bounds.
- `pickTab(tab)` helper to set direction and active tab.
- Pill nav block placed between the team header and the content.

Tabs: `["schedule", "roster"]` — uppercased-first-letter display via the same `tab.charAt(0).toUpperCase() + tab.slice(1)` pattern as LeaguePage, yielding **Schedule** and **Roster**.

Conditionally render:
- When `activeTab === "schedule"`: existing `MonthNavigation` + games grid.
- When `activeTab === "roster"`: `RosterGrid` (or skeleton when loading, `ErrorState` on error).

Wrap content in `AnimatePresence mode="wait"` with the same custom `tabDirection` slide variants as LeaguePage.

The "Schedule" `<h2>` heading is removed — the active tab pill itself communicates the section. The Compare button + Season selector row stays above the tabs.

`useTeamRoster` is invoked with `enabled: activeTab === "roster"` so historical seasons aren't fetched until the user opens the tab.

### Tests — `frontend/src/__tests__/`
- `useTeamRoster.test.js` — TanStack Query happy/error paths with `createWrapper`.
- `RosterGrid.test.jsx` — renders cards, links to player page with correct slug + season, shows status badge only when non-available.

## Caching & invalidation

- 5-min TTL on current-season roster keeps trade-day churn fresh.
- 30-day TTL on historical seasons — mirrors `standings:{league}:{season}` past-season caching.
- Bump `CACHE_VERSION` in `cache/cache.js` is **not** required — new key namespace.

## Risks & open items

- **Position-NULL players** → grouped at the end via `NULLS LAST` ordering.
- **Missing image_url** → `onError` hides the `<img>`, leaving the layout intact (same pattern as `TeamPage.jsx` team logo).
- **Historical roster gaps** for ~2,000 NULL-eventid games → players traded mid-historical-season may appear under their newer team. Acknowledged limitation, consistent with the rest of the app.
