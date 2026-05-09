import pool from "../../db/db.js";
import { cached } from "../../cache/cache.js";
import { currentSeasonForLeague } from "../../cache/seasons.js";
import { gradeFromRaw } from "./ratingEngine.js";

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
  switch (window) {
    case "today":
      return { predicate: "g.date = (NOW() AT TIME ZONE 'America/New_York')::date", binds: [] };
    case "week":
      return { predicate: "g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - INTERVAL '7 days'", binds: [] };
    case "month":
      return { predicate: "g.date >= (NOW() AT TIME ZONE 'America/New_York')::date - INTERVAL '30 days'", binds: [] };
    case "season":
      if (!opts.season) {
        const err = new Error("season required for window=season"); err.status = 500; throw err;
      }
      return { predicate: "g.season = $WIN1", binds: [opts.season] };
    case "all":
      return { predicate: "", binds: [] };
    default:
      return { predicate: "", binds: [] };
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
  league, type, window, sort = "desc", position = "all", limit, days,
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

  const key = `top-performances:${league}:${canonicalType}:${canonicalWindow}:${sort}:${position}:${safeLimit}`;
  const ttl = TTL_BY_WINDOW[canonicalWindow] ?? 60;

  return cached(key, ttl, async () => {
    const season = canonicalWindow === "season"
      ? await currentSeasonForLeague(league)
      : null;
    const ctx = { league, window: canonicalWindow, season, sort, position, limit: safeLimit };
    if (canonicalType === "performances") return queryPerformances(ctx);
    if (canonicalType === "rankings")     return queryRankings(ctx);
    return queryPlays(ctx);
  });
}

function buildFilters({ window, season, position }, startIdx) {
  const parts = [];
  const binds = [];
  let idx = startIdx;
  const w = resolveWindow(window, { season });
  if (w.predicate) {
    let frag = w.predicate;
    for (let i = 0; i < w.binds.length; i++) {
      frag = frag.replace("$WIN" + (i + 1), "$" + idx);
      binds.push(w.binds[i]);
      idx += 1;
    }
    parts.push(frag);
  }
  const pp = positionPredicate(position);
  if (pp) parts.push(pp);
  return {
    sql: parts.length ? " AND " + parts.join(" AND ") : "",
    binds,
    nextIdx: idx,
  };
}

async function queryPerformances({ league, window, season, sort, position, limit }) {
  const f = buildFilters({ window, season, position }, 3);
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

async function queryRankings({ league, window, season, sort, position, limit }) {
  const f = buildFilters({ window, season, position }, 3);
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

async function queryPlays(_ctx) {
  throw new Error("queryPlays not yet implemented");
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
