import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));

const { updateStreakEvents } = await import(
  resolve(__dirname, "../../src/ingestion/streakEvents.js"),
);

describe("updateStreakEvents — player streaks", () => {
  let pool;
  let client;

  beforeEach(() => {
    pool = createMockPool();
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    jest.clearAllMocks();
  });

  it("opens a transaction and releases the client", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const calls = client.query.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe("BEGIN");
    expect(calls[calls.length - 1]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("scans player streaks for the requested league only", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    expect(scanCalls.length).toBeGreaterThan(0);
    for (const [, params] of scanCalls) {
      expect(params[0]).toBe("nba");
    }
  });

  it("upserts active player streaks via ON CONFLICT", async () => {
    client.query.mockImplementation(async (sql, params) => {
      if (typeof sql !== "string") return { rows: [] };
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (/double-double/i.test(sql) && /FROM stats/i.test(sql)) {
        return {
          rows: [
            {
              subject_id: 4234,
              length: 5,
              start_game_date: "2026-04-20",
              last_game_date: "2026-04-29",
            },
          ],
        };
      }
      return { rows: [] };
    });

    await updateStreakEvents(pool, "nba");

    const upsertCall = client.query.mock.calls.find(
      (c) => typeof c[0] === "string" && /INSERT INTO streak_events/i.test(c[0]),
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall[0]).toMatch(/ON CONFLICT.*DO UPDATE/i);
    const params = upsertCall[1];
    expect(params).toEqual(expect.arrayContaining(["player", 4234, "double-double"]));
  });

  it("deactivates rows that fall out of the active set", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const deactivate = client.query.mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        /UPDATE streak_events/i.test(c[0]) &&
        /is_active\s*=\s*FALSE/i.test(c[0]),
    );
    expect(deactivate).toBeDefined();
    expect(deactivate[0]).toMatch(/league\s*=\s*\$1/);
    expect(deactivate[1][0]).toBe("nba");
  });

  it("rolls back on error and releases the client", async () => {
    client.query.mockImplementation(async (sql) => {
      if (sql === "BEGIN") return { rows: [] };
      throw new Error("boom");
    });

    await expect(updateStreakEvents(pool, "nba")).rejects.toThrow("boom");

    const calls = client.query.mock.calls.map((c) => c[0]);
    expect(calls).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("uses NBA threshold of 4 for player streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe("2025-26");
      expect(params[2]).toBe(4);
    }
  });

  it("uses NFL threshold of 3 for player streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nfl");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe("2025-26");
      expect(params[2]).toBe(3);
    }
  });

  it("uses NHL threshold of 3 for player streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nhl");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe("2025-26");
      expect(params[2]).toBe(3);
    }
  });

  it("filters games by season instead of a recent-day window", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    expect(scanCalls.length).toBeGreaterThan(0);
    for (const [sql] of scanCalls) {
      expect(sql).toMatch(/g\.season\s*=\s*\$2/);
      expect(sql).not.toMatch(/INTERVAL/i);
    }
  });

  it("only counts completed (Final) games in player streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    expect(scanCalls.length).toBeGreaterThan(0);
    for (const [sql] of scanCalls) {
      expect(sql).toMatch(/g\.status\s+ILIKE\s+'Final%'/i);
    }
  });

  it("threads an explicit season override into queries", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba", { season: "2024-25" });

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM stats/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe("2024-25");
    }
  });

  it("throws when an explicit season is null or empty", async () => {
    await expect(updateStreakEvents(pool, "nba", { season: null }))
      .rejects.toThrow(/explicit season required/);
    await expect(updateStreakEvents(pool, "nba", { season: "" }))
      .rejects.toThrow(/explicit season required/);
  });
});

describe("updateStreakEvents — team streaks", () => {
  let pool;
  let client;

  beforeEach(() => {
    pool = createMockPool();
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    jest.clearAllMocks();
  });

  it("scans team W/L streaks from games for the requested league", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM games/i.test(c[0]) && /hometeamid|awayteamid/i.test(c[0]),
    );
    expect(scanCalls.length).toBeGreaterThan(0);
    for (const [, params] of scanCalls) {
      expect(params[0]).toBe("nba");
    }
  });

  it("filters team scans by threshold of 3", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM games/i.test(c[0]),
    );
    for (const [, params] of scanCalls) {
      expect(params[1]).toBe("2025-26");
      expect(params[2]).toBe(3);
    }
  });

  it("upserts active team streaks with subject_type='team'", async () => {
    client.query.mockImplementation(async (sql) => {
      if (typeof sql !== "string") return { rows: [] };
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      if (/FROM games/i.test(sql) && /BOOL_AND\(won\)/i.test(sql)) {
        return {
          rows: [
            {
              subject_id: 13,
              stat_label: "win",
              length: 5,
              start_game_date: "2026-04-20",
              last_game_date: "2026-04-29",
            },
          ],
        };
      }
      return { rows: [] };
    });

    await updateStreakEvents(pool, "nba");

    const upsertCall = client.query.mock.calls.find(
      (c) => typeof c[0] === "string" && /INSERT INTO streak_events/i.test(c[0]),
    );
    expect(upsertCall).toBeDefined();
    expect(upsertCall[1]).toEqual(expect.arrayContaining(["team", 13, "win"]));
  });

  it("ignores tied games (homescore = awayscore)", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nfl");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM games/i.test(c[0]),
    );
    for (const [sql] of scanCalls) {
      expect(sql).toMatch(/homescore\s*<>\s*awayscore/);
    }
  });

  it("only counts completed (Final) games in team streaks", async () => {
    client.query.mockResolvedValue({ rows: [] });

    await updateStreakEvents(pool, "nba");

    const scanCalls = client.query.mock.calls.filter(
      (c) => typeof c[0] === "string" && /FROM games/i.test(c[0]),
    );
    expect(scanCalls.length).toBeGreaterThan(0);
    for (const [sql] of scanCalls) {
      expect(sql).toMatch(/g\.status\s+ILIKE\s+'Final%'/i);
    }
  });
});
