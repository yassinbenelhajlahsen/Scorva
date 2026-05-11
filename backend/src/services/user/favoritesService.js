import { DateTime } from "luxon";
import pool from "../../db/db.js";
import pgDateToString from "../../utils/pgDateToString.js";
import { ensureUser } from "./ensureUser.js";

export { ensureUser };

export async function getFavorites(userId) {
  const todayEST = DateTime.now().setZone("America/New_York").toFormat("yyyy-MM-dd");
  const [playersResult, playerStatsResult, teamsResult, teamGamesResult, nextGamesResult] =
    await Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.image_url, p.position, p.jerseynum, p.league,
                p.status, p.status_description,
                t.name AS team_name, t.shortname AS team_shortname, t.logo_url AS team_logo,
                t.id AS team_id
         FROM user_favorite_players ufp
         JOIN players p ON ufp.player_id = p.id
         LEFT JOIN teams t ON p.teamid = t.id
         WHERE ufp.user_id = $1
         ORDER BY ufp.created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT rs.*
         FROM (
           SELECT s.playerid, s.gameid, s.points, s.assists, s.rebounds, s.blocks, s.steals,
                  s.fg, s.threept, s.ft, s.turnovers, s.plusminus, s.minutes, s.fouls,
                  s.yds, s.sacks, s.td, s.interceptions, s.cmpatt,
                  s.g, s.a, s.saves, s.savepct, s.shots, s.toi,
                  g.date, g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
                  g.winnerid, g.status, g.league, g.id AS game_id,
                  th.shortname AS home_shortname, th.logo_url AS home_logo,
                  ta.shortname AS away_shortname, ta.logo_url AS away_logo,
                  ROW_NUMBER() OVER (PARTITION BY s.playerid ORDER BY g.date DESC) AS rn
           FROM stats s
           JOIN games g ON s.gameid = g.id
           JOIN teams th ON g.hometeamid = th.id
           JOIN teams ta ON g.awayteamid = ta.id
           WHERE s.playerid IN (
             SELECT player_id FROM user_favorite_players WHERE user_id = $1
           )
           AND g.status NOT ILIKE '%Scheduled%'
         ) rs
         WHERE rs.rn <= 3`,
        [userId]
      ),
      pool.query(
        `SELECT t.id, t.name, t.abbreviation, t.shortname, t.location, t.logo_url, t.record, t.league
         FROM user_favorite_teams uft
         JOIN teams t ON uft.team_id = t.id
         WHERE uft.user_id = $1
         ORDER BY uft.created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT rg.*
         FROM (
           SELECT g.id, g.league, g.date, g.hometeamid, g.awayteamid, g.homescore, g.awayscore,
                  g.status, g.winnerid, g.game_label, g.type,
                  g.firstqtr, g.secondqtr, g.thirdqtr, g.fourthqtr,
                  g.ot1, g.ot2, g.ot3, g.ot4,
                  th.name AS home_team_name, th.shortname AS home_shortname, th.logo_url AS home_logo,
                  ta.name AS away_team_name, ta.shortname AS away_shortname, ta.logo_url AS away_logo,
                  CASE WHEN g.hometeamid IN (SELECT team_id FROM user_favorite_teams WHERE user_id = $1)
                       THEN g.hometeamid
                       ELSE g.awayteamid
                  END AS fav_team_id,
                  ROW_NUMBER() OVER (
                    PARTITION BY CASE WHEN g.hometeamid IN (SELECT team_id FROM user_favorite_teams WHERE user_id = $1)
                                      THEN g.hometeamid
                                      ELSE g.awayteamid
                                 END
                    ORDER BY g.date DESC
                  ) AS rn
           FROM games g
           JOIN teams th ON g.hometeamid = th.id
           JOIN teams ta ON g.awayteamid = ta.id
           WHERE (
             g.hometeamid IN (SELECT team_id FROM user_favorite_teams WHERE user_id = $1)
             OR g.awayteamid IN (SELECT team_id FROM user_favorite_teams WHERE user_id = $1)
           )
           AND g.status NOT ILIKE '%Scheduled%'
         ) rg
         WHERE rg.rn <= 3`,
        [userId]
      ),
      pool.query(
        `WITH followed_teams AS (
           SELECT team_id FROM user_favorite_teams WHERE user_id = $1
           UNION
           SELECT p.teamid AS team_id
             FROM user_favorite_players ufp
             JOIN players p ON p.id = ufp.player_id
            WHERE ufp.user_id = $1 AND p.teamid IS NOT NULL
         )
         SELECT ng.team_id,
                ng.id, ng.league, ng.date, ng.start_time, ng.status,
                ng.hometeamid, ng.awayteamid,
                ng.home_shortname, ng.home_logo,
                ng.away_shortname, ng.away_logo
           FROM followed_teams ft
           JOIN LATERAL (
             SELECT g.id, g.league, g.date, g.start_time, g.status,
                    g.hometeamid, g.awayteamid,
                    th.shortname AS home_shortname, th.logo_url AS home_logo,
                    ta.shortname AS away_shortname, ta.logo_url AS away_logo,
                    ft.team_id
               FROM games g
               JOIN teams th ON g.hometeamid = th.id
               JOIN teams ta ON g.awayteamid = ta.id
              WHERE (g.hometeamid = ft.team_id OR g.awayteamid = ft.team_id)
                AND g.date >= $2::date
                AND g.status = 'Scheduled'
              ORDER BY g.date ASC, g.id ASC
              LIMIT 1
           ) ng ON true`,
        [userId, todayEST]
      ),
    ]);

  const statsByPlayer = {};
  for (const row of playerStatsResult.rows) {
    if (!statsByPlayer[row.playerid]) statsByPlayer[row.playerid] = [];
    statsByPlayer[row.playerid].push(row);
  }

  const gamesByTeam = {};
  for (const row of teamGamesResult.rows) {
    if (!gamesByTeam[row.fav_team_id]) gamesByTeam[row.fav_team_id] = [];
    gamesByTeam[row.fav_team_id].push(row);
  }

  const nextGameByTeam = {};
  for (const row of nextGamesResult.rows) {
    const { team_id, ...rest } = row;
    nextGameByTeam[team_id] = { ...rest, date: pgDateToString(rest.date) };
  }

  return {
    players: playersResult.rows.map((p) => ({
      ...p,
      recentStats: statsByPlayer[p.id] || [],
      nextGame: p.team_id ? nextGameByTeam[p.team_id] || null : null,
    })),
    teams: teamsResult.rows.map((t) => ({
      ...t,
      recentGames: gamesByTeam[t.id] || [],
      nextGame: nextGameByTeam[t.id] || null,
    })),
  };
}

export async function addFavoritePlayer(userId, playerId, profile = {}) {
  await ensureUser(userId, profile);
  await pool.query(
    `INSERT INTO user_favorite_players (user_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, playerId]
  );
}

export async function removeFavoritePlayer(userId, playerId) {
  await pool.query(
    `DELETE FROM user_favorite_players WHERE user_id = $1 AND player_id = $2`,
    [userId, playerId]
  );
}

export async function addFavoriteTeam(userId, teamId, profile = {}) {
  await ensureUser(userId, profile);
  await pool.query(
    `INSERT INTO user_favorite_teams (user_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, teamId]
  );
}

export async function removeFavoriteTeam(userId, teamId) {
  await pool.query(
    `DELETE FROM user_favorite_teams WHERE user_id = $1 AND team_id = $2`,
    [userId, teamId]
  );
}

export async function checkFavorites(userId, playerIds, teamIds) {
  const [pResult, tResult] = await Promise.all([
    playerIds.length
      ? pool.query(
          `SELECT player_id FROM user_favorite_players WHERE user_id = $1 AND player_id = ANY($2::int[])`,
          [userId, playerIds]
        )
      : { rows: [] },
    teamIds.length
      ? pool.query(
          `SELECT team_id FROM user_favorite_teams WHERE user_id = $1 AND team_id = ANY($2::int[])`,
          [userId, teamIds]
        )
      : { rows: [] },
  ]);
  return {
    playerIds: pResult.rows.map((r) => r.player_id),
    teamIds: tResult.rows.map((r) => r.team_id),
  };
}
