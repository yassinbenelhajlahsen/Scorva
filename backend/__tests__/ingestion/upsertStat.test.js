/**
 * Tests for upsertStat utility
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import upsertStat from "../../src/ingestion/upsertStat.js";

describe("upsertStat", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };
  });

  it("should insert NBA stats", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    const stats = {
      points: 28,
      assists: 7,
      rebounds: 8,
      blocks: 1,
      steals: 2,
      fg: "10-18",
      threept: "3-7",
      ft: "5-6",
      turnovers: 3,
      plusminus: "+12",
      minutes: "35",
      fouls: 3,
    };

    const result = await upsertStat(mockClient, 100, 200, stats);

    expect(result).toBe(1);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO stats"),
      expect.arrayContaining([100, 200, 28, 7, 8])
    );
  });

  it("should insert NFL stats", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 2 }] });

    const stats = {
      cmpatt: "22/30",
      yds: 320,
      sacks: 2,
      td: 3,
      interceptions: 1,
    };

    const result = await upsertStat(mockClient, 100, 300, stats);

    expect(result).toBe(2);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([100, 300, "22/30"])
    );
  });

  it("should insert NHL stats", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 3 }] });

    const stats = {
      g: 2,
      a: 1,
      saves: 30,
      savePct: ".920",
      ga: 3,
      toi: "20:15",
      shots: 5,
      sm: 3,
      bs: 1,
      pn: 1,
      pim: 2,
      ht: 3,
      tk: 1,
      gv: 0,
    };

    const result = await upsertStat(mockClient, 100, 400, stats);

    expect(result).toBe(3);
  });

  it("should use gameid and playerid as conflict key", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertStat(mockClient, 1, 2, {});

    const query = mockClient.query.mock.calls[0][0];
    expect(query).toContain("ON CONFLICT (gameid, playerid)");
    expect(query).toContain("RETURNING id");
  });

  it("should handle null/missing stats gracefully", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await upsertStat(mockClient, 1, 2, {});

    expect(result).toBe(1);
    const values = mockClient.query.mock.calls[0][1];
    // gameid and playerid should be set, most stats null
    expect(values[0]).toBe(1);
    expect(values[1]).toBe(2);
    // Remaining values should be null
    expect(values.slice(2).every((v) => v === null)).toBe(true);
  });

  it("should parse td with slash format (e.g. '2/0')", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertStat(mockClient, 1, 2, { td: "2/0" });

    const values = mockClient.query.mock.calls[0][1];
    // td is at index 16 (gameid=0, playerid=1, ...14 fields..., td=16)
    expect(values[16]).toBe(2);
  });

  it("should handle numeric td value", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertStat(mockClient, 1, 2, { td: 3 });

    const values = mockClient.query.mock.calls[0][1];
    expect(values[16]).toBe(3);
  });

  it("should handle null td value", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertStat(mockClient, 1, 2, { td: null });

    const values = mockClient.query.mock.calls[0][1];
    expect(values[16]).toBeNull();
  });

  it("should parse minutes as integer", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertStat(mockClient, 1, 2, { minutes: "35" });

    const values = mockClient.query.mock.calls[0][1];
    // minutes is at index 12
    expect(values[12]).toBe(35);
  });

  it("should handle non-numeric minutes", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertStat(mockClient, 1, 2, { minutes: "N/A" });

    const values = mockClient.query.mock.calls[0][1];
    expect(values[12]).toBeNull();
  });

  it("should parse yds as integer", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertStat(mockClient, 1, 2, { yds: "250" });

    const values = mockClient.query.mock.calls[0][1];
    // yds is at index 14
    expect(values[14]).toBe(250);
  });

  it("should propagate query errors", async () => {
    mockClient.query.mockRejectedValue(new Error("Insert failed"));

    await expect(
      upsertStat(mockClient, 1, 2, { points: 10 })
    ).rejects.toThrow("Insert failed");
  });
});
