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
const ALLOWED_SORTS = new Set(["desc", "asc"]);
const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);

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
  league, type, window, sort = "desc", position = "all", limit, days, playerId,
}) {
  const canonicalType = TYPE_ALIASES[type] ?? type ?? "performances";
  if (!ALLOWED_TYPES.has(canonicalType)) {
    const err = new Error(`invalid type: ${type}`); err.status = 400; throw err;
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
      return { type: canonicalType, window: canonicalWindow, performances: [] };
    }
  }

  const playerSuffix = resolvedPlayerId == null ? "" : `:p${resolvedPlayerId}`;
  const key = `top-performances:${league}:${canonicalType}:${canonicalWindow}:${sort}:${position}:${safeLimit}${playerSuffix}`;
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
    };
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
        AND g.status ILIKE '%final%'
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
        AND g.status ILIKE '%final%'
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
        AND g.status ILIKE '%final%'
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
      result: r.homescore != null && r.awayscore != null
        ? ((r.team_id === r.hometeamid && r.homescore > r.awayscore) ||
           (r.team_id === r.awayteamid && r.awayscore > r.homescore) ? "W" : "L")
        : null,
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
