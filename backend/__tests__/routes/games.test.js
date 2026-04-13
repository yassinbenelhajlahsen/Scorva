/**
 * Tests for /api/:league/games endpoint
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool, fixtures } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create mock pool
const mockPool = createMockPool();

// Mock the db module with absolute path
const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({
  default: mockPool,
}));

// Mock seasons cache helper so getCurrentSeason never hits the DB in tests
const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({
  getCurrentSeason: jest.fn().mockResolvedValue("2025-26"),
}));

// Now import the modules that depend on db
const routerPath = resolve(__dirname, "../../src/routes/games/games.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: gamesRouter } = await import(routerPath);

// Helper: mock the two-query sequence for the default (no teamId, no season) path.
// First call is the EXISTS check; second call is the main SELECT.
function mockTodayCheck(hasTodayGames, games = []) {
  mockPool.query
    .mockResolvedValueOnce({ rows: [{ has_today_games: hasTodayGames }] })
    .mockResolvedValueOnce({ rows: games });
}

describe("Games Route - GET /:league/games", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", gamesRouter);
    jest.clearAllMocks();
  });

  describe("default path (no teamId, no season)", () => {
    it("should return today's games when today has live/final games", async () => {
      const mockGames = [
        {
          ...fixtures.game({ status: "In Progress" }),
          home_team_name: "Los Angeles Lakers",
          home_shortname: "LAL",
          home_logo: "https://example.com/lal.png",
          away_team_name: "Boston Celtics",
          away_shortname: "BOS",
          away_logo: "https://example.com/bos.png",
        },
      ];

      mockTodayCheck(true, mockGames);

      const response = await request(app).get("/api/nba/games");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockGames);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      // First call: EXISTS check
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("EXISTS"),
        ["nba", null, expect.any(String)]
      );
      // Second call: today's full slate, ordered by status priority
      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("ILIKE"),
        ["nba", null, expect.any(String)]
      );
    });

    it("should return upcoming scheduled games when no live/final games today", async () => {
      const scheduledGames = [
        {
          ...fixtures.game({ status: "Scheduled", homescore: null, awayscore: null }),
          home_team_name: "Los Angeles Lakers",
          home_shortname: "LAL",
          home_logo: "https://example.com/lal.png",
          away_team_name: "Boston Celtics",
          away_shortname: "BOS",
          away_logo: "https://example.com/bos.png",
        },
      ];

      mockTodayCheck(false, scheduledGames);

      const response = await request(app).get("/api/nba/games");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(scheduledGames);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
      // Second call: upcoming scheduled, ordered by date ASC
      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("ORDER BY g.date ASC"),
        ["nba", null, expect.any(String)]
      );
    });

    it("should include LIMIT 12 for today's games query", async () => {
      mockTodayCheck(true, []);

      await request(app).get("/api/nba/games");

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("LIMIT 12"),
        ["nba", null, expect.any(String)]
      );
    });

    it("should include LIMIT 12 for upcoming scheduled games query", async () => {
      mockTodayCheck(false, []);

      await request(app).get("/api/nba/games");

      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("LIMIT 12"),
        ["nba", null, expect.any(String)]
      );
    });

    it("should fall back to last final games when no upcoming scheduled games (off-season)", async () => {
      const finalGames = [
        {
          ...fixtures.game({ status: "Final" }),
          home_team_name: "Team A",
          away_team_name: "Team B",
        },
      ];

      // EXISTS check → false, upcoming query → empty, fallback → final games
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ has_today_games: false }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: finalGames });

      const response = await request(app).get("/api/nfl/games");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(finalGames);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
      // Fallback query: ORDER BY date DESC, no status filter
      expect(mockPool.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("ORDER BY g.date DESC"),
        ["nfl", null]
      );
    });

    it("should return empty array when no games exist at all", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ has_today_games: false }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get("/api/nfl/games");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("should work with different league parameters", async () => {
      mockTodayCheck(false, []);

      await request(app).get("/api/nhl/games");

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        ["nhl", null, expect.any(String)]
      );
    });

    it("should handle database errors gracefully", async () => {
      mockPool.query.mockRejectedValue(new Error("Database error"));

      const response = await request(app).get("/api/nba/games");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Failed to fetch games." });
    });
  });

  describe("teamId path (preserves original behavior)", () => {
    it("should filter games by teamId and order by date descending", async () => {
      const teamId = 5;
      const mockGames = [
        {
          ...fixtures.game({ hometeamid: teamId }),
          home_team_name: "Los Angeles Lakers",
          away_team_name: "Boston Celtics",
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockGames });

      const response = await request(app)
        .get("/api/nba/games")
        .query({ teamId: teamId.toString() });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockGames);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("$3::integer IN"),
        ["nba", null, teamId.toString()]
      );
    });

    it("should not apply LIMIT when filtering by teamId", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get("/api/nba/games").query({ teamId: "1" });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [calledQuery] = mockPool.query.mock.calls[0];
      expect(calledQuery).not.toContain("LIMIT");
    });

    it("should order by date descending for teamId path", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get("/api/nba/games").query({ teamId: "1" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY g.date DESC"),
        expect.any(Array)
      );
    });
  });

  describe("season path (preserves original behavior)", () => {
    it("should filter by season and order by date descending", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get("/api/nba/games").query({ season: "2024-25" });

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY g.date DESC"),
        ["nba", "2024-25"]
      );
    });

    it("should apply LIMIT 12 for season path without teamId", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await request(app).get("/api/nba/games").query({ season: "2024-25" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT 12"),
        ["nba", "2024-25"]
      );
    });
  });

  describe("date path (?date= query param)", () => {
    describe("validation", () => {
      it("returns 400 for an invalid date format", async () => {
        const response = await request(app)
          .get("/api/nba/games")
          .query({ date: "01-15-2025" });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "Invalid date format. Use YYYY-MM-DD." });
        expect(mockPool.query).not.toHaveBeenCalled();
      });

      it("returns 400 when the date includes a time component", async () => {
        const response = await request(app)
          .get("/api/nba/games")
          .query({ date: "2025-01-15T00:00:00" });
        expect(response.status).toBe(400);
      });

      it("accepts a valid YYYY-MM-DD date and forwards to the service", async () => {
        // getSeasonForDate query + main date query
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2025-26" }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get("/api/nba/games")
          .query({ date: "2025-01-15" });

        expect(response.status).toBe(200);
      });
    });

    describe("exact date match", () => {
      it("returns { games, resolvedDate, resolvedSeason } when games exist on the requested date", async () => {
        const gameRow = {
          ...fixtures.game({ status: "Final" }),
          home_team_name: "LA Lakers",
          home_shortname: "LAL",
          home_logo: "https://example.com/lal.png",
          away_team_name: "Boston Celtics",
          away_shortname: "BOS",
          away_logo: "https://example.com/bos.png",
        };

        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2025-26" }] }) // getSeasonForDate
          .mockResolvedValueOnce({ rows: [gameRow] });               // date query

        const response = await request(app)
          .get("/api/nba/games")
          .query({ date: "2025-01-15" });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          resolvedDate: "2025-01-15",
          resolvedSeason: "2025-26",
          games: [gameRow],
        });
      });

      it("orders games by status priority (live first)", async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2025-26" }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get("/api/nba/games").query({ date: "2025-01-15" });

        expect(mockPool.query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining("ILIKE '%In Progress%'"),
          expect.any(Array)
        );
      });
    });

    describe("nearest-date fallback", () => {
      it("finds the nearest date and returns games from that date", async () => {
        const gameRow = {
          ...fixtures.game({ status: "Final", date: "2025-01-14" }),
          home_team_name: "LA Lakers",
          home_shortname: "LAL",
          home_logo: "https://example.com/lal.png",
          away_team_name: "Boston Celtics",
          away_shortname: "BOS",
          away_logo: "https://example.com/bos.png",
        };

        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2025-26" }] })     // getSeasonForDate
          .mockResolvedValueOnce({ rows: [] })                           // exact date query → empty
          .mockResolvedValueOnce({ rows: [{ date: new Date("2025-01-14T00:00:00Z") }] }) // nearest UNION
          .mockResolvedValueOnce({ rows: [gameRow] });                   // re-query with nearest date

        const response = await request(app)
          .get("/api/nba/games")
          .query({ date: "2025-01-15" });

        expect(response.status).toBe(200);
        expect(response.body.resolvedDate).toBe("2025-01-14");
        expect(response.body.games).toHaveLength(1);
        expect(mockPool.query).toHaveBeenCalledTimes(4);
      });

      it("returns empty games when no nearest date exists", async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2025-26" }] }) // getSeasonForDate
          .mockResolvedValueOnce({ rows: [] })                       // exact date query → empty
          .mockResolvedValueOnce({ rows: [] });                      // nearest UNION → empty

        const response = await request(app)
          .get("/api/nba/games")
          .query({ date: "2025-01-15" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          games: [],
          resolvedDate: "2025-01-15",
          resolvedSeason: "2025-26",
        });
      });

      it("uses a UNION ALL query to find the nearest date in both directions", async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2025-26" }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get("/api/nba/games").query({ date: "2025-01-15" });

        expect(mockPool.query).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining("UNION ALL"),
          ["nba", "2025-26", "2025-01-15"]
        );
      });
    });

    describe("season resolution", () => {
      it("resolves season from the games table when a matching game row exists", async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2024-25" }] }) // getSeasonForDate hit
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get("/api/nba/games").query({ date: "2024-12-15" });

        // The main date query should use the resolved season "2024-25"
        expect(mockPool.query).toHaveBeenNthCalledWith(
          2,
          expect.any(String),
          ["nba", "2024-25", "2024-12-15"]
        );
      });

      it("falls back to getCurrentSeason when no game row matches the date", async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] })    // getSeasonForDate: no direct hit
          .mockResolvedValueOnce({ rows: [] })    // getSeasonForDate: no nearest either
          .mockResolvedValueOnce({ rows: [] });   // main date query

        // getCurrentSeason mock returns "2025-26" — so the date query should use that
        await request(app).get("/api/nba/games").query({ date: "2025-01-15" });

        expect(mockPool.query).toHaveBeenNthCalledWith(
          3,
          expect.any(String),
          ["nba", "2025-26", "2025-01-15"]
        );
      });
    });

    describe("error handling", () => {
      it("returns 500 when the database throws during the date query", async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ season: "2025-26" }] })
          .mockRejectedValueOnce(new Error("DB error"));

        const response = await request(app)
          .get("/api/nba/games")
          .query({ date: "2025-01-15" });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "Failed to fetch games." });
      });
    });
  });
});
