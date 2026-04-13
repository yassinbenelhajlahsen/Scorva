import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2025-26");
const mockCached = jest.fn().mockImplementation(async (_key, _ttl, fn) => fn());
const mockGetStandings = jest.fn();
const mockGetRegularSeasonGames = jest.fn().mockResolvedValue([]);

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: mockGetCurrentSeason,
}));

const cachePath = resolve(__dirname, "../../src/cache/cache.js");
jest.unstable_mockModule(cachePath, () => ({ cached: mockCached }));

const standingsPath = resolve(__dirname, "../../src/services/standings/standingsService.js");
jest.unstable_mockModule(standingsPath, () => ({
  getStandings: mockGetStandings,
  getRegularSeasonGames: mockGetRegularSeasonGames,
}));

const { getNbaPlayoffs } = await import(
  resolve(__dirname, "../../src/services/standings/playoffsService.js")
);

// 15 teams per conference. Wins descend so seeds are predictable.
// East: t1(60)=1, t2(55)=2, ..., t8(25)=8, t9(20)=9, t10(15)=10, then t11-t15(14-10) below
// West: t101(60)=1, ..., t108(25)=8, t109(20)=9, t110(15)=10, then t111-t115(14-10) below
function makeStandingsRows() {
  const east = [];
  const west = [];
  for (let i = 0; i < 10; i++) {
    const wins = 60 - i * 5;
    const losses = 82 - wins;
    east.push({
      id: i + 1,
      name: `East ${i + 1}`,
      shortname: `E${i + 1}`,
      location: `City${i + 1}`,
      conf: "east",
      logo_url: `e${i + 1}.png`,
      primary_color: "#007A33",
      wins,
      losses,
    });
    west.push({
      id: 100 + i + 1,
      name: `West ${i + 1}`,
      shortname: `W${i + 1}`,
      location: `City${i + 1}`,
      conf: "west",
      logo_url: `w${i + 1}.png`,
      primary_color: "#552583",
      wins,
      losses,
    });
  }
  for (let i = 10; i < 15; i++) {
    const wins = 14 - (i - 10);
    east.push({
      id: i + 1,
      name: `East ${i + 1}`,
      shortname: `E${i + 1}`,
      location: `City${i + 1}`,
      conf: "east",
      logo_url: `e${i + 1}.png`,
      primary_color: "#000",
      wins,
      losses: 82 - wins,
    });
    west.push({
      id: 100 + i + 1,
      name: `West ${i + 1}`,
      shortname: `W${i + 1}`,
      location: `City${i + 1}`,
      conf: "west",
      logo_url: `w${i + 1}.png`,
      primary_color: "#000",
      wins,
      losses: 82 - wins,
    });
  }
  return [...east, ...west];
}

function sweep({ winnerId, loserId, startDate, gameIdStart }) {
  const games = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 2);
    games.push({
      id: gameIdStart + i,
      date: d.toISOString().slice(0, 10),
      hometeamid: i % 2 === 0 ? winnerId : loserId,
      awayteamid: i % 2 === 0 ? loserId : winnerId,
      homescore: i % 2 === 0 ? 110 : 95,
      awayscore: i % 2 === 0 ? 95 : 110,
      winnerid: winnerId,
      status: "Final",
      type: "playoff",
    });
  }
  return games;
}

function playInGame({ homeId, awayId, winnerId, date, id }) {
  return {
    id,
    date,
    hometeamid: homeId,
    awayteamid: awayId,
    homescore: winnerId === homeId ? 115 : 100,
    awayscore: winnerId === awayId ? 115 : 100,
    winnerid: winnerId,
    status: "Final",
    type: "playoff",
  };
}

describe("getNbaPlayoffs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2025-26");
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
    mockGetStandings.mockResolvedValue(makeStandingsRows());
  });

  it("returns projected bracket from standings when no playoff games exist", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNbaPlayoffs("2025-26");

    expect(result.isProjected).toBe(true);
    expect(result.season).toBe("2025-26");
    expect(result.bracket.eastern.r1).toHaveLength(4);
    expect(result.bracket.eastern.r1[0].teamA.seed).toBe(1);
    expect(result.bracket.eastern.r1[0].teamB.seed).toBe(8);
    expect(result.bracket.eastern.r1[1].teamA.seed).toBe(4);
    expect(result.bracket.eastern.r1[1].teamB.seed).toBe(5);
    expect(result.bracket.eastern.r1[0].games).toEqual([]);
    expect(result.playIn).not.toBeNull();
    expect(result.playIn.eastern).toHaveLength(3);
    expect(result.playIn.western).toHaveLength(3);
    expect(result.playIn.eastern.filter((s) => s.playInTier === 1)).toHaveLength(2);
    expect(result.playIn.eastern.filter((s) => s.playInTier === 2)).toHaveLength(1);
    expect(result.bracket.finals).toHaveLength(1);
    expect(result.bracket.finals[0].games).toEqual([]);
  });

  it("builds a historical bracket from real playoff games", async () => {
    const games = [];
    let id = 1000;
    games.push(...sweep({ winnerId: 1, loserId: 8, startDate: "2024-04-20", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 2, loserId: 7, startDate: "2024-04-21", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 3, loserId: 6, startDate: "2024-04-22", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 4, loserId: 5, startDate: "2024-04-23", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 101, loserId: 108, startDate: "2024-04-20", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 102, loserId: 107, startDate: "2024-04-21", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 103, loserId: 106, startDate: "2024-04-22", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 104, loserId: 105, startDate: "2024-04-23", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 1, loserId: 4, startDate: "2024-05-06", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 2, loserId: 3, startDate: "2024-05-07", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 101, loserId: 104, startDate: "2024-05-06", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 102, loserId: 103, startDate: "2024-05-07", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 1, loserId: 2, startDate: "2024-05-20", gameIdStart: id }));
    id += 10;
    games.push(...sweep({ winnerId: 101, loserId: 102, startDate: "2024-05-20", gameIdStart: id }));
    id += 10;
    const finals = sweep({ winnerId: 1, loserId: 101, startDate: "2024-06-06", gameIdStart: id });
    finals.forEach((g) => (g.type = "final"));
    games.push(...finals);

    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    expect(result.isProjected).toBe(false);
    expect(result.playIn).toBeNull();
    expect(result.bracket.eastern.r1).toHaveLength(4);
    const r1Pairs = result.bracket.eastern.r1.map((s) => [s.teamA.seed, s.teamB.seed]);
    expect(r1Pairs).toEqual([
      [1, 8],
      [4, 5],
      [3, 6],
      [2, 7],
    ]);
    expect(result.bracket.eastern.semis).toHaveLength(2);
    expect(result.bracket.eastern.confFinals).toHaveLength(1);
    expect(result.bracket.western.confFinals).toHaveLength(1);
    expect(result.bracket.finals).toHaveLength(1);
    expect(result.bracket.finals[0].isComplete).toBe(true);
    expect(result.bracket.finals[0].winnerId).toBe(1);
    expect(result.bracket.finals[0].games).toHaveLength(4);
  });

  it("detects play-in games and places them in the playIn section", async () => {
    const games = [];
    games.push(playInGame({ homeId: 7, awayId: 8, winnerId: 7, date: "2024-04-16", id: 900 }));
    games.push(playInGame({ homeId: 9, awayId: 10, winnerId: 9, date: "2024-04-17", id: 901 }));
    games.push(playInGame({ homeId: 8, awayId: 9, winnerId: 8, date: "2024-04-19", id: 902 }));
    games.push(playInGame({ homeId: 107, awayId: 108, winnerId: 107, date: "2024-04-16", id: 903 }));
    games.push(playInGame({ homeId: 109, awayId: 110, winnerId: 109, date: "2024-04-17", id: 904 }));
    games.push(playInGame({ homeId: 108, awayId: 109, winnerId: 108, date: "2024-04-19", id: 905 }));

    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    expect(result.playIn).not.toBeNull();
    expect(result.playIn.eastern).toHaveLength(3);
    expect(result.playIn.western).toHaveLength(3);
    for (const s of result.playIn.eastern) {
      expect(s.games).toHaveLength(1);
    }
    // Tier 1: 7v8 and 9v10; Tier 2: crossover (8v9)
    const tier1 = result.playIn.eastern.filter((s) => s.playInTier === 1);
    const tier2 = result.playIn.eastern.filter((s) => s.playInTier === 2);
    expect(tier1).toHaveLength(2);
    expect(tier2).toHaveLength(1);
  });

  it("marks completed play-in series as isComplete", async () => {
    const games = [
      playInGame({ homeId: 7, awayId: 8, winnerId: 7, date: "2024-04-16", id: 900 }),
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    expect(result.playIn).not.toBeNull();
    const eastPlayIn = result.playIn.eastern;
    expect(eastPlayIn.length).toBeGreaterThanOrEqual(1);
    const completedSeries = eastPlayIn.find(
      (s) => s.teamA && s.teamB && s.games.length === 1
    );
    expect(completedSeries).toBeDefined();
    expect(completedSeries.isComplete).toBe(true);
    expect(completedSeries.winnerId).toBe(7);
  });

  it("returns empty placeholders when team conference data is missing", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    mockGetStandings.mockResolvedValueOnce([
      { id: 1, name: "X", shortname: "X", conf: null, logo_url: "", primary_color: null, wins: 50, losses: 32 },
    ]);

    const result = await getNbaPlayoffs("2025-26");

    expect(result.isProjected).toBe(true);
    expect(result.bracket.eastern.r1).toHaveLength(4);
    expect(result.bracket.eastern.r1.every((s) => !s.teamA && !s.teamB)).toBe(true);
  });

  it("uses 30-day TTL for historical seasons and 30s TTL for current", async () => {
    mockGetCurrentSeason.mockResolvedValue("2025-26");
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getNbaPlayoffs("2024-25");
    const [, historicalTtl] = mockCached.mock.calls[0];
    expect(historicalTtl).toBe(30 * 86400);

    mockCached.mockClear();
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getNbaPlayoffs("2025-26");
    const [, currentTtl] = mockCached.mock.calls[0];
    expect(currentTtl).toBe(30);
  });

  it("cache key uses league and resolved season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getNbaPlayoffs("2023-24");

    const [key] = mockCached.mock.calls[0];
    expect(key).toBe("playoffs:nba:2023-24");
  });

  it("does not misclassify R1 series with 1 game played as play-in", async () => {
    const games = [
      playInGame({ homeId: 7, awayId: 8, winnerId: 7, date: "2024-04-16", id: 900 }),
      // 9v10 still in progress — keeps play-in visible
      {
        id: 901,
        date: "2024-04-17",
        hometeamid: 9,
        awayteamid: 10,
        homescore: 0,
        awayscore: 0,
        winnerid: null,
        status: "Scheduled",
        type: "playoff",
      },
      // R1 game 1 only (1 vs 8 seed) — should NOT end up in play-in
      {
        id: 950,
        date: "2024-04-20",
        hometeamid: 1,
        awayteamid: 8,
        homescore: 110,
        awayscore: 95,
        winnerid: 1,
        status: "Final",
        type: "playoff",
      },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    expect(result.playIn).not.toBeNull();
    // Only 7v8 and 9v10 are play-in (seeds 7-10), not 1v8
    expect(result.playIn.eastern).toHaveLength(2);
    // The 1v8 series should be in bracket R1, not play-in
    const r1Teams = result.bracket.eastern.r1
      .filter((s) => s.teamA && s.teamB)
      .map((s) => [s.teamA.id, s.teamB.id].sort((a, b) => a - b));
    expect(r1Teams).toContainEqual([1, 8]);
  });

  it("shows projected R1 and play-in when only play-in games exist", async () => {
    // Only play-in games in the DB — no R1 games yet
    const games = [
      playInGame({ homeId: 7, awayId: 8, winnerId: 7, date: "2024-04-16", id: 900 }),
      {
        id: 901,
        date: "2024-04-17",
        hometeamid: 9,
        awayteamid: 10,
        homescore: 0,
        awayscore: 0,
        winnerid: null,
        status: "Scheduled",
        type: "playoff",
      },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    // Play-in should be visible (actual play-in games exist)
    expect(result.playIn).not.toBeNull();
    expect(result.playIn.eastern).toHaveLength(2);

    // R1 should be filled with projected matchups, not all TBD
    expect(result.bracket.eastern.r1).toHaveLength(4);
    const r1Seeds = result.bracket.eastern.r1.map((s) => [
      s.teamA?.seed,
      s.teamB?.seed,
    ]);
    expect(r1Seeds).toEqual([
      [1, 8],
      [4, 5],
      [3, 6],
      [2, 7],
    ]);
  });

  it("handles ESPN placeholder teams (no conference) as TBD in R1", async () => {
    // ESPN creates projected R1 games with a placeholder team for the
    // undecided play-in slot (e.g. "Suns/Trail Blazers" with no conf).
    const standings = makeStandingsRows();
    standings.push({
      id: 999999,
      name: "Placeholder/Team",
      shortname: "PH",
      location: "TBD",
      conf: null,
      logo_url: "",
      primary_color: null,
      wins: 0,
      losses: 0,
    });
    mockGetStandings.mockResolvedValueOnce(standings);

    // R1 game: seed-1 east (id 1) vs placeholder (id 999999)
    const games = [
      {
        id: 1000,
        date: "2024-04-20",
        hometeamid: 1,
        awayteamid: 999999,
        homescore: 0,
        awayscore: 0,
        winnerid: null,
        status: "Scheduled",
        type: "playoff",
      },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    // The series should exist in R1 (not dropped)
    const seriesWithTeam1 = result.bracket.eastern.r1.find(
      (s) => s.teamA?.id === 1 || s.teamB?.id === 1
    );
    expect(seriesWithTeam1).toBeDefined();
    expect(seriesWithTeam1.teamA.id).toBe(1);
    // Placeholder renders as TBD (null)
    expect(seriesWithTeam1.teamB).toBeNull();

    // TBD opponent in R1 means play-in hasn't resolved — show projected play-in
    expect(result.playIn).not.toBeNull();
    expect(result.playIn.eastern.length).toBeGreaterThan(0);
    expect(result.playIn.western.length).toBeGreaterThan(0);
  });
});
