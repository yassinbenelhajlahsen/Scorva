import axios from "axios";
import logger from "../logger.js";
import { getSportPath } from "./espn/espnAPIClient.js";

const log = logger.child({ worker: "eventProcessor" });

const playerDetailsCache = new Map();

export const runStats = {
  espnApiCalls: 0,
  cacheHits: 0,
  dbHits: 0,
  playersUpserted: 0,
  statsUpserted: 0,
  gamesProcessed: 0,
};

let skippedFinalGamesCount = 0;

/**
 * Clear the in-memory player cache and reset all run statistics.
 * Call this at the end of each hourly/historical run to free memory.
 */
export function clearPlayerCache() {
  playerDetailsCache.clear();
  skippedFinalGamesCount = 0;
  runStats.espnApiCalls = 0;
  runStats.cacheHits = 0;
  runStats.dbHits = 0;
  runStats.playersUpserted = 0;
  runStats.statsUpserted = 0;
  runStats.gamesProcessed = 0;
}

export function incrementSkippedFinal() {
  skippedFinalGamesCount++;
}

/**
 * Get cache statistics for logging/debugging.
 */
export function getPlayerCacheStats() {
  return {
    size: playerDetailsCache.size,
    skippedFinalGames: skippedFinalGamesCount,
    ...runStats,
  };
}

/**
 * Fetch detailed player info from ESPN API.
 */
export async function fetchPlayerDetails(espnId, leagueSlug) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/${path}/${leagueSlug}/athletes/${espnId}`;
  runStats.espnApiCalls++;
  try {
    const resp = await axios.get(url);
    return resp.data.athlete || null;
  } catch (err) {
    // If ESPN returns 404 or similar, skip details
    log.warn({ err, espnId }, "Could not fetch athlete from ESPN");
    return null;
  }
}

/**
 * Check if a player already exists in the database with non-null core fields.
 * Returns the player details formatted like ESPN response, or null if not found/incomplete.
 */
async function getExistingPlayerFromDB(client, espnId, leagueSlug) {
  const query = `
    SELECT
      espn_playerid as id,
      name,
      position,
      height,
      weight,
      image_url,
      jerseynum,
      dob,
      draftinfo
    FROM players
    WHERE espn_playerid = $1 AND league = $2
      AND name IS NOT NULL
      AND position IS NOT NULL
      AND height IS NOT NULL
      AND weight IS NOT NULL
      AND image_url IS NOT NULL
  `;
  const result = await client.query(query, [espnId, leagueSlug]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  // Return in a format compatible with ESPN athlete response
  return {
    id: row.id,
    displayName: row.name,
    position: { abbreviation: row.position },
    displayHeight: row.height,
    displayWeight: row.weight,
    headshot: { href: row.image_url },
    jersey: row.jerseynum,
    displayDOB: row.dob,
    displayDraft: row.draftinfo,
    _fromDB: true, // marker to indicate this came from DB
  };
}

/**
 * Get player details with three-tier caching:
 * 1. In-memory cache (same-run deduplication)
 * 2. Database (cross-run persistence)
 * 3. ESPN API only if both miss
 */
export async function getCachedPlayerDetails(client, espnId, leagueSlug) {
  const cacheKey = `${leagueSlug}:${espnId}`;

  if (playerDetailsCache.has(cacheKey)) {
    runStats.cacheHits++;
    return playerDetailsCache.get(cacheKey);
  }

  const dbPlayer = await getExistingPlayerFromDB(client, espnId, leagueSlug);
  if (dbPlayer) {
    runStats.dbHits++;
    playerDetailsCache.set(cacheKey, dbPlayer);
    return dbPlayer;
  }

  const espnPlayer = await fetchPlayerDetails(espnId, leagueSlug).catch(() => null);
  playerDetailsCache.set(cacheKey, espnPlayer);
  return espnPlayer;
}
