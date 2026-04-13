import axios from "axios";
import logger from "../../logger.js";
import { getSportPath } from "../../utils/sportPath.js";

const log = logger.child({ worker: "eventProcessor" });

export { getSportPath };

/**
 * Retry wrapper for ESPN API calls.
 * On 429 responses, backs off harder (15s × attempt) to respect rate limits.
 * On other errors, uses exponential backoff (baseDelayMs × 2^(attempt-1)).
 */
export async function withRetry(fn, { retries = 3, baseDelayMs = process.env.NODE_ENV === "test" ? 0 : 1500, label = "" } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const is429 = err?.response?.status === 429;
      const delay = is429
        ? 15000 * attempt
        : baseDelayMs * 2 ** (attempt - 1);
      log.warn(
        { label, attempt, delayMs: delay, status: err?.response?.status },
        "retrying ESPN fetch",
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Fetch all events for a specific date (YYYYMMDD) and league.
 */
export async function getEventsByDate(dateString, leagueSlug) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/${leagueSlug}/scoreboard?dates=${dateString}`;
  try {
    const resp = await withRetry(() => axios.get(url), {
      label: `scoreboard:${leagueSlug}:${dateString}`,
    });
    return resp.data.events || [];
  } catch (err) {
    log.error({ err, date: dateString, league: leagueSlug }, "error fetching events by date");
    return [];
  }
}

/**
 * Fetch "today's" events (live + scheduled) for a league.
 * No ?dates parameter means "today" from ESPN's perspective.
 */
export async function getTodayEvents(leagueSlug) {
  const path = getSportPath(leagueSlug);
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/${leagueSlug}/scoreboard`;
  try {
    const resp = await axios.get(url);
    return resp.data.events || [];
  } catch (err) {
    log.error({ err, league: leagueSlug }, "error fetching today's events");
    return [];
  }
}
