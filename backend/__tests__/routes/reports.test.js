import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import express from "express";
import request from "supertest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockGetForLeague = jest.fn();
const mockGetAcrossLeagues = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/reports/reportsService.js"),
  () => ({
    getReportsForLeague: mockGetForLeague,
    getReportsAcrossLeagues: mockGetAcrossLeagues,
  })
);

const reportsRoute = (await import(
  resolve(__dirname, "../../src/routes/reports/reports.js")
)).default;

const app = express();
app.use("/api", reportsRoute);

function r(type, id, league = "nba", date = "2026-04-30T18:00:00Z") {
  return { id, type, date, league, player: { id: 1, name: "x" } };
}

describe("GET /api/reports", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns all-types when ?league set, ?type omitted", async () => {
    mockGetForLeague.mockResolvedValueOnce([
      r("injury", "i1"), r("move", "m1"), r("birthday", "b1"),
    ]);
    const res = await request(app).get("/api/reports?league=nba");
    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(3);
    expect(res.body.total).toBe(3);
    expect(res.body.hasMore).toBe(false);
  });

  it("filters by type", async () => {
    mockGetForLeague.mockResolvedValueOnce([
      r("injury", "i1"), r("move", "m1"), r("birthday", "b1"),
    ]);
    const res = await request(app).get("/api/reports?league=nba&type=move");
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0].type).toBe("move");
  });

  it("paginates with limit and offset", async () => {
    mockGetForLeague.mockResolvedValueOnce(
      Array.from({ length: 30 }, (_, i) => r("injury", `i${i}`))
    );
    const res = await request(app).get("/api/reports?league=nba&limit=10&offset=5");
    expect(res.body.reports).toHaveLength(10);
    expect(res.body.reports[0].id).toBe("i5");
    expect(res.body.total).toBe(30);
    expect(res.body.hasMore).toBe(true);
  });

  it("caps limit at 50", async () => {
    mockGetForLeague.mockResolvedValueOnce(
      Array.from({ length: 100 }, (_, i) => r("injury", `i${i}`))
    );
    const res = await request(app).get("/api/reports?league=nba&limit=999");
    expect(res.body.reports).toHaveLength(50);
  });

  it("returns cross-league results when ?league omitted", async () => {
    mockGetAcrossLeagues.mockResolvedValueOnce([
      r("injury", "i1", "nba"), r("move", "m1", "nfl"),
    ]);
    const res = await request(app).get("/api/reports?limit=5");
    expect(res.body.reports).toHaveLength(2);
    expect(mockGetAcrossLeagues).toHaveBeenCalled();
    expect(mockGetForLeague).not.toHaveBeenCalled();
  });

  it("rejects invalid league", async () => {
    const res = await request(app).get("/api/reports?league=mlb");
    expect(res.status).toBe(400);
  });

  it("rejects invalid type", async () => {
    const res = await request(app).get("/api/reports?league=nba&type=fake");
    expect(res.status).toBe(400);
  });
});
