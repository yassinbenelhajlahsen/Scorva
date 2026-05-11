import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { gradeFromRaw } from "./ratingEngine.js";
import { getPlayerIdBySlug } from "../../utils/slugResolver.js";

const TTL_BY_WINDOW = {
  today: 30,
  week: 60,
  month: 5 * 60,
  season: 5 * 60,
  all: 60 * 60,
};

const TYPE_ALIASES = { games: "performances", cumulative: "rankings" };
const ALLOWED_TYPES = new Set(["performances", "rankings", "plays"]);
const ALLOWED_ENTITIES = new Set(["player", "team", "game"]);
const ALLOWED_SORTS = new Set(["desc", "asc"]);
const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);
const WINDOW_CASCADE = ["today", "week", "month", "season", "all"];

const LIVE_STATUS_SQL = `(g.status ILIKE '%In Progress%' OR g.status ILIKE '%End of Period%' OR g.status ILIKE '%Halftime%')`;
const RATEABLE_STATUS_SQL = `(g.status ILIKE '%final%' OR ${LIVE_STATUS_SQL})`;

function clamp(n, lo, hi) {
  if (Number.isNaN(n) || n == null) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function daysToWindow(days) {
  const d = parseInt(days, 10);
  if (Number.isNaN(d)) return null;
  if (d <= 1) return "today";
  if (d <= 7) return "week";
  return "month";
}

export function resolveWindow(window, opts = {}) {
  if (!ALLOWED_WINDOWS.has(window)) {
    const err = new Error(`invalid window: ${window}`); err.status = 400; throw err;
  }
  const startIdx = opts.startIdx ?? 1;
  switch (window) {
    case "today":
      // Rolling ~24h window: include yesterday + today (NY tz).
      // Game dates are date-only, so we widen to cover any game finished
      // within the last day even if its calendar date is yesterday.
      return { predicate: "g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - 1", binds: [], nextIdx: startIdx };
    case "week":
      return { predicate: "g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - INTERVAL '7 days'", binds: [], nextIdx: startIdx };
    case "month":
      return { predicate: "g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - INTERVAL '30 days'", binds: [], nextIdx: startIdx };
    case "season":
      if (!opts.season) {
        const err = new Error("season required for window=season"); err.status = 500; throw err;
      }
      return { predicate: `g.season = $${startIdx}`, binds: [opts.season], nextIdx: startIdx + 1 };
    case "all":
      return { predicate: "", binds: [], nextIdx: startIdx };
    default:
      return { predicate: "", binds: [], nextIdx: startIdx };
  }
}

export function positionPredicate(position) {
  if (!ALLOWED_POSITIONS.has(position)) {
    const err = new Error(`invalid position: ${position}`); err.status = 400; throw err;
  }
  switch (position) {
    case "all": return "";
    case "G":   return "p.position ~* '^(PG|SG|G)'";
    case "F":   return "p.position ~* '^(SF|PF|F)'";
    case "C":   return "p.position ~* '^C'";
    default:    return "";
  }
}

export async function getTopPerformances({
  league, type, window, sort = "desc", position = "all", limit, days, playerId, teamId, fallback, entity,
}) {
  const canonicalType = TYPE_ALIASES[type] ?? type ?? "performances";
  const canonicalEntity = entity ?? "player";
  if (!ALLOWED_TYPES.has(canonicalType)) {
    const err = new Error(`invalid type: ${type}`); err.status = 400; throw err;
  }
  if (!ALLOWED_ENTITIES.has(canonicalEntity)) {
    const err = new Error(`invalid entity: ${entity}`); err.status = 400; throw err;
  }
  if (canonicalEntity === "game" && canonicalType === "rankings") {
    const err = new Error("rankings not supported for entity=game"); err.status = 400; throw err;
  }
  if (!ALLOWED_SORTS.has(sort)) {
    const err = new Error(`invalid sort: ${sort}`); err.status = 400; throw err;
  }
  const canonicalWindow = window ?? daysToWindow(days) ?? "week";
  if (!ALLOWED_WINDOWS.has(canonicalWindow)) {
    const err = new Error(`invalid window: ${canonicalWindow}`); err.status = 400; throw err;
  }
  if (!ALLOWED_POSITIONS.has(position)) {
    const err = new Error(`invalid position: ${position}`); err.status = 400; throw err;
  }
  const safeLimit = clamp(parseInt(limit, 10), 1, 25);

  let resolvedPlayerId = null;
  if (playerId != null && playerId !== "") {
    resolvedPlayerId = await getPlayerIdBySlug(playerId, league);
    if (resolvedPlayerId == null) {
      const empty = { type: canonicalType, window: canonicalWindow, performances: [] };
      return fallback === true ? { ...empty, actualWindow: canonicalWindow } : empty;
    }
  }

  const ctxBase = {
    league,
    type: canonicalType,
    entity: canonicalEntity,
    sort,
    position,
    limit: safeLimit,
    resolvedPlayerId,
    teamId,
  };

  if (fallback !== true) {
    return runForWindow(ctxBase, canonicalWindow);
  }

  const startIdx = WINDOW_CASCADE.indexOf(canonicalWindow);
  let lastResult = null;
  for (let i = startIdx; i < WINDOW_CASCADE.length; i++) {
    const w = WINDOW_CASCADE[i];
    const result = await runForWindow(ctxBase, w);
    if (result.performances.length > 0) {
      return { ...result, actualWindow: w };
    }
    lastResult = result;
  }
  const finalWindow = WINDOW_CASCADE[WINDOW_CASCADE.length - 1];
  return { ...lastResult, actualWindow: finalWindow };
}

async function runForWindow(ctxBase, canonicalWindow) {
  const {
    league, type: canonicalType, entity: canonicalEntity,
    sort, position, limit: safeLimit, resolvedPlayerId, teamId,
  } = ctxBase;
  const playerSuffix = resolvedPlayerId == null ? "" : `:p${resolvedPlayerId}`;
  const teamSuffix = teamId == null ? "" : `:t${teamId}`;
  const key = `top-performances:${league}:${canonicalEntity}:${canonicalType}:${canonicalWindow}:${sort}:${position}:${safeLimit}${playerSuffix}${teamSuffix}`;
  const ttl = TTL_BY_WINDOW[canonicalWindow] ?? 60;

  return cached(key, ttl, async () => {
    const season = canonicalWindow === "season"
      ? await getCurrentSeason(league)
      : null;
    const ctx = {
      league,
      window: canonicalWindow,
      season,
      sort,
      position,
      limit: safeLimit,
      playerId: resolvedPlayerId,
      teamId,
    };
    if (canonicalEntity === "team" && canonicalType === "performances") return queryTeamPerformances(ctx);
    if (canonicalEntity === "team" && canonicalType === "rankings")     return queryTeamRankings(ctx);
    if (canonicalEntity === "game" && canonicalType === "performances") return queryGamePerformances(ctx);
    if (canonicalType === "performances") return queryPerformances(ctx);
    if (canonicalType === "rankings")     return queryRankings(ctx);
    return queryPlays(ctx);
  });
}

function buildFilters({ window, season, position, playerId, playerColumn = "s.playerid" }, startIdx) {
  const parts = [];
  const binds = [];
  const w = resolveWindow(window, { season, startIdx });
  if (w.predicate) {
    parts.push(w.predicate);
    binds.push(...w.binds);
  }
  let nextIdx = w.nextIdx;
  if (playerId != null) {
    parts.push(`${playerColumn} = $${nextIdx}`);
    binds.push(playerId);
    nextIdx += 1;
  }
  const pp = positionPredicate(position);
  if (pp) parts.push(pp);
  return {
    sql: parts.length ? " AND " + parts.join(" AND ") : "",
    binds,
    nextIdx,
  };
}

async function queryPerformances({ league, window, season, sort, position, limit, playerId }) {
  const f = buildFilters({ window, season, position, playerId, playerColumn: "s.playerid" }, 3);
  const { rows } = await pool.query(
    `SELECT s.playerid, s.gameid, s.rating,
            p.name, p.image_url, p.position,
            g.date,
            g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
            ${LIVE_STATUS_SQL} AS is_live,
            s.points, s.rebounds, s.assists,
            t.id AS team_id,
            t.abbreviation, t.logo_url, t.primary_color,
            ot.id AS opp_id,
            ot.abbreviation AS opp_abbreviation,
            ot.logo_url AS opp_logo_url
       FROM stats s
       JOIN games   g ON g.id = s.gameid
       JOIN players p ON p.id = s.playerid
       JOIN teams   t ON t.id = COALESCE(s.teamid, p.teamid)
       JOIN teams   ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND ${RATEABLE_STATUS_SQL}
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
        ${f.sql}
      ORDER BY s.rating ${sort === "asc" ? "ASC" : "DESC"}, s.playerid ASC
      LIMIT $2`,
    [league, limit, ...f.binds],
  );
  return { type: "performances", window, performances: rows.map(shapeGameRow) };
}

async function queryRankings({ league, window, season, sort, position, limit, playerId }) {
  const f = buildFilters({ window, season, position, playerId, playerColumn: "s.playerid" }, 3);
  const { rows } = await pool.query(
    `SELECT s.playerid,
            SUM(s.rating)  AS total_rating,
            COUNT(*)       AS games_played,
            AVG(s.rating)  AS avg_per_game,
            (ARRAY_AGG(s.gameid ORDER BY s.rating DESC))[1] AS best_game_id,
            MAX(s.rating)  AS best_game_rating,
            (ARRAY_AGG(ot.abbreviation ORDER BY s.rating DESC))[1] AS best_opp_abbreviation,
            p.name, p.image_url, p.position,
            t.id AS team_id,
            t.abbreviation, t.logo_url, t.primary_color
       FROM stats s
       JOIN games   g ON g.id = s.gameid
       JOIN players p ON p.id = s.playerid
       JOIN teams   t ON t.id = COALESCE(s.teamid, p.teamid)
       JOIN teams   ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND ${RATEABLE_STATUS_SQL}
        AND g.type IN ('regular','playoff','final','makeup')
        AND s.rating IS NOT NULL
        ${f.sql}
      GROUP BY s.playerid, p.name, p.image_url, p.position, t.id, t.abbreviation, t.logo_url, t.primary_color
      ORDER BY total_rating ${sort === "asc" ? "ASC" : "DESC"}, s.playerid ASC
      LIMIT $2`,
    [league, limit, ...f.binds],
  );
  return { type: "rankings", window, performances: rows.map(shapeCumulativeRow) };
}

async function queryPlays({ league, window, season, sort, position, limit, playerId }) {
  const f = buildFilters({ window, season, position, playerId, playerColumn: "pr.player_id" }, 3);
  const { rows } = await pool.query(
    `SELECT pr.play_id,
            pr.player_id,
            pr.game_id,
            pr.weighted_value,
            pr.wpa_delta,
            pl.period,
            pl.clock,
            pl.description,
            p.name, p.image_url, p.position,
            g.date,
            g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
            ${LIVE_STATUS_SQL} AS is_live,
            t.id AS team_id,
            t.abbreviation, t.logo_url, t.primary_color,
            ot.id AS opp_id,
            ot.abbreviation AS opp_abbreviation,
            ot.logo_url AS opp_logo_url
       FROM play_ratings pr
       JOIN plays    pl ON pl.id = pr.play_id
       JOIN players  p  ON p.id  = pr.player_id
       JOIN games    g  ON g.id  = pr.game_id
       LEFT JOIN stats s ON s.gameid = pr.game_id AND s.playerid = pr.player_id
       JOIN teams    t  ON t.id  = COALESCE(s.teamid, p.teamid)
       JOIN teams    ot ON ot.id = CASE WHEN t.id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE g.league = $1
        AND ${RATEABLE_STATUS_SQL}
        AND g.type IN ('regular','playoff','final','makeup')
        AND pr.weighted_value IS NOT NULL
        ${f.sql}
      ORDER BY pr.weighted_value ${sort === "asc" ? "ASC" : "DESC"}, pr.play_id ASC
      LIMIT $2`,
    [league, limit, ...f.binds],
  );
  return { type: "plays", window, performances: rows.map(shapePlayRow) };
}

function shapePlayRow(r) {
  const isLive = !!r.is_live;
  return {
    player: {
      id: r.player_id,
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
      id: r.game_id,
      date: r.date,
      opponent: { id: r.opp_id, abbreviation: r.opp_abbreviation, logo: r.opp_logo_url },
      isHome: r.team_id === r.hometeamid,
      isLive,
      homeScore: r.homescore,
      awayScore: r.awayscore,
      result: isLive
        ? null
        : (r.homescore != null && r.awayscore != null
            ? (((r.team_id === r.hometeamid && r.homescore > r.awayscore) ||
                (r.team_id === r.awayteamid && r.awayscore > r.homescore)) ? "W" : "L")
            : null),
    },
    play: {
      id: r.play_id,
      description: r.description,
      period: r.period,
      clock: r.clock,
      weightedValue: round1(Number(r.weighted_value)),
      wpaDelta: r.wpa_delta == null ? null : round4(Number(r.wpa_delta)),
    },
  };
}

function round4(n) { return n == null ? null : Math.round(n * 10000) / 10000; }

function shapeGameRow(r) {
  const rating = Number(r.rating);
  const isLive = !!r.is_live;
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
      isLive,
      homeScore: r.homescore,
      awayScore: r.awayscore,
      result: isLive
        ? null
        : (r.homescore != null && r.awayscore != null
            ? (((r.team_id === r.hometeamid && r.homescore > r.awayscore) ||
                (r.team_id === r.awayteamid && r.awayscore > r.homescore)) ? "W" : "L")
            : null),
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

async function queryTeamPerformances({ league, window, season, sort, limit, teamId }) {
  const filters = [];
  const binds = [league];
  let nextIdx = 2;
  const w = resolveWindow(window, { season, startIdx: nextIdx });
  if (w.predicate) { filters.push(w.predicate); binds.push(...w.binds); nextIdx = w.nextIdx; }
  if (teamId != null) {
    filters.push(`t.id = $${nextIdx}`);
    binds.push(teamId);
    nextIdx += 1;
  }

  const { rows } = await pool.query(
    `WITH team_games AS (
       SELECT g.id AS gameid,
              CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN g.hometeamid ELSE g.awayteamid END AS team_id,
              SUM(s.rating) AS team_rating
         FROM stats s
         JOIN games g   ON g.id = s.gameid
         JOIN players p ON p.id = s.playerid
        WHERE g.league = $1
          AND ${RATEABLE_STATUS_SQL}
          AND g.type IN ('regular','playoff','final','makeup')
          AND s.rating IS NOT NULL
        GROUP BY g.id, team_id
     )
     SELECT tg.gameid, tg.team_id, tg.team_rating,
            t.name, t.abbreviation, t.logo_url, t.primary_color,
            g.date, g.hometeamid, g.awayteamid, g.homescore, g.awayscore, g.status,
            ${LIVE_STATUS_SQL} AS is_live,
            ot.id AS opp_id, ot.abbreviation AS opp_abbreviation, ot.logo_url AS opp_logo_url
       FROM team_games tg
       JOIN teams t  ON t.id = tg.team_id
       JOIN games g  ON g.id = tg.gameid
       JOIN teams ot ON ot.id = CASE WHEN tg.team_id = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END
      WHERE TRUE
        ${filters.length ? "AND " + filters.join(" AND ") : ""}
      ORDER BY tg.team_rating ${sort === "asc" ? "ASC" : "DESC"}, tg.gameid ASC, tg.team_id ASC
      LIMIT $${nextIdx}`,
    [...binds, limit],
  );
  return { type: "performances", window, performances: rows.map(shapeTeamGameRow) };
}

async function queryTeamRankings({ league, window, season, sort, limit }) {
  const filters = [];
  const binds = [league];
  let nextIdx = 2;
  const w = resolveWindow(window, { season, startIdx: nextIdx });
  if (w.predicate) { filters.push(w.predicate); binds.push(...w.binds); nextIdx = w.nextIdx; }

  const { rows } = await pool.query(
    `WITH team_games AS (
       SELECT g.id AS gameid,
              CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN g.hometeamid ELSE g.awayteamid END AS team_id,
              CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN g.awayteamid ELSE g.hometeamid END AS opp_id,
              SUM(s.rating) AS team_rating
         FROM stats s
         JOIN games g   ON g.id = s.gameid
         JOIN players p ON p.id = s.playerid
        WHERE g.league = $1
          AND ${RATEABLE_STATUS_SQL}
          AND g.type IN ('regular','playoff','final','makeup')
          AND s.rating IS NOT NULL
          ${filters.length ? "AND " + filters.join(" AND ") : ""}
        GROUP BY g.id, team_id, opp_id
     )
     SELECT tg.team_id,
            t.name, t.abbreviation, t.logo_url, t.primary_color,
            SUM(tg.team_rating)  AS total_rating,
            COUNT(*)             AS games_played,
            AVG(tg.team_rating)  AS avg_per_game,
            (ARRAY_AGG(tg.gameid ORDER BY tg.team_rating DESC))[1] AS best_game_id,
            MAX(tg.team_rating)  AS best_game_rating,
            (ARRAY_AGG(ot.abbreviation ORDER BY tg.team_rating DESC))[1] AS best_opp_abbreviation
       FROM team_games tg
       JOIN teams t  ON t.id = tg.team_id
       JOIN teams ot ON ot.id = tg.opp_id
      GROUP BY tg.team_id, t.name, t.abbreviation, t.logo_url, t.primary_color
      ORDER BY total_rating ${sort === "asc" ? "ASC" : "DESC"}, tg.team_id ASC
      LIMIT $${nextIdx}`,
    [...binds, limit],
  );
  return { type: "rankings", window, performances: rows.map(shapeTeamCumulativeRow) };
}

async function queryGamePerformances({ league, window, season, sort, limit }) {
  const filters = [];
  const binds = [league];
  let nextIdx = 2;
  const w = resolveWindow(window, { season, startIdx: nextIdx });
  if (w.predicate) { filters.push(w.predicate); binds.push(...w.binds); nextIdx = w.nextIdx; }

  const { rows } = await pool.query(
    `WITH per_game AS (
       SELECT g.id AS gameid,
              g.date, g.status, g.homescore, g.awayscore, g.hometeamid, g.awayteamid,
              SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.hometeamid THEN s.rating END) AS home_rating,
              SUM(CASE WHEN COALESCE(s.teamid, p.teamid) = g.awayteamid THEN s.rating END) AS away_rating,
              SUM(s.rating)                                                                 AS game_rating
         FROM stats s
         JOIN games g   ON g.id = s.gameid
         JOIN players p ON p.id = s.playerid
        WHERE g.league = $1
          AND ${RATEABLE_STATUS_SQL}
          AND g.type IN ('regular','playoff','final','makeup')
          AND s.rating IS NOT NULL
          ${filters.length ? "AND " + filters.join(" AND ") : ""}
        GROUP BY g.id
     )
     SELECT pg.*, ${LIVE_STATUS_SQL} AS is_live,
            th.name AS home_name, th.abbreviation AS home_abbr, th.logo_url AS home_logo, th.primary_color AS home_color,
            ta.name AS away_name, ta.abbreviation AS away_abbr, ta.logo_url AS away_logo, ta.primary_color AS away_color
       FROM per_game pg
       JOIN games g  ON g.id = pg.gameid
       JOIN teams th ON th.id = pg.hometeamid
       JOIN teams ta ON ta.id = pg.awayteamid
      ORDER BY pg.game_rating ${sort === "asc" ? "ASC" : "DESC"}, pg.gameid ASC
      LIMIT $${nextIdx}`,
    [...binds, limit],
  );
  return { type: "performances", window, performances: rows.map(shapeGameRatingRow) };
}

function shapeTeamGameRow(r) {
  const teamId = r.team_id;
  const isLive = !!r.is_live;
  const rating = Number(r.team_rating);
  return {
    team: {
      id: teamId, name: r.name, abbr: r.abbreviation,
      logo: r.logo_url, primary_color: r.primary_color,
    },
    game: {
      id: r.gameid, date: r.date,
      opponent: { id: r.opp_id, abbreviation: r.opp_abbreviation, logo: r.opp_logo_url },
      isHome: teamId === r.hometeamid,
      isLive,
      homeScore: r.homescore, awayScore: r.awayscore,
      result: isLive
        ? null
        : (r.homescore != null && r.awayscore != null
            ? (((teamId === r.hometeamid && r.homescore > r.awayscore) ||
                (teamId === r.awayteamid && r.awayscore > r.homescore)) ? "W" : "L")
            : null),
    },
    rating: round1(rating),
    ratingGrade: round1(gradeFromRaw(rating)),
  };
}

function shapeTeamCumulativeRow(r) {
  return {
    team: {
      id: r.team_id, name: r.name, abbr: r.abbreviation,
      logo: r.logo_url, primary_color: r.primary_color,
    },
    totalRating: round1(Number(r.total_rating)),
    gamesPlayed: parseInt(r.games_played, 10),
    avgPerGame: Math.round(Number(r.avg_per_game) * 100) / 100,
    bestGame: {
      gameId: r.best_game_id,
      rating: round1(Number(r.best_game_rating)),
      opponentAbbreviation: r.best_opp_abbreviation,
    },
  };
}

function shapeGameRatingRow(r) {
  const gameRaw = Number(r.game_rating);
  const homeRaw = r.home_rating == null ? null : Number(r.home_rating);
  const awayRaw = r.away_rating == null ? null : Number(r.away_rating);
  const homeGrade = homeRaw == null ? null : round1(gradeFromRaw(homeRaw));
  const awayGrade = awayRaw == null ? null : round1(gradeFromRaw(awayRaw));
  const gameGrade = round1(gradeFromRaw(gameRaw));
  return {
    game: {
      id: r.gameid, date: r.date,
      homeTeam: { id: r.hometeamid, name: r.home_name, abbr: r.home_abbr, logo: r.home_logo, primary_color: r.home_color },
      awayTeam: { id: r.awayteamid, name: r.away_name, abbr: r.away_abbr, logo: r.away_logo, primary_color: r.away_color },
      homeScore: r.homescore, awayScore: r.awayscore,
      isLive: !!r.is_live,
    },
    homeTeamRating: homeRaw == null ? null : round1(homeRaw),
    awayTeamRating: awayRaw == null ? null : round1(awayRaw),
    rating: round1(gameRaw),
    ratingGrade: gameGrade,
    tierLabel: computeTier({
      gameGrade, homeGrade, awayGrade,
      status: r.status, homeScore: r.homescore, awayScore: r.awayscore,
    }),
  };
}

function computeTier({ gameGrade, homeGrade, awayGrade, status, homeScore, awayScore }) {
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

function round1(n) { return n == null ? null : Math.round(n * 10) / 10; }
function round2(n) { return n == null ? null : Math.round(n * 100) / 100; }
