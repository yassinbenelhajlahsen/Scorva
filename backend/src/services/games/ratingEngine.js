/**
 * NBA player rating engine — pure-function helpers + per-game recompute.
 *
 * Per-play rating model:
 *   weighted = clamp(base_value + wpa_contribution, -10.0, +10.0)
 *   base_value     = role-specific weight (see NBA_BASE_WEIGHTS)
 *   wpa_contribution = WPA_WEIGHT × wpa_delta × team_sign
 *   team_sign = +1 if play helped player's team's win prob, -1 otherwise
 *
 * Per-game = sum of (player's plays clamped values), open-ended.
 * Per-display grade = max(0, min(10, raw / 5.5)).
 *
 * recomputeGame(client, gameId) is in this same module — see Task 8.
 */

const WPA_WEIGHT = 30;
const GRADE_DIVISOR = 5.5;

export function gradeFromRaw(raw) {
  if (raw == null) return null;
  return Math.max(0, Math.min(10, Number(raw) / GRADE_DIVISOR));
}

export function clampPlayValue(v) {
  if (v > 10) return 10;
  if (v < -10) return -10;
  return v;
}

export function wpaContribution(wpaDelta, side /* "home" | "away" */) {
  if (wpaDelta == null) return 0;
  const sign = side === "home" ? 1 : -1;
  return WPA_WEIGHT * Number(wpaDelta) * sign;
}

/**
 * Compute base_value for a (role, ctx) combination.
 *
 * ctx fields:
 *   - type: "made_3pt" | "made_2pt" | "made_ft" | "missed_3pt" | "missed_2pt" | "missed_ft"
 *   - distance: number | null  (only for shooter roles)
 *   - offensive: boolean (only for rebounder)
 *   - shooting:  boolean (only for foul_committer)
 */
export function baseValue(role, ctx = {}) {
  switch (role) {
    case "scorer": {
      switch (ctx.type) {
        case "made_3pt": {
          const d = Math.max(0, (ctx.distance ?? 0) - 23);
          return Math.min(3.0, 1.5 + 0.02 * d);
        }
        case "made_2pt": {
          const d = Math.max(0, ctx.distance ?? 0);
          return Math.min(2.0, 1.0 + 0.02 * d);
        }
        case "made_ft":  return 0.4;
        default:         return 0;
      }
    }
    case "shot_attempter":
      return ctx.type === "missed_ft" ? -0.3 : -0.5;
    case "assister":
      return 0.7;
    case "rebounder":
      return ctx.offensive ? 0.6 : 0.3;
    case "stealer":
      return 1.0;
    case "blocker":
      return 0.7;
    case "turnover_committer":
      return -1.0;
    case "foul_committer":
      return ctx.shooting ? -0.5 : -0.2;
    default:
      return 0;
  }
}
