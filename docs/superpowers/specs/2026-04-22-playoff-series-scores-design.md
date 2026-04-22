# Playoff Series Scores — Design Spec

## Context

Game cards and game pages don't currently show the series standing for ongoing playoff matchups. Users viewing a Game 3 between BOS and NYK have no in-page signal for who leads the series. This adds a series score label (e.g., "BOS lead 2-0") below the round/game label on both `GameCard` and `GameMatchupHeader`.

Scope: NBA and NHL best-of-7 series only. Excluded: NFL playoffs (single elimination), NBA play-in tournament, NBA in-season tournament.

---

## Backend

### `gamesService.js`

Extend `selectFrom` with a `LEFT JOIN LATERAL` so every game row in every query branch gains two new columns: `home_series_wins` and `away_series_wins`.

```sql
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE g2.winnerid = g.hometeamid) AS home_series_wins,
    COUNT(*) FILTER (WHERE g2.winnerid = g.awayteamid) AS away_series_wins
  FROM games g2
  WHERE g.league IN ('nba', 'nhl')
    AND g.type IN ('playoff', 'final')
    AND (g.game_label IS NULL OR g.game_label NOT ILIKE '%play-in%')
    AND g2.league = g.league
    AND g2.season = g.season
    AND g2.type IN ('playoff', 'final')
    AND g2.status ILIKE 'Final%'
    AND g2.id <= g.id
    AND (
      (g2.hometeamid = g.hometeamid AND g2.awayteamid = g.awayteamid) OR
      (g2.hometeamid = g.awayteamid AND g2.awayteamid = g.hometeamid)
    )
) sc ON true
```

Guards in the subquery's own `WHERE` ensure non-qualifying rows (NFL, regular season, play-in, in-season tournament type `'other'`) get `COUNT = 0` — no CASE needed. Final games include themselves; scheduled/live games don't (not yet final).

**File:** `backend/src/services/games/gamesService.js`

### `gameDetailQueryBuilder.js`

Same lateral subquery added to the `FROM` clause (after the existing team joins). Add to `json_build_object('game', ...)`:

```sql
'seriesScore', json_build_object(
  'homeWins', COALESCE(sc.home_series_wins, 0),
  'awayWins', COALESCE(sc.away_series_wins, 0)
)
```

**File:** `backend/src/services/games/gameDetailQueryBuilder.js`

---

## Frontend

### Shared display logic

```js
// Returns null when series hasn't started (0-0), otherwise a leader-centric label.
function seriesLabel(h, a, homeName, awayName) {
  if (h + a === 0) return null;
  if (h === a) return `Tied ${h}-${a}`;
  return h > a ? `${homeName} lead ${h}-${a}` : `${awayName} lead ${a}-${h}`;
}
```

Inlined in each component — 4 lines doesn't warrant a shared utility.

### `GameCard.jsx`

Below the existing playoff round label `<p>` (currently line 241), add:

```jsx
{isPlayoff && game.game_label && (() => {
  const h = Number(game.home_series_wins ?? 0);
  const a = Number(game.away_series_wins ?? 0);
  if (h + a === 0) return null;
  const label = h === a
    ? `Tied ${h}-${a}`
    : h > a
      ? `${homeName} lead ${h}-${a}`
      : `${awayName} lead ${a}-${h}`;
  return (
    <p className="text-[10px] text-text-tertiary text-center mt-0.5">
      {label}
    </p>
  );
})()}
```

**File:** `frontend/src/components/cards/GameCard.jsx`

### `GameMatchupHeader.jsx`

Below the `game.gameLabel` span (currently line 82), inside the same `playoffLogo` block:

```jsx
{game.seriesScore && (() => {
  const { homeWins: h, awayWins: a } = game.seriesScore;
  if (h + a === 0) return null;
  const label = h === a
    ? `Tied ${h}-${a}`
    : h > a
      ? `${homeTeam.info.shortName} lead ${h}-${a}`
      : `${awayTeam.info.shortName} lead ${a}-${h}`;
  return (
    <span className="text-xs text-text-tertiary text-center block mt-0.5">
      {label}
    </span>
  );
})()}
```

**File:** `frontend/src/components/game/GameMatchupHeader.jsx`

---

## Display rules

| Condition | Output |
|---|---|
| Both wins = 0 | Hidden (pre-series or non-qualifying) |
| Equal wins | `Tied 2-2` |
| Home leads | `BOS lead 3-1` |
| Away leads | `NYK lead 2-1` |

Leader name always appears first; X-Y always shows leader's wins first.

---

## Exclusions handled by SQL guard

| Case | Why excluded |
|---|---|
| NFL playoffs | `g.league IN ('nba', 'nhl')` guard |
| NBA/NHL regular season | `g.type IN ('playoff', 'final')` guard |
| NBA play-in | `g.game_label NOT ILIKE '%play-in%'` guard |
| NBA in-season tournament | Cup championship is `type='other'`; group/QF/SF are `type='regular'` — neither matches the type guard |

---

## Caching

No changes needed. `gamesService` caches at 30s for the current season — series scores stay fresh. `gameDetailService` only caches final games (30d), by which point the series score for that game is fixed and correct.

---

## Verification

1. Run backend: `cd backend && npm run dev`
2. Navigate to an NBA or NHL game page that is a playoff game (type `playoff` or `final`) — confirm series score appears below the round label in `GameMatchupHeader`
3. Navigate to the league page for a day with playoff games — confirm series score appears below round label in each `GameCard`
4. Confirm a regular-season game card shows no series score
5. Navigate to an NBA play-in game — confirm no series score shown
6. Run `cd backend && npm run verify` and `cd frontend && npm run verify`
