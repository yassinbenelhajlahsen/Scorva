import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockAxiosGet = jest.fn();
jest.unstable_mockModule("axios", () => ({
  default: { get: mockAxiosGet },
}));

const { runSeed } = await import(
  resolve(__dirname, "../../src/ingestion/scripts/seedAwards.js")
);

function awardIndexResp(refIds, league = "nba", year = 2025) {
  const sport = league === "nba" ? "basketball" : league === "nfl" ? "football" : "hockey";
  return {
    data: {
      count: refIds.length,
      items: refIds.map((id) => ({
        $ref: `http://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/seasons/${year}/awards/${id}`,
      })),
    },
  };
}

function awardResp({ id, name, athleteIds = [] }) {
  return {
    data: {
      id: String(id),
      name,
      winners: athleteIds.map((aid) => ({
        athlete: { $ref: `http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2025/athletes/${aid}` },
      })),
    },
  };
}

function makePool() {
  const queryFn = jest.fn();
  return {
    query: queryFn,
    end: jest.fn(),
  };
}

describe("seedAwards.runSeed", () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
  });

  it("inserts a mapped, matched award", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([33]))
      .mockResolvedValueOnce(awardResp({ id: 33, name: "MVP", athleteIds: [12345] }));
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 999 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] });

    const summary = await runSeed({
      pool,
      args: { league: "nba", season: "2024-25", "dry-run": false },
    });

    expect(summary.inserted).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.unmatched).toEqual([]);
    expect(summary.unmapped).toEqual([]);
    expect(summary.errors).toBe(0);

    const insertCall = pool.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO player_awards"));
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual([999, "nba", "2024-25", "mvp", "MVP"]);
  });

  it("dry-run does not call INSERT but still counts inserted", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([33]))
      .mockResolvedValueOnce(awardResp({ id: 33, name: "MVP", athleteIds: [12345] }));
    pool.query.mockResolvedValueOnce({ rows: [{ id: 999 }] });

    const summary = await runSeed({
      pool,
      args: { league: "nba", season: "2024-25", "dry-run": true },
    });

    expect(summary.inserted).toBe(1);
    const insertCalls = pool.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO"));
    expect(insertCalls).toHaveLength(0);
  });

  it("counts ON CONFLICT result as skipped", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([33]))
      .mockResolvedValueOnce(awardResp({ id: 33, name: "MVP", athleteIds: [12345] }));
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 999 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const summary = await runSeed({
      pool,
      args: { league: "nba", season: "2024-25", "dry-run": false },
    });

    expect(summary.inserted).toBe(0);
    expect(summary.skipped).toBe(1);
  });

  it("logs unmatched athletes when player not in DB", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([33]))
      .mockResolvedValueOnce(awardResp({ id: 33, name: "MVP", athleteIds: [99999] }));
    pool.query.mockResolvedValueOnce({ rows: [] });

    const summary = await runSeed({
      pool,
      args: { league: "nba", season: "2024-25", "dry-run": false },
    });

    expect(summary.inserted).toBe(0);
    expect(summary.unmatched).toHaveLength(1);
    expect(summary.unmatched[0]).toMatchObject({
      league: "nba",
      season: "2024-25",
      awardType: "mvp",
      espnAthleteId: 99999,
    });
  });

  it("logs unmapped awards", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([777]))
      .mockResolvedValueOnce(awardResp({ id: 777, name: "Some Future Award", athleteIds: [12345] }));

    const summary = await runSeed({
      pool,
      args: { league: "nba", season: "2024-25", "dry-run": false },
    });

    expect(summary.unmapped).toHaveLength(1);
    expect(summary.unmapped[0]).toMatchObject({
      league: "nba",
      season: "2024-25",
      espnId: "777",
      espnName: "Some Future Award",
    });
    const playerLookups = pool.query.mock.calls.filter(([sql]) => sql.includes("FROM players"));
    expect(playerLookups).toHaveLength(0);
  });

  it("silently counts known out-of-scope awards (no warning, no unmapped entry)", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([888]))
      .mockResolvedValueOnce(awardResp({ id: 888, name: "Coach of the Year", athleteIds: [12345] }));

    const summary = await runSeed({
      pool,
      args: { league: "nba", season: "2024-25", "dry-run": false },
    });

    expect(summary.unmapped).toHaveLength(0);
    expect(summary.outOfScope).toBe(1);
    const playerLookups = pool.query.mock.calls.filter(([sql]) => sql.includes("FROM players"));
    expect(playerLookups).toHaveLength(0);
  });

  it("auto-routes --season 'YYYY-YY' to NBA + NHL only (skips NFL)", async () => {
    const pool = makePool();
    mockAxiosGet.mockResolvedValue({ data: { items: [] } });

    const summary = await runSeed({
      pool,
      args: { season: "2024-25", "dry-run": true },
    });

    expect(summary.errors).toBe(0);
    // Two leagues processed (NBA + NHL), each fetches its index → 2 axios calls.
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    const urls = mockAxiosGet.mock.calls.map(([url]) => url);
    expect(urls.some((u) => u.includes("/leagues/nba/"))).toBe(true);
    expect(urls.some((u) => u.includes("/leagues/nhl/"))).toBe(true);
    expect(urls.some((u) => u.includes("/leagues/nfl/"))).toBe(false);
  });

  it("backfill stops on 404 from award index", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([33]))
      .mockResolvedValueOnce(awardResp({ id: 33, name: "MVP", athleteIds: [12345] }))
      .mockRejectedValueOnce({ response: { status: 404 } });
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 999 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] });

    const summary = await runSeed({
      pool,
      args: { league: "nba", backfill: true, "dry-run": false },
    });

    expect(summary.inserted).toBe(1);
    expect(summary.errors).toBe(0);
  });

  it("backfill stops on empty items array", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([33]))
      .mockResolvedValueOnce(awardResp({ id: 33, name: "MVP", athleteIds: [12345] }))
      .mockResolvedValueOnce({ data: { items: [] } });
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 999 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] });

    const summary = await runSeed({
      pool,
      args: { league: "nba", backfill: true, "dry-run": false },
    });

    expect(summary.inserted).toBe(1);
  });

  it("handles multiple winners on a single award (e.g., All-NBA team)", async () => {
    const pool = makePool();
    mockAxiosGet
      .mockResolvedValueOnce(awardIndexResp([40]))
      .mockResolvedValueOnce(awardResp({ id: 40, name: "All-NBA First Team", athleteIds: [1, 2, 3, 4, 5] }));
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 101 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 102 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 103 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 104 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 4 }] })
      .mockResolvedValueOnce({ rows: [{ id: 105 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 5 }] });

    const summary = await runSeed({
      pool,
      args: { league: "nba", season: "2024-25", "dry-run": false },
    });

    expect(summary.inserted).toBe(5);
    const insertCalls = pool.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO player_awards"));
    expect(insertCalls).toHaveLength(5);
    expect(insertCalls[0][1][3]).toBe("all_nba_first");
  });
});
