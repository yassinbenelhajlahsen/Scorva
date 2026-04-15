import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockGetCurrentSeason = jest.fn().mockResolvedValue("2024-25");
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

const { getNflPlayoffs } = await import(
  resolve(__dirname, "../../src/services/standings/nflPlayoffsService.js")
);

// Build a minimal NFL team row. winPct is derived from wins/losses/ties.
function makeTeam({ id, conf, division, wins, losses, ties = 0 }) {
  const gp = wins + losses + ties;
  const winPct = gp > 0 ? (wins + 0.5 * ties) / gp : 0;
  return {
    id,
    name: `Team ${id}`,
    shortname: `T${id}`,
    location: "City",
    conf,
    division,
    logo_url: `t${id}.png`,
    primary_color: "#000000",
    wins,
    losses,
    ties,
    winPct,
    pointDiff: wins - losses,
    confWinPct: 0,
    divWinPct: 0,
  };
}

// 32-team NFL standings (8 per conf, 4 divisions per conf, 4 teams per division).
// Win totals are STRICTLY decreasing across all teams within each conference so
// seeding is deterministic — no tiebreakers needed, tests stay predictable.
//
// AFC divisions: afc_east (1-4), afc_north (11-14), afc_south (21-24), afc_west (31-34)
// NFC divisions: nfc_east (101-104), nfc_north (111-114), nfc_south (121-124), nfc_west (131-134)
//
// Division winners (AFC): id1(14W), id11(13W), id21(12W), id31(11W) → seeds 1-4
// Wild cards (AFC):        id2(10W), id12(9W), id2(8W) but id2 is afc_east non-winner...
//
// AFC non-winners by rank:
//   id2(10W), id12(9W), id22(8W), id32(7W), id3(6W), id13(5W)...
//   WC5=id2, WC6=id12, WC7=id22
function makeStandings14() {
  return [
    // AFC East – strictly decreasing: 14, 10, 6, 4
    makeTeam({ id: 1,  conf: "afc", division: "afc_east",  wins: 14, losses: 3 }),
    makeTeam({ id: 2,  conf: "afc", division: "afc_east",  wins: 10, losses: 7 }),
    makeTeam({ id: 3,  conf: "afc", division: "afc_east",  wins: 6,  losses: 11 }),
    makeTeam({ id: 4,  conf: "afc", division: "afc_east",  wins: 4,  losses: 13 }),
    // AFC North – strictly decreasing: 13, 9, 5, 3
    makeTeam({ id: 11, conf: "afc", division: "afc_north", wins: 13, losses: 4 }),
    makeTeam({ id: 12, conf: "afc", division: "afc_north", wins: 9,  losses: 8 }),
    makeTeam({ id: 13, conf: "afc", division: "afc_north", wins: 5,  losses: 12 }),
    makeTeam({ id: 14, conf: "afc", division: "afc_north", wins: 3,  losses: 14 }),
    // AFC South – strictly decreasing: 12, 8, 4, 2
    makeTeam({ id: 21, conf: "afc", division: "afc_south", wins: 12, losses: 5 }),
    makeTeam({ id: 22, conf: "afc", division: "afc_south", wins: 8,  losses: 9 }),
    makeTeam({ id: 23, conf: "afc", division: "afc_south", wins: 4,  losses: 13 }),
    makeTeam({ id: 24, conf: "afc", division: "afc_south", wins: 2,  losses: 15 }),
    // AFC West – strictly decreasing: 11, 7, 3, 1
    makeTeam({ id: 31, conf: "afc", division: "afc_west",  wins: 11, losses: 6 }),
    makeTeam({ id: 32, conf: "afc", division: "afc_west",  wins: 7,  losses: 10 }),
    makeTeam({ id: 33, conf: "afc", division: "afc_west",  wins: 3,  losses: 14 }),
    makeTeam({ id: 34, conf: "afc", division: "afc_west",  wins: 1,  losses: 16 }),
    // NFC East – strictly decreasing: 14, 10, 6, 4
    makeTeam({ id: 101, conf: "nfc", division: "nfc_east",  wins: 14, losses: 3 }),
    makeTeam({ id: 102, conf: "nfc", division: "nfc_east",  wins: 10, losses: 7 }),
    makeTeam({ id: 103, conf: "nfc", division: "nfc_east",  wins: 6,  losses: 11 }),
    makeTeam({ id: 104, conf: "nfc", division: "nfc_east",  wins: 4,  losses: 13 }),
    // NFC North – strictly decreasing: 13, 9, 5, 3
    makeTeam({ id: 111, conf: "nfc", division: "nfc_north", wins: 13, losses: 4 }),
    makeTeam({ id: 112, conf: "nfc", division: "nfc_north", wins: 9,  losses: 8 }),
    makeTeam({ id: 113, conf: "nfc", division: "nfc_north", wins: 5,  losses: 12 }),
    makeTeam({ id: 114, conf: "nfc", division: "nfc_north", wins: 3,  losses: 14 }),
    // NFC South – strictly decreasing: 12, 8, 4, 2
    makeTeam({ id: 121, conf: "nfc", division: "nfc_south", wins: 12, losses: 5 }),
    makeTeam({ id: 122, conf: "nfc", division: "nfc_south", wins: 8,  losses: 9 }),
    makeTeam({ id: 123, conf: "nfc", division: "nfc_south", wins: 4,  losses: 13 }),
    makeTeam({ id: 124, conf: "nfc", division: "nfc_south", wins: 2,  losses: 15 }),
    // NFC West – strictly decreasing: 11, 7, 3, 1
    makeTeam({ id: 131, conf: "nfc", division: "nfc_west",  wins: 11, losses: 6 }),
    makeTeam({ id: 132, conf: "nfc", division: "nfc_west",  wins: 7,  losses: 10 }),
    makeTeam({ id: 133, conf: "nfc", division: "nfc_west",  wins: 3,  losses: 14 }),
    makeTeam({ id: 134, conf: "nfc", division: "nfc_west",  wins: 1,  losses: 16 }),
  ];
}

// Same data used for 12-team format test (bracketFormat derives from season year).
function makeStandings12() {
  return makeStandings14();
}

// Build a single playoff game (NFL: no series, each is one game).
function playoffGame({ homeId, awayId, winnerId, date, id, game_label, type = "playoff" }) {
  return {
    id,
    date,
    hometeamid: homeId,
    awayteamid: awayId,
    homescore: winnerId === homeId ? 24 : 17,
    awayscore: winnerId === awayId ? 24 : 17,
    winnerid: winnerId,
    status: "Final",
    type,
    game_label,
  };
}

describe("getNflPlayoffs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2024-25");
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
    mockGetStandings.mockResolvedValue(makeStandings14());
    mockGetRegularSeasonGames.mockResolvedValue([]);
  });

  // ── Unsupported seasons ─────────────────────────────────────────────────

  it("returns unsupported for seasons before 2015", async () => {
    const result = await getNflPlayoffs("2014-15");
    expect(result).toEqual({ season: "2014-15", unsupported: true });
    expect(mockGetStandings).not.toHaveBeenCalled();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // ── Projected bracket (no playoff games yet) ────────────────────────────

  it("returns projected 14-team bracket with correct Wild Card slots when no games exist", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNflPlayoffs("2024-25");

    expect(result.isProjected).toBe(true);
    expect(result.season).toBe("2024-25");
    expect(result.format).toBe("14team");
    expect(result.bracket.afc).toBeDefined();
    expect(result.bracket.nfc).toBeDefined();
    expect(result.bracket.superBowl).toHaveLength(1);

    const wc = result.bracket.afc.wildCard;
    expect(wc).toHaveLength(3);

    // AFC seeds: 1=id1(14W), 2=id11(13W), 3=id21(12W), 4=id31(11W)
    // WC5=id2(10W), WC6=id12(9W), WC7=id22(8W)
    // Wild Card matchups: 2v7, 3v6, 4v5
    const seeds = wc.map((s) => [s.teamA?.seed, s.teamB?.seed]).sort((a, b) => a[0] - b[0]);
    expect(seeds[0]).toEqual([2, 7]);
    expect(seeds[1]).toEqual([3, 6]);
    expect(seeds[2]).toEqual([4, 5]);

    // Divisional and Championship are TBD (projected, no games)
    expect(result.bracket.afc.divisional).toHaveLength(2);
    expect(result.bracket.afc.confChampionship).toHaveLength(1);
  });

  it("returns projected 12-team bracket for pre-2020 seasons", async () => {
    mockGetCurrentSeason.mockResolvedValue("2019-20");
    mockGetStandings.mockResolvedValue(makeStandings12());
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNflPlayoffs("2019-20");

    expect(result.format).toBe("12team");
    const wc = result.bracket.afc.wildCard;
    // 12-team: only seeds 3-6 play Wild Card (2 games per conf); seeds 1+2 have byes
    expect(wc).toHaveLength(2);
    const seeds = wc.map((s) => [s.teamA?.seed, s.teamB?.seed]).sort((a, b) => a[0] - b[0]);
    expect(seeds[0]).toEqual([3, 6]);
    expect(seeds[1]).toEqual([4, 5]);
  });

  // ── Historical bracket (actual games) ──────────────────────────────────

  it("classifies games into correct rounds from game_label", async () => {
    // Provide Wild Card, Divisional, Conf Championship, and Super Bowl games.
    // AFC only for this test (NFC also gets queried but we check AFC).
    const wcGames = [
      playoffGame({ id: 1, homeId: 11, awayId: 22, winnerId: 11, date: "2025-01-11", game_label: "AFC Wild Card" }),
      playoffGame({ id: 2, homeId: 21, awayId: 12, winnerId: 21, date: "2025-01-11", game_label: "AFC Wild Card" }),
      playoffGame({ id: 3, homeId: 31, awayId: 2,  winnerId: 31, date: "2025-01-12", game_label: "AFC Wild Card" }),
    ];
    const divGames = [
      playoffGame({ id: 10, homeId: 1,  awayId: 31, winnerId: 1,  date: "2025-01-18", game_label: "AFC Divisional Round" }),
      playoffGame({ id: 11, homeId: 11, awayId: 21, winnerId: 11, date: "2025-01-19", game_label: "AFC Divisional Round" }),
    ];
    const cfGames = [
      playoffGame({ id: 20, homeId: 1, awayId: 11, winnerId: 1, date: "2025-01-26", game_label: "AFC Championship" }),
    ];
    const sbGame = [
      playoffGame({ id: 30, homeId: 1, awayId: 101, winnerId: 1, date: "2025-02-09", game_label: "Super Bowl LIX", type: "final" }),
    ];

    // NFC also needs to be satisfied; provide minimal NFC WC/div/cf data
    const nfcWc = [
      playoffGame({ id: 4,  homeId: 111, awayId: 122, winnerId: 111, date: "2025-01-11", game_label: "NFC Wild Card" }),
      playoffGame({ id: 5,  homeId: 121, awayId: 112, winnerId: 121, date: "2025-01-11", game_label: "NFC Wild Card" }),
      playoffGame({ id: 6,  homeId: 131, awayId: 102, winnerId: 131, date: "2025-01-12", game_label: "NFC Wild Card" }),
    ];
    const nfcDiv = [
      playoffGame({ id: 12, homeId: 101, awayId: 131, winnerId: 101, date: "2025-01-18", game_label: "NFC Divisional Round" }),
      playoffGame({ id: 13, homeId: 111, awayId: 121, winnerId: 111, date: "2025-01-19", game_label: "NFC Divisional Round" }),
    ];
    const nfcCf = [
      playoffGame({ id: 21, homeId: 101, awayId: 111, winnerId: 101, date: "2025-01-26", game_label: "NFC Championship" }),
    ];

    mockPool.query.mockResolvedValueOnce({
      rows: [...wcGames, ...divGames, ...cfGames, ...sbGame, ...nfcWc, ...nfcDiv, ...nfcCf],
    });

    const result = await getNflPlayoffs("2024-25");

    expect(result.isProjected).toBe(false);
    expect(result.bracket.afc.wildCard).toHaveLength(3);
    expect(result.bracket.afc.divisional).toHaveLength(2);
    expect(result.bracket.afc.confChampionship).toHaveLength(1);
    expect(result.bracket.superBowl).toHaveLength(1);
    expect(result.bracket.superBowl[0].winnerId).toBe(1);
  });

  // ── Single-game isComplete ──────────────────────────────────────────────

  it("marks a series as complete after a single decided game", async () => {
    const wcGame = playoffGame({
      id: 1, homeId: 11, awayId: 22, winnerId: 11,
      date: "2025-01-11", game_label: "AFC Wild Card",
    });
    mockPool.query.mockResolvedValueOnce({ rows: [wcGame] });

    const result = await getNflPlayoffs("2024-25");

    const wc = result.bracket.afc.wildCard;
    const completedSeries = wc.find((s) => s.games?.length > 0);
    expect(completedSeries).toBeDefined();
    expect(completedSeries.isComplete).toBe(true);
    expect(completedSeries.winnerId).toBe(11);
  });

  // ── Reseeding: 7-seed upset changes Divisional matchups ────────────────

  it("projects 7-seed vs 1-seed in Divisional after a 7-seed Wild Card upset", async () => {
    // AFC WC: 2v7(upset!), 3v6, 4v5 — 7-seed (id22, 8W) beats 2-seed (id11, 13W)
    const wcGames = [
      playoffGame({ id: 1, homeId: 11, awayId: 22, winnerId: 22, date: "2025-01-11", game_label: "AFC Wild Card" }),
      playoffGame({ id: 2, homeId: 21, awayId: 12, winnerId: 21, date: "2025-01-11", game_label: "AFC Wild Card" }),
      playoffGame({ id: 3, homeId: 31, awayId: 2,  winnerId: 2,  date: "2025-01-12", game_label: "AFC Wild Card" }),
    ];
    mockPool.query.mockResolvedValueOnce({ rows: wcGames });

    const result = await getNflPlayoffs("2024-25");

    // Survivors after WC: id1(bye,seed1), id22(upset,seed7), id21(seed3), id2(seed5 as WC)
    // Wait — id2 won WC3 (4v5 slot where id2=WC2=seed5, id31=seed4) — so id2 wins, seed5
    // id22 upset seed2, so id22 advances as seed7
    // AFC WC projected seeds: 2v7 → 11v22, 3v6 → 21v12, 4v5 → 31v2
    // After WC: survivors by seed: id1(bye,1), id22(upset winner,7), id21(3), id2(5)
    // Divisional reseeding: highest vs lowest: 1 vs 7, 3 vs 5
    const div = result.bracket.afc.divisional;
    const seeds = div.map((s) => {
      const sA = s.teamA?.seed ?? s.teamA?.id;
      const sB = s.teamB?.seed ?? s.teamB?.id;
      return [sA, sB].sort((a, b) => a - b);
    }).sort((a, b) => a[0] - b[0]);
    expect(seeds[0]).toEqual([1, 7]);  // 1-seed vs 7-seed (upset winner)
    expect(seeds[1]).toEqual([3, 5]);  // 3-seed vs 5-seed
  });

  // ── Super Bowl ──────────────────────────────────────────────────────────

  it("places Super Bowl in superBowl key with null conference", async () => {
    const sbGame = playoffGame({
      id: 99, homeId: 1, awayId: 101, winnerId: 1,
      date: "2025-02-09", game_label: "Super Bowl LIX", type: "final",
    });
    mockPool.query.mockResolvedValueOnce({ rows: [sbGame] });

    const result = await getNflPlayoffs("2024-25");

    const sb = result.bracket.superBowl;
    expect(sb).toHaveLength(1);
    expect(sb[0].round).toBe("superBowl");
    expect(sb[0].conference).toBeNull();
    expect(sb[0].winnerId).toBe(1);
  });

  // ── Missing division data ────────────────────────────────────────────────

  it("returns division_data_missing warning when teams lack division", async () => {
    const badStandings = makeStandings14().map((t) => ({ ...t, division: null }));
    mockGetStandings.mockResolvedValue(badStandings);
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNflPlayoffs("2024-25");

    expect(result.warning).toBe("division_data_missing");
    expect(result.isProjected).toBe(true);
  });

  // ── NFL ties in seeding ─────────────────────────────────────────────────

  it("seeds a 9-7-1 team above a 9-8-0 team", async () => {
    // 9-7-1: winPct = (9 + 0.5) / 17 ≈ 0.5588
    // 9-8-0: winPct = 9 / 17 ≈ 0.5294
    // Compare id2 (afc_east non-winner) vs id12 (afc_north non-winner).
    // id12 already has 9-8-0 in makeStandings14(); we only change id2.
    // Both are confirmed non-winners (id1=14W wins afc_east; id11=13W wins afc_north).
    const standings = makeStandings14().map((t) => {
      if (t.id === 2) return makeTeam({ id: 2, conf: "afc", division: "afc_east", wins: 9, losses: 7, ties: 1 });
      return t;
    });
    mockGetStandings.mockResolvedValue(standings);
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNflPlayoffs("2024-25");

    // WC pool (non-div-winners): id2(9-7-1, 0.5588) → WC5, id12(9-8-0, 0.5294) → WC6.
    // Both appear in the Wild Card round (2 vs 7, 3 vs 6, 4 vs 5 matchups).
    const wc = result.bracket.afc.wildCard;
    const wcSeeds = wc.flatMap((s) => [
      { id: s.teamA?.id, seed: s.teamA?.seed },
      { id: s.teamB?.id, seed: s.teamB?.seed },
    ]).filter((t) => t.id === 2 || t.id === 12);

    expect(wcSeeds).toHaveLength(2);
    const id2entry = wcSeeds.find((t) => t.id === 2);
    const id12entry = wcSeeds.find((t) => t.id === 12);
    // id2 (9-7-1) should have a lower (better) seed number than id12 (9-8-0)
    expect(id2entry.seed).toBeLessThan(id12entry.seed);
    expect(result.bracket.afc.wildCard).toHaveLength(3);
  });

  // ── Cache ────────────────────────────────────────────────────────────────

  it("uses 30s TTL for the current season", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getNflPlayoffs("2024-25");

    expect(mockCached).toHaveBeenCalledWith(
      "playoffs:nfl:2024-25",
      30,
      expect.any(Function)
    );
  });

  it("uses 30d TTL for historical seasons", async () => {
    mockGetCurrentSeason.mockResolvedValue("2024-25");
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getNflPlayoffs("2023-24");

    expect(mockCached).toHaveBeenCalledWith(
      "playoffs:nfl:2023-24",
      30 * 86400,
      expect.any(Function)
    );
  });

  it("uses cache key format playoffs:nfl:{season}", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getNflPlayoffs("2022-23");

    expect(mockCached.mock.calls[0][0]).toBe("playoffs:nfl:2022-23");
  });

  // ── No current season ────────────────────────────────────────────────────

  it("returns an empty projected bracket when no current season exists", async () => {
    mockGetCurrentSeason.mockResolvedValue(null);

    const result = await getNflPlayoffs();

    expect(result.season).toBeNull();
    expect(result.isProjected).toBe(true);
    expect(mockPool.query).not.toHaveBeenCalled();
    expect(mockGetStandings).not.toHaveBeenCalled();
  });
});
