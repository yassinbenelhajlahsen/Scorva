// backend/src/services/games/ratingAggregates.js
import { gradeFromRaw } from "./ratingEngine.js";

/**
 * Aggregate per-game team + game ratings from stats.rating.
 * NBA-only — non-NBA gameIds return null-filled bundles.
 *
 * @param {{ query: Function }} client - pg pool or client.
 * @param {number[]} gameIds
 * @returns {Promise<Map<number, RatingBundle>>}
 */
export async function ratingsForGames(client, gameIds) {
  const out = new Map();
  if (!Array.isArray(gameIds) || gameIds.length === 0) return out;

  const { rows } = await client.query(
    `SELECT g.id AS gameid,
            g.status,
            g.homescore,
            g.awayscore,
            SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid
                     THEN s.rating END) AS home_rating,
            SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.awayteamid
                     THEN s.rating END) AS away_rating,
            SUM(s.rating)                AS game_rating
       FROM games g
       LEFT JOIN stats   s ON s.gameid = g.id AND s.rating IS NOT NULL
       LEFT JOIN players p ON p.id = s.playerid
      WHERE g.id = ANY($1) AND g.league = 'nba'
      GROUP BY g.id, g.hometeamid, g.awayteamid, g.status, g.homescore, g.awayscore`,
    [gameIds],
  );

  for (const id of gameIds) {
    out.set(id, emptyBundle());
  }
  for (const r of rows) {
    const homeRaw = r.home_rating == null ? null : Number(r.home_rating);
    const awayRaw = r.away_rating == null ? null : Number(r.away_rating);
    const gameRaw = r.game_rating == null ? null : Number(r.game_rating);
    const homeGrade = homeRaw == null ? null : round1(gradeFromRaw(homeRaw));
    const awayGrade = awayRaw == null ? null : round1(gradeFromRaw(awayRaw));
    const gameGrade = gameRaw == null ? null : round1(gradeFromRaw(gameRaw));
    const label = gameGrade == null ? null : tierLabel({
      gameGrade, homeGrade, awayGrade,
      status: r.status, homeScore: r.homescore, awayScore: r.awayscore,
    });
    out.set(Number(r.gameid), {
      gameRating: gameRaw == null ? null : round1(gameRaw),
      homeTeamRating: homeRaw == null ? null : round1(homeRaw),
      awayTeamRating: awayRaw == null ? null : round1(awayRaw),
      gameGrade,
      homeGrade,
      awayGrade,
      tierLabel: label,
    });
  }
  return out;
}

export function tierLabel({ gameGrade, homeGrade, awayGrade, status, homeScore, awayScore }) {
  if (gameGrade == null) return null;
  const isFinal = typeof status === "string" && status.toLowerCase().includes("final");
  if (isFinal
      && homeGrade != null && awayGrade != null
      && homeScore != null && awayScore != null
      && Math.abs(homeGrade - awayGrade) <= 1.0
      && Math.abs(homeScore - awayScore) <= 5) {
    return "Close";
  }
  if (gameGrade >= 8.5) return "Elite";
  if (gameGrade >= 7.0) return "Great";
  if (gameGrade >= 5.5) return "Solid";
  return "Routine";
}

function emptyBundle() {
  return {
    gameRating: null, homeTeamRating: null, awayTeamRating: null,
    gameGrade: null, homeGrade: null, awayGrade: null, tierLabel: null,
  };
}

function round1(n) { return n == null ? null : Math.round(n * 10) / 10; }
