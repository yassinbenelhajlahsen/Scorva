import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

const mockAxiosGet = jest.fn();
jest.unstable_mockModule("axios", () => ({
  default: { get: mockAxiosGet },
}));

const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn, _opts) => fn());
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({
  cached: mockCached,
}));

jest.unstable_mockModule(resolve(__dirname, "../../src/utils/sportPath.js"), () => ({
  getSportPath: (league) => {
    const map = { nba: "basketball", nfl: "football", nhl: "hockey" };
    return map[league];
  },
}));

jest.unstable_mockModule(resolve(__dirname, "../../src/logger.js"), () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { getWinProbability } = await import(
  resolve(__dirname, "../../src/services/games/winProbabilityService.js")
);

const SAMPLE_PLAYS = [
  { id: "p1", homeScore: 0, awayScore: 0 },
  { id: "p2", homeScore: 5, awayScore: 3 },
  { id: "p3", homeScore: 10, awayScore: 8 },
];

const SAMPLE_WIN_PROB = [
  { homeWinPercentage: 0.65, playId: "p1" },
  { homeWinPercentage: 0.55, playId: "p2" },
  { homeWinPercentage: 0.82, playId: "p3" },
];

const SAMPLE_ESPN_RESPONSE = {
  winprobability: SAMPLE_WIN_PROB,
  plays: SAMPLE_PLAYS,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCached.mockImplementation(async (_key, _ttl, fn, _opts) => fn());
});

describe("getWinProbability — cache key and TTL", () => {
  it("uses the versioned cache key", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    await getWinProbability("nba", "401585757", false);
    expect(mockCached.mock.calls[0][0]).toBe("winprob:v2:nba:401585757");
  });

  it("uses 30-day TTL for final games", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    await getWinProbability("nba", "401585757", true);
    expect(mockCached.mock.calls[0][1]).toBe(30 * 86400);
  });

  it("uses 30-second TTL for live games", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    await getWinProbability("nba", "401585757", false);
    expect(mockCached.mock.calls[0][1]).toBe(30);
  });

  it("cacheIf returns false when data is null", async () => {
    mockAxiosGet.mockResolvedValue({ data: {} });
    await getWinProbability("nba", "401585757", true);
    const opts = mockCached.mock.calls[0][3];
    expect(opts.cacheIf(null)).toBe(false);
  });

  it("cacheIf returns true when data is an object", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    await getWinProbability("nba", "401585757", true);
    const opts = mockCached.mock.calls[0][3];
    expect(opts.cacheIf({ winProbability: [], scoreMargin: null })).toBe(true);
  });
});

describe("getWinProbability — ESPN URL construction", () => {
  it("builds the correct URL for NBA", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    await getWinProbability("nba", "401585757", true);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401585757",
      expect.objectContaining({ timeout: 10000 })
    );
  });

  it("builds the correct URL for NFL", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    await getWinProbability("nfl", "401671773", true);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401671773",
      expect.any(Object)
    );
  });

  it("builds the correct URL for NHL", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    await getWinProbability("nhl", "401559800", true);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=401559800",
      expect.any(Object)
    );
  });
});

describe("getWinProbability — data transformation", () => {
  it("returns winProbability and scoreMargin on success", async () => {
    mockAxiosGet.mockResolvedValue({ data: SAMPLE_ESPN_RESPONSE });
    const result = await getWinProbability("nba", "401585757", true);
    expect(result).toEqual({
      winProbability: [
        { homeWinPercentage: 0.65, playId: "p1" },
        { homeWinPercentage: 0.55, playId: "p2" },
        { homeWinPercentage: 0.82, playId: "p3" },
      ],
      scoreMargin: [
        { playId: "p1", margin: 0 },
        { playId: "p2", margin: 2 },
        { playId: "p3", margin: 2 },
      ],
    });
  });

  it("extracts plays from NFL drives structure", async () => {
    const nflResponse = {
      winprobability: SAMPLE_WIN_PROB,
      drives: {
        previous: [
          { plays: [SAMPLE_PLAYS[0], SAMPLE_PLAYS[1]] },
          { plays: [SAMPLE_PLAYS[2]] },
        ],
      },
    };
    mockAxiosGet.mockResolvedValue({ data: nflResponse });
    const result = await getWinProbability("nfl", "401671773", true);
    expect(result.scoreMargin).toEqual([
      { playId: "p1", margin: 0 },
      { playId: "p2", margin: 2 },
      { playId: "p3", margin: 2 },
    ]);
  });

  it("returns scoreMargin: null when no plays data", async () => {
    mockAxiosGet.mockResolvedValue({ data: { winprobability: SAMPLE_WIN_PROB } });
    const result = await getWinProbability("nba", "401585757", true);
    expect(result).toEqual({
      winProbability: [
        { homeWinPercentage: 0.65, playId: "p1" },
        { homeWinPercentage: 0.55, playId: "p2" },
        { homeWinPercentage: 0.82, playId: "p3" },
      ],
      scoreMargin: null,
    });
  });

  it("returns scoreMargin: null when plays array is empty", async () => {
    mockAxiosGet.mockResolvedValue({ data: { winprobability: SAMPLE_WIN_PROB, plays: [] } });
    const result = await getWinProbability("nba", "401585757", true);
    expect(result.scoreMargin).toBeNull();
  });

  it("returns null when winprobability key is missing", async () => {
    mockAxiosGet.mockResolvedValue({ data: {} });
    const result = await getWinProbability("nba", "401585757", true);
    expect(result).toBeNull();
  });

  it("returns null when winprobability is an empty array", async () => {
    mockAxiosGet.mockResolvedValue({ data: { winprobability: [] } });
    const result = await getWinProbability("nba", "401585757", true);
    expect(result).toBeNull();
  });
});

describe("getWinProbability — error handling", () => {
  it("returns null when axios throws", async () => {
    mockAxiosGet.mockRejectedValue(new Error("Network error"));
    const result = await getWinProbability("nba", "401585757", false);
    expect(result).toBeNull();
  });

  it("returns null on ESPN 5xx errors", async () => {
    const err = new Error("Request failed with status 503");
    err.response = { status: 503 };
    mockAxiosGet.mockRejectedValue(err);
    const result = await getWinProbability("nba", "401585757", false);
    expect(result).toBeNull();
  });
});
