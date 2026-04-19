import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn) => fn());

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

const { getPrediction, computePlayerImpactShare, computeTeamImpactFactor } =
  await import(resolve(__dirname, "../../src/services/games/predictionService.js"));

const HOME_ID = 1;
const AWAY_ID = 2;
const SEASON = "2025-26";

const baseTeamStats = (id, shortname) => ({
  id,
  name: shortname,
  shortname,
  logo_url: `https://example.com/${shortname}.png`,
  games_played: "20",
  wins: "12",
  losses: "8",
  otl: "0",
  off_rating: "112",
  def_rating: "108",
  home_off_rating: "115",
  home_def_rating: "106",
  home_wins: "8",
  home_losses: "2",
  home_otl: "0",
  away_off_rating: "109",
  away_def_rating: "110",
  away_wins: "4",
  away_losses: "6",
  away_otl: "0",
});

function setupQueryMocks({ homeRoster = [], awayRoster = [], freshTs = null } = {}) {
  // Order of queries inside getPrediction:
  // 1) game row
  // 2) freshness MAX(status_updated_at)
  // 3) ratings (both teams)
  // 4-8) Promise.all: home form, away form, h2h, home roster, away roster
  mockPool.query.mockReset();
  mockPool.query
    .mockResolvedValueOnce({ // game
      rows: [{ hometeamid: HOME_ID, awayteamid: AWAY_ID, season: SEASON, status: "Scheduled" }],
    })
    .mockResolvedValueOnce({ // freshness
      rows: [{ ts: freshTs }],
    })
    .mockResolvedValueOnce({ // ratings
      rows: [baseTeamStats(HOME_ID, "HOM"), baseTeamStats(AWAY_ID, "AWY")],
    })
    .mockResolvedValueOnce({ rows: [{ winnerid: HOME_ID }, { winnerid: AWAY_ID }, { winnerid: HOME_ID }] }) // home form
    .mockResolvedValueOnce({ rows: [{ winnerid: AWAY_ID }, { winnerid: HOME_ID }] }) // away form
    .mockResolvedValueOnce({ rows: [] }) // h2h
    .mockResolvedValueOnce({ rows: homeRoster }) // home roster
    .mockResolvedValueOnce({ rows: awayRoster }); // away roster
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
});

describe("computePlayerImpactShare", () => {
  it("returns 0 when team has zero production", () => {
    expect(computePlayerImpactShare({ pts: 25, ast: 5, reb: 5 }, 0, "nba")).toBe(0);
  });

  it("clamps NBA share to 0.40 maximum", () => {
    const player = { pts: 100, ast: 0, reb: 0 };
    expect(computePlayerImpactShare(player, 100, "nba")).toBe(0.4);
  });

  it("computes NBA weighted share (pts + 0.6*ast + 0.4*reb)", () => {
    const player = { pts: 20, ast: 5, reb: 10 }; // weighted = 27
    const teamWeighted = 100;
    expect(computePlayerImpactShare(player, teamWeighted, "nba")).toBeCloseTo(0.27, 5);
  });

  it("returns 0.02 fixed share for NFL OL/ST positions", () => {
    expect(computePlayerImpactShare({ position: "OL", yds: 0, td: 0 }, 1000, "nfl")).toBe(0.02);
    expect(computePlayerImpactShare({ position: "K", yds: 0, td: 0 }, 1000, "nfl")).toBe(0.02);
  });
});

describe("computeTeamImpactFactor", () => {
  it("returns 0 with no roster", () => {
    expect(computeTeamImpactFactor([], "nba")).toEqual({ factor: 0, players: [] });
  });

  it("ignores active players", () => {
    const roster = [
      { id: 1, name: "A", status: "active", pts: 25, ast: 5, reb: 5 },
      { id: 2, name: "B", status: "active", pts: 15, ast: 3, reb: 3 },
    ];
    expect(computeTeamImpactFactor(roster, "nba").players).toHaveLength(0);
  });

  it("applies availability multiplier — out=1.0, questionable=0.5", () => {
    // Two identical players, one out, one questionable
    const star = (id, status) => ({
      id, name: `P${id}`, position: "F", status,
      pts: 20, ast: 5, reb: 5,
      status_description: null, status_updated_at: null,
    });
    const filler = { id: 99, name: "Filler", status: "active", pts: 80, ast: 0, reb: 0 };
    const outResult = computeTeamImpactFactor([star(1, "out"), filler], "nba");
    const qResult = computeTeamImpactFactor([star(1, "questionable"), filler], "nba");
    expect(qResult.factor).toBeCloseTo(outResult.factor * 0.5, 5);
  });

  it("caps total team impact factor at 0.55", () => {
    // Make 5 high-impact out players
    const players = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, name: `P${i}`, position: "F", status: "out",
      pts: 25, ast: 5, reb: 5,
      status_description: null, status_updated_at: null,
    }));
    const result = computeTeamImpactFactor(players, "nba");
    expect(result.factor).toBeLessThanOrEqual(0.55);
    expect(result.factor).toBe(0.55);
  });
});

describe("getPrediction — injury impact", () => {
  it("returns identical baseline when no injuries", async () => {
    setupQueryMocks();
    const result = await getPrediction("nba", 100);
    expect(result.homeTeam.injuries.impactFactor).toBe(0);
    expect(result.homeTeam.injuries.players).toEqual([]);
    expect(result.awayTeam.injuries.impactFactor).toBe(0);
    expect(result.homeTeam.winProbability + result.awayTeam.winProbability).toBe(100);
  });

  it("drops home win probability when star player is out", async () => {
    setupQueryMocks();
    const baseline = await getPrediction("nba", 100);

    // Same data but with a star out for the home team. Filler players keep team total.
    const homeRoster = [
      {
        id: 1, name: "Star", position: "F", status: "out",
        status_description: "Knee", status_updated_at: new Date(),
        pts: 30, ast: 8, reb: 10,
      },
      { id: 2, name: "Filler1", status: "active", pts: 70, ast: 4, reb: 4 },
    ];
    setupQueryMocks({ homeRoster });
    const injured = await getPrediction("nba", 100);

    expect(injured.homeTeam.injuries.impactFactor).toBeGreaterThan(0);
    expect(injured.homeTeam.injuries.players).toHaveLength(1);
    expect(injured.homeTeam.injuries.players[0].name).toBe("Star");
    expect(injured.homeTeam.winProbability).toBeLessThan(baseline.homeTeam.winProbability);
  });

  it("downgrades confidence to low when one team's impactFactor > 0.25", async () => {
    const heavyRoster = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, name: `P${i}`, position: "F", status: "out",
      status_description: null, status_updated_at: null,
      pts: 25, ast: 5, reb: 5,
    }));
    setupQueryMocks({ homeRoster: heavyRoster });
    const result = await getPrediction("nba", 100);
    expect(result.homeTeam.injuries.impactFactor).toBeGreaterThan(0.25);
    expect(result.confidence).toBe("low");
  });

  it("adds an injury keyFactor when impact >= 10%", async () => {
    const homeRoster = [
      {
        id: 1, name: "Star", position: "F", status: "out",
        status_description: null, status_updated_at: null,
        pts: 30, ast: 8, reb: 10,
      },
      { id: 2, name: "Filler", status: "active", pts: 70, ast: 4, reb: 4 },
    ];
    setupQueryMocks({ homeRoster });
    const result = await getPrediction("nba", 100);
    const injuryFactors = result.keyFactors.filter((f) => f.type === "injury");
    expect(injuryFactors.length).toBeGreaterThanOrEqual(1);
    expect(injuryFactors[0].text).toContain("HOM");
  });
});

describe("getPrediction — cache key freshness", () => {
  it("includes freshness timestamp in cache key", async () => {
    const ts = new Date("2026-04-18T19:30:00Z");
    setupQueryMocks({ freshTs: ts });
    await getPrediction("nba", 100);
    const cacheKey = mockCached.mock.calls[0][0];
    expect(cacheKey).toBe(`prediction:nba:100:${ts.getTime()}`);
  });

  it("uses 0 in key when no injury timestamps present", async () => {
    setupQueryMocks({ freshTs: null });
    await getPrediction("nba", 100);
    const cacheKey = mockCached.mock.calls[0][0];
    expect(cacheKey).toBe("prediction:nba:100:0");
  });
});
