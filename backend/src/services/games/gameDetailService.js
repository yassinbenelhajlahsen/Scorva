import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { buildGameDetailSQL } from "./gameDetailQueryBuilder.js";
import { gradeFromRaw } from "./ratingEngine.js";

const GAME_DETAIL_TTL = 30 * 86400; // 30 days

function shapePlayerRating(player) {
  const rating = player.rating != null ? Number(player.rating) : null;
  player.rating = rating;
  player.ratingGrade = rating == null ? null : Math.round(gradeFromRaw(rating) * 10) / 10;
  return player;
}

function shapeRatings(row) {
  if (!row) return row;
  const detail = row.json_build_object;
  if (!detail) return row;
  for (const side of ["homeTeam", "awayTeam"]) {
    const players = detail[side]?.players;
    if (Array.isArray(players)) {
      for (const p of players) shapePlayerRating(p);
    }
  }
  return row;
}

async function getGameDetail(gameId, league) {
  return cached(
    `gameDetail:${league}:${gameId}`,
    GAME_DETAIL_TTL,
    async () => {
      const result = await pool.query(buildGameDetailSQL(league), [gameId, league]);
      return shapeRatings(result.rows[0] ?? null);
    },
    { cacheIf: (data) => data?.json_build_object?.game?.status?.includes("Final") }
  );
}

export const getNbaGame = (gameId) => getGameDetail(gameId, "nba");
export const getNflGame = (gameId) => getGameDetail(gameId, "nfl");
export const getNhlGame = (gameId) => getGameDetail(gameId, "nhl");
