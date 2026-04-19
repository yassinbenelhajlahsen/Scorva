import pool from "../../../../db/db.js";
import { cached } from "../../../../cache/cache.js";
import { getCurrentSeason } from "../../../../cache/seasons.js";
import { MINUTES_FILTER_SQL } from "../../../../utils/statFilters.js";

const STATUS_SEVERITY = {
  out: 1,
  ir: 2,
  doubtful: 3,
  questionable: 4,
  "day-to-day": 5,
  suspended: 6,
};

const VALID_STATUSES = Object.keys(STATUS_SEVERITY);
const VALID_LEAGUES = ["nba", "nfl", "nhl"];

const SEVERITY_CASE_SQL =
  "CASE p.status " +
  Object.entries(STATUS_SEVERITY)
    .map(([k, v]) => `WHEN '${k}' THEN ${v}`)
    .join(" ") +
  " ELSE 99 END";

function statsSelectFor(league) {
  if (league === "nba") {
    return `
      ROUND(AVG(s.points)::numeric, 1) AS points,
      ROUND(AVG(s.rebounds)::numeric, 1) AS rebounds,
      ROUND(AVG(s.assists)::numeric, 1) AS assists,
      ROUND(AVG(s.minutes)::numeric, 1) AS minutes`;
  }
  if (league === "nfl") {
    return `
      ROUND(AVG(s.yds)::numeric, 1) AS yards,
      SUM(s.td) AS touchdowns,
      SUM(s.interceptions) AS interceptions`;
  }
  return `
    ROUND(AVG(s.g)::numeric, 2) AS goals,
    ROUND(AVG(s.a)::numeric, 2) AS assists,
    ROUND(AVG(s.shots)::numeric, 1) AS shots`;
}

function shapeSeasonAverages(league, row) {
  if (!row) return null;
  if (league === "nba") {
    return {
      points: row.points == null ? null : Number(row.points),
      rebounds: row.rebounds == null ? null : Number(row.rebounds),
      assists: row.assists == null ? null : Number(row.assists),
      minutes: row.minutes == null ? null : Number(row.minutes),
    };
  }
  if (league === "nfl") {
    return {
      yards: row.yards == null ? null : Number(row.yards),
      touchdowns: row.touchdowns == null ? null : Number(row.touchdowns),
      interceptions: row.interceptions == null ? null : Number(row.interceptions),
    };
  }
  return {
    goals: row.goals == null ? null : Number(row.goals),
    assists: row.assists == null ? null : Number(row.assists),
    shots: row.shots == null ? null : Number(row.shots),
  };
}

export async function getTeamInjuries(league, teamId, season) {
  if (!VALID_LEAGUES.includes(league)) return { error: `Invalid league: ${league}` };
  if (!Number.isFinite(Number(teamId))) return { error: "Invalid teamId" };

  const resolvedSeason = season || (await getCurrentSeason(league));

  return cached(`injuries:team:${league}:${teamId}:${resolvedSeason}`, 120, async () => {
    const playersRes = await pool.query(
      `SELECT p.id, p.name, p.position,
              p.status, p.status_description, p.status_updated_at,
              t.id AS team_id, t.name AS team_name, t.shortname AS team_short
         FROM players p
         JOIN teams t ON t.id = p.teamid
        WHERE p.teamid = $1
          AND p.league = $2
          AND p.status IS NOT NULL`,
      [teamId, league],
    );

    if (playersRes.rows.length === 0) {
      const teamRes = await pool.query(
        `SELECT id, name, shortname FROM teams WHERE id = $1 AND league = $2`,
        [teamId, league],
      );
      const team = teamRes.rows[0];
      return {
        team: team
          ? { id: team.id, name: team.name, shortName: team.shortname }
          : null,
        season: resolvedSeason,
        asOf: null,
        count: 0,
        players: [],
      };
    }

    const playerIds = playersRes.rows.map((r) => r.id);
    const statsRes = await pool.query(
      `SELECT s.playerid,
              COUNT(DISTINCT g.id) AS games_played,
              ${statsSelectFor(league)}
         FROM stats s
         JOIN games g ON g.id = s.gameid
        WHERE g.league = $1
          AND g.season = $2
          AND g.status ILIKE 'Final%'
          AND g.type IN ('regular', 'makeup')
          AND s.playerid = ANY($3::int[])
          AND ${MINUTES_FILTER_SQL}
        GROUP BY s.playerid`,
      [league, resolvedSeason, playerIds],
    );

    const statsByPlayer = new Map(statsRes.rows.map((r) => [r.playerid, r]));

    const players = playersRes.rows.map((r) => {
      const s = statsByPlayer.get(r.id);
      return {
        id: r.id,
        name: r.name,
        position: r.position,
        status: r.status,
        statusDescription: r.status_description,
        statusUpdatedAt: r.status_updated_at,
        seasonAverages: shapeSeasonAverages(league, s),
        gamesPlayed: s ? Number(s.games_played) : 0,
      };
    });

    players.sort((a, b) => {
      const sa = STATUS_SEVERITY[a.status] || 999;
      const sb = STATUS_SEVERITY[b.status] || 999;
      return sa - sb;
    });

    const asOf = playersRes.rows.reduce((max, r) => {
      if (!r.status_updated_at) return max;
      if (!max || r.status_updated_at > max) return r.status_updated_at;
      return max;
    }, null);

    const first = playersRes.rows[0];
    return {
      team: {
        id: first.team_id,
        name: first.team_name,
        shortName: first.team_short,
      },
      season: resolvedSeason,
      asOf,
      count: players.length,
      players,
    };
  });
}

export async function getLeagueInjuries(
  league,
  { status, minPopularity = 0, limit = 25 } = {},
) {
  if (!VALID_LEAGUES.includes(league)) return { error: `Invalid league: ${league}` };
  if (status && !VALID_STATUSES.includes(status)) {
    return { error: `Invalid status: ${status}` };
  }

  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 25), 50);
  const safeMinPop = Math.max(0, parseInt(minPopularity) || 0);

  const key = `injuries:league:${league}:${status || "all"}:${safeMinPop}:${safeLimit}`;
  return cached(key, 120, async () => {
    const res = await pool.query(
      `SELECT p.id AS player_id, p.name AS player_name, p.position,
              p.status, p.status_description, p.status_updated_at, p.popularity,
              t.id AS team_id, t.name AS team_name, t.shortname AS team_short
         FROM players p
         LEFT JOIN teams t ON t.id = p.teamid
        WHERE p.league = $1
          AND p.status IS NOT NULL
          AND p.popularity >= $2
          AND ($3::text IS NULL OR p.status = $3)
        ORDER BY p.popularity DESC, ${SEVERITY_CASE_SQL}
        LIMIT $4`,
      [league, safeMinPop, status || null, safeLimit],
    );

    return {
      league,
      count: res.rows.length,
      players: res.rows.map((r) => ({
        player: {
          id: r.player_id,
          name: r.player_name,
          position: r.position,
        },
        team: r.team_id
          ? { id: r.team_id, name: r.team_name, shortName: r.team_short }
          : null,
        status: r.status,
        statusDescription: r.status_description,
        statusUpdatedAt: r.status_updated_at,
      })),
    };
  });
}

export async function getPlayerStatus(league, playerId) {
  if (!VALID_LEAGUES.includes(league)) return { error: `Invalid league: ${league}` };
  if (!Number.isFinite(Number(playerId))) return { error: "Invalid playerId" };

  return cached(`injuries:player:${league}:${playerId}`, 60, async () => {
    const res = await pool.query(
      `SELECT id, name, status, status_description, status_updated_at
         FROM players
        WHERE id = $1 AND league = $2`,
      [playerId, league],
    );
    if (res.rows.length === 0) return { error: "Player not found" };

    const row = res.rows[0];
    if (!row.status) {
      return { id: row.id, name: row.name, status: "active" };
    }
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      statusDescription: row.status_description,
      statusUpdatedAt: row.status_updated_at,
    };
  });
}
