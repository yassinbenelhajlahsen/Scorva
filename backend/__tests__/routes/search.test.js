/**
 * Tests for /api/search endpoint
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockSearch = jest.fn();

const servicePath = resolve(__dirname, "../../src/services/meta/searchService.js");
jest.unstable_mockModule(servicePath, () => ({ search: mockSearch }));

const routerPath = resolve(__dirname, "../../src/routes/meta/search.js");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: searchRouter } = await import(routerPath);

describe("Search Route - GET /search", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", searchRouter);
    jest.clearAllMocks();
  });

  it("returns empty array when no search term provided", async () => {
    const response = await request(app).get("/api/search");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns empty array when search term is whitespace-only", async () => {
    const response = await request(app).get("/api/search").query({ term: "   " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("delegates to search service and returns results", async () => {
    const mockResults = [
      { id: 1, name: "LeBron James", league: "nba", type: "player" },
      { id: 2, name: "Los Angeles Lakers", league: "nba", type: "team" },
    ];
    mockSearch.mockResolvedValueOnce(mockResults);

    const response = await request(app).get("/api/search").query({ term: "lakers" });

    expect(response.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith("lakers");
    expect(response.body).toEqual(mockResults);
  });

  it("passes the raw term (including whitespace) to the service", async () => {
    mockSearch.mockResolvedValueOnce([]);

    await request(app).get("/api/search").query({ term: "  lakers  " });

    expect(mockSearch).toHaveBeenCalledWith("  lakers  ");
  });

  it("handles database errors gracefully", async () => {
    mockSearch.mockRejectedValueOnce(new Error("Database error"));

    const response = await request(app).get("/api/search").query({ term: "test" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Internal server error" });
  });

  it("returns game results when service returns them", async () => {
    const mockResults = [
      { id: 1, name: "LAL vs BOS", league: "nba", type: "game" },
    ];
    mockSearch.mockResolvedValueOnce(mockResults);

    const response = await request(app).get("/api/search").query({ term: "lal" });

    expect(response.status).toBe(200);
    expect(response.body[0].type).toBe("game");
  });

  it("returns results in service-determined order", async () => {
    const mockResults = [
      { id: 1, name: "Lakers", shortname: "LAL", league: "nba", type: "team" },
      { id: 2, name: "Los Angeles Lakers", shortname: "LAL", league: "nba", type: "team" },
    ];
    mockSearch.mockResolvedValueOnce(mockResults);

    const response = await request(app).get("/api/search").query({ term: "lal" });

    expect(response.status).toBe(200);
    expect(response.body[0].shortname).toBe("LAL");
  });
});
