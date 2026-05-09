# Rating Model v2 — role-aware WPA, sqrt compression, and play-type fixes

Date: 2026-05-09
Status: Approved for implementation

## Background

The v1 player rating engine computes a per-play weighted value:

```
weighted = clamp(base + WPA_WEIGHT × wpa_delta × team_sign, ±10)
```

with `WPA_WEIGHT = 30` and a per-play clamp of `±10`.

In production, validation against real plays revealed several defects:

1. **Identical "+10" credit for every team-side participant on a high-WPA play.** A game-winning 3pt with assist gives both shooter and assister a clamped +10. The base values are drowned out by the linear WPA term (`30 × 0.4 = +12`).
2. **Cap saturation.** 129 plays sit at +10 and 48 at −10 across the season; the cap loses discriminatory power on clutch plays.
3. **Assisted vs unassisted scoring is rated identically.** Iso buckets and catch-and-shoots get the same scorer credit.
4. **Garbage-time small samples can swing wildly.** A 3-minute appearance with two clutch fouls produces a −15 game rating despite minimal game involvement.
5. **Tech and flagrant fouls cost the same as regular non-shooting fouls** (−0.2), despite giving up a free FT and possession.
6. **Charge-drawers get no credit.** Defenders who draw offensive charges (787/season) and offensive-foul turnovers (3,898/season) are uncredited.
7. **End-of-period heaves penalize the shooter.** Distance ≥35ft attempts at clock ≤3s are strategic, not bad shots.

## Goals

1. Differentiate credit by role on multi-participant plays.
2. Keep clutch plays meaningful but not flat-topped.
3. Differentiate iso vs catch-and-shoot scoring.
4. Bound the impact of small-sample noise on game ratings.
5. Cost technicals/flagrants appropriately.
6. Credit charge-drawers.
7. Don't penalize end-of-period heaves.
8. Preserve the per-game `stats.rating = SUM(weighted_value)` aggregation and the existing `gradeFromRaw` sqrt curve.
9. Idempotent: re-running `recomputeGame` on the same data must produce the same result.

## Non-goals

- Changing the 0–10 grade curve (`gradeFromRaw`) or `GRADE_COEFFICIENT`. Top-end grades will drop slightly (Jokic 56-pt Christmas game ~7.9 → ~7.1) — this is intended, model honesty over visual continuity.
- NHL/NFL ratings (still NBA-only).
- Plus/minus blending, score-margin context (already in `wpa_delta`), foul-drawn credit (data quality).

## Design

### Per-play formula

Computed in "model space" (compact ±6 range), then scaled to display space (familiar ±10 range):

```
wpa_term      = ROLE_WPA_MULT[role] × WPA_WEIGHT × sign(wpa_delta) × sqrt(|wpa_delta|) × team_sign
model_value   = clamp(base + wpa_term, -6, +6)
weighted_value = model_value × DISPLAY_SCALE      // stored in play_ratings
```

`DISPLAY_SCALE = 10/6` (≈1.667). All downstream consumers (chips, sums, `gradeFromRaw`) see the scaled value.

### Constants

| Constant         | v1   | v2   |
|------------------|------|------|
| `WPA_WEIGHT`     | 30   | 18   |
| Internal clamp   | ±10  | ±6   |
| `DISPLAY_SCALE`  | n/a  | 10/6 |

### `ROLE_WPA_MULT`

| Role                 | Multiplier |
|----------------------|------------|
| `scorer`             | 1.0        |
| `assister`           | 0.4        |
| `blocker`            | 0.5        |
| `stealer`            | 0.5        |
| `charge_drawer`      | 0.5        |
| `rebounder` (off)    | 0.4        |
| `rebounder` (def)    | 0.25       |
| `turnover_committer` | 0.6        |
| `foul_committer`     | 0.3        |
| `shot_attempter`     | 0.5        |
| `heave_attempter`    | 0          |

`heave_attempter` gets zero WPA term (and zero base — see below) because end-of-period heaves are strategic.

### Base-value updates

Scorer base depends on whether the shot was assisted (read from the secondary participant role):

| Type        | Unassisted | Assisted |
|-------------|-----------:|---------:|
| `made_3pt`  | 1.5 + 0.02 × max(0, dist−23), capped 3.0 | 1.2 + 0.02 × max(0, dist−23), capped 2.4 |
| `made_2pt`  | 1.0 + 0.02 × max(0, dist), capped 2.0 | 0.7 + 0.02 × max(0, dist), capped 1.5 |
| `made_ft`   | 0.4 (unchanged) | n/a |

Iso scorers gain ~25–30%; assisted scorers lose the same. The team's total credit (scorer + assister) is roughly unchanged from v1, but the split is more honest.

Foul-committer base depends on play_type:

| Play type subset                          | Base |
|-------------------------------------------|-----:|
| Shooting Foul                             | −0.5 |
| Personal/Loose Ball/Take Foul/Other       | −0.2 |
| Technical Foul / Defensive 3-Sec / Delay  | −1.5 |
| Flagrant Foul Type 1                      | −2.0 |
| Flagrant Foul Type 2                      | −3.5 |

### Heave detection

A shot attempt qualifies as a heave when **`shot_distance_ft >= 35` AND parsed clock seconds ≤ 3**, in any period. Both `heave_attempter` (the shooter) and any blocker/rebounder on the play behave normally; only the shot-attempter role swap differs. Made heaves remain `scorer` (deserved).

### Charge-drawer

In `nbaPlayRoles.js`, when `play_type` is `Offensive Charge` or `Offensive Foul Turnover` and `participants[1]` exists, attribute `participants[0]` as `turnover_committer` (current behavior) and `participants[1]` as `charge_drawer` (new role). Base value: 1.0 (matches stealer, since a charge is a possession swing).

### Game-rating floor (minutes-aware)

After computing `stats.rating = SUM(weighted_value)`, apply a soft floor on magnitude proportional to minutes played:

```
max_magnitude = max(8, 1.5 × minutes)
stats.rating  = sign(stats.rating) × min(|stats.rating|, max_magnitude)
```

A 3-minute appearance can't go beyond ±8 (the constant base ensures even minutes=0 garbage isn't crushed harder than ±8). A 30-minute appearance can hit ±45 (matches the top-game ceiling). This addresses the "Eli John N'Diaye played 5 plays, lost 14.9 points" pattern without distorting normal-rotation games.

### Worked examples (post-DISPLAY_SCALE)

Bulls game-winning 3 by Huerter, **assisted** by White, `wpa_delta = +0.4`, both Bulls (`team_sign = +1`):

- **Scorer** (Huerter, assisted): `base = 1.2`, `wpa_term = 1.0 × 18 × √0.4 ≈ +11.4` → `clamp(12.6, ±6) = +6` → `× 10/6 = +10.0`
- **Assister** (White): `base = 0.7`, `wpa_term = 0.4 × 18 × √0.4 ≈ +4.6` → `clamp(5.3, ±6) = +5.3` → `× 10/6 = +8.8`

Self-created clutch iso bucket (no assist), Schroder, `wpa_delta = +0.5`:

- **Scorer** (unassisted 3pt, 26ft): `base = 1.5 + 0.06 = 1.56`, `wpa_term = 1.0 × 18 × √0.5 ≈ +12.7` → `clamp(14.3, ±6) = +6` → `× 10/6 = +10.0`

Heave at end of Q4 (40ft, clock 1.2s), missed:

- **Heave_attempter**: `base = 0`, `wpa_term = 0` → `0` → `0` (no penalty)

Tech foul mid-game (Draymond shouting):

- **Foul_committer (technical)**: `base = -1.5`, small WPA term → `≈ -1.7` → `× 10/6 ≈ -2.8`

## Components

### `backend/src/services/games/ratingEngine.js`

Changes:
1. New constants `ROLE_WPA_MULT`, `DISPLAY_SCALE = 10/6`, `MAX_PER_PLAY = 6`.
2. `WPA_WEIGHT` 30 → 18.
3. `wpaContribution(wpaDelta, side, role)` adds `role` parameter; applies `ROLE_WPA_MULT[role] × sign × sqrt(|delta|)` instead of linear `delta`.
4. `clampPlayValue(v)` clamps to `±MAX_PER_PLAY` (not ±10).
5. New `displayValue(modelValue) = modelValue × DISPLAY_SCALE`.
6. `baseValue(role, ctx)`:
   - `scorer` for `made_3pt`/`made_2pt` reads new `ctx.assisted` flag and applies the assisted base table above.
   - `foul_committer` reads new `ctx.foulType` field with the severity table.
   - New `heave_attempter` and `charge_drawer` roles.
7. `ctxFromPlay(pl)` adds `assisted` (read from participants — set during recompute), `foulType` (parsed from `play_type`), and `isHeave` (distance + clock check).
8. `recomputeGame` reorders to determine `assisted` from participants before computing scorer base; applies heave swap for `shot_attempter`; pipes role through `wpaContribution`.
9. `recomputeGame` final `UPDATE stats SET rating` adds the minutes-aware cap in the SET clause:
   ```sql
   UPDATE stats SET rating = sign(sub.total) * LEAST(
     abs(sub.total),
     GREATEST(8, 1.5 * COALESCE(stats.minutes, 0))
   )
   ```
   `COALESCE(stats.minutes, 0)` handles NULL minutes (DNPs are filtered upstream, but defensive). The constant 8 is the floor — ensures even a 0-minute edge case can swing up to ±8.
10. `weighted_value` written to `play_ratings` is the post-`DISPLAY_SCALE` value (so all downstream consumers see scaled).

### `backend/src/ingestion/mappings/nbaPlayRoles.js`

Add `charge_drawer` role attribution:
- For `play_type === "Offensive Charge"` or `"Offensive Foul Turnover"`, when `participants[1]` exists, append `{ espnAthleteId: ids[1], role: "charge_drawer" }` to the existing turnover/foul attribution.

### Tests

Unit tests in `__tests__/services/ratingEngine.test.js`:

- Existing `wpaContribution`, `clampPlayValue`, `baseValue` tests update for new signature and constants.
- New cases: assisted vs unassisted scorer differential; heave produces 0; charge_drawer base 1.0; tech foul base −1.5; flagrant 2 base −3.5; sqrt scaling at small/large `wpa_delta`; DISPLAY_SCALE applied; minutes floor at low minutes.
- Worked examples above codified as integration tests.

Role-inference tests in `__tests__/ingestion/nbaPlayRoles.test.js`:

- Charge-drawer attributed when participant 2 is present on Offensive Charge.
- No charge-drawer when only one participant on Offensive Foul.

### Migration

Order of operations on production:

1. Null bad `stats.teamid` rows (Bug 2 step 1):
   ```sql
   UPDATE stats s SET teamid = NULL FROM games g
   WHERE g.id = s.gameid AND g.league = 'nba'
     AND s.teamid IS NOT NULL
     AND s.teamid <> g.hometeamid AND s.teamid <> g.awayteamid;
   ```
2. Run `node src/ingestion/scripts/backfillStatsTeamid.js` (refetches ESPN boxscores for ~400 affected games, repopulates correct `stats.teamid`).
3. Deploy v2 rating model code.
4. Run `node src/ingestion/scripts/recomputeAllNbaRatings.js 2025-26` (recomputes v2 ratings for all NBA games this season — ~1,200 games).

## Error handling

No new error modes. Same savepoint-wrapped recompute pattern; failures roll back without affecting plays/participants.

## Out of scope but related

The "click play in PlaysList → doesn't scroll/highlight" bug (`frontend/src/pages/GamePage.jsx:50-94`) is a separate fix: the hash-scroll effect runs on `gameData` arrival but does not re-run when `usePlays` data lands later. Tracked separately.
