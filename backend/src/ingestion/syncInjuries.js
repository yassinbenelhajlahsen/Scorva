import axios from "axios";
import logger from "../logger.js";
import { getSportPath, withRetry } from "./espn/espnAPIClient.js";

const log = logger.child({ worker: "syncInjuries" });

const ESPN_STATUS_MAP = {
  active: "active",
  "day-to-day": "day-to-day",
  "day to day": "day-to-day",
  questionable: "questionable",
  doubtful: "doubtful",
  out: "out",
  "out for season": "out",
  "injured reserve": "ir",
  ir: "ir",
  "injured-reserve": "ir",
  "o-ir": "ir",
  suspended: "suspended",
  suspension: "suspended",
};

export function normalizeStatus(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return ESPN_STATUS_MAP[key] || null;
}

async function fetchTeamInjuries(leagueSlug, espnTeamId) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/${leagueSlug}/teams/${espnTeamId}/injuries`;
  try {
    const resp = await withRetry(() => axios.get(url), {
      label: `injuries:${leagueSlug}:${espnTeamId}`,
    });
    return resp.data?.injuries || [];
  } catch (err) {
    log.warn(
      { err: err?.message, status: err?.response?.status, league: leagueSlug, espnTeamId },
      "failed to fetch team injuries",
    );
    return null;
  }
}

export async function syncInjuriesForLeague(pool, leagueSlug) {
  const client = await pool.connect();
  let updated = 0;
  let cleared = 0;
  let teamsProcessed = 0;

  try {
    const { rows: teams } = await client.query(
      `SELECT id, espnid FROM teams WHERE league = $1 AND espnid IS NOT NULL`,
      [leagueSlug],
    );

    for (const team of teams) {
      const payload = await fetchTeamInjuries(leagueSlug, team.espnid);
      if (payload === null) continue;
      teamsProcessed++;

      const entries = Array.isArray(payload)
        ? payload.flatMap((block) => block?.injuries || [])
        : [];

      const injuredEspnIds = [];

      for (const entry of entries) {
        const espnPlayerId = parseInt(entry?.athlete?.id, 10);
        if (!Number.isFinite(espnPlayerId)) continue;
        const status = normalizeStatus(entry?.status);
        if (!status) continue;

        const description =
          entry?.shortComment ||
          entry?.longComment ||
          entry?.details?.type ||
          null;

        const res = await client.query(
          `UPDATE players
              SET status = $1,
                  status_description = $2,
                  status_updated_at = NOW()
            WHERE espn_playerid = $3 AND league = $4`,
          [status, description, espnPlayerId, leagueSlug],
        );
        if (res.rowCount > 0) {
          updated += res.rowCount;
          injuredEspnIds.push(espnPlayerId);
        }
      }

      // Clear any player on this team whose ESPN id wasn't in the injury feed
      const clearRes = await client.query(
        `UPDATE players
            SET status = NULL,
                status_description = NULL,
                status_updated_at = NOW()
          WHERE teamid = $1
            AND league = $2
            AND status IS NOT NULL
            AND NOT (espn_playerid = ANY($3::int[]))`,
        [team.id, leagueSlug, injuredEspnIds],
      );
      cleared += clearRes.rowCount;
    }

    log.info(
      { league: leagueSlug, teamsProcessed, updated, cleared },
      "injury sync complete",
    );
    return { teamsProcessed, updated, cleared };
  } finally {
    client.release();
  }
}
