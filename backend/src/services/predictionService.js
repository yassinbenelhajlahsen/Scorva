import pool from "../db/db.js";
import { cached } from "../cache/cache.js";

const PREDICTION_TTL = 3600; // 1 hour

const LEAGUE_CONFIG = {
  nba: { homeBonus: 3, scale: 0.1 },
  nfl: { homeBonus: 3, scale: 0.15 },
  nhl: { homeBonus: 0.5, scale: 0.5 },
};

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function computeWinProbabilities(homeStats, awayStats, league) {
  const { homeBonus, scale } = LEAGUE_CONFIG[league] ?? LEAGUE_CONFIG.nba;
  const homeStrength = homeStats.off_rating - homeStats.def_rating;
  const awayStrength = awayStats.off_rating - awayStats.def_rating;
  const diff = homeStrength - awayStrength + homeBonus;
  const homeWinProb = sigmoid(diff * scale);
  const home = Math.round(homeWinProb * 100);
  return { home, away: 100 - home };
}

function generateKeyFactors(homeStats, awayStats, league) {
  const factors = [];
  const h = homeStats.shortname;
  const a = awayStats.shortname;

  const courtTerm =
    league === "nhl" ? "Home ice" : league === "nfl" ? "Home field" : "Home court";
  factors.push(`${courtTerm} advantage`);

  if (homeStats.off_rating > awayStats.off_rating + 0.5) {
    factors.push(`${h} higher offensive rating`);
  } else if (awayStats.off_rating > homeStats.off_rating + 0.5) {
    factors.push(`${a} higher offensive rating`);
  }

  if (homeStats.def_rating < awayStats.def_rating - 0.5) {
    factors.push(`${h} stronger defense`);
  } else if (awayStats.def_rating < homeStats.def_rating - 0.5) {
    factors.push(`${a} stronger defense`);
  }

  const homeGames = Number(homeStats.games_played);
  const awayGames = Number(awayStats.games_played);
  if (homeGames > 0 && awayGames > 0) {
    const homeWinPct = Number(homeStats.wins) / homeGames;
    const awayWinPct = Number(awayStats.wins) / awayGames;
    if (Math.abs(homeWinPct - awayWinPct) > 0.05) {
      const better = homeWinPct > awayWinPct ? h : a;
      factors.push(`${better} better overall record`);
    }
  }

  return factors.slice(0, 4);
}

export async function getPrediction(league, gameId) {
  return cached(
    `prediction:${league}:${gameId}`,
    PREDICTION_TTL,
    async () => {
      // Fetch game row
      const gameResult = await pool.query(
        `SELECT hometeamid, awayteamid, season, status
         FROM games WHERE id = $1 AND league = $2`,
        [gameId, league]
      );
      if (gameResult.rows.length === 0) return null;

      const game = gameResult.rows[0];
      const { status, hometeamid, awayteamid, season } = game;

      // Only predict for pre-game
      const isLiveOrFinal =
        status?.includes("Final") ||
        status?.includes("In Progress") ||
        status?.includes("Halftime") ||
        status?.includes("End of Period");
      if (isLiveOrFinal) return null;

      // Compute team ratings from finished regular-season games this season
      const ratingsResult = await pool.query(
        `SELECT
          t.id,
          t.name,
          t.shortname,
          t.logo_url,
          COUNT(*) AS games_played,
          COUNT(*) FILTER (WHERE g.winnerid = t.id) AS wins,
          COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id) AS losses,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.homescore ELSE g.awayscore END) AS off_rating,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.awayscore ELSE g.homescore END) AS def_rating
        FROM teams t
        JOIN games g ON (g.hometeamid = t.id OR g.awayteamid = t.id)
        WHERE t.id = ANY($1)
          AND g.league = $2
          AND g.season = $3
          AND g.status ILIKE 'Final%'
          AND g.type = 'regular'
        GROUP BY t.id, t.name, t.shortname, t.logo_url`,
        [[hometeamid, awayteamid], league, season]
      );

      const statsById = {};
      for (const row of ratingsResult.rows) {
        statsById[row.id] = row;
      }

      const homeStats = statsById[hometeamid];
      const awayStats = statsById[awayteamid];

      // Not enough data to make a prediction
      if (!homeStats || !awayStats) return null;
      if (Number(homeStats.games_played) === 0 || Number(awayStats.games_played) === 0) return null;

      const confidence =
        Number(homeStats.games_played) < 5 || Number(awayStats.games_played) < 5
          ? "low"
          : "normal";

      const probs = computeWinProbabilities(homeStats, awayStats, league);
      const keyFactors = generateKeyFactors(homeStats, awayStats, league);

      return {
        homeTeam: {
          id: homeStats.id,
          name: homeStats.name,
          shortName: homeStats.shortname,
          logoUrl: homeStats.logo_url,
          winProbability: probs.home,
          offRating: Math.round(Number(homeStats.off_rating) * 10) / 10,
          defRating: Math.round(Number(homeStats.def_rating) * 10) / 10,
          record: {
            wins: Number(homeStats.wins),
            losses: Number(homeStats.losses),
          },
        },
        awayTeam: {
          id: awayStats.id,
          name: awayStats.name,
          shortName: awayStats.shortname,
          logoUrl: awayStats.logo_url,
          winProbability: probs.away,
          offRating: Math.round(Number(awayStats.off_rating) * 10) / 10,
          defRating: Math.round(Number(awayStats.def_rating) * 10) / 10,
          record: {
            wins: Number(awayStats.wins),
            losses: Number(awayStats.losses),
          },
        },
        keyFactors,
        confidence,
      };
    },
    { cacheIf: (data) => data !== null }
  );
}
