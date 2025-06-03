import axios from "axios";
import { Pool } from "pg";
import mapStatsToSchema from "./mapStatsToSchema.js";

import upsertTeam from "./upsertTeam.js";
import upsertPlayer from "./upsertPlayer.js";
import upsertStat from "./upsertStat.js";
import upsertGame from "./upsertGame.js";


export function getSportPath(leagueSlug) {
  switch (leagueSlug.toLowerCase()) {
    case "nba":
      return "basketball";
    case "nfl":
      return "football";
    case "nhl":
      return "hockey";
    default:
      throw new Error(`Unsupported league: ${leagueSlug}`);
  }
}

/**
 * 3) Utility: fetch detailed player info from ESPN API
 */
export async function fetchPlayerDetails(espnId, leagueSlug) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/${path}/${leagueSlug}/athletes/${espnId}`;
  try {
    const resp = await axios.get(url);
    return resp.data.athlete || null;
  } catch (err) {
    // If ESPN returns 404 or similar, skip details
    console.warn(`⚠️ [fetchPlayerDetails] could not fetch athlete ${espnId}: ${err.message}`);
    return null;
  }
}

/**
 * 4a) Fetch all events for a specific date (YYYYMMDD) and league
 *     → Returns an array of ESPN “event” objects
 */
export async function getEventsByDate(dateString, leagueSlug) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/${leagueSlug}/scoreboard?dates=${dateString}`;
  try {
    const resp = await axios.get(url);
    return resp.data.events || [];
  } catch (err) {
    console.error(`🔴 [getEventsByDate] error fetching ${dateString} ${leagueSlug}: ${err.message}`);
    return [];
  }
}

/**
 * 4b) Fetch “today’s” events (live + scheduled) for a league
 *     → No ?dates parameter means “today”
 */
export async function getTodayEvents(leagueSlug) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/${leagueSlug}/scoreboard`;
  try {
    const resp = await axios.get(url);
    return resp.data.events || [];
  } catch (err) {
    console.error(`🔴 [getTodayEvents] error fetching today’s ${leagueSlug}: ${err.message}`);
    return [];
  }
}

/**
 * 5) processEvent: do everything necessary to upsert one event into Postgres.
 *
 *    5a) Upsert home + away teams
 *    5b) Construct a game payload, upsert that
 *    5c) Fetch the boxscore summary, then upsert each player + stats
 *
 *    Returns the game’s internal PK (from upsertGameCore).
 */
export async function processEvent(client, leagueSlug, event) {
  // 5a) Ensure event.id is a number
  const espnEventId = parseInt(event.id, 10);
  if (Number.isNaN(espnEventId)) {
    console.warn(`⚠️ [processEvent] invalid event.id (“${event.id}”) → skipping`);
    return null;
  }

  // Extract date portion YYYY-MM-DD
  const isoDateOnly = event.date.slice(0, 10);
  const comps = event.competitions?.[0]?.competitors || [];
  const homeComp = comps.find((c) => c.homeAway === "home");
  const awayComp = comps.find((c) => c.homeAway === "away");
  if (!homeComp || !awayComp) {
    console.warn(`⚠️ [processEvent] missing home/away for event ${espnEventId}`);
    return null;
  }

  // BEGIN a transaction
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = 0");

  const homeTeamData = {
        name: homeComp.team.displayName,
        shortname: homeComp.team.name,
        location: homeComp.team.location,
        logo_url: homeComp.team.logo,
        record: homeComp.records?.[0]?.summary || "0-0",
        homerecord: homeComp.records?.find((r) => r.type === "home")?.summary || "0-0",
        awayrecord: homeComp.records?.find((r) => r.type === "road")?.summary || "0-0",
      };

      const awayTeamData = {
        name: awayComp.team.displayName,
        shortname: awayComp.team.name,
        location: awayComp.team.location,
        logo_url: awayComp.team.logo,
        record: awayComp.records?.[0]?.summary || "0-0",
        homerecord: awayComp.records?.find((r) => r.type === "home")?.summary || "0-0",
        awayrecord: awayComp.records?.find((r) => r.type === "road")?.summary || "0-0",
      }

    

  try {
    // ── Upsert HOME team ──
    const homeTeamId = await upsertTeam(
      client,
      parseInt(homeComp.team.id, 10),
      leagueSlug,
      homeTeamData
    );


    // ── Upsert AWAY team ──
    const awayTeamId = await upsertTeam(
      client,
      parseInt(awayComp.team.id, 10),
      leagueSlug,
      awayTeamData
    );



// 5.4.5) Extract scores (if present)
      const homeScore = (homeComp.score !== undefined) ? parseInt(homeComp.score, 10) : null;
      const awayScore = (awayComp.score !== undefined) ? parseInt(awayComp.score, 10) : null;

      // 5.4.6) Venue & broadcast
      const venue = event.competitions[0].venue
        ? event.competitions[0].venue.fullName
        : null;

      let broadcast = null;
      if (event.competitions[0].broadcast) {
        broadcast = event.competitions[0].broadcast;
      } else if (event.broadcasts && event.broadcasts.length) {
        broadcast = event.broadcasts.map(b => b.names.join('/')).join(', ');
      }

      // 5.4.7) Status (SCHEDULED, IN, FINAL, etc.)
      const status = (event.status && event.status.type)
        ? event.status.type.description
        : null;

      // 5.4.8) Build quarter/period scores (if available)
      const periodsMap = {};
      for (const teamComp of comps) {
        if (!teamComp.linescores) continue;
        const sideKey = (teamComp.homeAway === 'home') ? 'home' : 'away';
        for (const ls of teamComp.linescores) {
          const p = ls.period.toString();
          if (!periodsMap[p]) {
            periodsMap[p] = { home: null, away: null };
          }
          periodsMap[p][sideKey] = ls.value;
        }
      }

      const quarterStrings = {
        first:  null,
        second: null,
        third:  null,
        fourth: null,
        ot1:    null,
        ot2:    null,
        ot3:    null,
        ot4:    null,
      };
      Object.entries(periodsMap).forEach(([p, scores]) => {
        const h = (scores.home !== null) ? scores.home : '-';
        const a = (scores.away !== null) ? scores.away : '-';
        const str = `${h}-${a}`;
        switch (p) {
          case '1': quarterStrings.first  = str; break;
          case '2': quarterStrings.second = str; break;
          case '3': quarterStrings.third  = str; break;
          case '4': quarterStrings.fourth = str; break;
          case '5': quarterStrings.ot1    = str; break;
          case '6': quarterStrings.ot2    = str; break;
          case '7': quarterStrings.ot3    = str; break;
          case '8': quarterStrings.ot4    = str; break;
          default:  break;
        }
      });
      const seasonTypeCode = event.season.type.id;

      // 5.4.9) Season text (“YYYY-reg” or “YYYY-post”)
      const seasonYear = event.season.year;
      const seasonText = (seasonTypeCode === 3)
        ? `${seasonYear}-post`
        : `${seasonYear}-reg`;

      // 5.4.10) Upsert into games
      const gamePayload = {
        eventid: espnEventId,
        date:       isoDateOnly,
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        venue,
        broadcast,
        quarters:   quarterStrings,
        status,
        seasonText,
      };
      const gameId = await upsertGame(client, leagueSlug, gamePayload);

    // ── Fetch boxscore summary to upsert player stats ──
    const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(
      leagueSlug
    )}/${leagueSlug}/summary?event=${espnEventId}`;

    let statsResp;
    try {
      statsResp = await axios.get(boxscoreUrl);
    } catch (err) {
      console.warn(`⚠️ [processEvent] no boxscore for ${espnEventId}: ${err.message}`);
      // We still want to commit the game row even if stats fail
      await client.query("COMMIT");
      return gameId;
    }

    const playerGroups = statsResp.data.boxscore?.players || [];
    for (const group of playerGroups) {
      // figure out if this group is HOME or AWAY
      const espnGroupTeamId = String(group.team.id);
      const teamIdForPlayer =
        espnGroupTeamId === String(homeComp.team.id) ? homeTeamId : awayTeamId;

      const statNames = group.statistics?.[0]?.names || [];
      const athletes = group.statistics?.[0]?.athletes || [];

      for (const athleteEntry of athletes) {
        if (athleteEntry.didNotPlay) continue; // skip DNP
        const espnId = athleteEntry.athlete?.id;
        if (!espnId) continue;

        // 5a) Fetch more player details if needed
        const detailedAthlete = await fetchPlayerDetails(espnId, leagueSlug).catch(() => null);
        const fallbackName = athleteEntry.athlete.displayName || "Unknown";

        const playerObj = {
          id: detailedAthlete?.id || espnId,
          name: detailedAthlete?.displayName || fallbackName,
          position:
            detailedAthlete?.position?.abbreviation ||
            athleteEntry.athlete.position?.abbreviation ||
            null,
          height: detailedAthlete?.displayHeight || null,
          weight: detailedAthlete?.displayWeight || null,
          birthdate: detailedAthlete?.displayDOB || null,
          image_url: detailedAthlete?.headshot?.href || null,
          draftinfo: detailedAthlete?.displayDraft || null,
          jerseynum: detailedAthlete?.jersey || athleteEntry.athlete.jersey || null,
          birthplace: detailedAthlete?.displayBirthPlace || null,
          age: detailedAthlete?.age || null,
        };
        // 5b) Upsert the player
        const playerId = await upsertPlayer(client, playerObj, teamIdForPlayer, leagueSlug);

        // 5c) Build raw stats object and map it
        const rawStatsObj = { gameid: gameId };
        const statValues = athleteEntry.stats || [];
        statNames.forEach((label, idx) => {
          if (!label) return;
          rawStatsObj[label.trim()] = statValues[idx] === "" ? null : statValues[idx];
        });

        const mappedStats = mapStatsToSchema(rawStatsObj, leagueSlug);

        // 5d) Upsert the stat row
        await upsertStat(client, gameId, playerId, mappedStats);
      }
    }

    // Everything succeeded → commit
    await client.query("COMMIT");
    return gameId;
  } catch (err) {
    await client.query("ROLLBACK");
    return null;
  }
}

/**
 * 6) Convenience: process one full day’s worth of events for one league
 *    (historical script will call this repeatedly for each date)
 */
export async function runDateRangeProcessing(leagueSlug, dateStrings, pool) {
  console.log(`▶ Starting import for ${leagueSlug}: ${dateStrings.length} dates`);
  for (let i = 0; i < dateStrings.length; i++) {
    const date = dateStrings[i];
    const events = await getEventsByDate(date, leagueSlug);

    for (const event of events) {
      const client = await pool.connect();
      try {
        await processEvent(client, leagueSlug, event);
      } finally {
        client.release();
      }
    }
  }
  console.log(`✅ Finished import for ${leagueSlug}`);
}

/**
 * 7) Convenience: process “today’s” events for one league
 *    (hourly script will call this once per league)
 */
export async function runTodayProcessing(leagueSlug, pool) {
  console.log(`▶ Starting “today’s” import for ${leagueSlug}`);
  const events = await getTodayEvents(leagueSlug);
  console.log(`  • Found ${events.length} events for today (${leagueSlug})`);

  for (const event of events) {
    const client = await pool.connect();
    try {
      await processEvent(client, leagueSlug, event);
    } finally {
      client.release();
    }
  }
  console.log(`✅ Finished “today’s” import for ${leagueSlug}`);
}