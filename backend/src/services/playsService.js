import axios from "axios";
import pool from "../db/db.js";
import { cached } from "../cache/cache.js";

const PLAYS_TTL = 30 * 86400; // 30 days

const SPORT_PATH = {
  nba: "basketball/nba",
  nfl: "american-football/nfl",
  nhl: "hockey/nhl",
};

export async function getPlays(gameId, league) {
  const { rows: gameRows } = await pool.query(
    "SELECT eventid, status FROM games WHERE id = $1 AND league = $2",
    [gameId, league],
  );

  if (gameRows.length === 0) return null;

  const { eventid, status } = gameRows[0];
  const isFinal = status && status.toLowerCase().includes("final");

  if (isFinal) {
    return getStoredPlays(gameId, league);
  }

  if (!eventid) {
    // Scheduled game, no eventid yet — nothing to show
    return { plays: [], source: "none" };
  }

  // Live game: read from DB (written by liveSync every ~30s); fall back to ESPN
  // proxy on cold start before liveSync has written any plays yet.
  const dbResult = await getStoredPlaysLive(gameId);
  if (dbResult && dbResult.plays.length > 0) {
    return dbResult;
  }
  return getLivePlays(league, eventid);
}

async function getStoredPlays(gameId, league) {
  return cached(
    `plays:${league}:${gameId}`,
    PLAYS_TTL,
    async () => {
      const { rows } = await pool.query(
        `SELECT
           p.id,
           p.espn_play_id,
           p.sequence,
           p.period,
           p.clock,
           p.description,
           p.short_text,
           p.home_score,
           p.away_score,
           p.scoring_play,
           p.team_id,
           p.play_type,
           p.drive_number,
           p.drive_description,
           p.drive_result,
           t.logo_url AS team_logo,
           t.shortname AS team_short
         FROM plays p
         LEFT JOIN teams t ON t.id = p.team_id
         WHERE p.gameid = $1
         ORDER BY p.sequence ASC`,
        [gameId],
      );

      if (rows.length === 0) return null;
      return { plays: rows, source: "db" };
    },
    { cacheIf: (result) => result !== null },
  );
}

async function getStoredPlaysLive(gameId) {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.espn_play_id,
       p.sequence,
       p.period,
       p.clock,
       p.description,
       p.short_text,
       p.home_score,
       p.away_score,
       p.scoring_play,
       p.team_id,
       p.play_type,
       p.drive_number,
       p.drive_description,
       p.drive_result,
       t.logo_url AS team_logo,
       t.shortname AS team_short
     FROM plays p
     LEFT JOIN teams t ON t.id = p.team_id
     WHERE p.gameid = $1
     ORDER BY p.sequence ASC`,
    [gameId],
  );
  if (rows.length === 0) return null;
  return { plays: rows, source: "db" };
}

async function getLivePlays(league, eventId) {
  const sportPath = SPORT_PATH[league];
  if (!sportPath) return { plays: [], source: "none" };

  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/playbyplay?event=${eventId}`;

  let resp;
  try {
    resp = await axios.get(url, { timeout: 10000 });
  } catch {
    return { plays: [], source: "espn_error" };
  }

  const plays = normalizeLivePlays(resp.data, league);
  return { plays, source: "espn" };
}

function normalizeLivePlays(data, league) {
  if (league === "nfl") {
    return normalizeNflDrives(data);
  }

  const raw = data.plays;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((p) => p.text || p.shortText)
    .map((p) => ({
      id:               null,
      espn_play_id:     String(p.id ?? p.sequenceNumber ?? ""),
      sequence:         parseInt(p.sequenceNumber ?? p.id, 10),
      period:           p.period?.number ?? 1,
      clock:            p.clock?.displayValue ?? null,
      description:      p.text ?? p.shortText ?? "",
      short_text:       p.shortText ?? null,
      home_score:       p.homeScore != null ? parseInt(p.homeScore, 10) : null,
      away_score:       p.awayScore != null ? parseInt(p.awayScore, 10) : null,
      scoring_play:     !!p.scoringPlay,
      team_id:          null,
      play_type:        p.type?.text ?? null,
      drive_number:     null,
      drive_description: null,
      drive_result:     null,
      team_logo:        null,
      team_short:       null,
    }));
}

function normalizeNflDrives(data) {
  const drivesObj = data.drives;
  if (!drivesObj) return [];

  const driveList = [];
  if (Array.isArray(drivesObj.previous)) driveList.push(...drivesObj.previous);
  if (drivesObj.current) driveList.push(drivesObj.current);

  const plays = [];
  driveList.forEach((drive, idx) => {
    const drivePlays = drive.plays;
    if (!Array.isArray(drivePlays)) return;

    drivePlays.forEach((p) => {
      const desc = p.text ?? p.shortText ?? "";
      if (!desc) return;

      plays.push({
        id:               null,
        espn_play_id:     String(p.id ?? p.sequenceNumber ?? ""),
        sequence:         parseInt(p.sequenceNumber ?? p.id, 10),
        period:           p.period?.number ?? p.start?.period?.number ?? 1,
        clock:            p.clock?.displayValue ?? p.start?.clock?.displayValue ?? null,
        description:      desc,
        short_text:       p.shortText ?? null,
        home_score:       p.homeScore != null ? parseInt(p.homeScore, 10) : null,
        away_score:       p.awayScore != null ? parseInt(p.awayScore, 10) : null,
        scoring_play:     !!p.scoringPlay,
        team_id:          null,
        play_type:        p.type?.text ?? null,
        drive_number:     idx + 1,
        drive_description: drive.description ?? null,
        drive_result:     drive.result ?? null,
        team_logo:        null,
        team_short:       null,
      });
    });
  });

  return plays;
}
