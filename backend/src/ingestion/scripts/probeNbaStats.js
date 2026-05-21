// Probe stats.nba.com reachability from the host running this script.
// Run on Railway: `railway run node src/ingestion/scripts/probeNbaStats.js`
// Run locally:   `node backend/src/ingestion/scripts/probeNbaStats.js`
//
// Exits 0 if stats.nba.com/videodetailsasset returns a parseable JSON body that
// resolves to a videos.nba.com mp4 URL. Anything else (timeout, 4xx, 5xx, empty
// body, missing URL) exits non-zero. Prints a single PASS/FAIL summary.

import axios from "axios";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Connection: "keep-alive",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
  "Sec-Fetch-Site": "same-site",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

// CLE @ NYK 2026 ECF Game 1 — playoff game with video on every made shot.
// Override via CLI: node probeNbaStats.js <gameId> <gameEventId>
const GAME_ID = process.argv[2] || "0042500301";
const EVENT_ID = process.argv[3] || "100";
const TIMEOUT_MS = 15_000;

async function timed(label, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    return { label, ok: true, ms: Date.now() - start, ...result };
  } catch (err) {
    return {
      label,
      ok: false,
      ms: Date.now() - start,
      status: err.response?.status ?? null,
      code: err.code ?? null,
      message: err.message,
    };
  }
}

async function getEgressIp() {
  return timed("egress IP", async () => {
    const { data } = await axios.get("https://api.ipify.org?format=json", {
      timeout: 5000,
    });
    return { body: data };
  });
}

async function probeCdnControl() {
  // cdn.nba.com is a different host on a different egress reputation.
  // If this also fails the issue is the network in general, not the IP block.
  return timed("cdn.nba.com control", async () => {
    const { status, data } = await axios.get(
      "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json",
      { headers: HEADERS, timeout: TIMEOUT_MS, responseType: "json" }
    );
    return {
      status,
      gameCount: data?.scoreboard?.games?.length ?? null,
    };
  });
}

async function probeVideoDetailsAsset() {
  return timed("stats.nba.com/videodetailsasset", async () => {
    const url =
      `https://stats.nba.com/stats/videodetailsasset` +
      `?GameID=${GAME_ID}&GameEventID=${EVENT_ID}` +
      `&PlayerID=0&ContextMeasure=FGM` +
      `&LastNGames=0&LeagueID=00&Month=0&OpponentTeamID=0` +
      `&Period=0&Season=2025-26&SeasonType=Playoffs&TeamID=0&VsConference=&VsDivision=`;
    const { status, data } = await axios.get(url, {
      headers: HEADERS,
      timeout: TIMEOUT_MS,
      responseType: "json",
    });
    const videoUrls = data?.resultSets?.Meta?.videoUrls ?? [];
    const first = videoUrls[0] ?? null;
    return {
      status,
      videoUrlCount: videoUrls.length,
      lurl: first?.lurl ?? null,
      sample: first ? JSON.stringify(first).slice(0, 200) : null,
    };
  });
}

async function probeCdnMp4(url) {
  if (!url) return null;
  return timed("videos.nba.com mp4 HEAD", async () => {
    const { status, headers } = await axios.head(url, {
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
    });
    return { status, contentType: headers["content-type"] ?? null };
  });
}

function printRow(r) {
  const tag = r.ok ? "OK " : "FAIL";
  const status = r.status != null ? `HTTP ${r.status}` : r.code || "no-response";
  const extra = [
    r.gameCount != null && `games=${r.gameCount}`,
    r.videoUrlCount != null && `videoUrls=${r.videoUrlCount}`,
    r.lurl && `mp4=${r.lurl.slice(0, 80)}...`,
    r.contentType && `ct=${r.contentType}`,
    r.body && `body=${JSON.stringify(r.body)}`,
    !r.ok && r.message && `err="${r.message.slice(0, 100)}"`,
  ]
    .filter(Boolean)
    .join(" ");
  console.log(`[${tag}] ${r.label.padEnd(34)} ${String(r.ms).padStart(5)}ms ${status.padEnd(14)} ${extra}`);
}

async function main() {
  console.log(`Probing stats.nba.com — gameId=${GAME_ID} eventId=${EVENT_ID}`);
  console.log("");

  const egress = await getEgressIp();
  printRow(egress);

  const control = await probeCdnControl();
  printRow(control);

  const stats = await probeVideoDetailsAsset();
  printRow(stats);

  const cdn = await probeCdnMp4(stats.lurl);
  if (cdn) printRow(cdn);

  console.log("");
  const passed =
    stats.ok &&
    stats.videoUrlCount > 0 &&
    !!stats.lurl &&
    cdn?.ok &&
    cdn.status >= 200 &&
    cdn.status < 400;

  if (passed) {
    console.log("PASS — stats.nba.com is reachable and the CDN URL plays.");
    process.exit(0);
  }
  console.log("FAIL — see rows above.");
  console.log("");
  console.log("Common signatures:");
  console.log("  HTTP code=ECONNABORTED / no-response  → IP block (silent timeout)");
  console.log("  HTTP 403                              → IP block (returned)");
  console.log("  HTTP 200 + videoUrls=0                → endpoint reached but no clip for this event");
  console.log("  cdn.nba.com control FAIL              → general network issue, not an NBA block");
  process.exit(1);
}

main().catch((err) => {
  console.error("probe crashed:", err);
  process.exit(2);
});
