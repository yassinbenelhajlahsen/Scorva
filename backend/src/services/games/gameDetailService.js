import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { buildGameDetailSQL } from "./gameDetailQueryBuilder.js";
import { attachRatingGrade } from "./ratingEngine.js";
import { ratingsForGames } from "./ratingAggregates.js";

const GAME_DETAIL_TTL = 30 * 86400; // 30 days

function shapeRatings(row) {
  if (!row) return row;
  const detail = row.json_build_object;
  if (!detail) return row;
  for (const side of ["homeTeam", "awayTeam"]) {
    const players = detail[side]?.players;
    if (Array.isArray(players)) {
      for (const p of players) attachRatingGrade(p);
    }
  }
  return row;
}

async function attachGameRating(row, league) {
  if (league !== "nba") return row;
  const gameId = row?.json_build_object?.game?.id;
  if (!gameId) return row;
  const map = await ratingsForGames(pool, [gameId]);
  const bundle = map.get(Number(gameId));
  if (!bundle || bundle.gameGrade == null) return row;
  row.json_build_object.game.rating = {
    raw: bundle.gameRating,
    grade: bundle.gameGrade,
    tierLabel: bundle.tierLabel,
    home: { raw: bundle.homeTeamRating, grade: bundle.homeGrade },
    away: { raw: bundle.awayTeamRating, grade: bundle.awayGrade },
  };
  return row;
}

async function getGameDetail(gameId, league) {
  return cached(
    `gameDetail:${league}:${gameId}`,
    GAME_DETAIL_TTL,
    async () => {
      const result = await pool.query(buildGameDetailSQL(league), [gameId, league]);
      const shaped = shapeRatings(result.rows[0] ?? null);
      return await attachGameRating(shaped, league);
    },
    { cacheIf: (data) => data?.json_build_object?.game?.status?.includes("Final") }
  );
}

export const getNbaGame = (gameId) => getGameDetail(gameId, "nba");
export const getNflGame = (gameId) => getGameDetail(gameId, "nfl");
export const getNhlGame = (gameId) => getGameDetail(gameId, "nhl");
