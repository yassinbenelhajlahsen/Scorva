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
    // Only 7v8 and 9v10 are play-in (seeds 7-10), not 1v8.
    // After the 7v8 finishes, a tier-2 decisive slot is injected (team-8 vs TBD).
    expect(result.playIn.eastern).toHaveLength(3);
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

    // Play-in should be visible (actual play-in games exist).
    // A tier-2 decisive slot is injected: 7v8 is done so team-8 (loser) advances; 9v10
    // is still scheduled so the other side is TBD.
    expect(result.playIn).not.toBeNull();
    expect(result.playIn.eastern).toHaveLength(3);
    const decisive = result.playIn.eastern.find((s) => s.playInTier === 2);
    expect(decisive).toBeDefined();
    expect(decisive.teamA?.id).toBe(8); // loser of 7v8
    expect(decisive.teamB).toBeNull(); // 9v10 winner not yet known

    // R1 1v8 and 2v7 slots show the locked higher seed vs TBD (play-in still live).
    // 3v6 and 4v5 are projected normally since those seeds are locked.
    expect(result.bracket.eastern.r1).toHaveLength(4);
    const r1Seeds = result.bracket.eastern.r1.map((s) => [
      s.teamA?.seed,
      s.teamB?.seed,
    ]);
    expect(r1Seeds).toEqual([
      [1, undefined],
      [4, 5],
      [3, 6],
      [2, undefined],
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

  it("classifies play-in by game_label even when standings seed is outside 7-10", async () => {
    // Simulates the 2023-24 bug: Philly had an extra DB game inflating their wins
    // to seed 5 instead of 7. Without label-based classification the Philly-Heat
    // play-in game landed in R1, pushing Bucks-Pacers into the semis slot.
    const playInGame76ers = {
      id: 900,
      date: "2024-04-16",
      hometeamid: 7,  // seed 7 in standings (normal)
      awayteamid: 5,  // seed 5 in standings (should be 7 — inflated wins)
      homescore: 105,
      awayscore: 104,
      winnerid: 5,
      status: "Final",
      type: "regular",
      game_label: "NBA Play-In - East - 7th Place vs 8th Place",
    };
    const r1Games = [
      { id: 1000, date: "2024-04-20", hometeamid: 1, awayteamid: 8,  homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff", game_label: null },
      { id: 1010, date: "2024-04-21", hometeamid: 4, awayteamid: 5,  homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff", game_label: null },
      { id: 1020, date: "2024-04-22", hometeamid: 3, awayteamid: 6,  homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff", game_label: null },
      { id: 1030, date: "2024-04-23", hometeamid: 2, awayteamid: 7,  homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff", game_label: null },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: [playInGame76ers, ...r1Games] });

    const result = await getNbaPlayoffs("2023-24");

    // The play-in game should NOT be counted as R1 — R1 should have all 4 real matchups
    expect(result.bracket.eastern.r1).toHaveLength(4);
    // No R1 series should contain the play-in teams (ids 5 and 7 are both in play-in)
    const r1TeamIds = result.bracket.eastern.r1.flatMap((s) =>
      [s.teamA?.id, s.teamB?.id].filter(Boolean)
    );
    // Seeds 5 and 7 (play-in participants) must not appear as a pair in R1
    expect(r1TeamIds).not.toEqual(expect.arrayContaining([5, 7]));
    // The play-in block should include the mislabeled game
    expect(result.playIn).not.toBeNull();
  });

  it("propagates 9v10 winner into decisive slot when only 9v10 is complete", async () => {
    // 9v10 finished; 7v8 not started yet
    const games = [
      playInGame({ homeId: 9, awayId: 10, winnerId: 9, date: "2024-04-17", id: 901 }),
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    expect(result.playIn).not.toBeNull();
    const decisive = result.playIn.eastern.find((s) => s.playInTier === 2);
    expect(decisive).toBeDefined();
    expect(decisive.teamA).toBeNull(); // 7v8 loser not yet known
    expect(decisive.teamB?.id).toBe(9); // winner of 9v10
    expect(decisive.isComplete).toBe(false);
  });

  it("propagates both tier-1 results into decisive slot when both are complete", async () => {
    // Both 7v8 (winner=7) and 9v10 (winner=9) are done; no decisive game yet
    const games = [
      playInGame({ homeId: 7, awayId: 8, winnerId: 7, date: "2024-04-16", id: 900 }),
      playInGame({ homeId: 9, awayId: 10, winnerId: 9, date: "2024-04-17", id: 901 }),
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    expect(result.playIn).not.toBeNull();
    const decisive = result.playIn.eastern.find((s) => s.playInTier === 2);
    expect(decisive).toBeDefined();
    expect(decisive.teamA?.id).toBe(8); // loser of 7v8
    expect(decisive.teamB?.id).toBe(9); // winner of 9v10
    expect(decisive.isComplete).toBe(false); // decisive game hasn't been played
  });

  it("clears semis to TBD when no R1 series has completed", async () => {
    // 4 R1 games in progress + a spurious "pre-created" semis row (like ESPN sometimes
    // adds before R1 is done). Semis should be cleared so the leaked row is invisible.
    const games = [
      // R1 games in progress (no winner yet)
      { id: 1000, date: "2024-04-20", hometeamid: 1, awayteamid: 8, homescore: 0, awayscore: 0, winnerid: null, status: "In Progress", type: "playoff" },
      { id: 1010, date: "2024-04-21", hometeamid: 4, awayteamid: 5, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1020, date: "2024-04-22", hometeamid: 3, awayteamid: 6, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1030, date: "2024-04-23", hometeamid: 2, awayteamid: 7, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      // Spurious pre-created semis row that ESPN put in early (team 1 vs team 4)
      { id: 2000, date: "2024-05-06", hometeamid: 1, awayteamid: 4, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    // No R1 complete → semis should be TBD
    expect(result.bracket.eastern.semis[0].teamA).toBeNull();
    expect(result.bracket.eastern.semis[0].teamB).toBeNull();
    expect(result.bracket.eastern.semis[1].teamA).toBeNull();
    expect(result.bracket.eastern.semis[1].teamB).toBeNull();
    // Conf finals also TBD
    expect(result.bracket.eastern.confFinals[0].teamA).toBeNull();
  });

  it("slots a 9-seed play-in winner correctly into the 1v8 R1 position", async () => {
    // East play-in: seed-8 beats seed-7 in 7v8, seed-9 beats seed-10, seed-9 wins decisive.
    // Seed-9 is now the playoff 8-seed and should face the 1-seed in R1.
    const playInGames = [
      playInGame({ homeId: 7, awayId: 8, winnerId: 8, date: "2024-04-16", id: 900 }), // 8 beats 7
      playInGame({ homeId: 9, awayId: 10, winnerId: 9, date: "2024-04-17", id: 901 }), // 9 beats 10
      playInGame({ homeId: 8, awayId: 9, winnerId: 9, date: "2024-04-19", id: 902 }), // 9 wins decisive → playoff 8 seed
    ];
    // R1: seed-1 vs playoff-8-seed (team id=9, originally 9th in standings)
    const r1Games = [
      { id: 1000, date: "2024-04-20", hometeamid: 1, awayteamid: 9, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1010, date: "2024-04-21", hometeamid: 4, awayteamid: 5, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1020, date: "2024-04-22", hometeamid: 3, awayteamid: 6, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1030, date: "2024-04-23", hometeamid: 2, awayteamid: 8, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: [...playInGames, ...r1Games] });

    const result = await getNbaPlayoffs("2023-24");

    // 1v8 slot should show seed-1 vs seed-9 team (now carrying playoff seed 8)
    const slot18 = result.bracket.eastern.r1.find(
      (s) => s.teamA?.seed === 1 || s.teamB?.seed === 1
    );
    expect(slot18).toBeDefined();
    const opponent = slot18.teamA?.id === 1 ? slot18.teamB : slot18.teamA;
    expect(opponent?.id).toBe(9);   // originally 9th in standings
    expect(opponent?.seed).toBe(8); // but carries playoff seed 8 now
  });

  it("shows semis once at least one R1 series completes", async () => {
    // R1: team-1 sweeps team-8; others still in progress
    const games = [
      ...sweep({ winnerId: 1, loserId: 8, startDate: "2024-04-20", gameIdStart: 1000 }),
      { id: 1010, date: "2024-04-21", hometeamid: 4, awayteamid: 5, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1020, date: "2024-04-22", hometeamid: 3, awayteamid: 6, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1030, date: "2024-04-23", hometeamid: 2, awayteamid: 7, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    // R1[0] is complete → semis should NOT be cleared
    const r1Complete = result.bracket.eastern.r1.some((s) => s.isComplete);
    expect(r1Complete).toBe(true);
    // Semis array exists with correct length (may be TBD teams since only 1 of 4 R1 done)
    expect(result.bracket.eastern.semis).toHaveLength(2);
  });

  it("does not count a win for an in-progress game with a winnerid set", async () => {
    // Game 1 is still In Progress but already has winnerid set (e.g. live sync
    // provisionally marked the leader). Series counter must stay 0-0 until Final.
    const games = [
      { id: 1000, date: "2024-04-20", hometeamid: 1, awayteamid: 8, homescore: 30, awayscore: 24, winnerid: 1, status: "In Progress", type: "playoff" },
      { id: 1010, date: "2024-04-21", hometeamid: 4, awayteamid: 5, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1020, date: "2024-04-22", hometeamid: 3, awayteamid: 6, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
      { id: 1030, date: "2024-04-23", hometeamid: 2, awayteamid: 7, homescore: 0, awayscore: 0, winnerid: null, status: "Scheduled", type: "playoff" },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNbaPlayoffs("2023-24");

    const slot = result.bracket.eastern.r1.find(
      (s) => s.teamA?.id === 1 || s.teamB?.id === 1
    );
    expect(slot).toBeDefined();
    expect(slot.wins[1]).toBe(0);
    expect(slot.wins[8]).toBe(0);
    expect(slot.isComplete).toBe(false);
    expect(slot.winnerId).toBeNull();
  });
});
