/**
 * Tests for upsertPlayer utility
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import upsertPlayer from "../../src/populate/src/upsertPlayer.js";

describe("upsertPlayer", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };
  });

  it("should insert a new player with all fields", async () => {
    const player = {
      id: "1966", // ESPN player ID
      name: "LeBron James",
      position: "F",
      height: "6-9",
      image_url: "https://example.com/lebron.jpg",
      jerseynum: "23",
      weight: "250",
      birthdate: "1984-12-30",
      draftinfo: "Round 1, Pick 1, 2003",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 123 }],
    });

    const result = await upsertPlayer(mockClient, player, 5, "nba");

    expect(result).toBe(123);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO players"),
      expect.arrayContaining([
        "LeBron James",
        5,
        "F",
        "6-9",
        "https://example.com/lebron.jpg",
        "23",
        "250",
        "1984-12-30",
        "Round 1, Pick 1, 2003",
        "nba",
        "1966",
      ])
    );
  });

  it("should update existing player on conflict", async () => {
    const player = {
      id: "1966",
      name: "LeBron James",
      position: "F",
      height: "6-9",
      image_url: "https://example.com/lebron-new.jpg",
      jerseynum: "6", // Changed jersey number
      weight: "250",
      birthdate: "1984-12-30",
      draftinfo: "Round 1, Pick 1, 2003",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 123 }],
    });

    await upsertPlayer(mockClient, player, 5, "nba");

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "ON CONFLICT (espn_playerid, league) DO UPDATE SET"
      ),
      expect.any(Array)
    );
  });

  it("should handle null/optional fields", async () => {
    const player = {
      id: "1966",
      name: "Test Player",
      // Missing optional fields
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 456 }],
    });

    const result = await upsertPlayer(mockClient, player, 10, "nfl");

    expect(result).toBe(456);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        "Test Player",
        10,
        null, // position
        null, // height
        null, // image_url
        null, // jerseynum
        null, // weight
        null, // birthdate
        null, // draftinfo
        "nfl",
        "1966",
      ])
    );
  });

  it("should use espn_playerid and league as conflict key", async () => {
    const player = {
      id: "1966",
      name: "Player Name",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 1 }],
    });

    await upsertPlayer(mockClient, player, 1, "nba");

    const query = mockClient.query.mock.calls[0][0];
    expect(query).toContain("ON CONFLICT (espn_playerid, league)");
  });

  it("should return the player id after insert", async () => {
    const player = {
      id: "999",
      name: "New Player",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 777 }],
    });

    const result = await upsertPlayer(mockClient, player, 2, "nhl");

    expect(result).toBe(777);
  });

  it("should handle query errors", async () => {
    const player = {
      id: "1966",
      name: "LeBron James",
    };

    mockClient.query.mockRejectedValue(new Error("Database error"));

    await expect(upsertPlayer(mockClient, player, 1, "nba")).rejects.toThrow(
      "Database error"
    );
  });

  it("should include league in insert values", async () => {
    const player = {
      id: "123",
      name: "Hockey Player",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 1 }],
    });

    await upsertPlayer(mockClient, player, 3, "nhl");

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["nhl"])
    );
  });

  it("should map birthdate correctly", async () => {
    const player = {
      id: "456",
      name: "Player",
      birthdate: "1995-05-15",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 1 }],
    });

    await upsertPlayer(mockClient, player, 1, "nba");

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["1995-05-15"])
    );
  });

  it("should update all fields on conflict", async () => {
    const player = {
      id: "1966",
      name: "Updated Name",
      position: "G",
      teamid: 5,
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 123 }],
    });

    await upsertPlayer(mockClient, player, 7, "nba");

    const query = mockClient.query.mock.calls[0][0];
    expect(query).toContain("name        = EXCLUDED.name");
    expect(query).toContain("teamid      = CASE");
    expect(query).toContain("position    = EXCLUDED.position");
  });

  it("should preserve team id on conflict when preserveExistingTeam is enabled", async () => {
    const player = {
      id: "1966",
      name: "LeBron James",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 123 }],
    });

    await upsertPlayer(mockClient, player, 55, "nba", {
      preserveExistingTeam: true,
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        "LeBron James",
        null, // insert team id is intentionally blank for special events
        "nba",
        "1966",
        true,
      ]),
    );
  });

  it("should update team id on conflict when preserveExistingTeam is disabled", async () => {
    const player = {
      id: "1966",
      name: "LeBron James",
    };

    mockClient.query.mockResolvedValue({
      rows: [{ id: 123 }],
    });

    await upsertPlayer(mockClient, player, 5, "nba");

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        "LeBron James",
        5,
        "nba",
        "1966",
        false,
      ]),
    );
  });
});
