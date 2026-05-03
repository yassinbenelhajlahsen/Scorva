# Global Live-Games Rail — Design Spec

**Date:** 2026-05-02
**Status:** Approved, ready for implementation plan
**Scope:** Replace the per-league `LeagueSlate` (currently rendered only on `LeaguePage`) with a single global rail mounted in the app layout. Visible on every page that renders the layout, sticky on desktop, static on mobile. League scope derived from the URL: shows all three leagues mixed on routes without a league prefix, filtered to the current league on `/nba`, `/nfl`, `/nhl` and their nested routes.

## Goals

- Give the user constant visibility into live and same-day games from any page — primary motivation: on mobile, today's games are buried below the hero and news section on the homepage.
- Re-use the existing `LeagueSlate` rendering, data hooks, caching, and slate-date logic — no new backend endpoint, no new SSE wiring.
- Make league scope automatic from URL — no manual toggle, no global state.
- Hide cleanly when there are no games to show.

## Non-Goals

- **No new backend endpoint.** Multi-league mode fans out to the three existing `useLeagueData` queries client-side.
- **No new live-update mechanism.** Whatever invalidates today's-games queries today (live-sync) propagates to the rail automatically.
- **No empty-state UI.** When 0 live + 0 today's games are in scope, the rail is hidden entirely (no skeleton, no "no games" message).
- **No filtering of the current game on detail pages.** When viewing `/nba/games/123`, the pill for game 123 still appears in the rail. Removing it would introduce stateful filtering and edge cases on navigation; the redundancy is acceptable.
- **No cap on item count.** Horizontal scroll handles overflow, same as the existing `LeagueSlate`.
- **No replacement of the homepage league tabs / game grid.** The rail augments the homepage; it does not replace the existing "Today's Games" section.

## User-Facing Surfaces

### Placement

Mounted in `App.jsx` between `<Navbar />` and the `<Routes>` outlet — one mount, one data subscription per route, every page sees it.

### Routes where rail is visible

- All pages by default.
- **Hidden on:** `/about`, `/privacy` (utility pages — low value, would push real content down).
- Auth modals are overlays and do not affect rail visibility.

### Sticky behavior

- **Desktop (`sm:` breakpoint and up):** `sticky top-[navbar-height]` so the rail pins below the navbar as the page scrolls.
- **Mobile:** static (scrolls away with content). The rail sits above page content so it is the first thing visible under the navbar+search row when a page loads. Per the user's earlier choice (Section 1 of brainstorm), mobile users get an "above-the-fold" view of live games on initial paint without paying ~40px of permanent vertical real estate.

### League scoping rules

| Path pattern | Filter |
|---|---|
| `/nba`, `/nba/games/:id`, `/nba/players/:id`, `/nba/teams/:id`, etc. | NBA only |
| `/nfl`, `/nfl/...` | NFL only |
| `/nhl`, `/nhl/...` | NHL only |
| `/`, `/reports`, `/settings`, `/compare`, anything else | All 3 leagues mixed |

Resolved from the first path segment via `useLocation()`. If segment ∈ `{"nba","nfl","nhl"}`, filter to that league; otherwise multi-league.

### Pill content

Reuses the existing `LeagueSlate` `GamePill` exactly, with one addition:

- **Multi-league mode:** small `NBA` / `NFL` / `NHL` tag prepended on each pill (8 px uppercase, `text-text-tertiary`, slight right margin).
- **League-filtered mode:** league tag is omitted (redundant — the user is already on a league page).

Pill structure (unchanged from today's `LeagueSlate`):

```
[ league-tag? ] [ status label | LIVE / 7:30P / FINAL ] [ away logo + name + score? ] · [ home logo + name + score? ]
```

### Ordering within rail

Same as existing `LeagueSlate`:

1. **Live first** — games whose status includes `In Progress`, `Halftime`, or `End of Period`
2. **Upcoming today** — sorted ascending by `start_time` (parsed via existing `parseStartTime`)
3. **Finals today** — at the end

In multi-league mode, all three leagues are folded into the same three buckets — leagues are interleaved by status priority, not grouped by league.

### Empty state

- All three leagues empty (multi-league mode) → rail hides.
- Filtered league empty or off-season → rail hides. (`useLeagueData` already returns `resolvedDate !== slateDate` as the off-season signal — we treat it as "hide.")
- Loading on first paint → render `GlobalSlateSkeleton` (3 placeholder pills); do not block page content.

### Hover prefetch

Each pill links to `/{league}/games/{id}`. On `mouseenter`, prefetch the `gameDetail` query for that game. Matches the codebase convention (StatCard, FavoritePlayersSection, etc.). Guard with `window.matchMedia("(hover: hover)").matches`.

## Architecture / Implementation

### New component: `GlobalSlate`

- File: `frontend/src/components/layout/GlobalSlate.jsx` (moved from `navigation/`)
- Created by **renaming** `frontend/src/components/navigation/LeagueSlate.jsx`
- Accepts a `leagueFilter` prop: `"nba" | "nfl" | "nhl" | null`
- Internally calls `useGlobalSlate(leagueFilter)`
- Renders pills the same way the existing `LeagueSlate` does, with the league-tag addition for multi-league mode

### New hook: `useGlobalSlate(leagueFilter)`

- File: `frontend/src/hooks/data/useGlobalSlate.js`
- Returns `{ games, loading, error }`, where `games` is a single sorted array (live → upcoming → final)
- **When `leagueFilter` is set:** delegates to `useLeagueData(leagueFilter, null, slateDate)` — same path as today's `LeagueSlate`
- **When `leagueFilter` is null:** runs three `useLeagueData(league, null, slateDate)` calls (one per league); merges their `games` arrays client-side, then re-sorts by the same status-group + start-time logic
- Each underlying query is already Redis-cached at the backend (`games:{league}:default:{todayEST}` 30s TTL) and TanStack-Query-cached at the frontend with per-league keys
- `loading`: true only while **no league** has yet returned data. Once any league has resolved, render its games immediately — do not block on slower leagues. Each remaining league's data flows in as it arrives.
- `error`: only true if **all** queries error (per-league errors in multi-league mode silently drop that league)

### Shared util: `slateDate.js`

- File: `frontend/src/utils/slateDate.js`
- Extracted from `LeagueSlate.jsx`: `getSlateDateET()`, `parseStartTime(s)`, `compactTime(s)`, `statusGroup(game)`
- Now imported by `useGlobalSlate` and `GlobalSlate` (and any future consumer)

### App layout integration

- `App.jsx`: between `<Navbar />` and the routed outlet, render `<GlobalSlate leagueFilter={leagueFilter} />`
- `leagueFilter` resolved via a small helper `resolveLeagueFilter(pathname)` in the same file or in `slateDate.js`:

```js
function resolveLeagueFilter(pathname) {
  const seg = pathname.split("/")[1]; // "nba" / "nfl" / "nhl" / "reports" / ""
  return ["nba", "nfl", "nhl"].includes(seg) ? seg : null;
}
```

- Hide on `/about` and `/privacy` via a simple route check (`if (["/about","/privacy"].includes(pathname)) return null;` inside `GlobalSlate`, or wrap the mount in a check in `App.jsx`)

### Removal of inline LeagueSlate on LeaguePage

- `frontend/src/pages/LeaguePage.jsx` — remove the `<LeagueSlate league={league} />` render at line ~414 and any `showSlate` gating around it. The global rail handles this case now.
- Keep the import deletion clean — no orphan imports.

### Skeleton

- `LeagueSlateSkeleton` → `GlobalSlateSkeleton` (rename for consistency)
- Keep co-located in `skeletons/LeaguePageSkeleton.jsx` for now (matches existing structure); can be moved to a layout-skeletons file later if it grows

### Live updates

- The rail subscribes to the same TanStack-Query cache as today's `LeagueSlate`. Whatever live-sync mechanism currently invalidates `games:{league}:default:{date}` queries (or refetches them on a schedule) will refresh the rail without further work.

## Edge Cases

- **Off-season for one league** but not others (multi-league mode) — that league's `useLeagueData` returns empty / `resolvedDate !== slateDate`; that league silently drops out. Rail still shows the other two.
- **Off-season for filtered league** — rail hides on that league's pages.
- **All three leagues empty** — rail hides entirely.
- **3 AM ET viewing** — `getSlateDateET()` rolls back to "yesterday's slate" before 6 AM ET, so finals from last night are still visible. Existing logic preserved.
- **Game on detail page** — current game still appears in the rail. Acceptable (see Non-Goals).
- **Mobile horizontal scroll** — `overflow-x-auto scrollbar-none`, exactly as today.
- **First paint** — `GlobalSlateSkeleton` (3 pills), does not block page content.
- **Navigation between leagues** — `leagueFilter` changes, `useGlobalSlate` swaps from a 1-query subscription to a 3-query subscription (or vice versa). TanStack Query handles this cleanly.

## Error Handling

- Per-league fetch error in multi-league mode → that league drops out silently. No user-facing error UI on the rail.
- All leagues fail (network down, backend down) → `useGlobalSlate` returns `loading: false, error: true, games: []`. Rail hides. The page below has its own error state for the data the user actually came for.
- Aborts on rapid league switching are handled by `useLeagueData`'s underlying TanStack Query mechanics — no new logic needed.

## Testing

Per `frontend/docs/testing.md` patterns (Vitest + Testing Library):

- **`useGlobalSlate.test.jsx`** — wrapped with `createWrapper`. Mock `useLeagueData`. Cases:
  - `filter=null` → fires 3 queries and merges their games
  - `filter="nba"` → fires 1 query, returns its games unchanged
  - One league errors in multi-league mode → other two still render
  - All leagues error → returns `error: true, games: []`
  - Off-season filtered league → returns empty
- **`GlobalSlate.test.jsx`** —
  - Renders pills from hook
  - Hides when `games.length === 0`
  - Shows league tags only when `leagueFilter === null`
  - Wires `onMouseEnter` prefetch on each pill
  - Hides on `/about` and `/privacy` (mock `useLocation`)
- **`slateDate.test.js`** — direct unit tests for `getSlateDateET` (6 AM ET cutover), `parseStartTime`, `compactTime`, `statusGroup`. These were implicitly covered before; now testable directly.
- **`LeaguePage.test.jsx`** — remove any assertions about the inline `LeagueSlate`. Confirm the `showSlate` gating is no longer referenced.

No backend tests required — no backend changes.

## Out of Scope

- `useLeagueData` shape, caching, or backend route changes
- The hover-prefetch convention itself (already established)
- News section, hero, league tabs, game grid on Homepage all remain as-is
- Pull-to-refresh on Homepage stays unchanged
- A new merged backend endpoint (`/api/all/games/today`) — explicitly rejected; the per-league cache + client merge is sufficient and avoids a new cache key
- Manual league-toggle UI on the rail — league scope is URL-driven only

## Open Questions / Risks

- **None blocking.** Mobile non-sticky behavior is a deliberate tradeoff (Section 1 brainstorm decision). Can revisit after launch if users report wanting the rail pinned on mobile too.
- **Visual density on mobile in multi-league mode** — 5+ leagues × games could produce a long horizontal scroll. Existing `LeagueSlate` already lives with this; not new. Monitor post-launch.
