import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { gradeFromRaw } from "./ratingEngine.js";

const TTL = 60;
const ALLOWED_TYPES = new Set(["games", "cumulative"]);

function clamp(n, lo, hi) {
  if (Number.isNaN(n) || n == null) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

export async function getTopPerformances({ league, days, type, limit }) {
  if (!ALLOWED_TYPES.has(type)) {
    const err = new Error(`invalid type: ${type}`);
    err.status = 400;
    throw err;
  }
  const safeDays = clamp(parseInt(days, 10), 1, 30);
  const safeLimit = clamp(parseInt(limit, 10), 1, 25);

  const key = `top-performances:${league}:${type}:${safeDays}:${safeLimit}`;
  return cached(key, TTL, async () => {
    if (type === "games") return queryGames(league, safeDays, safeLimit);
    return queryCumulative(league, safeDays, safeLimit);
  });
}

async function queryGames(league, days, limit) {
  const { rows } = await pool.query(
    `SELECT s.playerid, s.gameid, s.rating,
            p.name, p.image_url, p.position,
            g.date,
            g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
            s.points, s.rebounds, s.assists,
            t.id   AS team_id,
            t.abbreviation, t.logo_url, t.primary_color,
            ot.id  AS opp_id,
            ot.abbreviation AS opp_abbreviation,
            ot.logo_url     AS opp_logo_url
       FROM stats s
       JOIN games   g ON g.id = s.gameid
       JOIN players p ON p.id = s.playerid
       JOIN teams   t ON t.id = COALESCE(s.teamid, p.teamid)
       JOIN teams   ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - $2::int
        AND g.status ILIKE '%final%'
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
      ORDER BY s.rating DESC, s.playerid ASC
      LIMIT $3`,
    [league, days, limit],
  );
  return {
    type: "games",
    days,
    performances: rows.map(shapeGameRow),
  };
}

async function queryCumulative(league, days, limit) {
  const { rows } = await pool.query(
    `SELECT s.playerid,
            SUM(s.rating)  AS total_rating,
            COUNT(*)       AS games_played,
            AVG(s.rating)  AS avg_per_game,
            (ARRAY_AGG(s.gameid ORDER BY s.rating DESC))[1] AS best_game_id,
            MAX(s.rating)  AS best_game_rating,
            (ARRAY_AGG(ot.abbreviation ORDER BY s.rating DESC))[1] AS best_opp_abbreviation,
            p.name, p.image_url, p.position,
            t.id           AS team_id,
            t.abbreviation, t.logo_url, t.primary_color
       FROM stats s
       JOIN games   g ON g.id = s.gameid
       JOIN players p ON p.id = s.playerid
       JOIN teams   t ON t.id = COALESCE(s.teamid, p.teamid)
       JOIN teams   ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - $2::int
        AND g.status ILIKE '%final%'
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
      GROUP BY s.playerid, p.name, p.image_url, p.position, t.id, t.abbreviation, t.logo_url, t.primary_color
      ORDER BY total_rating DESC, s.playerid ASC
      LIMIT $3`,
    [league, days, limit],
  );
  return {
    type: "cumulative",
    days,
    performances: rows.map(shapeCumulativeRow),
  };
}

function shapeGameRow(r) {
  const rating = Number(r.rating);
  return {
    player: {
      id: r.playerid,
      name: r.name,
      imageUrl: r.image_url,
      position: r.position,
      team: {
        id: r.team_id,
        abbreviation: r.abbreviation,
        logo: r.logo_url,
        primary_color: r.primary_color,
      },
    },
    game: {
      id: r.gameid,
      date: r.date,
      opponent: { id: r.opp_id, abbreviation: r.opp_abbreviation, logo: r.opp_logo_url },
      isHome: r.team_id === r.hometeamid,
      result: r.homescore != null && r.awayscore != null
        ? ((r.team_id === r.hometeamid && r.homescore > r.awayscore) ||
           (r.team_id === r.awayteamid && r.awayscore > r.homescore) ? "W" : "L")
        : null,
    },
    rating,
    ratingGrade: round1(gradeFromRaw(rating)),
    stats: { points: r.points, rebounds: r.rebounds, assists: r.assists },
  };
}

function shapeCumulativeRow(r) {
  return {
    player: {
      id: r.playerid,
      name: r.name,
      imageUrl: r.image_url,
      position: r.position,
      team: {
        id: r.team_id,
        abbreviation: r.abbreviation,
        logo: r.logo_url,
        primary_color: r.primary_color,
      },
    },
    totalRating: Number(r.total_rating),
    gamesPlayed: parseInt(r.games_played, 10),
    avgPerGame: round2(Number(r.avg_per_game)),
    bestGame: {
      gameId: r.best_game_id,
      rating: Number(r.best_game_rating),
      opponentAbbreviation: r.best_opp_abbreviation,
    },
  };
}

function round1(n) { return n == null ? null : Math.round(n * 10) / 10; }
function round2(n) { return n == null ? null : Math.round(n * 100) / 100; }
