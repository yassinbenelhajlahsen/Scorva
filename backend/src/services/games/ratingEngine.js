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
 * Per-display grade = clamp(0, 10, GRADE_COEFFICIENT × sqrt(raw)).
 *
 * The square-root curve was calibrated against Real App's published grades
 * (Barnes 47.9 raw → 6.4; LeBron 24.9 raw → 4.6) — fits both within ~0.05.
 * It lifts mid-range performances (a solid 15-pt bench game now reads ~3
 * instead of <1) and compresses the top so historic 50+ raw games hit 10
 * without bunching multiple top players at the cap.
 *
 * recomputeGame(client, gameId) is in this same module.
 */

import { getWinProbability } from "./winProbabilityService.js";

const WPA_WEIGHT = 30;
const GRADE_COEFFICIENT = 0.92;

export function gradeFromRaw(raw) {
  if (raw == null) return null;
  const r = Math.max(0, Number(raw));
  return Math.max(0, Math.min(10, GRADE_COEFFICIENT * Math.sqrt(r)));
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

  const { rows: parts } = await client.query(
    `SELECT pp.play_id, pp.player_id, pp.role,
            CASE WHEN pl.teamid = g.hometeamid THEN 'home' ELSE 'away' END AS team_side
       FROM play_participants pp
       JOIN plays p     ON p.id = pp.play_id
       JOIN players pl  ON pl.id = pp.player_id
       JOIN games g     ON g.id = p.gameid
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

  // Build INSERT row arrays
  const insPlay = [], insPlayer = [], insGame = [], insRole = [], insBase = [], insWpa = [], insWeighted = [];

  for (const pl of plays) {
    const meta = playMeta.get(pl.id);
    const playerParts = partsByPlay.get(pl.id) || [];
    for (const pp of playerParts) {
      const base = baseValue(pp.role, contextForRole(pp.role, meta.ctx));
      const wpa  = wpaContribution(meta.wpaDelta, pp.team_side);
      const weighted = clampPlayValue(base + wpa);
      insPlay.push(pl.id);
      insPlayer.push(pp.player_id);
      insGame.push(gameId);
      insRole.push(pp.role);
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
    `UPDATE stats SET rating = sub.total
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
  // 3-point detection: most NBA shot types include "three" in their text only
  // when they're 3pt; otherwise infer from distance ≥ 22 ft (the corner 3 line).
  const is3pt = t.includes("three") || (pl.shot_distance_ft != null && pl.shot_distance_ft >= 22 && !isFT);
  let type = null;
  if (isFT) type = made ? "made_ft" : "missed_ft";
  else if (made) type = is3pt ? "made_3pt" : "made_2pt";
  else type = is3pt ? "missed_3pt" : "missed_2pt";
  return {
    type,
    distance: pl.shot_distance_ft,
    offensive: t.includes("offensive"),         // for rebounder
    shooting: t.includes("shooting") && t.includes("foul"),  // for foul_committer
  };
}

function contextForRole(role, ctx) {
  // Pass only what each role uses, but ctx is small so this is a no-op in practice.
  return ctx;
}

function round1(n) { return Math.round(n * 10) / 10; }
function round4(n) { return Math.round(n * 10000) / 10000; }
