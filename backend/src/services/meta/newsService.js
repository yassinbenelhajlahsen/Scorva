import axios from "axios";
import { getSportPath } from "../../utils/sportPath.js";
import { withRetry } from "../../ingestion/espn/espnAPIClient.js";
import { cached } from "../../cache/cache.js";
import logger from "../../logger.js";

const log = logger.child({ module: "newsService" });
const LEAGUES = ["nba", "nfl", "nhl"];

const ROUNDUP_PATTERNS = [
  /\bbuzz\b/i,
  /\btracker\b/i,
  /\blatest\b.*\bupdates?\b/i,
  /\bfantasy\b.*\bpicks?\b/i,
  /\bdfs\b/i,
  /\bbetting\b/i,
  /\bdraft profile\b/i,
  /\bpodcast\b/i,
  /\brankings?\b/i,
  /\bmock draft\b/i,
];

function isRoundup(headline) {
  return ROUNDUP_PATTERNS.some((re) => re.test(headline));
}

function buildUrl(league) {
  const sport = getSportPath(league);
  return `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/news?limit=12`;
}

export function validUrl(str) {
  try {
    return str && new URL(str).protocol.startsWith("http") ? str : null;
  } catch {
    return null;
  }
}

function mapArticle(raw, league) {
  return {
    headline: raw.headline,
    description: raw.description ?? "",
    url: validUrl(raw.links?.web?.href),
    imageUrl: validUrl(raw.images?.[0]?.url),
    published: raw.published ?? null,
    league,
  };
}

async function fetchAllNews() {
  const results = await Promise.allSettled(
    LEAGUES.map((league) =>
      withRetry(
        () => axios.get(buildUrl(league)).then((r) => r.data),
        { retries: 2, label: `news:${league}` },
      ).then((data) =>
        (data.articles ?? [])
          .filter((a) => !isRoundup(a.headline))
          .map((a) => mapArticle(a, league)),
      ),
    ),
  );

  const articles = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      log.warn({ err: result.reason?.message }, "failed to fetch league news");
    }
  }

  articles.sort((a, b) => new Date(b.published) - new Date(a.published));

  // Guarantee at least 1 article per league in the top results
  const picked = [];
  const seen = new Set();
  for (const league of LEAGUES) {
    const first = articles.find((a) => a.league === league);
    if (first) { picked.push(first); seen.add(first); }
  }
  for (const article of articles) {
    if (picked.length >= 10) break;
    if (!seen.has(article)) picked.push(article);
  }

  return picked;
}

export async function getNews() {
  return cached("news:headlines", 300, fetchAllNews, {
    cacheIf: (d) => d.length > 0,
  });
}
