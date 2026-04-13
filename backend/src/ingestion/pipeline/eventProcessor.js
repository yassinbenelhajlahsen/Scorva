import axios from "axios";
import mapStatsToSchema from "../mappings/mapStatsToSchema.js";
import upsertTeam from "../upsert/upsertTeam.js";
import upsertPlayer from "../upsert/upsertPlayer.js";
import upsertStat from "../upsert/upsertStat.js";
import upsertGame from "../upsert/upsertGame.js";
import upsertPlays from "../upsert/upsertPlays.js";
import { espnImage } from "../espn/espnImage.js";
import { DateTime } from "luxon";
import logger from "../../logger.js";
import {
  getSportPath,
  withRetry,
  getEventsByDate,
  getTodayEvents,
} from "../espn/espnAPIClient.js";
import {
  runStats,
  clearPlayerCache,
  getPlayerCacheStats,
  fetchPlayerDetails,
  getCachedPlayerDetails,
  incrementSkippedFinal,
} from "../playerCacheManager.js";

const log = logger.child({ worker: "eventProcessor" });

// Re-export for backwards compatibility with existing consumers
export { getSportPath, getEventsByDate, getTodayEvents, fetchPlayerDetails, clearPlayerCache, getPlayerCacheStats };


const MIN_STAT_ROWS = {
  nba: 12, // 8–13 active per team → 16–26 rows expected
  nhl: 20, // 18–20 skaters + goalies per team → 36–40 rows expected
  nfl: 10, // only skill positions + DBs → 15–40 rows expected
};

function isSpecialEventGame(event, homeComp, awayComp) {
  const metadataText = [
    event.name,
    event.shortName,
    event.season?.slug,
    event.season?.type?.name,
    event.season?.type?.description,
    event.season?.type?.abbreviation,
    event.competitions?.[0]?.type?.text,
    event.competitions?.[0]?.type?.abbreviation,
    ...(event.competitions?.[0]?.notes || []).map((n) => n?.headline),
    homeComp?.team?.displayName,
    homeComp?.team?.name,
    awayComp?.team?.displayName,
    awayComp?.team?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /(all[\s-]?star|special event|exhibition|pro[\s-]?bowl|skills challenge|rising stars|slam[\s-]?dunk|3[\s-]?point|three[\s-]?point)/i.test(
    metadataText,
  );
}

/**
 * Check if a game already exists with FINAL status.
 * Returns { exists: boolean, isFinal: boolean, gameId: number | null }
 */
async function getExistingGameStatus(client, homeTeamId, awayTeamId, date, league) {
  const query = `
    SELECT id, status
    FROM games
    WHERE hometeamid = $1
      AND awayteamid = $2
      AND date = $3
      AND league = $4
  `;
  const result = await client.query(query, [homeTeamId, awayTeamId, date, league]);
  if (result.rows.length === 0) {
    return { exists: false, isFinal: false, gameId: null };
  }
  const row = result.rows[0];
  return { exists: true, isFinal: row.status === "Final", gameId: row.id };
}

/**
 * processEvent: upsert one ESPN event into Postgres.
 *
 * - Upserts home + away teams
 * - Constructs a game payload, upserts that
 * - Fetches the boxscore summary, then upserts each player + stats
 *
 * Returns the game's internal PK.
 */
export async function processEvent(client, leagueSlug, event, { force = false } = {}) {
  const espnEventId = parseInt(event.id, 10);
  if (Number.isNaN(espnEventId)) {
    log.warn({ eventId: event.id }, "invalid event.id, skipping");
    return null;
  }

  // Extract date portion YYYY-MM-DD and ET start time
  const rawDate = event.date; // "2025-06-09T00:00Z"
  const dt = DateTime.fromISO(rawDate, { zone: "utc" }).setZone("America/New_York");
  const localDate = dt.toFormat("yyyy-MM-dd");
  const hour = dt.hour % 12 || 12;
  const minute = dt.minute;
  const ampm = dt.hour < 12 ? "AM" : "PM";
  const startTime = minute === 0
    ? `${hour}${ampm} ET`
    : `${hour}:${String(minute).padStart(2, "0")}${ampm} ET`;

  const comps = event.competitions?.[0]?.competitors || [];
  const homeComp = comps.find((c) => c.homeAway === "home");
  const awayComp = comps.find((c) => c.homeAway === "away");
  if (!homeComp || !awayComp) {
    log.warn({ eventId: espnEventId }, "missing home/away competitor for event");
    return null;
  }

  const preserveExistingTeam = isSpecialEventGame(event, homeComp, awayComp);

  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = 0");

  const homeTeamData = {
    name: homeComp.team.displayName,
    shortname: homeComp.team.name,
    location: homeComp.team.location,
    logo_url: espnImage(homeComp.team.logo, 200, 200),
    record: homeComp.records?.[0]?.summary || "0-0",
    homerecord: homeComp.records?.find((r) => r.type === "home")?.summary || "0-0",
    awayrecord: homeComp.records?.find((r) => r.type === "road")?.summary || "0-0",
    primary_color: homeComp.team.color ? `#${homeComp.team.color}` : null,
  };

  const awayTeamData = {
    name: awayComp.team.displayName,
    shortname: awayComp.team.name,
    location: awayComp.team.location,
    logo_url: espnImage(awayComp.team.logo, 200, 200),
    record: awayComp.records?.[0]?.summary || "0-0",
    homerecord: awayComp.records?.find((r) => r.type === "home")?.summary || "0-0",
    awayrecord: awayComp.records?.find((r) => r.type === "road")?.summary || "0-0",
    primary_color: awayComp.team.color ? `#${awayComp.team.color}` : null,
  };

  try {
    const homeTeamId = await upsertTeam(client, parseInt(homeComp.team.id, 10), leagueSlug, homeTeamData);
    const awayTeamId = await upsertTeam(client, parseInt(awayComp.team.id, 10), leagueSlug, awayTeamData);

    const homeScore = homeComp.score !== undefined ? parseInt(homeComp.score, 10) : null;
    const awayScore = awayComp.score !== undefined ? parseInt(awayComp.score, 10) : null;

    const venue = event.competitions[0].venue ? event.competitions[0].venue.fullName : null;
    let broadcast = null;
    if (event.competitions[0].broadcast) {
      broadcast = event.competitions[0].broadcast;
    } else if (event.broadcasts && event.broadcasts.length) {
      broadcast = event.broadcasts.map((b) => b.names.join("/")).join(", ");
    }

    const status = event.status && event.status.type ? event.status.type.description : null;
    const currentPeriod = event.status?.period ?? null;
    const clock = event.status?.displayClock ?? null;

    // Build quarter/period scores
    const periodsMap = {};
    for (const teamComp of comps) {
      if (!teamComp.linescores) continue;
      const sideKey = teamComp.homeAway === "home" ? "home" : "away";
      for (const ls of teamComp.linescores) {
        const p = ls.period.toString();
        if (!periodsMap[p]) periodsMap[p] = { home: null, away: null };
        periodsMap[p][sideKey] = ls.value;
      }
    }

    const quarterStrings = { first: null, second: null, third: null, fourth: null, ot1: null, ot2: null, ot3: null, ot4: null };
    Object.entries(periodsMap).forEach(([p, scores]) => {
      const h = scores.home !== null ? scores.home : "-";
      const a = scores.away !== null ? scores.away : "-";
      const str = `${h}-${a}`;
      switch (p) {
        case "1": quarterStrings.first = str; break;
        case "2": quarterStrings.second = str; break;
        case "3": quarterStrings.third = str; break;
        case "4": quarterStrings.fourth = str; break;
        case "5": quarterStrings.ot1 = str; break;
        case "6": quarterStrings.ot2 = str; break;
        case "7": quarterStrings.ot3 = str; break;
        case "8": quarterStrings.ot4 = str; break;
        default: break;
      }
    });

    // Season text: NBA/NHL span calendar years (2023-24), NFL uses start year
    let startYear, endYear, seasonText;
    if (leagueSlug !== "nfl") {
      endYear = event.season.year;
      startYear = endYear - 1;
      seasonText = `${startYear}-${String(endYear).slice(-2)}`;
    } else {
      startYear = event.season.year;
      endYear = startYear + 1;
      seasonText = `${startYear}-${String(endYear).slice(-2)}`;
    }

    // Game label from ESPN notes (type 1 = preseason, type 3 = playoffs)
    const gameLabel =
      event.season?.type === 1
        ? "Preseason"
        : (event.competitions?.[0]?.notes?.[0]?.headline || null);

    // Derive structured game type
    let gameType;
    if (preserveExistingTeam) {
      gameType = "other";
    } else if (event.season?.type === 1) {
      gameType = "preseason";
    } else if (event.season?.type === 3) {
      const headline = (gameLabel || "").toLowerCase();
      if (headline.includes("nba finals") || headline.includes("stanley cup") || headline.includes("super bowl")) {
        gameType = "final";
      } else if (headline.includes("makeup")) {
        gameType = "makeup";
      } else {
        gameType = "playoff";
      }
    } else {
      const headline = (gameLabel || "").toLowerCase();
      if (headline.includes("play-in")) {
        gameType = "playoff";
      } else {
        gameType = headline.includes("makeup") ? "makeup" : "regular";
      }
    }

    const gamePayload = {
      eventid: espnEventId,
      date: localDate,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      venue,
      broadcast,
      quarters: quarterStrings,
      status,
      seasonText,
      gameLabel,
      currentPeriod,
      clock,
      startTime,
      gameType,
    };


    const existingGame = await getExistingGameStatus(client, homeTeamId, awayTeamId, localDate, leagueSlug);
    const gameId = await upsertGame(client, leagueSlug, gamePayload);
    runStats.gamesProcessed++;

    if (existingGame.exists && existingGame.isFinal && !force) {
      const { rows } = await client.query(
        "SELECT COUNT(*) AS cnt FROM stats WHERE gameid = $1",
        [existingGame.gameId],
      );
      const statCount = parseInt(rows[0].cnt, 10);
      const minRows = MIN_STAT_ROWS[leagueSlug] ?? 10;
      if (statCount >= minRows) {
        incrementSkippedFinal();
        await client.query("COMMIT");
        return gameId;
      }
      log.info(
        { espnEventId, statCount, minRows, league: leagueSlug },
        "final game has low stat count — reprocessing",
      );
      // fall through to boxscore fetch
    }

    // Fetch boxscore
    const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(leagueSlug)}/${leagueSlug}/summary?event=${espnEventId}`;
    let statsResp;
    try {
      statsResp = await withRetry(() => axios.get(boxscoreUrl), {
        retries: 3,
        baseDelayMs: process.env.NODE_ENV === "test" ? 0 : 2000,
        label: `boxscore:${leagueSlug}:${espnEventId}`,
      });
    } catch (err) {
      log.warn({ err }, "No boxscore available after retries");
      await client.query("COMMIT");
      return gameId;
    }

    const playerGroups = statsResp.data.boxscore?.players || [];

    await upsertPlays(
      client,
      gameId,
      statsResp.data,
      leagueSlug,
      homeTeamId,
      awayTeamId,
      parseInt(homeComp.team.id, 10),
      parseInt(awayComp.team.id, 10),
    );

    try {
      for (const group of playerGroups) {
        const espnGroupTeamId = String(group.team.id);
        const teamIdForPlayer = espnGroupTeamId === String(homeComp.team.id) ? homeTeamId : awayTeamId;
        const statCategories = group.statistics || [];

        for (const cat of statCategories) {
          let statNames;
          if (leagueSlug === "nfl") {
            statNames = Array.isArray(cat.keys)
              ? cat.labels
              : Array.isArray(cat.descriptions)
                ? cat.descriptions
                : cat.names || [];
          } else {
            statNames = Array.isArray(cat.keys)
              ? cat.keys
              : Array.isArray(cat.descriptions)
                ? cat.descriptions
                : cat.names || [];
          }

          for (const athleteEntry of cat.athletes || []) {
            if (athleteEntry.didNotPlay) continue;
            const espnId = athleteEntry.athlete?.id;
            if (!espnId) continue;

            const detailedAthlete = await getCachedPlayerDetails(client, espnId, leagueSlug);
            const fallbackName = athleteEntry.athlete.displayName || "Unknown";
            const playerObj = {
              id: detailedAthlete?.id || espnId,
              name: detailedAthlete?.displayName || fallbackName,
              position: detailedAthlete?.position?.abbreviation || athleteEntry.athlete.position?.abbreviation || null,
              height: detailedAthlete?.displayHeight || "N/A",
              weight: detailedAthlete?.displayWeight || "N/A",
              birthdate: detailedAthlete?.displayDOB || "N/A",
              image_url: detailedAthlete?.headshot?.href || "https://www.press-seal.com/wp-content/uploads/2016/10/img-team-GENERIC.jpg",
              draftinfo: detailedAthlete?.displayDraft || "Undrafted",
              jerseynum: detailedAthlete?.jersey || athleteEntry.athlete.jersey || null,
              birthplace: detailedAthlete?.displayBirthPlace || null,
              age: detailedAthlete?.age || null,
            };

            const playerId = await upsertPlayer(client, playerObj, teamIdForPlayer, leagueSlug, { preserveExistingTeam });
            runStats.playersUpserted++;

            const rawStatsObj = { gameid: gameId };
            const statValues = athleteEntry.stats || [];
            statNames.forEach((label, idx) => {
              if (!label) return;
              rawStatsObj[label.trim()] = statValues[idx] === "" ? null : statValues[idx];
            });
            const mappedStats = mapStatsToSchema(rawStatsObj, leagueSlug);
            await upsertStat(client, gameId, playerId, teamIdForPlayer, mappedStats);
            runStats.statsUpserted++;
          }
        }
      }
      await client.query("COMMIT");
      return gameId;
    } catch (err) {
      // eslint-disable-next-line no-empty
      try { await client.query("ROLLBACK"); } catch (_) {}
      throw err; // propagate so runDateRangeProcessing retry wrapper can handle deadlocks
    }
  } catch (err) {
    if (err.code !== "40P01") log.error({ err }, "processEvent error");
    // eslint-disable-next-line no-empty
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  }
}

/**
 * Process one full day's worth of events for one league.
 * Historical scripts call this repeatedly for each date.
 */
export async function runDateRangeProcessing(
  leagueSlug,
  dateStrings,
  pool,
  { batchSize = 5, batchDelayMs = 0, force = false } = {},
) {
  log.info({ league: leagueSlug, dates: dateStrings.length }, "starting import");

  let lastLoggedMonth = null;

  for (let i = 0; i < dateStrings.length; i++) {
    const date = dateStrings[i];
    const month = date.slice(0, 6); // YYYYMM
    if (month !== lastLoggedMonth) {
      log.info({ league: leagueSlug, month: `${date.slice(0, 4)}-${date.slice(4, 6)}` }, "processing month");
      lastLoggedMonth = month;
    }
    const events = await getEventsByDate(date, leagueSlug);
    for (let j = 0; j < events.length; j += batchSize) {
      const batch = events.slice(j, j + batchSize);

      await Promise.all(
        batch.map(async (event) => {
          const MAX_DEADLOCK_RETRIES = 3;
          for (let attempt = 1; attempt <= MAX_DEADLOCK_RETRIES; attempt++) {
            const client = await pool.connect();
            try {
              await processEvent(client, leagueSlug, event, { force });
              return;
            } catch (err) {
              if (err.code === "40P01" && attempt < MAX_DEADLOCK_RETRIES) {
                const delay = 250 * attempt;
                log.warn({ eventId: event.id, attempt, delayMs: delay }, "deadlock detected, retrying");
                await new Promise((r) => setTimeout(r, delay));
              } else {
                log.error({ err, eventId: event.id }, "error processing event");
                return;
              }
            } finally {
              client.release();
            }
          }
        }),
      );

      if (batchDelayMs > 0 && j + batchSize < events.length) {
        await new Promise((r) => setTimeout(r, batchDelayMs));
      }
    }
  }
  log.info({ league: leagueSlug }, "finished import");
}

/**
 * Process "today's" events for one league.
 * Hourly sync calls this once per league.
 */
export async function runTodayProcessing(leagueSlug, pool) {
  const events = await getTodayEvents(leagueSlug);

  for (const event of events) {
    const client = await pool.connect();
    try {
      await processEvent(client, leagueSlug, event);
    } finally {
      client.release();
    }
  }
}

/**
 * Fetch and upsert upcoming games for the next 14 days.
 * Prevents the "morning gap" where ESPN's parameterless scoreboard stops
 * returning today's (now-final) games before it starts returning tomorrow's.
 */
export async function runUpcomingProcessing(leagueSlug, pool) {
  const nowEST = DateTime.now().setZone("America/New_York");

  const dateStrings = [];
  for (let i = 1; i <= 14; i++) {
    dateStrings.push(nowEST.plus({ days: i }).toFormat("yyyyMMdd"));
  }

  const BATCH_SIZE = 3;
  const seenIds = new Set();
  const upcomingEvents = [];

  for (let i = 0; i < dateStrings.length; i += BATCH_SIZE) {
    const batch = dateStrings.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((d) => getEventsByDate(d, leagueSlug)));
    for (const events of results) {
      for (const event of events) {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          upcomingEvents.push(event);
        }
      }
    }
  }

  log.info(
    { league: leagueSlug, count: upcomingEvents.length, from: dateStrings[0], to: dateStrings[dateStrings.length - 1] },
    "found upcoming games",
  );

  for (const event of upcomingEvents) {
    const client = await pool.connect();
    try {
      await processEvent(client, leagueSlug, event);
    } finally {
      client.release();
    }
  }
}
