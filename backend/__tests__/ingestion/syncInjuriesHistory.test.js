import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockAxiosGet = jest.fn();
jest.unstable_mockModule("axios", () => ({
  default: { get: mockAxiosGet },
}));

const { syncInjuriesForLeague } = await import(
  resolve(__dirname, "../../src/ingestion/syncInjuries.js")
);

function makePool(queries) {
  const queryHandler = jest.fn(async (sql, params) => {
    for (const [pattern, response] of queries) {
      if (pattern.test(sql)) return typeof response === "function" ? response(sql, params) : response;
    }
    return { rows: [], rowCount: 0 };
  });
  const release = jest.fn();
  return {
    connect: async () => ({ query: queryHandler, release }),
    queryHandler,
  };
}

describe("syncInjuries history insertion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("inserts a history row when a player's status changes", async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nba/player/_/id/4234/test" }] },
            status: "questionable",
            shortComment: "right calf soreness",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee" }] }],
      [/INSERT INTO player_status_history/, { rowCount: 1 }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCall = pool.queryHandler.mock.calls.find(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([
        expect.any(Number),       // playerId
        "nba",                     // league
        "out",                     // prev_status
        "knee",                    // prev_status_description
        "questionable",            // new_status
        "right calf soreness",     // new_status_description
      ])
    );
  });

  it("does NOT insert a history row when status is unchanged", async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nba/player/_/id/4234/test" }] },
            status: "out",
            shortComment: "knee",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee" }] }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("does NOT insert when ESPN omits the description for an unchanged injury", async () => {
    // Regression: ESPN intermittently drops shortComment/longComment. We must not
    // treat that as a description change and bump changed_at on old injuries.
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nba/player/_/id/4234/test" }] },
            status: "out",
            // shortComment / longComment intentionally absent
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee" }] }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("does NOT insert when description differs only by whitespace", async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nba/player/_/id/4234/test" }] },
            status: "out",
            shortComment: "  knee  ",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee" }] }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("inserts a history row when clearing status (active player no longer injured)", async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { injuries: [{ id: 1, injuries: [] }] } });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      // The "clear" sweep uses a SELECT to find players to clear
      [/SELECT id, league, status, status_description FROM players[\s\S]*WHERE teamid/, { rows: [
        { id: 4234, league: "nba", status: "out", status_description: "ankle" }
      ] }],
      [/INSERT INTO player_status_history/, { rowCount: 1 }],
      [/UPDATE players[\s\S]*SET status[\s\S]*= NULL/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCall = pool.queryHandler.mock.calls.find(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([4234, "nba", "out", "ankle", null, null])
    );
  });

  it("inserts a history row for stale-cleared players", async () => {
    // Empty injuries response so per-entry path doesn't fire
    mockAxiosGet.mockResolvedValueOnce({ data: { injuries: [{ id: 1, injuries: [] }] } });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      // Per-team clear sweep returns no rows
      [/SELECT id, league, status, status_description FROM players[\s\S]*WHERE teamid/, { rows: [] }],
      // Stale sweep finds one stale row
      [/SELECT id, league, status, status_description FROM players[\s\S]*status_updated_at\s*<\s*NOW/, {
        rows: [{ id: 5000, league: "nba", status: "out", status_description: "recovery" }],
      }],
      [/INSERT INTO player_status_history/, { rowCount: 1 }],
      [/UPDATE players[\s\S]*SET status[\s\S]*= NULL[\s\S]*status_updated_at\s*<\s*NOW/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCall = pool.queryHandler.mock.calls.find(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([5000, "nba", "out", "recovery", null, null])
    );
  });
});
