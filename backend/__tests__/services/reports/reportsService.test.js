import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockCached = jest.fn().mockImplementation(async (_k, _t, fn) => fn());
jest.unstable_mockModule(resolve(__dirname, "../../../src/cache/cache.js"), () => ({
  cached: mockCached,
  CACHE_VERSION: 11,
}));

const mockInjuries = jest.fn();
const mockMoves = jest.fn();
const mockBirthdays = jest.fn();
const mockStreaks = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/reports/injuriesReports.js"),
  () => ({ getInjuriesForLeague: mockInjuries })
);
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/reports/movesReports.js"),
  () => ({ getMovesForLeague: mockMoves })
);
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/reports/birthdaysReports.js"),
  () => ({ getBirthdaysForLeague: mockBirthdays })
);
jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/reports/streaksReports.js"),
  () => ({ getStreaksForLeague: mockStreaks })
);

const { getReportsForLeague, getReportsAcrossLeagues } = await import(
  resolve(__dirname, "../../../src/services/reports/reportsService.js")
);

function r(type, date) {
  return { id: `${type}-${date}`, type, date, league: "nba", player: { id: 1, name: "x" } };
}

describe("getReportsForLeague", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_k, _t, fn) => fn());
  });

  it("merges all four type sources, sorted by date DESC", async () => {
    mockInjuries.mockResolvedValueOnce([r("injury", "2026-04-30T18:00:00Z")]);
    mockMoves.mockResolvedValueOnce([r("move", "2026-04-29T07:00:00Z")]);
    mockBirthdays.mockResolvedValueOnce([r("birthday", "2026-04-28T00:00:00Z")]);
    mockStreaks.mockResolvedValueOnce([r("streak", "2026-04-27T22:00:00Z")]);

    const out = await getReportsForLeague("nba");

    expect(out.map((x) => x.type)).toEqual(["injury", "move", "birthday", "streak"]);
  });

  it("survives one type service failing", async () => {
    mockInjuries.mockResolvedValueOnce([r("injury", "2026-04-30T18:00:00Z")]);
    mockMoves.mockRejectedValueOnce(new Error("ESPN down"));
    mockBirthdays.mockResolvedValueOnce([]);
    mockStreaks.mockResolvedValueOnce([]);

    const out = await getReportsForLeague("nba");
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("injury");
  });

  it("calls cached with the per-league key and 30-min TTL", async () => {
    mockInjuries.mockResolvedValueOnce([]);
    mockMoves.mockResolvedValueOnce([]);
    mockBirthdays.mockResolvedValueOnce([]);
    mockStreaks.mockResolvedValueOnce([]);

    await getReportsForLeague("nba");
    expect(mockCached).toHaveBeenCalledWith("reports:list:nba", 1800, expect.any(Function));
  });
});

describe("getReportsAcrossLeagues", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_k, _t, fn) => fn());
  });

  it("merges all three leagues sorted by date DESC", async () => {
    // Three calls (one per league); each returns an empty list except the matching one.
    mockInjuries
      .mockResolvedValueOnce([r("injury", "2026-04-30T18:00:00Z")])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockMoves
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...r("move", "2026-04-29T07:00:00Z"), league: "nfl" }])
      .mockResolvedValueOnce([]);
    mockBirthdays
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...r("birthday", "2026-04-28T00:00:00Z"), league: "nhl" }]);
    mockStreaks.mockResolvedValue([]);

    const out = await getReportsAcrossLeagues();

    expect(out.map((x) => x.league)).toEqual(["nba", "nfl", "nhl"]);
  });
});
