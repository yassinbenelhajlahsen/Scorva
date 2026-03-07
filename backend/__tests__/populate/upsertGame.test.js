/**
 * Tests for upsertGame utility
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import upsertGame from "../../src/populate/src/upsertGame.js";

describe("upsertGame", () => {
  let mockClient;

  const basePayload = {
    eventid: 401584583,
    date: "2025-01-15",
    homeTeamId: 1,
    awayTeamId: 2,
    homeScore: 110,
    awayScore: 105,
    venue: "Crypto.com Arena",
    broadcast: "ESPN",
    quarters: {
      first: "28-25",
      second: "27-30",
      third: "30-25",
      fourth: "25-25",
      ot1: null,
      ot2: null,
      ot3: null,
      ot4: null,
    },
    status: "Final",
    seasonText: "2024-25",
    gameLabel: null,
    currentPeriod: null,
    clock: null,
  };

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };
  });

  it("should insert a new game and set winner", async () => {
    // First call: INSERT RETURNING id
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
    // Second call: UPDATE winnerid
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const result = await upsertGame(mockClient, "nba", basePayload);

    expect(result).toBe(100);
    expect(mockClient.query).toHaveBeenCalledTimes(2);
  });

  it("should include all game fields in insert", async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", basePayload);

    const insertValues = mockClient.query.mock.calls[0][1];
    expect(insertValues).toContain(401584583); // eventid
    expect(insertValues).toContain("2025-01-15"); // date
    expect(insertValues).toContain(1); // homeTeamId
    expect(insertValues).toContain(2); // awayTeamId
    expect(insertValues).toContain("nba"); // league
    expect(insertValues).toContain(110); // homeScore
    expect(insertValues).toContain(105); // awayScore
    expect(insertValues).toContain("Crypto.com Arena"); // venue
    expect(insertValues).toContain("ESPN"); // broadcast
    expect(insertValues).toContain("28-25"); // first quarter
    expect(insertValues).toContain("Final"); // status
    expect(insertValues).toContain("2024-25"); // season
  });

  it("should use eventid and league as conflict key", async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", basePayload);

    const insertQuery = mockClient.query.mock.calls[0][0];
    expect(insertQuery).toContain("ON CONFLICT (eventid, league)");
  });

  it("should update winner based on scores", async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 50 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", basePayload);

    const updateQuery = mockClient.query.mock.calls[1][0];
    expect(updateQuery).toContain("WHEN homescore > awayscore THEN hometeamid");
    expect(updateQuery).toContain("WHEN awayscore > homescore THEN awayteamid");
    expect(mockClient.query.mock.calls[1][1]).toEqual([50]);
  });

  it("should handle overtime quarter values", async () => {
    const otPayload = {
      ...basePayload,
      quarters: {
        ...basePayload.quarters,
        ot1: "5-3",
        ot2: "3-2",
      },
    };

    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", otPayload);

    const insertValues = mockClient.query.mock.calls[0][1];
    expect(insertValues).toContain("5-3");
    expect(insertValues).toContain("3-2");
  });

  it("should handle null quarter values", async () => {
    const noQuarters = {
      ...basePayload,
      quarters: {
        first: null,
        second: null,
        third: null,
        fourth: null,
        ot1: null,
        ot2: null,
        ot3: null,
        ot4: null,
      },
    };

    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nfl", noQuarters);

    expect(mockClient.query).toHaveBeenCalledTimes(2);
  });

  it("should handle game labels", async () => {
    const playoffPayload = {
      ...basePayload,
      gameLabel: "NBA Finals - Game 1",
    };

    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", playoffPayload);

    const insertValues = mockClient.query.mock.calls[0][1];
    expect(insertValues).toContain("NBA Finals - Game 1");
  });

  it("should handle null gameLabel", async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", basePayload);

    const insertValues = mockClient.query.mock.calls[0][1];
    // gameLabel ($20), currentPeriod ($21), clock ($22) should all be null
    expect(insertValues[19]).toBeNull();
    expect(insertValues[20]).toBeNull();
    expect(insertValues[21]).toBeNull();
  });

  it("should write currentPeriod and clock for live games", async () => {
    const livePayload = {
      ...basePayload,
      status: "In Progress",
      currentPeriod: 3,
      clock: "2:34",
    };

    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", livePayload);

    const insertValues = mockClient.query.mock.calls[0][1];
    expect(insertValues).toContain(3);    // currentPeriod
    expect(insertValues).toContain("2:34"); // clock
  });

  it("should include current_period and clock in ON CONFLICT UPDATE", async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await upsertGame(mockClient, "nba", basePayload);

    const insertQuery = mockClient.query.mock.calls[0][0];
    expect(insertQuery).toContain("current_period");
    expect(insertQuery).toContain("clock");
  });

  it("should propagate query errors", async () => {
    mockClient.query.mockRejectedValue(new Error("DB error"));

    await expect(
      upsertGame(mockClient, "nba", basePayload)
    ).rejects.toThrow("DB error");
  });
});
