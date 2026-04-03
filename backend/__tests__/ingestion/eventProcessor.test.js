/**
 * Tests for eventProcessor — ESPN data pipeline
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock axios
const mockAxiosGet = jest.fn();
jest.unstable_mockModule("axios", () => ({
  default: { get: mockAxiosGet },
}));

// Mock upsert functions
const mockUpsertTeam = jest.fn();
const mockUpsertPlayer = jest.fn();
const mockUpsertStat = jest.fn();
const mockUpsertGame = jest.fn();
const mockMapStats = jest.fn();

jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/upsertTeam.js"),
  () => ({ default: mockUpsertTeam })
);
jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/upsertPlayer.js"),
  () => ({ default: mockUpsertPlayer })
);
jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/upsertStat.js"),
  () => ({ default: mockUpsertStat })
);
jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/upsertGame.js"),
  () => ({ default: mockUpsertGame })
);
jest.unstable_mockModule(
  resolve(__dirname, "../../src/ingestion/mapStatsToSchema.js"),
  () => ({ default: mockMapStats })
);

// Imported inside beforeAll so jest.unstable_mockModule registrations above
// are in place before the module (and its mocked dependencies) loads.
let getSportPath,
  clearPlayerCache,
  getPlayerCacheStats,
  fetchPlayerDetails,
  getEventsByDate,
  getTodayEvents,
  processEvent,
  runTodayProcessing,
  runDateRangeProcessing,
  runUpcomingProcessing;

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockClient() {
  return { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
}

function createMockEvent(overrides = {}) {
  return {
    id: "401584583",
    date: "2025-01-15T00:00Z",
    season: { year: 2025, type: 2 },
    status: { type: { description: "Final" } },
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            team: {
              id: "13",
              displayName: "Los Angeles Lakers",
              name: "Lakers",
              location: "Los Angeles",
              logo: "https://example.com/lal.png",
            },
            score: "110",
            records: [
              { summary: "25-15", type: "total" },
              { summary: "15-5", type: "home" },
              { summary: "10-10", type: "road" },
            ],
            linescores: [
              { period: 1, value: 28 },
              { period: 2, value: 27 },
              { period: 3, value: 30 },
              { period: 4, value: 25 },
            ],
          },
          {
            homeAway: "away",
            team: {
              id: "2",
              displayName: "Boston Celtics",
              name: "Celtics",
              location: "Boston",
              logo: "https://example.com/bos.png",
            },
            score: "105",
            records: [
              { summary: "20-20", type: "total" },
              { summary: "12-8", type: "home" },
              { summary: "8-12", type: "road" },
            ],
            linescores: [
              { period: 1, value: 25 },
              { period: 2, value: 30 },
              { period: 3, value: 25 },
              { period: 4, value: 25 },
            ],
          },
        ],
        venue: { fullName: "Crypto.com Arena" },
        broadcast: "ESPN",
        notes: [],
      },
    ],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("eventProcessor", () => {
  beforeAll(async () => {
    const epPath = resolve(__dirname, "../../src/ingestion/eventProcessor.js");
    const mod = await import(epPath);
    getSportPath = mod.getSportPath;
    clearPlayerCache = mod.clearPlayerCache;
    getPlayerCacheStats = mod.getPlayerCacheStats;
    fetchPlayerDetails = mod.fetchPlayerDetails;
    getEventsByDate = mod.getEventsByDate;
    getTodayEvents = mod.getTodayEvents;
    processEvent = mod.processEvent;
    runTodayProcessing = mod.runTodayProcessing;
    runDateRangeProcessing = mod.runDateRangeProcessing;
    runUpcomingProcessing = mod.runUpcomingProcessing;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearPlayerCache();
  });

  describe("getSportPath", () => {
    it("should return basketball for nba", () => {
      expect(getSportPath("nba")).toBe("basketball");
    });

    it("should return football for nfl", () => {
      expect(getSportPath("nfl")).toBe("football");
    });

    it("should return hockey for nhl", () => {
      expect(getSportPath("nhl")).toBe("hockey");
    });

    it("should handle uppercase input", () => {
      expect(getSportPath("NBA")).toBe("basketball");
    });

    it("should throw for unsupported league", () => {
      expect(() => getSportPath("mlb")).toThrow("Unsupported league: mlb");
    });
  });

  describe("clearPlayerCache / getPlayerCacheStats", () => {
    it("should return zeroed stats after clear", () => {
      clearPlayerCache();
      const stats = getPlayerCacheStats();

      expect(stats.size).toBe(0);
      expect(stats.skippedFinalGames).toBe(0);
      expect(stats.espnApiCalls).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.dbHits).toBe(0);
      expect(stats.gamesProcessed).toBe(0);
    });
  });

  describe("fetchPlayerDetails", () => {
    it("should call ESPN athlete API", async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          athlete: {
            id: "1966",
            displayName: "LeBron James",
          },
        },
      });

      const result = await fetchPlayerDetails("1966", "nba");

      expect(result).toEqual({ id: "1966", displayName: "LeBron James" });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining("basketball/nba/athletes/1966")
      );
    });

    it("should return null on API error", async () => {
      mockAxiosGet.mockRejectedValue(new Error("404 Not Found"));

      const result = await fetchPlayerDetails("9999", "nba");

      expect(result).toBeNull();
    });
  });

  describe("getEventsByDate", () => {
    it("should fetch events for a specific date", async () => {
      const mockEvents = [{ id: "1" }, { id: "2" }];
      mockAxiosGet.mockResolvedValue({ data: { events: mockEvents } });

      const result = await getEventsByDate("20250115", "nba");

      expect(result).toEqual(mockEvents);
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining("scoreboard?dates=20250115")
      );
    });

    it("should return empty array on error", async () => {
      mockAxiosGet.mockRejectedValue(new Error("Network error"));

      const result = await getEventsByDate("20250115", "nba");

      expect(result).toEqual([]);
    });

    it("should return empty array when no events field", async () => {
      mockAxiosGet.mockResolvedValue({ data: {} });

      const result = await getEventsByDate("20250115", "nba");

      expect(result).toEqual([]);
    });
  });

  describe("getTodayEvents", () => {
    it("should fetch today's events without date param", async () => {
      const mockEvents = [{ id: "3" }];
      mockAxiosGet.mockResolvedValue({ data: { events: mockEvents } });

      const result = await getTodayEvents("nba");

      expect(result).toEqual(mockEvents);
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining("basketball/nba/scoreboard")
      );
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.not.stringContaining("dates=")
      );
    });

    it("should return empty array on error", async () => {
      mockAxiosGet.mockRejectedValue(new Error("Timeout"));

      const result = await getTodayEvents("nfl");

      expect(result).toEqual([]);
    });
  });

  describe("processEvent", () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      // Default: game does not exist in DB
      mockClient.query.mockResolvedValue({ rows: [] });
      mockUpsertTeam.mockResolvedValue(1);
      mockUpsertGame.mockResolvedValue(100);
      mockUpsertPlayer.mockResolvedValue(200);
      mockUpsertStat.mockResolvedValue(300);
      mockMapStats.mockReturnValue({ points: 20 });
    });

    it("should return null for invalid event id", async () => {
      const event = createMockEvent({ id: "not-a-number" });

      const result = await processEvent(mockClient, "nba", event);

      expect(result).toBeNull();
    });

    it("should return null when home competitor is missing", async () => {
      const event = createMockEvent();
      event.competitions[0].competitors = [
        event.competitions[0].competitors[1],
      ];

      const result = await processEvent(mockClient, "nba", event);

      expect(result).toBeNull();
    });

    it("should return null when away competitor is missing", async () => {
      const event = createMockEvent();
      event.competitions[0].competitors = [
        event.competitions[0].competitors[0],
      ];

      const result = await processEvent(mockClient, "nba", event);

      expect(result).toBeNull();
    });

    it("should upsert both teams", async () => {
      // Boxscore returns empty players
      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nba", createMockEvent());

      expect(mockUpsertTeam).toHaveBeenCalledTimes(2);
      expect(mockUpsertTeam).toHaveBeenCalledWith(
        mockClient,
        13,
        "nba",
        expect.objectContaining({ name: "Los Angeles Lakers" })
      );
      expect(mockUpsertTeam).toHaveBeenCalledWith(
        mockClient,
        2,
        "nba",
        expect.objectContaining({ name: "Boston Celtics" })
      );
    });

    it("should upsert game with correct payload", async () => {
      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nba", createMockEvent());

      expect(mockUpsertGame).toHaveBeenCalledWith(
        mockClient,
        "nba",
        expect.objectContaining({
          eventid: 401584583,
          homeScore: 110,
          awayScore: 105,
          status: "Final",
        })
      );
    });

    it("should skip boxscore fetch for already-FINAL games in DB", async () => {
      // getExistingGameStatus returns exists + isFinal
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SET LOCAL
        .mockResolvedValueOnce({ rows: [{ id: 50, status: "Final" }] }) // game status check
        .mockResolvedValueOnce({ rows: [{ cnt: "50" }] }); // stat count check (≥ minRows → skip)

      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nba", createMockEvent());

      // upsertGame should still be called (metadata updates)
      expect(mockUpsertGame).toHaveBeenCalled();
      // But no player/stat upserts should happen
      expect(mockUpsertPlayer).not.toHaveBeenCalled();
      expect(mockUpsertStat).not.toHaveBeenCalled();
    });

    it("should process players and stats from boxscore", async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          boxscore: {
            players: [
              {
                team: { id: "13" },
                statistics: [
                  {
                    keys: ["PTS", "AST"],
                    athletes: [
                      {
                        athlete: { id: "1966", displayName: "LeBron James" },
                        stats: ["28", "7"],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      });

      // DB player lookup returns nothing (forces ESPN API call)
      mockClient.query.mockResolvedValue({ rows: [] });
      // ESPN player details
      mockAxiosGet
        .mockResolvedValueOnce({
          data: { boxscore: { players: [{ team: { id: "13" }, statistics: [{ keys: ["PTS", "AST"], athletes: [{ athlete: { id: "1966", displayName: "LeBron James" }, stats: ["28", "7"] }] }] }] } },
        })
        .mockResolvedValueOnce({
          data: { athlete: { id: "1966", displayName: "LeBron James", position: { abbreviation: "F" }, displayHeight: "6-9", displayWeight: "250", headshot: { href: "url" } } },
        });

      await processEvent(mockClient, "nba", createMockEvent());

      expect(mockUpsertPlayer).toHaveBeenCalled();
      expect(mockMapStats).toHaveBeenCalled();
      expect(mockUpsertStat).toHaveBeenCalled();
    });

    it("should skip DNP players", async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          boxscore: {
            players: [
              {
                team: { id: "13" },
                statistics: [
                  {
                    keys: ["PTS"],
                    athletes: [
                      {
                        athlete: { id: "100", displayName: "Active" },
                        stats: ["10"],
                        didNotPlay: false,
                      },
                      {
                        athlete: { id: "101", displayName: "Inactive" },
                        stats: [],
                        didNotPlay: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      });

      mockClient.query.mockResolvedValue({ rows: [] });
      // ESPN details for player 100
      mockAxiosGet.mockResolvedValueOnce({
        data: { boxscore: { players: [{ team: { id: "13" }, statistics: [{ keys: ["PTS"], athletes: [{ athlete: { id: "100", displayName: "Active" }, stats: ["10"] }, { athlete: { id: "101", displayName: "Inactive" }, stats: [], didNotPlay: true }] }] }] } },
      }).mockResolvedValueOnce({
        data: { athlete: null },
      });

      await processEvent(mockClient, "nba", createMockEvent());

      // Only the active player should be upserted
      const playerCalls = mockUpsertPlayer.mock.calls;
      const playerNames = playerCalls.map((c) => c[1].name);
      expect(playerNames).not.toContain("Inactive");
    });

    it("should handle boxscore fetch failure gracefully", async () => {
      mockAxiosGet.mockRejectedValue(new Error("Boxscore unavailable"));

      const event = createMockEvent();
      const result = await processEvent(mockClient, "nba", event);

      // Should still return a gameId (game was upserted before boxscore fetch)
      expect(mockUpsertGame).toHaveBeenCalled();
    });

    it("should calculate NFL season text differently", async () => {
      const nflEvent = createMockEvent({
        season: { year: 2025, type: 2 },
      });

      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nfl", nflEvent);

      expect(mockUpsertGame).toHaveBeenCalledWith(
        mockClient,
        "nfl",
        expect.objectContaining({
          seasonText: "2025-26",
        })
      );
    });

    it("should calculate NBA season text correctly", async () => {
      const nbaEvent = createMockEvent({
        season: { year: 2025, type: 2 },
      });

      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nba", nbaEvent);

      expect(mockUpsertGame).toHaveBeenCalledWith(
        mockClient,
        "nba",
        expect.objectContaining({
          seasonText: "2024-25",
        })
      );
    });

    it("should set gameLabel to Preseason for type 1", async () => {
      const preseasonEvent = createMockEvent({
        season: { year: 2025, type: 1 },
      });

      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nba", preseasonEvent);

      expect(mockUpsertGame).toHaveBeenCalledWith(
        mockClient,
        "nba",
        expect.objectContaining({
          gameLabel: "Preseason",
        })
      );
    });

    it("should extract playoff game label from notes", async () => {
      const playoffEvent = createMockEvent({
        season: { year: 2025, type: 3 },
      });
      playoffEvent.competitions[0].notes = [
        { headline: "NBA Finals - Game 1" },
      ];

      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nba", playoffEvent);

      expect(mockUpsertGame).toHaveBeenCalledWith(
        mockClient,
        "nba",
        expect.objectContaining({
          gameLabel: "NBA Finals - Game 1",
        })
      );
    });

    it("should begin and commit transaction on success", async () => {
      mockAxiosGet.mockResolvedValue({
        data: { boxscore: { players: [] } },
      });

      await processEvent(mockClient, "nba", createMockEvent());

      const queries = mockClient.query.mock.calls.map((c) => c[0]);
      expect(queries).toContain("BEGIN");
      expect(queries).toContain("COMMIT");
    });

    it("should rollback on processing error", async () => {
      mockUpsertTeam.mockRejectedValueOnce(new Error("Team insert failed"));

      await expect(processEvent(mockClient, "nba", createMockEvent())).rejects.toThrow("Team insert failed");

      const queries = mockClient.query.mock.calls.map((c) => c[0]);
      expect(queries).toContain("ROLLBACK");
    });
  });

  describe("runTodayProcessing", () => {
    it("should fetch today events and process each", async () => {
      const events = [createMockEvent({ id: "1" }), createMockEvent({ id: "2" })];
      mockAxiosGet
        .mockResolvedValueOnce({ data: { events } })
        // Boxscore for each event
        .mockResolvedValue({ data: { boxscore: { players: [] } } });

      const mockPool = {
        connect: jest.fn().mockResolvedValue(createMockClient()),
      };

      await runTodayProcessing("nba", mockPool);

      expect(mockPool.connect).toHaveBeenCalledTimes(2);
    });

    it("should release client after processing", async () => {
      const client = createMockClient();
      mockAxiosGet
        .mockResolvedValueOnce({ data: { events: [createMockEvent()] } })
        .mockResolvedValue({ data: { boxscore: { players: [] } } });

      const mockPool = { connect: jest.fn().mockResolvedValue(client) };

      await runTodayProcessing("nba", mockPool);

      expect(client.release).toHaveBeenCalled();
    });
  });

  describe("runUpcomingProcessing", () => {
    it("should fetch 14 days ahead of events", async () => {
      mockAxiosGet.mockResolvedValue({ data: { events: [] } });

      const mockPool = {
        connect: jest.fn().mockResolvedValue(createMockClient()),
      };

      await runUpcomingProcessing("nba", mockPool);

      // 14 getEventsByDate calls (days 1-14 ahead)
      expect(mockAxiosGet).toHaveBeenCalledTimes(14);
      expect(mockAxiosGet).toHaveBeenCalledWith(
        expect.stringContaining("scoreboard?dates=")
      );
    });

    it("should deduplicate events with the same ESPN id", async () => {
      const duplicateEvent = createMockEvent({ id: "999" });
      // First two dates return the same event; remaining 12 return empty
      // Remaining 12 date fetches fall through to the default; getEventsByDate does
      // `data.events || []` so a boxscore-shaped response is treated as empty events.
      mockAxiosGet
        .mockResolvedValueOnce({ data: { events: [duplicateEvent] } })
        .mockResolvedValueOnce({ data: { events: [duplicateEvent] } })
        .mockResolvedValue({ data: { boxscore: { players: [] } } });

      const mockClient = createMockClient();
      const mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };

      await runUpcomingProcessing("nba", mockPool);

      // pool.connect called once — only one unique event processed
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
    });

    it("should release client after processing each event", async () => {
      const client = createMockClient();
      mockAxiosGet
        .mockResolvedValueOnce({ data: { events: [createMockEvent()] } })
        .mockResolvedValue({ data: { boxscore: { players: [] } } });

      const mockPool = { connect: jest.fn().mockResolvedValue(client) };

      await runUpcomingProcessing("nba", mockPool);

      expect(client.release).toHaveBeenCalled();
    });

    it("should handle empty event lists for both dates", async () => {
      mockAxiosGet.mockResolvedValue({ data: { events: [] } });

      const mockPool = {
        connect: jest.fn().mockResolvedValue(createMockClient()),
      };

      await runUpcomingProcessing("nba", mockPool);

      // No events → no pool.connect needed
      expect(mockPool.connect).not.toHaveBeenCalled();
    });
  });

  describe("runDateRangeProcessing", () => {
    it("should process each date in the range", async () => {
      mockAxiosGet.mockResolvedValue({ data: { events: [] } });

      const mockPool = {
        connect: jest.fn().mockResolvedValue(createMockClient()),
      };

      await runDateRangeProcessing("nba", ["20250101", "20250102"], mockPool);

      // Should call getEventsByDate for each date
      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });

    it("should handle empty event lists", async () => {
      mockAxiosGet.mockResolvedValue({ data: { events: [] } });

      const mockPool = {
        connect: jest.fn().mockResolvedValue(createMockClient()),
      };

      await runDateRangeProcessing("nba", ["20250101"], mockPool);

      // No pool.connect needed if no events
      expect(mockPool.connect).not.toHaveBeenCalled();
    });
  });
});
