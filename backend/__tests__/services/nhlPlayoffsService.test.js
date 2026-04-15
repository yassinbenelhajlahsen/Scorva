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

const { getNhlPlayoffs } = await import(
  resolve(__dirname, "../../src/services/standings/nhlPlayoffsService.js")
);

// Build a minimal NHL team row with all fields deriveNhlPlayoffs reads.
// wins/losses/otl drive ptsPct; regWins, gf, pointDiff drive tiebreakers.
function makeTeam({
  id,
  conf,
  division,
  wins,
  losses,
  otl = 0,
  regWins = null,
  gf = null,
  pointDiff = null,
}) {
  const gp = wins + losses;
  const ptsPct = gp > 0 ? (2 * wins + otl) / (2 * gp) : 0;
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
    otl,
    regWins: regWins ?? wins,
    gf: gf ?? wins * 3,
    pointDiff: pointDiff ?? wins - losses,
    ptsPct,
  };
}

// Returns 4 teams per division (2 divs × 2 confs = 16 teams).
// ptsPct is strictly decreasing within each conference so seeds are
// deterministic without triggering any tiebreaker.
//
// East: atlantic (A) > metropolitan (M) by leader comparison.
//   atlantic:     id 1–4  wins: 55,50,45,35
//   metropolitan: id 11–14 wins: 52,48,44,30
//
// West: central (C) > pacific (P) by leader comparison.
//   central:  id 101–104 wins: 55,50,45,35
//   pacific:  id 111–114 wins: 52,48,44,30
function makeStandings() {
  return [
    // East — atlantic (better division: 55 > 52)
    makeTeam({ id: 1,  conf: "east", division: "atlantic",     wins: 55, losses: 20 }),
    makeTeam({ id: 2,  conf: "east", division: "atlantic",     wins: 50, losses: 24 }),
    makeTeam({ id: 3,  conf: "east", division: "atlantic",     wins: 45, losses: 29 }),
    makeTeam({ id: 4,  conf: "east", division: "atlantic",     wins: 35, losses: 39 }),
    // East — metropolitan
    makeTeam({ id: 11, conf: "east", division: "metropolitan", wins: 52, losses: 22 }),
    makeTeam({ id: 12, conf: "east", division: "metropolitan", wins: 48, losses: 26 }),
    makeTeam({ id: 13, conf: "east", division: "metropolitan", wins: 44, losses: 30 }),
    makeTeam({ id: 14, conf: "east", division: "metropolitan", wins: 30, losses: 44 }),
    // West — central (better division: 55 > 52)
    makeTeam({ id: 101, conf: "west", division: "central",  wins: 55, losses: 20 }),
    makeTeam({ id: 102, conf: "west", division: "central",  wins: 50, losses: 24 }),
    makeTeam({ id: 103, conf: "west", division: "central",  wins: 45, losses: 29 }),
    makeTeam({ id: 104, conf: "west", division: "central",  wins: 35, losses: 39 }),
    // West — pacific
    makeTeam({ id: 111, conf: "west", division: "pacific",  wins: 52, losses: 22 }),
    makeTeam({ id: 112, conf: "west", division: "pacific",  wins: 48, losses: 26 }),
    makeTeam({ id: 113, conf: "west", division: "pacific",  wins: 44, losses: 30 }),
    makeTeam({ id: 114, conf: "west", division: "pacific",  wins: 30, losses: 44 }),
  ];
}

// Produce 4-game sweep between two teams; all games use type "playoff" by default.
function sweep({ winnerId, loserId, startDate, gameIdStart, type = "playoff" }) {
  const games = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * 2);
    games.push({
      id: gameIdStart + i,
      date: d.toISOString().slice(0, 10),
      hometeamid: i % 2 === 0 ? winnerId : loserId,
      awayteamid: i % 2 === 0 ? loserId : winnerId,
      homescore: i % 2 === 0 ? 4 : 2,
      awayscore: i % 2 === 0 ? 2 : 4,
      winnerid: winnerId,
      status: "Final",
      type,
    });
  }
  return games;
}

describe("getNhlPlayoffs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2024-25");
    mockCached.mockImplementation(async (_key, _ttl, fn) => fn());
    mockGetStandings.mockResolvedValue(makeStandings());
    mockGetRegularSeasonGames.mockResolvedValue([]);
  });

  // ── Unsupported seasons ─────────────────────────────────────────────────

  it("returns unsupported for pre-2013-14 seasons", async () => {
    const result = await getNhlPlayoffs("2012-13");
    expect(result).toEqual({ season: "2012-13", unsupported: true });
    expect(mockGetStandings).not.toHaveBeenCalled();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("returns unsupported for the 2019-20 bubble season", async () => {
    const result = await getNhlPlayoffs("2019-20");
    expect(result).toEqual({ season: "2019-20", unsupported: true });
    expect(mockGetStandings).not.toHaveBeenCalled();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // ── Projected bracket (no games yet) ───────────────────────────────────

  it("returns projected bracket with canonical R1 slot order when no playoff games exist", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNhlPlayoffs("2024-25");

    expect(result.isProjected).toBe(true);
    expect(result.season).toBe("2024-25");
    expect(result.playIn).toBeNull();

    const er1 = result.bracket.eastern.r1;
    expect(er1).toHaveLength(4);

    // atlantic is divA (leader 55 > 52): A1=id1, A2=id2, A3=id3
    // metropolitan is divB: B1=id11, B2=id12, B3=id13
    // WC candidates: id4 (35W) and id14 (30W) → WC1=id4 (better), WC2=id14 (worse)

    // slot 0: A1 vs WC2(14)
    expect(er1[0].teamA.id).toBe(1);
    expect(er1[0].teamA.seed).toBe(1);
    expect(er1[0].teamB.id).toBe(14);
    expect(er1[0].teamB.seed).toBe(8);

    // slot 1: A2 vs A3
    expect(er1[1].teamA.id).toBe(2);
    expect(er1[1].teamA.seed).toBe(3);
    expect(er1[1].teamB.id).toBe(3);
    expect(er1[1].teamB.seed).toBe(4);

    // slot 2: B2 vs B3
    expect(er1[2].teamA.id).toBe(12);
    expect(er1[2].teamA.seed).toBe(5);
    expect(er1[2].teamB.id).toBe(13);
    expect(er1[2].teamB.seed).toBe(6);

    // slot 3: B1(11) vs WC1(4)
    expect(er1[3].teamA.id).toBe(11);
    expect(er1[3].teamA.seed).toBe(2);
    expect(er1[3].teamB.id).toBe(4);
    expect(er1[3].teamB.seed).toBe(7);

    // Semis and CF should be empty (no games)
    expect(result.bracket.eastern.semis).toHaveLength(2);
    expect(result.bracket.eastern.semis.every((s) => s.games.length === 0)).toBe(true);
    expect(result.bracket.eastern.confFinals).toHaveLength(1);
    expect(result.bracket.eastern.confFinals[0].games.length).toBe(0);
    expect(result.bracket.finals[0].games.length).toBe(0);
  });

  // ── Tiebreaker: ptsPct → regWins ───────────────────────────────────────

  it("breaks ptsPct tie using regWins", async () => {
    // Replace atlantic teams 2 and 3 with the same ptsPct but different regWins.
    // Both have 45 wins 29 losses 0 otl → ptsPct=45/74≈0.608.
    // id 2 gets regWins=40 (more), id 3 gets regWins=32 (fewer).
    // Expected: id 2 ranks above id 3 (seeds 3 and 4).
    const standings = makeStandings().map((t) => {
      if (t.id === 2) return { ...t, wins: 45, losses: 29, otl: 0, ptsPct: 45 / 74, regWins: 40 };
      if (t.id === 3) return { ...t, wins: 45, losses: 29, otl: 0, ptsPct: 45 / 74, regWins: 32 };
      return t;
    });
    mockGetStandings.mockResolvedValue(standings);
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNhlPlayoffs("2024-25");

    const er1 = result.bracket.eastern.r1;
    // slot 1: A2(seed3) vs A3(seed4) — id2 should be A2 (higher regWins)
    expect(er1[1].teamA.id).toBe(2);
    expect(er1[1].teamB.id).toBe(3);
  });

  // ── Tiebreaker: ptsPct + regWins → H2H pts ─────────────────────────────

  it("breaks tie using H2H pts when ptsPct and regWins are equal", async () => {
    // id 2 and id 3: same ptsPct, same regWins, but id 2 beat id 3 in reg games (2 wins)
    const standings = makeStandings().map((t) => {
      if (t.id === 2) return { ...t, wins: 45, losses: 29, otl: 0, ptsPct: 45 / 74, regWins: 38 };
      if (t.id === 3) return { ...t, wins: 45, losses: 29, otl: 0, ptsPct: 45 / 74, regWins: 38 };
      return t;
    });
    mockGetStandings.mockResolvedValue(standings);
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    // id 2 beat id 3 twice in head-to-head regular-season games
    mockGetRegularSeasonGames.mockResolvedValue([
      { id: 5001, hometeamid: 2, awayteamid: 3, homescore: 4, awayscore: 2, winnerid: 2, ot1: null },
      { id: 5002, hometeamid: 3, awayteamid: 2, homescore: 2, awayscore: 4, winnerid: 2, ot1: null },
    ]);

    const result = await getNhlPlayoffs("2024-25");

    const er1 = result.bracket.eastern.r1;
    expect(er1[1].teamA.id).toBe(2); // better H2H pts → A2
    expect(er1[1].teamB.id).toBe(3);
  });

  // ── Both WCs from same division ─────────────────────────────────────────

  it("produces a valid bracket when both WCs come from the same division", async () => {
    // Make metropolitan teams 4 and 5 (id 14) and suppress atlantic id 4 by
    // giving id 13 MORE points than id 4, so both WCs are metropolitan.
    // atlantic: id 1(55), id 2(50), id 3(45), id 4(28) wins
    // metro:    id 11(52), id 12(48), id 13(44), id 14(38) wins
    // Top 3 from each: atl→1,2,3; metro→11,12,13
    // Remaining for WC: id4(28) and id14(38) → WC1=id14, WC2=id4
    // Both WCs are in different divisions here, but let's force both from metro:
    // Boost id14 to 38W and drop id4 to 20W so both WCs are from metropolitan.
    // Top 3 atlantic: 1,2,3. Top 3 metro: 11,12,13.
    // WC candidates: id14(38W, metro) and id4(20W, atlantic) → WC1=id14, WC2=id4.
    const standings = makeStandings().map((t) => {
      if (t.id === 4)  return makeTeam({ id: 4,  conf: "east", division: "atlantic",     wins: 20, losses: 54 });
      if (t.id === 14) return makeTeam({ id: 14, conf: "east", division: "metropolitan", wins: 38, losses: 36 });
      return t;
    });
    mockGetStandings.mockResolvedValue(standings);
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getNhlPlayoffs("2024-25");

    expect(result.isProjected).toBe(true);
    const er1 = result.bracket.eastern.r1;
    // WC1 = id 14 (38 wins, metro), WC2 = id 4 (20 wins, atlantic)
    expect(er1[3].teamB.id).toBe(14); // slot 3 → B1 vs WC1(14)
    expect(er1[0].teamB.id).toBe(4);  // slot 0 → A1 vs WC2(4)
    // Bracket structure should still be intact
    expect(er1).toHaveLength(4);
  });

  // ── Partial bracket (mid-playoffs) ─────────────────────────────────────

  it("builds a partial bracket from 3 complete R1 series and 1 in-progress", async () => {
    let id = 2000;

    // East R1: slots 0,1,2 complete; slot 3 ongoing (only 2 games played)
    const r1East = [
      ...sweep({ winnerId: 1,  loserId: 4,  startDate: "2025-04-19", gameIdStart: id }),  // slot 0: A1 beats WC2
    ];
    id += 10;
    r1East.push(...sweep({ winnerId: 2,  loserId: 3,  startDate: "2025-04-20", gameIdStart: id })); // slot 1
    id += 10;
    r1East.push(...sweep({ winnerId: 12, loserId: 13, startDate: "2025-04-21", gameIdStart: id })); // slot 2
    id += 10;
    // slot 3: 2 games played, no winner yet
    r1East.push(
      { id: id++, date: "2025-04-19", hometeamid: 11, awayteamid: 14, homescore: 4, awayscore: 2, winnerid: 11, status: "Final", type: "playoff" },
      { id: id++, date: "2025-04-21", hometeamid: 14, awayteamid: 11, homescore: 4, awayscore: 2, winnerid: 14, status: "Final", type: "playoff" }
    );

    // West R1: no games played yet (bracket should stay projected)
    mockPool.query.mockResolvedValueOnce({ rows: r1East });

    const result = await getNhlPlayoffs("2024-25");

    expect(result.isProjected).toBe(false);
    const er1 = result.bracket.eastern.r1;
    // Slot 0 (A1 vs WC2): complete, id 1 won
    expect(er1[0].winnerId).toBe(1);
    expect(er1[0].isComplete).toBe(true);
    // Slot 1 (A2 vs A3): complete, id 2 won
    expect(er1[1].winnerId).toBe(2);
    // Slot 2 (B2 vs B3): complete, id 12 won
    expect(er1[2].winnerId).toBe(12);
    // Slot 3 (B1 vs WC1): in progress — no winner, not complete
    expect(er1[3].isComplete).toBe(false);
    expect(er1[3].winnerId).toBeNull();

    // Semis should be empty (no semis games)
    expect(result.bracket.eastern.semis.every((s) => s.games.length === 0)).toBe(true);
    // Western R1 all projected (no games for west)
    expect(result.bracket.western.r1.every((s) => s.games.length === 0)).toBe(true);
  });

  // ── Complete bracket with Stanley Cup Final ─────────────────────────────

  it("builds a complete bracket with Stanley Cup Final when playoffs finish", async () => {
    let id = 3000;
    const games = [];

    // East R1
    games.push(...sweep({ winnerId: 1,  loserId: 4,  startDate: "2025-04-19", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 2,  loserId: 3,  startDate: "2025-04-20", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 12, loserId: 13, startDate: "2025-04-21", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 11, loserId: 14, startDate: "2025-04-22", gameIdStart: id })); id += 10;

    // East semis
    games.push(...sweep({ winnerId: 1,  loserId: 2,  startDate: "2025-05-06", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 11, loserId: 12, startDate: "2025-05-07", gameIdStart: id })); id += 10;

    // East conf finals
    games.push(...sweep({ winnerId: 1,  loserId: 11, startDate: "2025-05-20", gameIdStart: id })); id += 10;

    // West R1
    games.push(...sweep({ winnerId: 101, loserId: 104, startDate: "2025-04-19", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 102, loserId: 103, startDate: "2025-04-20", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 112, loserId: 113, startDate: "2025-04-21", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 111, loserId: 114, startDate: "2025-04-22", gameIdStart: id })); id += 10;

    // West semis
    games.push(...sweep({ winnerId: 101, loserId: 102, startDate: "2025-05-06", gameIdStart: id })); id += 10;
    games.push(...sweep({ winnerId: 111, loserId: 112, startDate: "2025-05-07", gameIdStart: id })); id += 10;

    // West conf finals
    games.push(...sweep({ winnerId: 101, loserId: 111, startDate: "2025-05-20", gameIdStart: id })); id += 10;

    // Stanley Cup Final
    const finals = sweep({ winnerId: 1, loserId: 101, startDate: "2025-06-07", gameIdStart: id, type: "final" });
    games.push(...finals); id += 10;

    mockPool.query.mockResolvedValueOnce({ rows: games });

    const result = await getNhlPlayoffs("2024-25");

    expect(result.isProjected).toBe(false);
    expect(result.playIn).toBeNull();

    // Finals
    expect(result.bracket.finals).toHaveLength(1);
    const scf = result.bracket.finals[0];
    expect(scf.isComplete).toBe(true);
    expect(scf.winnerId).toBe(1);

    // East conference champions
    expect(result.bracket.eastern.confFinals[0].winnerId).toBe(1);
    expect(result.bracket.eastern.confFinals[0].isComplete).toBe(true);

    // West conference champions
    expect(result.bracket.western.confFinals[0].winnerId).toBe(101);

    // R1 winners
    expect(result.bracket.eastern.r1[0].winnerId).toBe(1);
    expect(result.bracket.eastern.r1[1].winnerId).toBe(2);
    expect(result.bracket.eastern.r1[2].winnerId).toBe(12);
    expect(result.bracket.eastern.r1[3].winnerId).toBe(11);
  });
});
