/**
 * Tests for upsertTeam utility
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import upsertTeam from "../../src/ingestion/upsert/upsertTeam.js";

describe("upsertTeam", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };
  });

  it("should insert a new team with all fields", async () => {
    mockClient.query.mockResolvedValue({
      rows: [{ id: 1 }],
    });

    const result = await upsertTeam(mockClient, 13, "nba", {
      name: "Los Angeles Lakers",
      shortname: "Lakers",
      location: "Los Angeles",
      logo_url: "https://example.com/lal.png",
      record: "25-15",
      homerecord: "15-5",
      awayrecord: "10-10",
    });

    expect(result).toBe(1);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO teams"),
      [
        13,
        "nba",
        "Los Angeles Lakers",
        "Lakers",
        "Los Angeles",
        "https://example.com/lal.png",
        "25-15",
        "15-5",
        "10-10",
        null,
      ]
    );
  });

  it("should update existing team on conflict", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 5 }] });

    await upsertTeam(mockClient, 13, "nba", {
      name: "Updated Name",
      shortname: "UPD",
      location: "New Location",
      logo_url: "https://example.com/new.png",
      record: "30-10",
      homerecord: "18-2",
      awayrecord: "12-8",
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (espnid, league"),
      expect.any(Array)
    );
  });

  it("should handle null optional fields", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 2 }] });

    const result = await upsertTeam(mockClient, 99, "nfl", {
      name: "Test Team",
      record: "0-0",
    });

    expect(result).toBe(2);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      [99, "nfl", "Test Team", null, null, null, "0-0", null, null, null]
    );
  });

  it("should return the team id", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 42 }] });

    const result = await upsertTeam(mockClient, 7, "nhl", {
      name: "Hockey Team",
      record: "10-5",
    });

    expect(result).toBe(42);
  });

  it("should use espnid and league as conflict key", async () => {
    mockClient.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await upsertTeam(mockClient, 1, "nba", { name: "Team", record: "0-0" });

    const query = mockClient.query.mock.calls[0][0];
    expect(query).toContain("ON CONFLICT (espnid, league");
    expect(query).toContain("RETURNING id");
  });

  it("should handle query errors", async () => {
    mockClient.query.mockRejectedValue(new Error("Connection lost"));

    await expect(
      upsertTeam(mockClient, 1, "nba", { name: "Team", record: "0-0" })
    ).rejects.toThrow("Connection lost");
  });
});
