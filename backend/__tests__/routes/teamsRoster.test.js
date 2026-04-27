import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();
const mockGetCurrentSeason = jest.fn();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const seasonsPath = resolve(__dirname, "../../src/cache/seasons.js");
jest.unstable_mockModule(seasonsPath, () => ({ getCurrentSeason: mockGetCurrentSeason }));

const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: teamsRouter } = await import(
  resolve(__dirname, "../../src/routes/teams/teams.js")
);

describe("Teams Route - GET /:league/teams/:teamId/roster", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", teamsRouter);
    jest.clearAllMocks();
    mockGetCurrentSeason.mockResolvedValue("2025-26");
  });

  it("returns roster rows for the current season", async () => {
    const players = [
      { id: 1, name: "LeBron James", position: "F", jerseynum: 23, image_url: null, status: null, status_description: null, status_updated_at: null, espn_playerid: 1966 },
    ];
    mockPool.query.mockResolvedValueOnce({ rows: players });

    const res = await request(app).get("/api/nba/teams/17/roster");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(players);
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players");
    expect(sql).not.toContain("FROM stats");
  });

  it("uses historical query path when season query param is set and not current", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get("/api/nba/teams/17/roster?season=2022-23");

    expect(res.status).toBe(200);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players p");
    expect(sql).toContain("JOIN stats s");
    expect(params).toEqual(["nba", 17, "2022-23"]);
  });

  it("returns 400 for invalid league", async () => {
    const res = await request(app).get("/api/mlb/teams/17/roster");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid league");
  });

  it("returns 400 for non-integer teamId", async () => {
    const res = await request(app).get("/api/nba/teams/notanumber/roster");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid team ID");
  });

  it("returns 500 when the DB throws", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB down"));

    const res = await request(app).get("/api/nba/teams/17/roster");

    expect(res.status).toBe(500);
    expect(res.text).toBe("Server error");
  });
});
