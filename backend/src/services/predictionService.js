import pool from "../db/db.js";
import { cached } from "../cache/cache.js";

const PREDICTION_TTL = 3600; // 1 hour

const LEAGUE_CONFIG = {
  nba: { homeBonus: 3, scale: 0.1, formScale: 5, h2hScale: 2 },
  nfl: { homeBonus: 3, scale: 0.15, formScale: 8, h2hScale: 3 },
  nhl: { homeBonus: 0.5, scale: 0.5, formScale: 3, h2hScale: 1 },
};

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function computeWinProbabilities(homeStats, awayStats, homeRecent, awayRecent, h2h, league) {
  const { homeBonus, scale, formScale, h2hScale } = LEAGUE_CONFIG[league] ?? LEAGUE_CONFIG.nba;

  // Season avg signal (50%)
  const seasonDiff =
    (homeStats.off_rating - homeStats.def_rating) -
    (awayStats.off_rating - awayStats.def_rating);

  // Home/away split signal (30%): home team's home performance vs away team's away performance
  const homeHasHomeData = homeStats.home_off_rating != null && homeStats.home_def_rating != null;
  const awayHasAwayData = awayStats.away_off_rating != null && awayStats.away_def_rating != null;
  const splitDiff =
    homeHasHomeData && awayHasAwayData
      ? (Number(homeStats.home_off_rating) - Number(homeStats.home_def_rating)) -
        (Number(awayStats.away_off_rating) - Number(awayStats.away_def_rating))
      : seasonDiff; // fall back to season diff if no split data

  // Recent form signal (20%): win rate delta scaled to points
  const homeFormRate = homeRecent.length > 0
    ? homeRecent.filter(Boolean).length / homeRecent.length
    : 0.5;
  const awayFormRate = awayRecent.length > 0
    ? awayRecent.filter(Boolean).length / awayRecent.length
    : 0.5;
  const formDiff = (homeFormRate - awayFormRate) * formScale;

  // H2H bonus: additive adjustment if one team dominates (≥60% of ≥5 meetings)
  let h2hBonus = 0;
  if (h2h.total >= 5) {
    const homeH2HPct = h2h.homeWins / h2h.total;
    h2hBonus = (homeH2HPct - 0.5) * h2hScale;
  }

  const combinedDiff = 0.5 * seasonDiff + 0.3 * splitDiff + formDiff + h2hBonus + homeBonus;
  const homeWinProb = sigmoid(combinedDiff * scale);
  const home = Math.round(homeWinProb * 100);
  return { home, away: 100 - home };
}

function generateKeyFactors(homeStats, awayStats, homeRecent, awayRecent, h2h, league) {
  const factors = [];
  const h = homeStats.shortname;
  const a = awayStats.shortname;

  // 1. Home advantage — always first
  const courtTerm =
    league === "nhl" ? "Home ice" : league === "nfl" ? "Home field" : "Home court";
  factors.push({ text: `${courtTerm} advantage`, type: "home" });

  // 2. H2H dominance — if one team has ≥60% of ≥5 meetings
  if (h2h.total >= 5) {
    const homeH2HPct = h2h.homeWins / h2h.total;
    if (homeH2HPct >= 0.6) {
      factors.push({ text: `${h} lead H2H ${h2h.homeWins}-${h2h.awayWins}`, type: "h2h" });
    } else if (homeH2HPct <= 0.4) {
      factors.push({ text: `${a} lead H2H ${h2h.awayWins}-${h2h.homeWins}`, type: "h2h" });
    }
  }

  // 3. Recent form — if one team won 4+ of last 5 vs other's 2 or fewer
  const homeFormWins = homeRecent.filter(Boolean).length;
  const awayFormWins = awayRecent.filter(Boolean).length;
  if (homeRecent.length >= 3 && awayRecent.length >= 3) {
    if (homeFormWins >= 4 && awayFormWins <= 2) {
      factors.push({ text: `${h} on a ${homeFormWins}-${homeRecent.length - homeFormWins} run`, type: "form" });
    } else if (awayFormWins >= 4 && homeFormWins <= 2) {
      factors.push({ text: `${a} on a ${awayFormWins}-${awayRecent.length - awayFormWins} run`, type: "form" });
    } else if (homeFormWins >= 4) {
      factors.push({ text: `${h} hot streak (${homeFormWins} of last ${homeRecent.length})`, type: "form" });
    } else if (awayFormWins >= 4) {
      factors.push({ text: `${a} hot streak (${awayFormWins} of last ${awayRecent.length})`, type: "form" });
    }
  }

  // 4. Home/away splits — use context-specific ratings if available
  const homeOff = Number(homeStats.home_off_rating ?? homeStats.off_rating);
  const homeDef = Number(homeStats.home_def_rating ?? homeStats.def_rating);
  const awayOff = Number(awayStats.away_off_rating ?? awayStats.off_rating);
  const awayDef = Number(awayStats.away_def_rating ?? awayStats.def_rating);

  if (homeOff > awayOff + 1) {
    factors.push({ text: `${h} higher scoring at home (${homeOff.toFixed(1)} PPG)`, type: "offense" });
  } else if (awayOff > homeOff + 1) {
    factors.push({ text: `${a} strong offensively on the road (${awayOff.toFixed(1)} PPG)`, type: "offense" });
  }

  if (homeDef < awayDef - 1) {
    factors.push({ text: `${h} tighter defense at home (${homeDef.toFixed(1)} opp PPG)`, type: "defense" });
  } else if (awayDef < homeDef - 1) {
    factors.push({ text: `${a} limiting opponents on the road (${awayDef.toFixed(1)} opp PPG)`, type: "defense" });
  }

  // 5. Overall record — only if gap is >10%
  const homeGames = Number(homeStats.games_played);
  const awayGames = Number(awayStats.games_played);
  if (homeGames > 0 && awayGames > 0) {
    const homeWinPct = Number(homeStats.wins) / homeGames;
    const awayWinPct = Number(awayStats.wins) / awayGames;
    if (Math.abs(homeWinPct - awayWinPct) > 0.1) {
      const better = homeWinPct > awayWinPct ? h : a;
      factors.push({ text: `${better} better overall record`, type: "record" });
    }
  }

  return factors.slice(0, 5);
}

export async function getPrediction(league, gameId) {
  return cached(
    `prediction:v2:${league}:${gameId}`,
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
      // Includes home/away splits
      const ratingsResult = await pool.query(
        `SELECT
          t.id,
          t.name,
          t.shortname,
          t.logo_url,
          COUNT(*) AS games_played,
          COUNT(*) FILTER (WHERE g.winnerid = t.id) AS wins,
          COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id) AS losses,
          COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id
            AND g.status IN ('Final/OT', 'Final/SO')) AS otl,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.homescore ELSE g.awayscore END) AS off_rating,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.awayscore ELSE g.homescore END) AS def_rating,
          -- Home-only splits
          AVG(CASE WHEN g.hometeamid = t.id THEN g.homescore END) AS home_off_rating,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.awayscore END) AS home_def_rating,
          COUNT(*) FILTER (WHERE g.hometeamid = t.id AND g.winnerid = t.id) AS home_wins,
          COUNT(*) FILTER (WHERE g.hometeamid = t.id AND g.winnerid IS NOT NULL AND g.winnerid != t.id) AS home_losses,
          COUNT(*) FILTER (WHERE g.hometeamid = t.id AND g.winnerid IS NOT NULL AND g.winnerid != t.id
            AND g.status IN ('Final/OT', 'Final/SO')) AS home_otl,
          -- Away-only splits
          AVG(CASE WHEN g.awayteamid = t.id THEN g.awayscore END) AS away_off_rating,
          AVG(CASE WHEN g.awayteamid = t.id THEN g.homescore END) AS away_def_rating,
          COUNT(*) FILTER (WHERE g.awayteamid = t.id AND g.winnerid = t.id) AS away_wins,
          COUNT(*) FILTER (WHERE g.awayteamid = t.id AND g.winnerid IS NOT NULL AND g.winnerid != t.id) AS away_losses,
          COUNT(*) FILTER (WHERE g.awayteamid = t.id AND g.winnerid IS NOT NULL AND g.winnerid != t.id
            AND g.status IN ('Final/OT', 'Final/SO')) AS away_otl
        FROM teams t
        JOIN games g ON (g.hometeamid = t.id OR g.awayteamid = t.id)
        WHERE t.id = ANY($1)
          AND g.league = $2
          AND g.season = $3
          AND g.status ILIKE 'Final%'
          AND g.type IN ('regular', 'makeup')
        GROUP BY t.id, t.name, t.shortname, t.logo_url`,
        [[hometeamid, awayteamid], league, season]
      );

      const statsById = {};
      for (const row of ratingsResult.rows) {
        statsById[row.id] = row;
      }

      const homeStats = statsById[hometeamid];
      const awayStats = statsById[awayteamid];

      if (!homeStats || !awayStats) return null;
      if (Number(homeStats.games_played) === 0 || Number(awayStats.games_played) === 0) {
        return null;
      }

      // Fetch recent form — last 5 games per team this season
      const [homeFormResult, awayFormResult] = await Promise.all([
        pool.query(
          `SELECT winnerid FROM games
           WHERE league = $1 AND season = $2 AND status ILIKE 'Final%' AND type IN ('regular', 'makeup')
             AND (hometeamid = $3 OR awayteamid = $3)
           ORDER BY id DESC LIMIT 5`,
          [league, season, hometeamid]
        ),
        pool.query(
          `SELECT winnerid FROM games
           WHERE league = $1 AND season = $2 AND status ILIKE 'Final%' AND type IN ('regular', 'makeup')
             AND (hometeamid = $3 OR awayteamid = $3)
           ORDER BY id DESC LIMIT 5`,
          [league, season, awayteamid]
        ),
      ]);
      const homeRecent = homeFormResult.rows.map((r) => r.winnerid === hometeamid);
      const awayRecent = awayFormResult.rows.map((r) => r.winnerid === awayteamid);

      // Fetch head-to-head — last 15 meetings all time
      const h2hResult = await pool.query(
        `SELECT winnerid FROM games
         WHERE league = $1 AND status ILIKE 'Final%' AND type IN ('regular', 'makeup')
           AND (
             (hometeamid = $2 AND awayteamid = $3) OR
             (hometeamid = $3 AND awayteamid = $2)
           )
         ORDER BY id DESC LIMIT 15`,
        [league, hometeamid, awayteamid]
      );
      const h2h = h2hResult.rows.reduce(
        (acc, r) => {
          acc.total++;
          if (r.winnerid === hometeamid) acc.homeWins++;
          else if (r.winnerid === awayteamid) acc.awayWins++;
          return acc;
        },
        { homeWins: 0, awayWins: 0, total: 0 }
      );

      const confidence =
        Number(homeStats.games_played) < 5 || Number(awayStats.games_played) < 5
          ? "low"
          : "normal";

      const probs = computeWinProbabilities(homeStats, awayStats, homeRecent, awayRecent, h2h, league);
      const keyFactors = generateKeyFactors(homeStats, awayStats, homeRecent, awayRecent, h2h, league);

      const toNum = (v) => (v != null ? Math.round(Number(v) * 10) / 10 : null);

      return {
        homeTeam: {
          id: homeStats.id,
          name: homeStats.name,
          shortName: homeStats.shortname,
          logoUrl: homeStats.logo_url,
          winProbability: probs.home,
          offRating: toNum(homeStats.off_rating),
          defRating: toNum(homeStats.def_rating),
          record: {
            wins: Number(homeStats.wins),
            losses: Number(homeStats.losses),
            otl: Number(homeStats.otl || 0),
          },
          homeRecord: {
            wins: Number(homeStats.home_wins),
            losses: Number(homeStats.home_losses),
            otl: Number(homeStats.home_otl || 0),
          },
          recentForm: homeRecent, // newest first, true = win
        },
        awayTeam: {
          id: awayStats.id,
          name: awayStats.name,
          shortName: awayStats.shortname,
          logoUrl: awayStats.logo_url,
          winProbability: probs.away,
          offRating: toNum(awayStats.off_rating),
          defRating: toNum(awayStats.def_rating),
          record: {
            wins: Number(awayStats.wins),
            losses: Number(awayStats.losses),
            otl: Number(awayStats.otl || 0),
          },
          awayRecord: {
            wins: Number(awayStats.away_wins),
            losses: Number(awayStats.away_losses),
            otl: Number(awayStats.away_otl || 0),
          },
          recentForm: awayRecent,
        },
        headToHead: h2h,
        keyFactors,
        confidence,
      };
    },
    { cacheIf: (data) => data !== null }
  );
}
