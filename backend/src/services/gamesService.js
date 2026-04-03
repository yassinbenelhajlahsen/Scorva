import pool from "../db/db.js";
import { DateTime } from "luxon";
import { cached } from "../cache/cache.js";
import { getCurrentSeason } from "../cache/seasons.js";
import pgDateToString from "../utils/pgDateToString.js";

async function getSeasonForDate(league, date) {
  // Look up which season this date belongs to
  const { rows } = await pool.query(
    `SELECT season FROM games WHERE league = $1 AND date = $2 AND season IS NOT NULL LIMIT 1`,
    [league, date]
  );
  if (rows.length > 0) return rows[0].season;
  // Fallback: nearest season by date proximity
  const { rows: fallback } = await pool.query(
    `SELECT season FROM games
     WHERE league = $1 AND season IS NOT NULL
     ORDER BY ABS(EXTRACT(EPOCH FROM (date - $2::date))) ASC
     LIMIT 1`,
    [league, date]
  );
  return fallback[0]?.season ?? (await getCurrentSeason(league));
}

export async function getGames(league, { teamId, season, date, live } = {}) {
  const currentSeasonSubquery = `(SELECT MAX(season) FROM games WHERE league = $1 AND season IS NOT NULL)`;
  const seasonClause = `g.season = COALESCE($2, ${currentSeasonSubquery})`;

  const selectFrom = `
    SELECT
      g.*,
      th.name AS home_team_name,
      th.shortname AS home_shortname,
      th.logo_url AS home_logo,
      ta.name AS away_team_name,
      ta.shortname AS away_shortname,
      ta.logo_url AS away_logo
    FROM games g
    JOIN teams th ON g.hometeamid = th.id
    JOIN teams ta ON g.awayteamid = ta.id
  `;

  const params = [league, season || null];

  // Date-specific query (league page date navigation)
  if (date) {
    const resolvedSeason = season || (await getSeasonForDate(league, date));
    const currentSeason = await getCurrentSeason(league);
    const isCurrent = resolvedSeason === currentSeason;
    const ttl = isCurrent ? 30 : 30 * 86400;
    const key = `games:${league}:${resolvedSeason}:date:${date}`;

    return cached(key, ttl, async () => {
      const dateParams = [league, resolvedSeason, date];
      const dateQuery =
        selectFrom +
        `WHERE g.league = $1 AND g.season = $2 AND g.date = $3
         ORDER BY
           CASE
             WHEN g.status ILIKE '%In Progress%' OR g.status ILIKE '%End of Period%' OR g.status ILIKE '%Halftime%' THEN 1
             WHEN g.status ILIKE '%Final%' THEN 2
             ELSE 3
           END ASC,
           g.id ASC`;

      let { rows } = await pool.query(dateQuery, dateParams);
      let resolvedDate = date;

      if (rows.length === 0) {
        // Find nearest date with games in either direction
        const { rows: nearest } = await pool.query(
          `(SELECT date FROM games WHERE league = $1 AND season = $2 AND date < $3::date ORDER BY date DESC LIMIT 1)
           UNION ALL
           (SELECT date FROM games WHERE league = $1 AND season = $2 AND date > $3::date ORDER BY date ASC LIMIT 1)`,
          [league, resolvedSeason, date]
        );

        if (nearest.length === 0) return { games: [], resolvedDate: date, resolvedSeason };

        const requested = new Date(date).getTime();
        const closest = nearest.reduce((a, b) => {
          const da = Math.abs(new Date(a.date).getTime() - requested);
          const db = Math.abs(new Date(b.date).getTime() - requested);
          return da <= db ? a : b;
        });
        resolvedDate = pgDateToString(closest.date);

        ({ rows } = await pool.query(dateQuery, [league, resolvedSeason, resolvedDate]));
      }

      return { games: rows, resolvedDate, resolvedSeason };
    });
  }

  // Team pages or historical season views: preserve original behavior
  if (teamId || season) {
    const currentSeason = await getCurrentSeason(league);
    const resolvedSeason = season || currentSeason;
    const isCurrent = resolvedSeason === currentSeason;
    const ttl = isCurrent ? 30 : 30 * 86400;
    const key = teamId
      ? `games:${league}:${resolvedSeason}:team:${teamId}`
      : `games:${league}:${resolvedSeason}:all`;

    return cached(key, ttl, async () => {
      let query = selectFrom + `WHERE g.league = $1 AND ${seasonClause}`;
      if (teamId) {
        query += ` AND ($${params.length + 1}::integer IN (g.hometeamid, g.awayteamid))`;
        params.push(teamId);
      }
      query += ` ORDER BY g.date DESC`;
      if (!teamId) query += ` LIMIT 12`;
      const { rows } = await pool.query(query, params);
      return rows;
    });
  }

  // Home/league page, current season: smart prioritization
  // Show today's full slate when live/final games exist; otherwise show nearest upcoming.
  const todayEST = DateTime.now().setZone("America/New_York").toFormat("yyyy-MM-dd");
  const key = `games:${league}:default:${todayEST}`;

  return cached(key, 30, async () => {
    params.push(todayEST); // $3

    // When called from SSE live controller, skip the EXISTS check — we already
    // know games are in progress, so go straight to the today-slate query.
    let has_today_games;
    if (live) {
      has_today_games = true;
    } else {
      const checkQuery = `
        SELECT EXISTS(
          SELECT 1 FROM games
          WHERE league = $1
            AND season = COALESCE($2, ${currentSeasonSubquery})
            AND (
              (date = $3 AND status NOT IN ('Scheduled', 'Postponed', 'Canceled'))
              OR (
                date = ($3::date - INTERVAL '1 day')
                AND (
                  status ILIKE '%In Progress%'
                  OR status ILIKE '%End of Period%'
                  OR status ILIKE '%Halftime%'
                )
              )
            )
        ) AS has_today_games
      `;
      ({ rows: [{ has_today_games }] } = await pool.query(checkQuery, params));
    }

    let query;
    if (has_today_games) {
      // Today has live/final games — show today's full slate (+ yesterday carry-over live games),
      // then fill remaining slots with upcoming scheduled games from future dates.
      // Ordered: live > final > scheduled today > scheduled tomorrow+
      query = selectFrom + `
        WHERE g.league = $1
          AND ${seasonClause}
          AND (
            g.date = $3
            OR (
              g.date = ($3::date - INTERVAL '1 day')
              AND (
                g.status ILIKE '%In Progress%'
                OR g.status ILIKE '%End of Period%'
                OR g.status ILIKE '%Halftime%'
              )
            )
            OR (
              g.date > $3
              AND g.status = 'Scheduled'
            )
          )
        ORDER BY
          CASE
            WHEN g.status ILIKE '%In Progress%' OR g.status ILIKE '%End of Period%' OR g.status ILIKE '%Halftime%' THEN 1
            WHEN g.status ILIKE '%Final%' THEN 2
            WHEN g.date = $3::date AND g.status = 'Scheduled' THEN 3
            ELSE 4
          END ASC,
          g.date ASC,
          g.id ASC
        LIMIT 12
      `;
    } else {
      // No live/final today — show nearest upcoming scheduled games, soonest first
      query = selectFrom + `
        WHERE g.league = $1
          AND ${seasonClause}
          AND g.date >= $3
          AND g.status = 'Scheduled'
        ORDER BY g.date ASC, g.id ASC
        LIMIT 12
      `;
    }

    const { rows } = await pool.query(query, params);

    // Off-season fallback: no live/final today AND no upcoming scheduled games.
    // Show the last finalized games of the season so the page isn't empty.
    if (!has_today_games && rows.length === 0) {
      const fallbackQuery = selectFrom + `
        WHERE g.league = $1
          AND ${seasonClause}
        ORDER BY g.date DESC, g.id DESC
        LIMIT 12
      `;
      const { rows: fallbackRows } = await pool.query(fallbackQuery, [league, season || null]);
      return fallbackRows;
    }

    return rows;
  });
}
