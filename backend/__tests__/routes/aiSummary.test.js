/**
 * Tests for /api/games/:id/ai-summary endpoint (NDJSON streaming)
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({
  default: mockPool,
}));

const authPath = resolve(__dirname, "../../src/middleware/auth.js");
jest.unstable_mockModule(authPath, () => ({
  requireAuth: jest.fn((_req, _res, next) => next()),
}));

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

const embeddingPath = resolve(__dirname, "../../src/services/ai/embeddingService.js");
jest.unstable_mockModule(embeddingPath, () => ({
  embedGameSummary: jest.fn().mockResolvedValue(undefined),
  generateEmbedding: jest.fn(),
  searchEmbeddings: jest.fn(),
}));

const routerPath = resolve(__dirname, "../../src/routes/ai/aiSummary.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: aiSummaryRouter } = await import(routerPath);

// Helper: create an async iterable mock for OpenAI streaming
function makeStreamMock(content) {
  let done = false;
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (!done) {
            done = true;
            return { value: { choices: [{ delta: { content } }] }, done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
    controller: { abort: jest.fn() },
  };
}

// Helper: parse NDJSON response text into array of objects
function parseNdjson(text) {
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe("AI Summary Route - GET /games/:id/ai-summary", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", aiSummaryRouter);
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
  });

  describe("Cached Summary", () => {
    it("should return cached summary as a single full NDJSON line", async () => {
      const cachedSummary = "- Insight 1\n- Insight 2\n- Insight 3";

      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: cachedSummary }],
      });

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      const events = parseNdjson(response.text);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "full", summary: cachedSummary, cached: true });
    });

    it("should not call OpenAI if summary is cached", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: "Cached summary" }],
      });

      await request(app).get("/api/games/1/ai-summary");

      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should make only 1 query for cached summaries", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ai_summary: "Cached" }],
      });

      await request(app).get("/api/games/1/ai-summary");

      expect(mockPool.query).toHaveBeenCalledTimes(1);
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
    it("should return a full NDJSON line with unavailable message for non-final games", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
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
      const events = parseNdjson(response.text);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("full");
      expect(events[0].summary).toBe("AI summary unavailable for this game.");
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
    ];

    it("should stream bullet events and a done event for a completed game", async () => {
      const generatedContent = "- Lakers secured the win\n- LeBron James led with 32 pts\n- Defense was key in Q4";

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [mockGameData] });
      mockPool.query.mockResolvedValueOnce({ rows: mockStats });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // saveSummary

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(
        makeStreamMock(generatedContent)
      );

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      const events = parseNdjson(response.text);

      const bulletEvents = events.filter((e) => e.type === "bullet");
      const doneEvent = events.find((e) => e.type === "done");

      expect(bulletEvents).toHaveLength(3);
      expect(bulletEvents[0].text).toBe("Lakers secured the win");
      expect(bulletEvents[1].text).toBe("LeBron James led with 32 pts");
      expect(bulletEvents[2].text).toBe("Defense was key in Q4");
      expect(doneEvent).toBeDefined();
    });

    it("should save the assembled summary to the database", async () => {
      const generatedContent = "- Bullet A\n- Bullet B\n- Bullet C";

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [mockGameData] });
      mockPool.query.mockResolvedValueOnce({ rows: mockStats });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(
        makeStreamMock(generatedContent)
      );

      await request(app).get("/api/games/1/ai-summary");

      expect(mockPool.query).toHaveBeenCalledWith(
        "UPDATE games SET ai_summary = $1 WHERE id = $2",
        ["- Bullet A\n- Bullet B\n- Bullet C", "1"]
      );
    });

    it("should include correct game data in OpenAI prompt", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [mockGameData] });
      mockPool.query.mockResolvedValueOnce({ rows: mockStats });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(
        makeStreamMock("- A\n- B\n- C")
      );

      await request(app).get("/api/games/1/ai-summary");

      const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = openAICall.messages.find((m) => m.role === "user");

      expect(userMessage.content).toContain("NBA");
      expect(userMessage.content).toContain("Los Angeles Lakers");
      expect(userMessage.content).toContain("Boston Celtics");
      expect(openAICall.stream).toBe(true);
    });

    it("should make 5 queries for new summary generation", async () => {
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
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // getGameStats
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // getClutchPlays status lookup (no plays)
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // saveSummary

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(
        makeStreamMock("- A\n- B\n- C")
      );

      await request(app).get("/api/games/1/ai-summary");

      expect(mockPool.query).toHaveBeenCalledTimes(5);
    });

    it("should handle NFL games correctly", async () => {
      const nflGameData = {
        ...mockGameData,
        league: "nfl",
        home_team_name: "Kansas City Chiefs",
        away_team_name: "Buffalo Bills",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [nflGameData] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(
        makeStreamMock("- A\n- B\n- C")
      );

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = openAICall.messages.find((m) => m.role === "user");
      expect(userMessage.content).toContain("NFL");
    });

    it("should handle games with overtime periods", async () => {
      const gameWithOT = {
        ...mockGameData,
        status: "Final/OT",
        homescore: 115,
        awayscore: 113,
        fourthqtr: "25-29",
        ot1: "5-5",
      };

      mockPool.query.mockResolvedValueOnce({ rows: [{ ai_summary: null }] });
      mockPool.query.mockResolvedValueOnce({ rows: [gameWithOT] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(
        makeStreamMock("- A\n- B\n- C")
      );

      await request(app).get("/api/games/1/ai-summary");

      const openAICall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = openAICall.messages.find((m) => m.role === "user");
      expect(userMessage.content).toContain("OT1");
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

      const response = await request(app).get("/api/games/1/ai-summary");

      expect(response.status).toBe(200);
      const events = parseNdjson(response.text);
      expect(events[0].type).toBe("full");
      expect(events[0].summary).toBe("AI summary unavailable for this game.");
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should handle OpenAI API errors with an error NDJSON line", async () => {
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

      expect(response.status).toBe(200);
      const events = parseNdjson(response.text);
      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent.message).toBe("AI summary unavailable for this game.");
    });

    it("should handle database errors gracefully with a 500", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const response = await request(app).get("/api/games/999/ai-summary");

      expect(response.status).toBe(500);
      expect(response.body.summary).toBe("AI summary unavailable for this game.");
    });
  });
});
