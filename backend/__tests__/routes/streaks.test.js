import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const mockGetActiveStreak = jest.fn();
const mockGetPlayerIdBySlug = jest.fn();

jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/streaks/streaksService.js"),
  () => ({ getActiveStreak: mockGetActiveStreak }),
);

jest.unstable_mockModule(
  resolve(__dirname, "../../src/utils/slugResolver.js"),
  () => ({ getPlayerIdBySlug: mockGetPlayerIdBySlug, nameToSlug: (s) => s }),
);

const streaksRouter = (await import(
  resolve(__dirname, "../../src/routes/streaks/streaks.js")
)).default;

let app;
beforeEach(() => {
  app = express();
  app.use("/api", streaksRouter);
  jest.clearAllMocks();
  mockGetActiveStreak.mockReset();
  mockGetPlayerIdBySlug.mockReset();
});

describe("GET /:league/players/:slug/streak", () => {
  it("returns { streak } for an existing player", async () => {
    mockGetPlayerIdBySlug.mockResolvedValueOnce(42);
    mockGetActiveStreak.mockResolvedValueOnce({
      length: 5, statLabel: "triple-double", subjectType: "player",
    });
    const res = await request(app).get("/api/nba/players/nikola-jokic/streak");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      streak: { length: 5, statLabel: "triple-double", subjectType: "player" },
    });
    expect(mockGetActiveStreak).toHaveBeenCalledWith("nba", "player", 42);
  });

  it("returns { streak: null } when none active", async () => {
    mockGetPlayerIdBySlug.mockResolvedValueOnce(42);
    mockGetActiveStreak.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/nba/players/jokic/streak");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ streak: null });
  });

  it("returns 404 when slug doesn't resolve", async () => {
    mockGetPlayerIdBySlug.mockResolvedValueOnce(null);
    const res = await request(app).get("/api/nba/players/nobody/streak");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid league", async () => {
    const res = await request(app).get("/api/xyz/players/x/streak");
    expect(res.status).toBe(400);
  });
});

describe("GET /:league/teams/:teamId/streak", () => {
  it("returns { streak } for an existing team", async () => {
    mockGetActiveStreak.mockResolvedValueOnce({
      length: 4, statLabel: "win", subjectType: "team",
    });
    const res = await request(app).get("/api/nba/teams/7/streak");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      streak: { length: 4, statLabel: "win", subjectType: "team" },
    });
    expect(mockGetActiveStreak).toHaveBeenCalledWith("nba", "team", 7);
  });

  it("returns 400 for non-numeric teamId", async () => {
    const res = await request(app).get("/api/nba/teams/abc/streak");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid league", async () => {
    const res = await request(app).get("/api/xyz/teams/7/streak");
    expect(res.status).toBe(400);
  });
});
