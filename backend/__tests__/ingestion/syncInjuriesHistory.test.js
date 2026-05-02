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
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee", status_changed_at: null }] }],
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
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee", status_changed_at: null }] }],
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
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee", status_changed_at: null }] }],
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
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee", status_changed_at: null }] }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("does NOT insert when entry.date matches stored status_changed_at", async () => {
    // ESPN's entry.date is the canonical "this report was filed at" timestamp.
    // If it matches what we last saved, the report is the same — no history row,
    // even if shortComment text drifted.
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nba/player/_/id/4234/test" }] },
            status: "out",
            shortComment: "knee — updated news copy",
            date: "2025-09-05T21:43Z",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee", status_changed_at: new Date("2025-09-05T21:43Z") }] }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("inserts when entry.date advances even if status unchanged", async () => {
    // ESPN bumped the injury report (e.g. severity update) — we want a new
    // history row keyed at ESPN's date, not NOW().
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nba/player/_/id/4234/test" }] },
            status: "out",
            shortComment: "knee — re-evaluated",
            date: "2026-04-22T21:37Z",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "knee", status_changed_at: new Date("2025-09-05T21:43Z") }] }],
      [/INSERT INTO player_status_history/, { rowCount: 1 }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCall = pool.queryHandler.mock.calls.find(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCall).toBeDefined();
    // entry.date passed as last param (parameterized changed_at)
    const params = insertCall[1];
    const entryDateParam = params[params.length - 1];
    expect(entryDateParam).toBeInstanceOf(Date);
    expect(entryDateParam.toISOString()).toBe("2026-04-22T21:37:00.000Z");
  });

  it("backfills status_changed_at on first sync of a known-injured player", async () => {
    // Existing player with status set but status_changed_at NULL (deploy state).
    // First sync should create exactly one history row with changed_at = entry.date
    // and update players.status_changed_at.
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nba/player/_/id/4234/test" }] },
            status: "out",
            shortComment: "torn ACL",
            date: "2025-09-05T21:43Z",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "torn ACL", status_changed_at: null }] }],
      [/INSERT INTO player_status_history/, { rowCount: 1 }],
      [/UPDATE players[\s\S]*SET status/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nba");

    const insertCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCalls).toHaveLength(1);
    const params = insertCalls[0][1];
    expect(params[params.length - 1]).toBeInstanceOf(Date);
    expect(params[params.length - 1].toISOString()).toBe("2025-09-05T21:43:00.000Z");
  });

  it("does NOT process ESPN entries with status=Active (roster news, not injuries)", async () => {
    // ESPN's NFL injury feed includes contract signings / trade news / returns
    // tagged status="Active" with roster-news shortComment text. We must skip
    // these — they aren't injuries, and processing them would pollute history.
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nfl/player/_/id/4234/test" }] },
            status: "Active",
            shortComment: "Player agreed to a three-year, $25M contract on Monday.",
            date: "2026-05-01T18:00Z",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      // Player has no prior status — should remain untouched
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: null, status_description: null, status_changed_at: null }] }],
    ]);

    await syncInjuriesForLeague(pool, "nfl");

    const insertCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    const updateCalls = pool.queryHandler.mock.calls.filter(([sql]) =>
      /UPDATE players[\s\S]*SET status\s*=\s*\$1/.test(sql)
    );
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
  });

  it("clears a previously-injured player when ESPN now lists them as Active", async () => {
    // Player was 'out' in DB; ESPN now lists them as Active (recovered/returned).
    // We skip the entry, but the league-wide clear sweep should fire and
    // transition them out → null with NOW() as changed_at (legitimate clear).
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [{
          id: 1,
          injuries: [{
            athlete: { links: [{ href: "/nfl/player/_/id/4234/test" }] },
            status: "Active",
            shortComment: "Player has been activated from injured reserve.",
            date: "2026-05-01T18:00Z",
          }],
        }],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/, { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "ankle", status_changed_at: new Date("2026-04-01T00:00Z") }] }],
      // League-wide clear sweep finds this player (status set, espn id NOT in injuredEspnIds since we skipped Active)
      [/SELECT id, league, status, status_description FROM players[\s\S]*NOT \(espn_playerid = ANY/, { rows: [{ id: 4234, league: "nfl", status: "out", status_description: "ankle" }] }],
      [/INSERT INTO player_status_history/, { rowCount: 1 }],
      [/UPDATE players[\s\S]*SET status[\s\S]*= NULL/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nfl");

    const insertCall = pool.queryHandler.mock.calls.find(([sql]) =>
      /INSERT INTO player_status_history/.test(sql)
    );
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([4234, "nfl", "out", "ankle", null, null])
    );
  });

  it("inserts a history row when clearing status (active player no longer injured)", async () => {
    mockAxiosGet.mockResolvedValueOnce({ data: { injuries: [{ id: 1, injuries: [] }] } });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      // The "clear" sweep uses a SELECT to find players to clear
      [/SELECT id, league, status, status_description FROM players[\s\S]*NOT \(espn_playerid = ANY/, { rows: [
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

  it("does NOT clear a player whose teamid in DB is stale (ESPN lists them under a different team)", async () => {
    // Stale-teamid bug: player traded/signed during offseason. ESPN's league
    // injury feed lists them under their NEW team's block; our DB still has
    // them on the OLD team because upsertPlayer hasn't run (no box scores).
    // The clear sweep must use a league-global injuredEspnIds set so a stale
    // teamid doesn't make team A's sweep wrongly clear a player whom ESPN
    // actually listed under team B's block.
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        injuries: [
          { id: 1, injuries: [] },                         // team A — no entries
          { id: 2, injuries: [{                            // team B — lists player
            athlete: { links: [{ href: "/nfl/player/_/id/4234/test" }] },
            status: "out",
            shortComment: "ankle",
            date: "2026-04-01T00:00Z",
          }] },
        ],
      },
    });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [
        { id: 1, espnid: 1 },  // DB: player has stale teamid=1 (team A)
        { id: 2, espnid: 2 },  // ESPN now lists player under team B
      ] }],
      [/SELECT id, espn_playerid, status, status_description, status_changed_at FROM players[\s\S]*WHERE espn_playerid = ANY/,
        { rows: [{ id: 4234, espn_playerid: 4234, status: "out", status_description: "ankle", status_changed_at: new Date("2026-04-01T00:00Z") }] }],
      // Pre-fix codepath (per-team sweep): team A finds the stale player, team B does not.
      // After fix this regex is never hit (SQL changes).
      [/SELECT id, league, status, status_description FROM players[\s\S]*WHERE teamid/, (sql, params) => {
        if (params?.[0] === 1) {
          return { rows: [{ id: 4234, league: "nfl", status: "out", status_description: "ankle" }] };
        }
        return { rows: [] };
      }],
      // Post-fix codepath (league-wide sweep): player IS in global injuredEspnIds → empty.
      [/SELECT id, league, status, status_description FROM players[\s\S]*NOT \(espn_playerid = ANY/, { rows: [] }],
      [/UPDATE players[\s\S]*SET status\s*=\s*\$1/, { rowCount: 1 }],
    ]);

    await syncInjuriesForLeague(pool, "nfl");

    // No spurious "out → null" history row should ever be inserted.
    const clearInserts = pool.queryHandler.mock.calls.filter(([sql, params]) =>
      /INSERT INTO player_status_history/.test(sql) &&
      params?.[2] === "out" &&
      params?.[4] === null
    );
    expect(clearInserts).toHaveLength(0);
  });

  it("inserts a history row for stale-cleared players", async () => {
    // Empty injuries response so per-entry path doesn't fire
    mockAxiosGet.mockResolvedValueOnce({ data: { injuries: [{ id: 1, injuries: [] }] } });

    const pool = makePool([
      [/SELECT id, espnid FROM teams/, { rows: [{ id: 1, espnid: 1 }] }],
      // League-wide clear sweep returns no rows
      [/SELECT id, league, status, status_description FROM players[\s\S]*NOT \(espn_playerid = ANY/, { rows: [] }],
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
