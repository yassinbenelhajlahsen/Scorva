import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { MINUTES_FILTER_BY_LEAGUE } from "../../utils/statFilters.js";

const PREDICTION_TTL = 3600; // 1 hour — invalidated by status_updated_at in cache key

const LEAGUE_CONFIG = {
  nba: { homeBonus: 3, scale: 0.12, formScale: 5, h2hScale: 2, seriesScale: 2 },
  nfl: { homeBonus: 3, scale: 0.15, formScale: 8, h2hScale: 3, seriesScale: 1.5 },
  nhl: { homeBonus: 0.5, scale: 0.15, formScale: 1, h2hScale: 1, seriesScale: 0.4 },
};

// Drop injured players who haven't logged a game with this team in N days —
// filters out stale ESPN entries for traded/released players whose `players.teamid`
// hasn't been refreshed yet.
const INJURY_STALENESS_DAYS = 21;

const AVAILABILITY = {
  out: 1.0,
  ir: 1.0,
  suspended: 1.0,
  doubtful: 0.75,
  questionable: 0.5,
  "day-to-day": 0.25,
};

// How much of the impact factor F translates into rating change.
// Off/def ratings are large numbers (~110 NBA, ~22 NFL, ~3 NHL) — applying F directly
// saturates the sigmoid. Tuned against Vegas/market lines for star-out scenarios:
// Luka out alone (F≈0.20) → ~17pt swing; Luka + Reaves (F≈0.45) → ~33pt swing.
const INJURY_OFF_WEIGHT = 0.25;
const INJURY_DEF_WEIGHT = 0.18;

// Per-player share ceiling — prevents a single star from consuming the team factor.
const PLAYER_IMPACT_CAP = 0.4;
// Team-total factor ceiling — keeps the sigmoid out of saturation even on catastrophic injury loads.
const TEAM_IMPACT_CAP = 0.55;
// Surface an "injury" keyFactor once a team's factor reaches this share of production.
const INJURY_KEY_FACTOR_MIN = 0.1;
// Drop overall confidence to "low" once either team crosses this factor.
const LOW_CONFIDENCE_IMPACT = 0.25;

const PRODUCTION_SELECT = {
  nba: `
    AVG(s.points) AS pts,
    AVG(s.assists) AS ast,
    AVG(s.rebounds) AS reb,
    AVG(s.blocks) AS blk,
    AVG(s.steals) AS stl,
    AVG(s.minutes) AS min`,
  nfl: `
    SUM(s.yds) AS yds,
    SUM(s.td) AS td`,
  nhl: `
    SUM(s.g) AS g,
    SUM(s.a) AS a,
    AVG(s.shots) AS shots`,
};

const NFL_OL_ST_POSITIONS = new Set([
  "OL", "C", "G", "T", "OT", "OG", "LS", "P", "K", "PK",
]);

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function playerWeightedProduction(player, league) {
  if (league === "nba") {
    return (
      Number(player.pts || 0) +
      0.6 * Number(player.ast || 0) +
      0.4 * Number(player.reb || 0) +
      0.3 * Number(player.blk || 0) +
      0.2 * Number(player.stl || 0)
    );
  }
  if (league === "nhl") {
    return (
      Number(player.g || 0) +
      0.6 * Number(player.a || 0) +
      0.2 * Number(player.shots || 0)
    );
  }
  if (league === "nfl") {
    const pos = (player.position || "").toUpperCase();
    if (pos === "QB") return Number(player.yds || 0) + 20 * Number(player.td || 0);
    if (NFL_OL_ST_POSITIONS.has(pos)) return null; // signals fixed share
    return Number(player.yds || 0) + 10 * Number(player.td || 0);
  }
  return 0;
}

export function computePlayerImpactShare(player, teamWeighted, league) {
  const raw = playerWeightedProduction(player, league);
  // NFL OL/ST get a fixed small share
  if (raw === null) return 0.02;
  if (!teamWeighted || teamWeighted <= 0) return 0;
  const share = raw / teamWeighted;
  if (!Number.isFinite(share) || share <= 0) return 0;
  return Math.min(PLAYER_IMPACT_CAP, share);
}

export function computeTeamImpactFactor(rosterRows, league) {
  if (!rosterRows?.length) return { factor: 0, players: [] };

  // Team total = sum of all rostered/played players' weighted production
  let teamWeighted = 0;
  for (const r of rosterRows) {
    const w = playerWeightedProduction(r, league);
    if (typeof w === "number") teamWeighted += w;
  }

  const players = [];
  let factor = 0;
  const staleCutoffMs = Date.now() - INJURY_STALENESS_DAYS * 24 * 60 * 60 * 1000;
  for (const r of rosterRows) {
    const status = r.status;
    if (!status || status === "active" || status === "available") continue;
    const availability = AVAILABILITY[status];
    if (availability == null) continue;
    // Drop ghost injuries: player flagged out but no recent game with this team.
    // Likely traded/released and ESPN's feed still surfaces them.
    if (r.last_game_date != null) {
      const lastGameMs = r.last_game_date instanceof Date
        ? r.last_game_date.getTime()
        : new Date(r.last_game_date).getTime();
      if (Number.isFinite(lastGameMs) && lastGameMs < staleCutoffMs) continue;
    }
    const share = computePlayerImpactShare(r, teamWeighted, league);
    if (share <= 0) continue;
    factor += share * availability;
    players.push({
      id: r.id,
      name: r.name,
      position: r.position,
      imageUrl: r.image_url,
      status,
      statusDescription: r.status_description,
      statusUpdatedAt: r.status_updated_at,
      impactShare: Math.round(share * 1000) / 1000,
      availability,
    });
  }

  // Sort most impactful first for display
  players.sort((a, b) => b.impactShare * b.availability - a.impactShare * a.availability);

  return { factor: Math.min(TEAM_IMPACT_CAP, factor), players };
}

async function getRosterProduction(league, season, teamId) {
  const productionSelect = PRODUCTION_SELECT[league];
  const minutesFilter = MINUTES_FILTER_BY_LEAGUE[league];
  if (!productionSelect || !minutesFilter) return [];

  const result = await pool.query(
    `SELECT
       p.id, p.name, p.position, p.image_url, p.status, p.status_description, p.status_updated_at,
       COUNT(DISTINCT s.gameid) AS games_played,
       MAX(g.date) AS last_game_date,
       ${productionSelect}
     FROM players p
     JOIN stats s ON s.playerid = p.id
     JOIN games g ON g.id = s.gameid
     WHERE p.teamid = $3
       AND g.league = $1
       AND g.season = $2
       AND g.status ILIKE 'Final%'
       AND g.type IN ('regular', 'makeup')
       AND COALESCE(s.teamid, p.teamid) = $3
       AND ${minutesFilter}
     GROUP BY p.id, p.name, p.position, p.image_url, p.status, p.status_description, p.status_updated_at
     HAVING COUNT(DISTINCT s.gameid) > 0`,
    [league, season, teamId]
  );
  return result.rows;
}

function computeWinProbabilities(
  homeStats,
  awayStats,
  homeRecent,
  awayRecent,
  h2h,
  league,
  homeImpact = 0,
  awayImpact = 0,
  seriesLeadDiff = 0
) {
  const { homeBonus, scale, formScale, h2hScale, seriesScale = 0 } = LEAGUE_CONFIG[league] ?? LEAGUE_CONFIG.nba;

  // Apply injury impact: scale offense down, defense (points allowed) up.
  // F is dampened by INJURY_*_WEIGHT to avoid saturating the sigmoid.
  const adj = (off, def, factor) => ({
    off: Number(off) * (1 - factor * INJURY_OFF_WEIGHT),
    def: Number(def) * (1 + factor * INJURY_DEF_WEIGHT),
  });

  const homeAdj = adj(homeStats.off_rating, homeStats.def_rating, homeImpact);
  const awayAdj = adj(awayStats.off_rating, awayStats.def_rating, awayImpact);

  // Season avg signal (50%)
  const seasonDiff = (homeAdj.off - homeAdj.def) - (awayAdj.off - awayAdj.def);

  // Home/away split signal (30%)
  const homeHasHomeData = homeStats.home_off_rating != null && homeStats.home_def_rating != null;
  const awayHasAwayData = awayStats.away_off_rating != null && awayStats.away_def_rating != null;
  let splitDiff;
  if (homeHasHomeData && awayHasAwayData) {
    const homeSplit = adj(homeStats.home_off_rating, homeStats.home_def_rating, homeImpact);
    const awaySplit = adj(awayStats.away_off_rating, awayStats.away_def_rating, awayImpact);
    splitDiff = (homeSplit.off - homeSplit.def) - (awaySplit.off - awaySplit.def);
  } else {
    splitDiff = seasonDiff;
  }

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

  const combinedDiff = 0.5 * seasonDiff + 0.3 * splitDiff + formDiff + h2hBonus + homeBonus + seriesLeadDiff * seriesScale;
  const homeWinProb = sigmoid(combinedDiff * scale);
  const home = Math.round(homeWinProb * 100);
  return { home, away: 100 - home };
}

function generateKeyFactors(
  homeStats,
  awayStats,
  homeRecent,
  awayRecent,
  h2h,
  league,
  homeInjury = { factor: 0, players: [] },
  awayInjury = { factor: 0, players: [] },
  series = null
) {
  const factors = [];
  const h = homeStats.shortname;
  const a = awayStats.shortname;

  // 1. Home advantage — always first
  const courtTerm =
    league === "nhl" ? "Home ice" : league === "nfl" ? "Home field" : "Home court";
  factors.push({ text: `${courtTerm} advantage`, type: "home" });

  // 2. Series lead — second for playoff games
  if (series && (series.homeWins > 0 || series.awayWins > 0)) {
    if (series.homeWins === series.awayWins) {
      factors.push({ text: `Series tied ${series.homeWins}-${series.awayWins}`, type: "series" });
    } else if (series.homeWins > series.awayWins) {
      factors.push({ text: `${h} lead series ${series.homeWins}-${series.awayWins}`, type: "series" });
    } else {
      factors.push({ text: `${a} lead series ${series.awayWins}-${series.homeWins}`, type: "series" });
    }
  }

  // 3. Injuries — at most one per team
  if (homeInjury.factor >= INJURY_KEY_FACTOR_MIN) {
    const pct = Math.round(homeInjury.factor * 100);
    factors.push({ text: `${h} missing key contributors (~${pct}% of production)`, type: "injury" });
  }
  if (awayInjury.factor >= INJURY_KEY_FACTOR_MIN) {
    const pct = Math.round(awayInjury.factor * 100);
    factors.push({ text: `${a} missing key contributors (~${pct}% of production)`, type: "injury" });
  }

  // 4. H2H dominance — if one team has ≥60% of ≥5 meetings
  if (h2h.total >= 5) {
    const homeH2HPct = h2h.homeWins / h2h.total;
    if (homeH2HPct >= 0.6) {
      factors.push({ text: `${h} lead H2H ${h2h.homeWins}-${h2h.awayWins}`, type: "h2h" });
    } else if (homeH2HPct <= 0.4) {
      factors.push({ text: `${a} lead H2H ${h2h.awayWins}-${h2h.homeWins}`, type: "h2h" });
    }
  }

  // 5. Recent form
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

  // 6. Home/away splits
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

  // 7. Overall record — only if gap is >10%
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
  // Fetch game row + freshness signal first so the cache key can invalidate
  // when ESPN pushes a new injury report.
  const gameResult = await pool.query(
    `SELECT hometeamid, awayteamid, season, status, type
     FROM games WHERE id = $1 AND league = $2`,
    [gameId, league]
  );
  if (gameResult.rows.length === 0) return null;

  const game = gameResult.rows[0];
  const { status, hometeamid, awayteamid, season, type } = game;

  // Only predict for pre-game
  const isLiveOrFinal =
    status?.includes("Final") ||
    status?.includes("In Progress") ||
    status?.includes("Halftime") ||
    status?.includes("End of Period");
  if (isLiveOrFinal) return null;

  const freshnessResult = await pool.query(
    `SELECT MAX(status_updated_at) AS ts
     FROM players
     WHERE teamid = ANY($1) AND status_updated_at IS NOT NULL`,
    [[hometeamid, awayteamid]]
  );
  const freshTs = freshnessResult.rows[0]?.ts;
  const freshKey = freshTs instanceof Date ? freshTs.getTime() : (freshTs ?? "0");

  const isPlayoff = type === "playoff" || type === "final";
  const series = { homeWins: 0, awayWins: 0 };
  if (isPlayoff) {
    const seriesResult = await pool.query(
      `SELECT winnerid FROM games
       WHERE league = $1 AND season = $2
         AND type IN ('playoff', 'final')
         AND status ILIKE 'Final%'
         AND (
           (hometeamid = $3 AND awayteamid = $4) OR
           (hometeamid = $4 AND awayteamid = $3)
         )`,
      [league, season, hometeamid, awayteamid]
    );
    for (const row of seriesResult.rows) {
      if (row.winnerid === hometeamid) series.homeWins++;
      else if (row.winnerid === awayteamid) series.awayWins++;
    }
  }

  return cached(
    `prediction:${league}:${gameId}:${freshKey}:${series.homeWins}-${series.awayWins}`,
    PREDICTION_TTL,
    async () => {
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
          COUNT(*) FILTER (WHERE g.winnerid IS NOT NULL AND g.winnerid != t.id
            AND g.status IN ('Final/OT', 'Final/SO')) AS otl,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.homescore ELSE g.awayscore END) AS off_rating,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.awayscore ELSE g.homescore END) AS def_rating,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.homescore END) AS home_off_rating,
          AVG(CASE WHEN g.hometeamid = t.id THEN g.awayscore END) AS home_def_rating,
          COUNT(*) FILTER (WHERE g.hometeamid = t.id AND g.winnerid = t.id) AS home_wins,
          COUNT(*) FILTER (WHERE g.hometeamid = t.id AND g.winnerid IS NOT NULL AND g.winnerid != t.id) AS home_losses,
          COUNT(*) FILTER (WHERE g.hometeamid = t.id AND g.winnerid IS NOT NULL AND g.winnerid != t.id
            AND g.status IN ('Final/OT', 'Final/SO')) AS home_otl,
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

      const [homeFormResult, awayFormResult, h2hResult, homeRoster, awayRoster] = await Promise.all([
        pool.query(
          `SELECT winnerid FROM games
           WHERE league = $1 AND season = $2 AND status ILIKE 'Final%' AND type IN ('regular', 'makeup', 'playoff', 'final')
             AND (hometeamid = $3 OR awayteamid = $3)
           ORDER BY id DESC LIMIT 5`,
          [league, season, hometeamid]
        ),
        pool.query(
          `SELECT winnerid FROM games
           WHERE league = $1 AND season = $2 AND status ILIKE 'Final%' AND type IN ('regular', 'makeup', 'playoff', 'final')
             AND (hometeamid = $3 OR awayteamid = $3)
           ORDER BY id DESC LIMIT 5`,
          [league, season, awayteamid]
        ),
        pool.query(
          `SELECT winnerid FROM games
           WHERE league = $1 AND status ILIKE 'Final%' AND type IN ('regular', 'makeup')
             AND (
               (hometeamid = $2 AND awayteamid = $3) OR
               (hometeamid = $3 AND awayteamid = $2)
             )
           ORDER BY id DESC LIMIT 15`,
          [league, hometeamid, awayteamid]
        ),
        getRosterProduction(league, season, hometeamid),
        getRosterProduction(league, season, awayteamid),
      ]);

      const homeRecent = homeFormResult.rows.map((r) => r.winnerid === hometeamid);
      const awayRecent = awayFormResult.rows.map((r) => r.winnerid === awayteamid);

      const h2h = h2hResult.rows.reduce(
        (acc, r) => {
          acc.total++;
          if (r.winnerid === hometeamid) acc.homeWins++;
          else if (r.winnerid === awayteamid) acc.awayWins++;
          return acc;
        },
        { homeWins: 0, awayWins: 0, total: 0 }
      );

      const homeInjury = computeTeamImpactFactor(homeRoster, league);
      const awayInjury = computeTeamImpactFactor(awayRoster, league);

      const baseConfidence =
        Number(homeStats.games_played) < 5 || Number(awayStats.games_played) < 5
          ? "low"
          : "normal";
      const confidence =
        isPlayoff ||
        homeInjury.factor > LOW_CONFIDENCE_IMPACT || awayInjury.factor > LOW_CONFIDENCE_IMPACT
          ? "low"
          : baseConfidence;

      const seriesLeadDiff = series.homeWins - series.awayWins;
      const probs = computeWinProbabilities(
        homeStats, awayStats, homeRecent, awayRecent, h2h, league,
        homeInjury.factor, awayInjury.factor, seriesLeadDiff
      );
      const keyFactors = generateKeyFactors(
        homeStats, awayStats, homeRecent, awayRecent, h2h, league,
        homeInjury, awayInjury, series
      );

      const toNum = (v) => (v != null ? Math.round(Number(v) * 10) / 10 : null);
      const toFactor = (v) => Math.round(v * 1000) / 1000;

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
          recentForm: homeRecent,
          injuries: {
            impactFactor: toFactor(homeInjury.factor),
            players: homeInjury.players,
          },
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
          injuries: {
            impactFactor: toFactor(awayInjury.factor),
            players: awayInjury.players,
          },
        },
        headToHead: h2h,
        keyFactors,
        confidence,
      };
    },
    { cacheIf: (data) => data !== null }
  );
}
