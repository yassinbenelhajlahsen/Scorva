# Plan: Injury-Aware Game Predictions

Extend `getPrediction()` to factor active player injuries into team ratings and surface injury context in the response.

## Goal

Today `predictionService.js` blends season ratings (50%), home/away splits (30%), recent form (20%), H2H, and a home bonus. It ignores who is actually available to play. This plan adjusts the offensive/defensive ratings used in that blend by the share of team production currently sidelined.

## Data we already have

- `players.status` — normalized: `active`, `day-to-day`, `questionable`, `doubtful`, `out`, `ir`, `suspended` (`backend/prisma/schema.prisma:64`)
- `players.status_description` — e.g. "Knee Injury"
- `players.status_updated_at` — freshness timestamp
- `players.teamid` — current team
- `stats(gameid, playerid)` — per-game box scores (`schema.prisma:79`)
- Sync worker: `backend/src/ingestion/syncInjuries.js` (league-wide ESPN feed, stale-clears >14 days)

No schema changes required.

## Step 1 — Add an injury-impact query

New helper in `backend/src/services/games/predictionService.js`:

```
getInjuredPlayersWithImpact(league, season, teamId)
```

For each team, return the injured roster joined with season averages from `stats`, filtered to players who actually logged minutes/snaps this season (reuse the league-specific minutes filter from `tools/teamStats.js:38-40`). Columns needed per player:

- `id`, `name`, `position`, `status`, `status_description`, `status_updated_at`
- `games_played` (this season)
- League-specific production:
  - NBA: `AVG(points)`, `AVG(assists)`, `AVG(rebounds)`, `AVG(minutes)`
  - NFL: `SUM(yds)`, `SUM(td)`
  - NHL: `SUM(g)`, `SUM(a)`, `AVG(shots)`
- Also return the team's season totals for the same fields (so shares can be computed).

Cache keyed on `(league, season, teamId)` with short TTL (≤300s) — injuries move fast but not sub-minute.

## Step 2 — Compute an impact share per player

Add pure helper `computePlayerImpactShare(player, teamTotals, league)` returning a number in `[0, 1]`:

- NBA: `(points + 0.6*assists + 0.4*rebounds) / team_total_of_same_weighted_sum`
- NFL: position-aware — QB uses `yds + 20*td`, skill/defensive players use `yds + 10*td`, OL/ST weight = small constant
- NHL: `(g + 0.6*a + 0.2*shots) / team_total`

Clamp share to `[0, 0.35]` so no single player can erase a team's rating. Tune weights from a one-off backtest against last season's closed games.

## Step 3 — Availability multiplier

```js
const AVAILABILITY = {
  out: 1.0,
  ir: 1.0,
  suspended: 1.0,
  doubtful: 0.75,
  questionable: 0.5,
  "day-to-day": 0.25,
};
```

Total team impact factor `F = min(0.5, Σ share_i × availability_i)`. Hard cap at 0.5 so a battered team still gets a non-trivial rating.

## Step 4 — Apply in `computeWinProbabilities`

Before the existing `seasonDiff` / `splitDiff` in `predictionService.js:16-52`:

```js
const homeOff = homeStats.off_rating * (1 - F_home_off);
const homeDef = homeStats.def_rating * (1 + F_home_def_inverse);
```

Offensive rating scales down by `F`; defensive rating (points allowed) scales up — being short-handed means giving up more. Apply the same factor to `home_off_rating` / `away_off_rating` splits so the 30% block stays consistent.

Pass `F_home` / `F_away` through so they can also fold into `keyFactors`.

## Step 5 — Extend the response

In the return object at `predictionService.js:251-295`, add per team:

```json
"injuries": {
  "impactFactor": 0.18,
  "players": [
    {
      "id": 12345,
      "name": "Jayson Tatum",
      "position": "SF",
      "status": "out",
      "statusDescription": "Right knee soreness",
      "statusUpdatedAt": "2026-04-18T19:30:00Z",
      "impactShare": 0.21,
      "availability": 1.0
    }
  ]
}
```

And extend `generateKeyFactors` to push an `injury` factor when `impactFactor >= 0.1`, e.g. `"BOS missing key contributors (~18% of production)"`. Limit to one injury factor per team so the factors array stays focused.

## Step 6 — Confidence

In the `confidence` block (`predictionService.js:241-244`), downgrade to `"low"` if either team's `impactFactor > 0.25` even when both have ≥5 games. A heavily depleted team makes the model less reliable.

## Step 7 — Caching

`PREDICTION_TTL` is currently 3600s. Since injuries change intra-day, either:

- Drop prediction cache TTL to 900s, or
- Include `MAX(status_updated_at)` across both rosters in the cache key so the entry invalidates when ESPN pushes a new report.

Prefer the second — preserves cache hits when nothing changed.

## Step 8 — Frontend

`frontend/src/...` (prediction card — find via `docs/file-map.md`) already renders `keyFactors`. Add an injury badge list under each team's stats column driven by the new `injuries.players` array. Reuse the existing status pill styling from the player detail page.

## Testing

- Unit tests in `backend/__tests__/services/games/predictionService.test.js`:
  - no injured players → result identical to pre-change baseline
  - star player `out` → home-team win probability drops by expected range
  - `questionable` player → half the impact of `out`
  - availability sum capped at 0.5
- Backtest script (one-off, not in CI): replay last season's games with/without the injury adjustment, compare Brier score.

## Non-goals

- No new table for injury history. The current schema only tracks current status. If retrospective "was this player out during the last 5 games?" reasoning is needed later, add an `injury_events` table then — out of scope here.
- No estimated-return-date logic. ESPN feed provides status but not timelines.
