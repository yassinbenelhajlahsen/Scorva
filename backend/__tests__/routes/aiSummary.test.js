/**
 * Tests for /api/games/:id/ai-summary endpoint
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
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

// Mock requireAuth to bypass authentication in tests
const authPath = resolve(__dirname, "../../src/middleware/auth.js");
jest.unstable_mockModule(authPath, () => ({
  requireAuth: jest.fn((_req, _res, next) => next()),
}));

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.unstable_mockModule("openai", () => ({
  default: jest.fn(() => mockOpenAI),
}));

// Mock embeddingService so fire-and-forget embedGameSummary doesn't hit the pool
const embeddingPath = resolve(__dirname, "../../src/services/ai/embeddingService.js");
jest.unstable_mockModule(embeddingPath, () => ({
  embedGameSummary: jest.fn().mockResolvedValue(undefined),
  generateEmbedding: jest.fn(),
  searchEmbeddings: jest.fn(),
}));

// Now import the modules that depend on db and OpenAI
const routerPath = resolve(__dirname, "../../src/routes/ai/aiSummary.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: aiSummaryRouter } = await import(routerPath);

describe("AI Summary Route - GET /games/:id/ai-summary", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", aiSummaryRouter);
    jest.clearAllMocks();
    // Set mock API key for tests
    process.env.OPENAI_API_KEY = "test-api-key";
  });

  describe("Cached Summary", () => {
    it("should return cached summary if it exists", async () => {
      const cachedSummary = "This is a cached AI summary of the game.";

      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: cachedSummary }],
      });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      expect(response.body.summary).toBe(cachedSummary);
      expect(response.body.cached).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT ai_summary FROM games WHERE id = $1",
        ["1"]
      );
    });

    it("should not call OpenAI if summary is cached", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: "Cached summary" }],
      });

      await request(app).get("/api/games/1/ai-summary");

      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });
  });

  describe("Game Not Found", () => {
    it("should return 404 if game does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get("/api/games/999/ai-summary");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Game not found");
    });
  });

  describe("Game Not Final", () => {
    it("should return unavailable message for non-final games", async () => {
      // First query - check cache (no summary)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: null }],
      });

      // Second query - fetch game data
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            league: "nba",
            date: "2025-01-16",
            homescore: 50,
            awayscore: 48,
            status: "In Progress - Q3",
            home_team_name: "Los Angeles Lakers",
            home_team_short: "LAL",
            away_team_name: "Boston Celtics",
            away_team_short: "BOS",
          },
        ],
      });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      expect(response.body.summary).toBe(
        "AI summary unavailable for this game."
      );
      expect(response.body.reason).toBe(
        "Game must be completed before summary can be generated"
      );
      expect(response.body.cached).toBe(false);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });
  });

  describe("AI Summary Generation", () => {
    const mockGameData = {
      id: 1,
      league: "nba",
      date: "2025-01-15",
      homescore: 110,
      awayscore: 105,
      venue: "Crypto.com Arena",
      status: "Final",
      firstqtr: "28-25",
      secondqtr: "27-26",
      thirdqtr: "30-28",
      fourthqtr: "25-26",
      ot1: null,
      ot2: null,
      ot3: null,
      ot4: null,
      home_team_name: "Los Angeles Lakers",
      home_team_short: "LAL",
      away_team_name: "Boston Celtics",
      away_team_short: "BOS",
    };

    const mockStats = [
      {
        playerid: 1,
        player_name: "LeBron James",
        position: "F",
        teamid: 1,
        team_short: "LAL",
        points: 32,
        rebounds: 8,
        assists: 10,
        fg: "12-20",
      },
      {
        playerid: 2,
        player_name: "Anthony Davis",
        position: "C",
        teamid: 1,
        team_short: "LAL",
        points: 28,
        rebounds: 12,
        assists: 3,
        fg: "10-18",
      },
      {
        playerid: 3,
        player_name: "Jayson Tatum",
        position: "F",
        teamid: 2,
        team_short: "BOS",
        points: 35,
        rebounds: 7,
        assists: 5,
        fg: "13-25",
      },
    ];

    it("should generate and cache AI summary for completed game", async () => {
      const generatedSummary =
        "• Lakers secured a 110-105 victory\n• LeBron James led with 32 points\n• Lakers' defense key in fourth quarter";

      // First query - check cache (no summary)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: null }],
      });

      // Second query - fetch game data
      mockPool.query.mockResolvedValueOnce({
        rows: [mockGameData],
      });

      // Third query - fetch stats
      mockPool.query.mockResolvedValueOnce({
        rows: mockStats,
      });

      // Fourth query - update with summary
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock OpenAI response
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: generatedSummary,
            },
          },
        ],
      });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      expect(response.body.summary).toBe(generatedSummary);
      expect(response.body.cached).toBe(false);

      // Verify OpenAI was called
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o-mini",
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
            }),
            expect.objectContaining({
              role: "user",
            }),
          ]),
          temperature: 0.9,
          max_tokens: 250,
        })
      );

      // Verify summary was stored in DB
      expect(mockPool.query).toHaveBeenCalledWith(
        "UPDATE games SET ai_summary = $1 WHERE id = $2",
        [generatedSummary, "1"]
      );
    });

    it("should include correct game data in OpenAI prompt", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [mockGameData] });
      mockPool.query.mockResolvedValueOnce({ rows: mockStats });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: "Test summary" } }],
      });

      await request(app).get("/api/games/1/ai-summary");

      const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = openAICall.messages.find((m) => m.role === "user");
      const promptContent = userMessage.content;

      expect(promptContent).toContain("NBA");
      expect(promptContent).toContain("Los Angeles Lakers");
      expect(promptContent).toContain("Boston Celtics");
      expect(promptContent).toContain("110");
      expect(promptContent).toContain("105");
    });

    it("should handle NFL games correctly", async () => {
      const nflGameData = {
        ...mockGameData,
        league: "nfl",
        home_team_name: "Kansas City Chiefs",
        away_team_name: "Buffalo Bills",
      };

      const nflStats = [
        {
          player_name: "Patrick Mahomes",
          team_short: "KC",
          yds: 320,
          td: 3,
          position: "QB",
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [nflGameData] });
      mockPool.query.mockResolvedValueOnce({ rows: nflStats });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: "NFL summary" } }],
      });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = openAICall.messages.find((m) => m.role === "user");
      expect(userMessage.content).toContain("NFL");
    });

    it("should handle NHL games correctly", async () => {
      const nhlGameData = {
        ...mockGameData,
        league: "nhl",
        home_team_name: "Toronto Maple Leafs",
        away_team_name: "Montreal Canadiens",
      };

      const nhlStats = [
        {
          player_name: "Auston Matthews",
          team_short: "TOR",
          g: 2,
          a: 1,
          position: "C",
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [nhlGameData] });
      mockPool.query.mockResolvedValueOnce({ rows: nhlStats });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: "NHL summary" } }],
      });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = openAICall.messages.find((m) => m.role === "user");
      expect(userMessage.content).toContain("NHL");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing OpenAI API key gracefully", async () => {
      delete process.env.OPENAI_API_KEY;

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            league: "nba",
            status: "Final",
            homescore: 100,
            awayscore: 95,
            home_team_name: "Team A",
            away_team_name: "Team B",
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      expect(response.body.summary).toBe(
        "AI summary unavailable for this game."
      );
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should handle OpenAI API errors gracefully", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            league: "nba",
            status: "Final",
            homescore: 100,
            awayscore: 95,
            home_team_name: "Team A",
            home_team_short: "TA",
            away_team_name: "Team B",
            away_team_short: "TB",
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error("OpenAI API error")
      );

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(500);
      expect(response.body.summary).toBe(
        "AI summary unavailable for this game."
      );
      expect(response.body.error).toBeUndefined();
      expect(response.body.cached).toBe(false);
    });

    it("should handle database errors gracefully", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(500);
      expect(response.body.summary).toBe(
        "AI summary unavailable for this game."
      );
      expect(response.body.error).toBeUndefined();
    });
  });

  describe("Query Order and Efficiency", () => {
    it("should make only 1 query for cached summaries", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: "Cached" }],
      });

      await request(app).get("/api/games/1/ai-summary");

      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it("should make 4 queries for new summary generation", async () => {
      // 1. Check cache
      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      // 2. Fetch game data
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            league: "nba",
            status: "Final",
            homescore: 100,
            awayscore: 95,
            home_team_name: "Team A",
            home_team_short: "TA",
            away_team_name: "Team B",
            away_team_short: "TB",
          },
        ],
      });
      // 3. Fetch stats
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      // 4. Update with summary
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: "Summary" } }],
      });

      await request(app).get("/api/games/1/ai-summary");

      expect(mockPool.query).toHaveBeenCalledTimes(4);
    });
  });

  describe("Data Formatting", () => {
    it("should handle games with overtime periods", async () => {
      const gameWithOT = {
        id: 1,
        league: "nba",
        status: "Final/OT",
        homescore: 115,
        awayscore: 113,
        firstqtr: "28-25",
        secondqtr: "27-26",
        thirdqtr: "30-28",
        fourthqtr: "25-29",
        ot1: "5-5",
        ot2: null,
        ot3: null,
        ot4: null,
        home_team_name: "Team A",
        home_team_short: "TA",
        away_team_name: "Team B",
        away_team_short: "TB",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [gameWithOT] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: "OT game summary" } }],
      });

      await request(app).get("/api/games/1/ai-summary");

      const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = openAICall.messages.find((m) => m.role === "user");
      const promptContent = userMessage.content;

      expect(promptContent).toContain("OT1");
    });

    it("should handle empty player stats", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            league: "nba",
            status: "Final",
            homescore: 100,
            awayscore: 95,
            home_team_name: "Team A",
            home_team_short: "TA",
            away_team_name: "Team B",
            away_team_short: "TB",
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Empty stats
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: "Summary" } }],
      });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });
  });
});
