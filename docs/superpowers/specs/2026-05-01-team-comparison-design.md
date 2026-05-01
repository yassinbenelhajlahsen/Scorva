# Team Performance Comparison (GamePage Analysis Tab)

**Date:** 2026-05-01
**Scope:** New component `frontend/src/components/game/TeamComparison.jsx`; one edit to `frontend/src/components/game/AnalysisTab.jsx`.

## Problem

The Analysis tab shows individual player box scores but no team-level summary. Users have to mentally aggregate to compare team performance (e.g., "who shot better, who controlled the boards"). All raw data needed to compute team totals is already in the existing `gameDetail` payload (`homeTeam.players[]`, `awayTeam.players[]`).

## Solution

Add a `TeamComparison` card above `BoxScore` in `AnalysisTab` for live and final games. Compute team totals client-side by summing player stats. Render a list of `StatRow`s — same visual pattern as `ComparePage.jsx:641-657`: centered label, home value left, away value right, the leading team's value in `text-accent`, ties unhighlighted.

## Component: `TeamComparison`

**Path:** `frontend/src/components/game/TeamComparison.jsx`

**Props:**

| Prop | Type | Notes |
|---|---|---|
| `homeTeam` | object | `{ info: { name, logoUrl, ... }, players: [...] }` from gameData |
| `awayTeam` | object | Same shape |
| `league` | string | `"nba" \| "nfl" \| "nhl"` |

**Render:**

```
┌─ Team Comparison ───────────────────────┐
│  [HOME LOGO]  Home Name    Away Name [AWAY LOGO]
│  ─────────────────────────────────────── │
│       108        PTS        102          │   ← home leads, 108 in accent
│      47.2%       FG%       43.1%         │
│       42         REB         38          │
│       …                                  │
└──────────────────────────────────────────┘
```

- Card chrome: `bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-6 mt-6`
- Section title: `text-2xl font-bold tracking-tight text-text-primary mb-6 text-center` (matches BoxScore title)
- Team header row: two team logos+names, separated by `VS` text or simply on opposite sides
- Stat rows: `space-y-3` between each row

If no stats are computable (e.g., empty players arrays — pre-game scheduled with no rosters), the component renders nothing and lets `BoxScore` show its own empty state.

## NFL Special Case

For NFL, naive summing double-counts (a passing TD is `+1` to QB and `+1` to receiver). The `cmpatt` field is non-null only for passers — the codebase already uses this as a QB flag (`backend/src/ingestion/streakEvents.js:15-18`). Split the comparison into two sub-sections within the same card:

- **Offense** (filter players where `stats.CMPATT` is present):
  - PASS YDS, PASS TD, CMP/ATT, INT THROWN (lower better), SACKS ALLOWED (lower better)
- **Defense** (filter players where `stats.CMPATT` is missing/null):
  - SACKS, INTERCEPTIONS

`SACKS ALLOWED` and `SACKS` come from the same `stats.SCKS` column — disambiguated by the QB filter.

## Stat Configuration

Defined inline in `TeamComparison.jsx` as a league-keyed object. Each entry:

```js
{ key, label, compute(players) -> number|string, format?(val) -> string, lowerIsBetter?: bool }
```

### NBA (10 rows)

| Label | Compute | Format | Lower better |
|---|---|---|---|
| PTS  | `sum(p.stats.PTS)` | int | — |
| FG%  | `sum(FG.made) / sum(FG.att) * 100` | `"47.2%"` | — |
| 3PT% | `sum(3PT.made) / sum(3PT.att) * 100` | `"38.5%"` | — |
| FT%  | `sum(FT.made) / sum(FT.att) * 100` | `"82.0%"` | — |
| REB  | `sum(p.stats.REB)` | int | — |
| AST  | `sum(p.stats.AST)` | int | — |
| STL  | `sum(p.stats.STL)` | int | — |
| BLK  | `sum(p.stats.BLK)` | int | — |
| TO   | `sum(p.stats.TO)`  | int | yes |
| PF   | `sum(p.stats.PF)`  | int | yes |

`FG` / `3PT` / `FT` are stored as strings like `"8-14"` — split on `-`, parse both halves.

### NHL (8 rows)

| Label | Compute | Format | Lower better |
|---|---|---|---|
| GOALS      | `sum(p.stats.G)`  | int | — |
| SHOTS      | `sum(p.stats.SHOTS)` | int | — |
| HITS       | `sum(p.stats.HT)` | int | — |
| BLOCKS     | `sum(p.stats.BS)` | int | — |
| TAKEAWAYS  | `sum(p.stats.TK)` | int | — |
| GIVEAWAYS  | `sum(p.stats.GV)` | int | yes |
| PIM        | `sum(p.stats.PIM)` | int | yes |
| SAVE%      | `sum(SAVES) / (sum(SAVES) + sum(GA)) * 100` | `"91.3%"` | — |

`SAVE%` is computed across all goalies who appeared (more robust than picking a single starter when multiple goalies played).

### NFL (Offense — 5 rows)

Filter `players.filter(p => p.stats?.CMPATT)`.

| Label | Compute | Format | Lower better |
|---|---|---|---|
| PASS YDS      | `sum(qb.stats.YDS)` | int | — |
| PASS TD       | `sum(qb.stats.TD)`  | int | — |
| CMP/ATT       | `sum(parsedCmp) + "/" + sum(parsedAtt)` | `"22/35"` | — |
| INT THROWN    | `sum(qb.stats.INT)` | int | yes |
| SACKS ALLOWED | `sum(parseInt(qb.stats.SCKS.split('-')[0]))` | int | yes |

`CMPATT` value format is `"comp/att"` per `backend/src/ingestion/mappings/mapStatsToSchema.js:36`. `SCKS` for QB rows is sacks taken, format `"count-yards"`.

### NFL (Defense — 2 rows)

Filter `players.filter(p => !p.stats?.CMPATT)`.

| Label | Compute | Format | Lower better |
|---|---|---|---|
| SACKS         | `sum(parseInt(p.stats.SCKS.split('-')[0]))` | int | — |
| INTERCEPTIONS | `sum(p.stats.INT)` | int | — |

For NFL, render the offense section, a thin divider (`border-t border-white/[0.06] my-4`), then the defense section. Each subsection has its own muted heading: `text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3` — `Offense`, `Defense`.

## Helpers (inside the component)

- `parseFraction(str)` — turn `"8-14"` into `[8, 14]`; returns `[0, 0]` for nullish/malformed.
- `pct(made, att)` — `att > 0 ? (made/att*100).toFixed(1) + "%" : "—"`.
- `safeSum(arr, picker)` — sums a numeric stat, treats null/undefined as 0.

These live at the top of `TeamComparison.jsx`. Not extracted; only used here.

## `StatRow` Reuse vs Inline

`StatRow` already exists in `ComparePage.jsx:641-657`. Per the codebase's "no abstractions beyond the task" preference, **inline a local copy** in `TeamComparison.jsx` rather than extract to a shared module. If a third user emerges later, extract then.

## AnalysisTab Edit

Current (`frontend/src/components/game/AnalysisTab.jsx:5-16`):

```jsx
if (isFinal || inProgress) {
  return (
    <>
      {isFinal && <AISummary gameId={gameId} />}
      <BoxScore … />
    </>
  );
}
```

After:

```jsx
if (isFinal || inProgress) {
  return (
    <>
      {isFinal && <AISummary gameId={gameId} />}
      <TeamComparison homeTeam={homeTeam} awayTeam={awayTeam} league={league} />
      <BoxScore … />
    </>
  );
}
```

Add `import TeamComparison from "./TeamComparison.jsx";` to AnalysisTab.

## Out of Scope

- Backend changes — all data is already in the gameDetail payload.
- Pre-game team comparison (no stats yet; AnalysisTab already shows "no data" state).
- Animations / staggered reveal — keep it static like `BoxScore`.
- Mobile-specific layout — the row pattern works fine at every width.
- Power-play / faceoff stats for NHL — not present in our schema.
- Rushing/receiving splits for NFL — not distinguishable in our schema.

## Testing

- `frontend/src/__tests__/components/game/TeamComparison.test.jsx`
  - Per-league: renders all configured rows with correct totals from a fixture player array
  - Leader highlight: home value gets `text-accent` when higher; away gets it when higher; neither on tie
  - Lower-better stats: lower value gets the accent
  - NFL: offense section uses only QB rows; defense section uses non-QB rows
  - Empty players: component renders nothing
- AnalysisTab snapshot/integration: when `isFinal` or `inProgress`, `TeamComparison` is rendered above `BoxScore`; when neither, neither component renders.
