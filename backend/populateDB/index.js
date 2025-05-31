/**
 * index.js
 *
 * A universal importer for ESPN’s “hidden” API that can backfill historical games
 * and fetch today’s scheduled/live/final contests for multiple leagues (NBA, NFL, NHL, MLB).
 *
 * Requirements:
 *   - Node.js
 *   - npm packages: axios, pg, dotenv
 *   - A PostgreSQL database defined by your schema, with:
 *       • teams table (with UNIQUE espnid)
 *       • games table (with UNIQUE espn_event_id)
 *     See comments in upsertTeam/upsertGame below for exact columns.
 *
 * Usage:
 *   1. Populate your .env with:
 *        DB_URL=postgres://<user>:<pass>@<host>:<port>/<database>
 *   2. Run `npm install axios pg dotenv`
 *   3. Run `node index.js`
 *
 * The script will:
 *   1. Backfill each league’s historical season (date range configurable below).
 *   2. Fetch “today’s” games (scheduled/live/final) for each league and upsert them.
 *   3. Skip preseason contests (season.type.id === 1).
 *   4. Upsert teams and games by ESPN IDs, ensuring no duplicates.
 */

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

// --- 1) Initialize Postgres Pool ---
const pool = new Pool({
  connectionString: process.env.DB_URL,
});

// --- 2) Helper: Upsert a team into `teams` ---
// Assumes your `teams` table has at least these columns:
//   id        SERIAL PRIMARY KEY,
//   espnid    INTEGER UNIQUE,         -- ESPN’s team ID (globally unique across leagues)
//   league    TEXT      NOT NULL,     -- e.g. 'nba', 'nfl', 'nhl', 'mlb'
//   name      TEXT      NOT NULL,
//   shortname TEXT,
//   location  TEXT,
//   logo_url  TEXT
//
// And a UNIQUE constraint on espnid alone: 
//   ALTER TABLE teams ADD CONSTRAINT teams_espnid_unique UNIQUE (espnid);
async function upsertTeam(client, espnId, league, teamInfo) {
  const text = `
    INSERT INTO teams
      (espnid, league, name, shortname, location, logo_url, record, homerecord, awayrecord)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (espnid, league ) DO UPDATE
      SET name       = EXCLUDED.name,
          league     = EXCLUDED.league,
          shortname  = EXCLUDED.shortname,
          location   = EXCLUDED.location,
          logo_url   = EXCLUDED.logo_url,
          record     = EXCLUDED.record,
          homerecord = EXCLUDED.homerecord,
          awayrecord = EXCLUDED.awayrecord
    RETURNING id;
  `;
  const values = [
    espnId,
    league,
    teamInfo.displayName,                // $3 → “name”
    teamInfo.shortDisplayName || null,    // $4 → “shortname”
    teamInfo.location      || null,       // $5 → “location”
    teamInfo.logoUrl       || null,       // $6 → “logo_url”
    teamInfo.record,  
    teamInfo.homerecord    || null,       // $7 → “homerecord”
    teamInfo.awayrecord    || null        // $8 → “awayrecord”
  ];

  const res = await client.query(text, values);
  return res.rows[0].id;
}





// --- 3) Helper: Upsert a game into `games` ---
// Assumes your `games` table has at least these columns:
//   id             SERIAL PRIMARY KEY,
//   espn_event_id  INTEGER  UNIQUE,       -- ESPN’s unique game ID
//   league         TEXT      NOT NULL,    -- 'nba', 'nfl', 'nhl'
//   date           DATE      NOT NULL,    -- calendar date (YYYY-MM-DD)
//   hometeamid     INTEGER   NOT NULL REFERENCES teams(id),
//   awayteamid     INTEGER   NOT NULL REFERENCES teams(id),
//   homescore      INTEGER,
//   awayscore      INTEGER,
//   venue          TEXT,
//   broadcast      TEXT,
//   firstqtr       TEXT,
//   secondqtr      TEXT,
//   thirdqtr       TEXT,
//   fourthqtr      TEXT,
//   ot1            TEXT,
//   ot2            TEXT,
//   ot3            TEXT,
//   ot4            TEXT,
//   status         TEXT,                   -- 'SCHEDULED', 'IN', 'FINAL', etc.
//   season         TEXT                    -- '2016-reg', '2026-post', etc.
//
// And a UNIQUE constraint on espn_event_id:
//   ALTER TABLE games ADD CONSTRAINT games_espn_event_unique UNIQUE (espn_event_id);
async function upsertGame(client, league, gamePayload) {
  const text = `
    INSERT INTO games
      (date, hometeamid, awayteamid, league,
       homescore, awayscore, venue, broadcast,
       firstqtr, secondqtr, thirdqtr, fourthqtr,
       ot1, ot2, ot3, ot4,
       status, season)
    VALUES
      ($1,       $2,         $3,          $4,
       $5,       $6,         $7,          $8,
       $9,       $10,        $11,         $12,
       $13,      $14,        $15,         $16,
       $17,      $18)
    ON CONFLICT (date, hometeamid, awayteamid, league) DO UPDATE
      SET homescore  = EXCLUDED.homescore,
          awayscore  = EXCLUDED.awayscore,
          venue      = EXCLUDED.venue,
          broadcast  = EXCLUDED.broadcast,
          firstqtr   = EXCLUDED.firstqtr,
          secondqtr  = EXCLUDED.secondqtr,
          thirdqtr   = EXCLUDED.thirdqtr,
          fourthqtr  = EXCLUDED.fourthqtr,
          ot1        = EXCLUDED.ot1,
          ot2        = EXCLUDED.ot2,
          ot3        = EXCLUDED.ot3,
          ot4        = EXCLUDED.ot4,
          status     = EXCLUDED.status,
          season     = EXCLUDED.season;
  `;

  const values = [
    gamePayload.date,         // e.g. '2025-05-30'
    gamePayload.homeTeamId,
    gamePayload.awayTeamId,
    league,                   // 'nba', 'nfl', etc.
    gamePayload.homeScore,
    gamePayload.awayScore,
    gamePayload.venue,
    gamePayload.broadcast,
    gamePayload.quarters.first   || null,
    gamePayload.quarters.second  || null,
    gamePayload.quarters.third   || null,
    gamePayload.quarters.fourth  || null,
    gamePayload.quarters.ot1     || null,
    gamePayload.quarters.ot2     || null,
    gamePayload.quarters.ot3     || null,
    gamePayload.quarters.ot4     || null,
    gamePayload.status,        // 'SCHEDULED' / 'IN' / 'FINAL'
    gamePayload.seasonText     // '2024-reg' / '2024-post'
  ];

  await client.query(text, values);
}


// --- 4) Helper: Generate all dates between two ISO strings (inclusive) ---
// Returns an array of strings in 'YYYYMMDD' format for each day between startISO and endISO.
function getAllDatesInRange(startISO, endISO) {
  const dates = [];
  const curr = new Date(startISO);
  const last = new Date(endISO);

  while (curr <= last) {
    const yyyy = curr.getUTCFullYear().toString();
    const mm   = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}${mm}${dd}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

// --- 5) Core Import Function: Fetch historical + “today’s” games for a given league and date ---
// dateString: 'YYYYMMDD' for the specific date you want to backfill (UTC-based).
// leagueSlug: e.g. 'nba', 'nfl', 'nhl', 'mlb'
async function populateDateForLeague(dateString, leagueSlug) {
  // 5.1) Construct the “date-specific” URL:
  const historicalUrl = `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(leagueSlug)}/${leagueSlug}/scoreboard?dates=${dateString}`;

  // 5.2) Construct the “today’s” URL (no dates=):
  const todayUrl = `https://site.api.espn.com/apis/site/v2/sports/${getSportPath(leagueSlug)}/${leagueSlug}/scoreboard`;

  console.log(`\n---\n[${leagueSlug.toUpperCase()}] Fetching games for ${dateString} (historical)…`);
  const respHist = await axios.get(historicalUrl);
  const dataHist = respHist.data;
  console.log(`→ Historical endpoint returned ${dataHist.events.length} event(s)`);

  console.log(`[${leagueSlug.toUpperCase()}] Fetching “today’s” scoreboard (no dates=)…`);
  const respToday = await axios.get(todayUrl);
  const dataToday = respToday.data;
  console.log(`→ “Today’s” endpoint returned ${dataToday.events.length} event(s)`);

  // 5.3) Combine events into a Map keyed by espn_event_id to avoid duplicates:
  const combinedEventsMap = new Map();

  function addEvents(eventsArray) {
    for (const ev of eventsArray) {
      const key = ev.id; // ESPN’s unique game ID
      if (!combinedEventsMap.has(key)) {
        combinedEventsMap.set(key, ev);
      }
    }
  }

  addEvents(dataHist.events);
  addEvents(dataToday.events);

  const combinedEvents = Array.from(combinedEventsMap.values());
  console.log(`→ Total unique events to process for ${leagueSlug.toUpperCase()}: ${combinedEvents.length}\n`);

  // 5.4) Upsert all combined events in one transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const event of combinedEvents) {
      // 5.4.1) Skip preseason (season.type.id === 1).  
      // If the league has an in-season tournament with type.id === 4, you can skip that here as well.
      const seasonTypeCode = event.season.type.id;
      if (seasonTypeCode === 1) {
        console.log(`  → [${leagueSlug.toUpperCase()}] Skipping PRESEASON game: ${event.name}`);
        continue;
      }

      // 5.4.2) Parse essential values
      const espnEventId  = parseInt(event.id, 10);
      const isoDateOnly  = event.date.slice(0, 10); // “YYYY-MM-DD”

// 1) Grab both competitors from the first competition
const comps    = event.competitions[0].competitors;
const homeComp = comps.find(c => c.homeAway === 'home');
const awayComp = comps.find(c => c.homeAway === 'away');

// 2) Extract “overall”, “home”, and “away” from homeComp.records
//    (falling back to null if any piece is missing)
// Home team record extraction
const homeRecordsArray   = homeComp.records || [];
const homeHomeObj        = homeRecordsArray.find(r => r.type === 'home');
const homeRoadObj        = homeRecordsArray.find(r => r.type === 'road');
const homeTotalObj       = homeRecordsArray.find(r => r.type === 'total');

const homeOverallRecord  = homeTotalObj?.summary   ?? "0-0";  // e.g. "73-9"
const homeHomeRecord     = homeHomeObj?.summary     ?? "0-0";  // e.g. "39-2"
const homeAwayRecord     = homeRoadObj?.summary     ?? "0-0";  // e.g. "34-7"

// Away team record extraction
const awayRecordsArray   = awayComp.records || [];
const awayHomeObj        = awayRecordsArray.find(r => r.type === 'home');
const awayRoadObj        = awayRecordsArray.find(r => r.type === 'road');
const awayTotalObj       = awayRecordsArray.find(r => r.type === 'total');

const awayOverallRecord  = awayTotalObj?.summary   ?? "0-0";  // e.g. "73-9"
const awayHomeRecord     = awayHomeObj?.summary     ?? "0-0";  // e.g. "39-2"
const awayAwayRecord     = awayRoadObj?.summary     ?? "0-0";  // e.g. "34-7"


// 4) Build the upsert payloads. Use the same property names that your upsertTeam expects:
//    { displayName, shortDisplayName, location, logoUrl, record, homerecord, awayrecord }
const homeTeamInfo = {
  displayName:      homeComp.team.displayName,        // e.g. "Golden State Warriors"
  shortDisplayName: homeComp.team.name,   // e.g. "Warriors"
  location:         homeComp.team.location,           // e.g. "Golden State"
  logoUrl:          homeComp.team.logo,               // scoreboard‐style logo URL
  record:           homeOverallRecord,                // e.g. "3-4"
  homerecord:       homeHomeRecord,                   // e.g. "39-2"
  awayrecord:       homeAwayRecord                    // e.g. "34-7"
};

const awayTeamInfo = {
  displayName:      awayComp.team.displayName,        // e.g. "Cleveland Cavaliers"
  shortDisplayName: awayComp.team.name,   // e.g. "Cavaliers"
  location:         awayComp.team.location,           // e.g. "Cleveland"
  logoUrl:          awayComp.team.logo,
  record:           awayOverallRecord,                // e.g. "4-3"
  homerecord:       awayHomeRecord,                   // e.g. "33-8"
  awayrecord:       awayAwayRecord                    // e.g. "24-17"
};

      const homeTeamId = await upsertTeam(
        client,
        parseInt(homeComp.team.id, 10),
        leagueSlug,
        homeTeamInfo
      );

      const awayTeamId = await upsertTeam(
        client,
        parseInt(awayComp.team.id, 10),
        leagueSlug,
        awayTeamInfo
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
      await upsertGame(client, leagueSlug, gamePayload);

      console.log(
        `  • [${leagueSlug.toUpperCase()}] Upserted #${espnEventId} ` +
        `${homeComp.team.abbreviation} vs ${awayComp.team.abbreviation} ` +
        `→ status=${status}`
      );
    }

    await client.query('COMMIT');
    console.log(`  ↳ All combined ${leagueSlug.toUpperCase()} events committed.\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ⚠️ Transaction rolled back for ${leagueSlug.toUpperCase()}:`, err.message);
  } finally {
    client.release();
  }
}

// --- 6) Utility: Map a league slug to its “sport path” in the ESPN URL ---
// The URL format is: /apis/site/v2/sports/{sport}/{league}/scoreboard
// For NBA: sport is “basketball”, league is “nba”
// For NFL: sport is “football”, league is “nfl”
// For NHL: sport is “hockey”,   league is “nhl”
// For MLB: sport is “baseball”, league is “mlb”
function getSportPath(leagueSlug) {
  switch (leagueSlug.toLowerCase()) {
    case 'nba': return 'basketball';
    case 'nfl': return 'football';
    case 'nhl': return 'hockey';
    default:
      throw new Error(`Unsupported league slug: ${leagueSlug}`);
  }
}

// --- 7) Main Driver: Loop over each league, backfill historical and fetch today’s ---
// Customize each league’s season start/end as needed.
(async () => {
  // 7.1) Define the leagues and their historical season ranges:
  const leagues = [
    {
      slug:        'nba',
      seasonStart: '2024-10-22', 
      seasonEnd:   '2025-05-31'
    },
    {
      slug:        'nfl',
      seasonStart: '2024-09-03',
      seasonEnd:   '2025-02-09' 
    },
    {
      slug:        'nhl',
      seasonStart: '2024-10-01', 
      seasonEnd:   '2025-05-31'
    },
  ];

  try {
    for (const { slug: leagueSlug, seasonStart, seasonEnd } of leagues) {
      console.log(`\n============\nStarting import for ${leagueSlug.toUpperCase()} season ${seasonStart} → ${seasonEnd}\n============`);

      // 7.2) Generate all dates in the season’s range (YYYYMMDD format)
      const allDates = getAllDatesInRange(seasonStart, seasonEnd);

      // 7.3) Backfill historical games for each date
      for (const dateString of allDates) {
        await populateDateForLeague(dateString, leagueSlug);
        // Throttle requests to avoid rate‐limiting
        await new Promise((r) => setTimeout(r, 400));
      }

      // 7.4) Finally, fetch “today’s” games for this league
      const todayDateString = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      console.log(`\n[${leagueSlug.toUpperCase()}] Fetching TODAY’s games for ${todayDateString} …`);
      await populateDateForLeague(todayDateString, leagueSlug);
    }

    console.log('\n✅ All leagues processed. Database is up‐to‐date!');
  } catch (err) {
    console.error('Fatal error during import:', err.message);
  } finally {
    await pool.end();
  }
})();
