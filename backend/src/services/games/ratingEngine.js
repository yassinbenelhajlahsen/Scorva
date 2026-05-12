/**
 * NBA player rating engine — pure-function helpers + per-game recompute.
 *
 * Per-play rating model (v2):
 *   model_value    = clamp(base_value + wpa_contribution, -MAX_PER_PLAY, +MAX_PER_PLAY)
 *   weighted_value = displayValue(model_value)   // stored in play_ratings (display ±10 range)
 *   base_value       = role-specific weight (see baseValue + ROLE_WPA_MULT)
 *   wpa_contribution = WPA_WEIGHT × sqrt(|wpa_delta|) × sign(wpa_delta) × team_sign × role_mult
 *   team_sign = +1 if play helped player's team's win prob, -1 otherwise
 *
 * Per-game raw = sum of weighted play values, open-ended.
 * Per-display  = displayValue(raw) scales model ±MAX_PER_PLAY to user-facing ±10.
 * Per-display grade = clamp(-10, 10, GRADE_COEFFICIENT × sqrt(|raw|) × sign).
 *
 * The square-root grade curve was calibrated against Real App's published grades
 * (Barnes 47.9 raw → 6.4; LeBron 24.9 raw → 4.6) — fits both within ~0.05.
 * It lifts mid-range performances (a solid 15-pt bench game now reads ~3
 * instead of <1) and compresses the top so historic 50+ raw games hit 10
 * without bunching multiple top players at the cap.
 *
 * recomputeGame(client, gameId) is in this same module.
 */

import { getWinProbability } from "./winProbabilityService.js";

// v2: smaller weight + sqrt compression on wpa_delta.
// Tuned so 8+ display ratings need true late-game clutch (final 1–2 min, |wpa|>0.2);
// mid-Q4 close-game makes rate ~6, buzzer-beaters cap at 10.
const WPA_WEIGHT = 7;
const GRADE_COEFFICIENT = 0.92;
const MAX_PER_PLAY = 6;       // internal "model space" clamp
const DISPLAY_SCALE = 10 / 6; // scale model values to user-facing ±10 range

// Per-role share of the WPA contribution. Scorer is the primary credit-receiver;
// secondary roles get a fraction so a clutch shooter and assister don't both cap.
const ROLE_WPA_MULT = {
  scorer:             1.0,
  shot_attempter:     0.5,
  assister:           0.4,
  blocker:            0.5,
  stealer:            0.5,
  charge_drawer:      0.5,
  turnover_committer: 0.6,
  foul_committer:     0.3,
  rebounder:          0.4,  // not read — see wpaContribution rebounder special case (off 0.4 / def 0.25)
  heave_attempter:    0,
};

export function gradeFromRaw(raw) {
  if (raw == null) return null;
  const r = Number(raw);
  const sign = r < 0 ? -1 : 1;
  const magnitude = GRADE_COEFFICIENT * Math.sqrt(Math.abs(r));
  return Math.max(-10, Math.min(10, sign * magnitude));
}

/**
 * Mutates the given object in place: coerces obj.rating to a Number (or null)
 * and adds obj.ratingGrade as a 0-10 calibrated value rounded to one decimal.
 * Safe to call multiple times. No-op for nullish ratings (preserves null).
 */
export function attachRatingGrade(obj) {
  if (obj == null) return;
  const r = obj.rating != null ? Number(obj.rating) : null;
  obj.rating = r;
  obj.ratingGrade = r == null ? null : Math.round(gradeFromRaw(r) * 10) / 10;
}

export function clampPlayValue(v) {
  if (v > MAX_PER_PLAY) return MAX_PER_PLAY;
  if (v < -MAX_PER_PLAY) return -MAX_PER_PLAY;
  return v;
}

export function displayValue(modelValue) {
  return modelValue * DISPLAY_SCALE;
}

export function wpaContribution(wpaDelta, side, role, ctx = {}) {
  if (wpaDelta == null) return 0;
  const delta = Number(wpaDelta);
  if (!Number.isFinite(delta)) return 0;
  // Defensive rebounders get a smaller WPA multiplier than offensive rebounders.
  const mult = role === "rebounder"
    ? (ctx.offensive ? 0.4 : 0.25)
    : (ROLE_WPA_MULT[role] ?? 0);
  if (mult === 0) return 0;
  const teamSign = side === "home" ? 1 : -1;
  const wpaSign = delta < 0 ? -1 : 1;
  const value = mult * WPA_WEIGHT * wpaSign * Math.sqrt(Math.abs(delta)) * teamSign;
  // FT possession-swap artifact: ESPN's homePct on the LAST FT in a trip includes
  // the possession change to the opposing team. On a 1-point FT, that swing can
  // outweigh the score effect and flip the WPA against the shooter (or in favor of
  // a missed-FT shooter). Clamp FT WPA to its "correct" direction.
  if (ctx.type === "made_ft" && value < 0) return 0;
  if (ctx.type === "missed_ft" && value > 0) return 0;
  return value;
}

/**
 * Compute base_value for a (role, ctx) combination.
 *
 * ctx fields (only relevant ones consumed per role):
 *   - type: "made_3pt" | "made_2pt" | "made_ft" | "missed_3pt" | "missed_2pt" | "missed_ft"
 *   - distance: number | null  (only for shooter roles)
 *   - assisted: boolean (only for scorer made_3pt / made_2pt — drops base when set)
 *   - offensive: boolean (only for rebounder)
 *   - shooting:  boolean (only for foul_committer fallback path)
 *   - foulType:  "technical" | "flagrant1" | "flagrant2" | null (only for foul_committer)
 */
export function baseValue(role, ctx = {}) {
  switch (role) {
    case "scorer": {
      switch (ctx.type) {
        case "made_3pt": {
          const d = Math.max(0, (ctx.distance ?? 0) - 23);
          if (ctx.assisted) return Math.min(2.4, 1.2 + 0.02 * d);
          return Math.min(3.0, 1.5 + 0.02 * d);
        }
        case "made_2pt": {
          const d = Math.max(0, ctx.distance ?? 0);
          if (ctx.assisted) return Math.min(1.5, 0.7 + 0.02 * d);
          return Math.min(2.0, 1.0 + 0.02 * d);
        }
        case "made_ft":  return 0.4;
        default:         return 0;
      }
    }
    case "shot_attempter":
      return ctx.type === "missed_ft" ? -0.3 : -0.5;
    case "heave_attempter":
      return 0;
    case "assister":
      return 0.7;
    case "rebounder":
      return ctx.offensive ? 0.6 : 0.3;
    case "stealer":
      return 1.0;
    case "blocker":
      return 0.7;
    case "charge_drawer":
      return 1.0;
    case "turnover_committer":
      return -1.0;
    case "foul_committer": {
      switch (ctx.foulType) {
        case "technical": return -1.5;
        case "flagrant1": return -2.0;
        case "flagrant2": return -3.5;
        default:          return ctx.shooting ? -0.5 : -0.2;
      }
    }
    default:
      return 0;
  }
}

/**
 * Idempotently recompute play_ratings + stats.rating for a single game.
 * Caller passes a pg client (typically inside a transaction). NBA only.
 */
export async function recomputeGame(client, gameId) {
  const { rows: gameRows } = await client.query(
    `SELECT league, eventid, status, hometeamid, awayteamid FROM games WHERE id = $1`,
    [gameId],
  );
  if (gameRows.length === 0) return;
  const { league, eventid, status } = gameRows[0];
  if (league !== "nba") return;

  // Plays for this game in sequence order. Joined with the game's home/away ids
  // for the team_side computation. Note: plays.shooting_play does not exist on the
  // table; we infer scoring vs missed from `scoring_play` + presence of "miss" in
  // play_type. For NBA-only and the role inference's classification, we already
  // populated participants with role; this query reloads play context.
  const { rows: plays } = await client.query(
    `SELECT
       p.id, p.sequence, p.period, p.clock, p.espn_play_id,
       p.scoring_play, p.shot_distance_ft, p.play_type,
       p.team_id,
       g.hometeamid AS home_team_id,
       g.awayteamid AS away_team_id,
       p.home_score, p.away_score
     FROM plays p
     JOIN games g ON g.id = p.gameid
     WHERE p.gameid = $1
     ORDER BY p.sequence ASC`,
    [gameId],
  );

  // Use COALESCE(stats.teamid, players.teamid) so traded players are attributed
  // to the team they actually played for in this game — not their current team.
  const { rows: parts } = await client.query(
    `SELECT pp.play_id, pp.player_id, pp.role,
            CASE WHEN COALESCE(s.teamid, pl.teamid) = g.hometeamid THEN 'home' ELSE 'away' END AS team_side
       FROM play_participants pp
       JOIN plays p     ON p.id = pp.play_id
       JOIN players pl  ON pl.id = pp.player_id
       JOIN games g     ON g.id = p.gameid
       LEFT JOIN stats s ON s.playerid = pp.player_id AND s.gameid = p.gameid
      WHERE p.gameid = $1`,
    [gameId],
  );

  // Build winprob map (playId → homeWinPercentage)
  const wp = await getWinProbability("nba", eventid, /* isFinal */ status?.toLowerCase().includes("final"));
  const wpMap = new Map();
  if (wp?.winProbability) {
    for (const dp of wp.winProbability) wpMap.set(String(dp.playId), Number(dp.homeWinPercentage));
  }

  // Walk plays in sequence; compute wpa_delta from previous valid winprob
  let prevHomePct = null;
  const playMeta = new Map(); // play.id → { side_of_home_action, wpa_delta, ctx }
  for (const pl of plays) {
    const homePct = wpMap.has(String(pl.espn_play_id)) ? wpMap.get(String(pl.espn_play_id)) : null;
    const wpaDelta = homePct != null && prevHomePct != null ? homePct - prevHomePct : null;
    if (homePct != null) prevHomePct = homePct;
    playMeta.set(pl.id, {
      wpaDelta,
      // Build ctx for baseValue from play_type + scoring_play + distance
      ctx: ctxFromPlay(pl),
    });
  }

  // Group participants by play
  const partsByPlay = new Map();
  for (const p of parts) {
    if (!partsByPlay.has(p.play_id)) partsByPlay.set(p.play_id, []);
    partsByPlay.get(p.play_id).push(p);
  }

  // Mark each play's ctx.assisted based on whether any participant is an assister.
  for (const [playId, playParts] of partsByPlay.entries()) {
    const meta = playMeta.get(playId);
    if (!meta) continue;
    meta.ctx.assisted = playParts.some((p) => p.role === "assister");
  }

  // Build INSERT row arrays
  const insPlay = [], insPlayer = [], insGame = [], insRole = [], insBase = [], insWpa = [], insWeighted = [];

  for (const pl of plays) {
    const meta = playMeta.get(pl.id);
    const playerParts = partsByPlay.get(pl.id) || [];
    for (const pp of playerParts) {
      // Heave detection: swap shot_attempter → heave_attempter so it gets zero base + zero wpa.
      // The swapped role is what gets stored in play_ratings.role — intentionally different
      // from play_participants.role for these end-of-period heaves.
      const role = (pp.role === "shot_attempter" && meta.ctx.isHeave) ? "heave_attempter" : pp.role;
      const base = baseValue(role, contextForRole(role, meta.ctx));
      const wpa  = wpaContribution(meta.wpaDelta, pp.team_side, role, meta.ctx);
      const modelValue = clampPlayValue(base + wpa);
      const weighted = displayValue(modelValue);
      insPlay.push(pl.id);
      insPlayer.push(pp.player_id);
      insGame.push(gameId);
      insRole.push(role);
      insBase.push(round1(base));
      insWpa.push(meta.wpaDelta == null ? null : round4(meta.wpaDelta));
      insWeighted.push(round1(weighted));
    }
  }

  await client.query(`DELETE FROM play_ratings WHERE game_id = $1`, [gameId]);

  if (insPlay.length > 0) {
    await client.query(
      `INSERT INTO play_ratings (play_id, player_id, game_id, role, base_value, wpa_delta, weighted_value)
       SELECT
         unnest($1::int[]),
         unnest($2::int[]),
         unnest($3::int[]),
         unnest($4::text[]),
         unnest($5::numeric[]),
         unnest($6::numeric[]),
         unnest($7::numeric[])`,
      [insPlay, insPlayer, insGame, insRole, insBase, insWpa, insWeighted],
    );
  }

  // Reset all stats.rating for this game first, so players whose participants
  // got removed don't keep stale ratings.
  await client.query(`UPDATE stats SET rating = NULL WHERE gameid = $1`, [gameId]);

  await client.query(
    `UPDATE stats SET rating = sign(sub.total) * LEAST(
       abs(sub.total),
       GREATEST(8, 1.5 * COALESCE(stats.minutes, 0))
     )
       FROM (
         SELECT player_id, SUM(weighted_value) AS total
           FROM play_ratings
          WHERE game_id = $1
          GROUP BY player_id
       ) sub
      WHERE stats.playerid = sub.player_id AND stats.gameid = $1`,
    [gameId],
  );
}

function ctxFromPlay(pl) {
  const t = (pl.play_type || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isFT = t.startsWith("free throw");
  const made = !!pl.scoring_play;
  // 3-point detection: most NBA shot types include "three" only when 3pt; otherwise infer
  // from distance ≥ 22 ft (the corner 3 line).
  const is3pt = t.includes("three") || (pl.shot_distance_ft != null && pl.shot_distance_ft >= 22 && !isFT);
  let type = null;
  if (isFT) type = made ? "made_ft" : "missed_ft";
  else if (made) type = is3pt ? "made_3pt" : "made_2pt";
  else type = is3pt ? "missed_3pt" : "missed_2pt";

  // Foul severity classification — read from play_type text.
  let foulType = null;
  if (t.includes("flagrant foul type 2")) foulType = "flagrant2";
  else if (t.includes("flagrant foul type 1") || t.includes("flagrant")) foulType = "flagrant1";
  else if (t.includes("technical")) foulType = "technical";

  // Heave detection: long-range attempt at end of period.
  // play.clock is a string like "M:SS" or "S.S"; parse seconds.
  const clockSec = parseClockSeconds(pl.clock);
  const isHeave = !made && !isFT
    && pl.shot_distance_ft != null && pl.shot_distance_ft >= 35
    && clockSec != null && clockSec <= 3.0;

  return {
    type,
    distance: pl.shot_distance_ft,
    offensive: t.includes("offensive"),
    shooting: t.includes("shooting") && t.includes("foul"),
    foulType,
    isHeave,
    // assisted is filled in by recomputeGame after participants are loaded
    assisted: false,
  };
}

function parseClockSeconds(clock) {
  if (clock == null) return null;
  const s = String(clock);
  if (s.includes(":")) {
    const parts = s.split(":");
    if (parts.length !== 2) return null;
    const [m, sec] = parts.map(Number);
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return null;
    return m * 60 + sec;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function contextForRole(role, ctx) {
  // Pass only what each role uses, but ctx is small so this is a no-op in practice.
  return ctx;
}

function round1(n) { return Math.round(n * 10) / 10; }
function round4(n) { return Math.round(n * 10000) / 10000; }
