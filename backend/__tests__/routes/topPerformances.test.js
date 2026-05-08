import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const mockGet = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/games/topPerformancesService.js"),
  () => ({ getTopPerformances: mockGet }),
);

const { default: router } = await import("../../src/routes/games/topPerformances.js");

const app = express();
app.use("/api", router);

beforeEach(() => mockGet.mockReset());

test("GET /api/nba/top-performances?days=7&type=games", async () => {
  mockGet.mockResolvedValueOnce({ type: "games", days: 7, performances: [] });
  const r = await request(app).get("/api/nba/top-performances?days=7&type=games");
  expect(r.status).toBe(200);
  expect(r.body.type).toBe("games");
  expect(mockGet).toHaveBeenCalledWith({ league: "nba", days: "7", type: "games", limit: undefined });
});

test("400 for non-NBA in v1", async () => {
  const r = await request(app).get("/api/nfl/top-performances?days=7&type=games");
  expect(r.status).toBe(400);
});

test("400 for invalid type", async () => {
  mockGet.mockRejectedValueOnce(Object.assign(new Error("invalid type"), { status: 400 }));
  const r = await request(app).get("/api/nba/top-performances?days=7&type=garbage");
  expect(r.status).toBe(400);
});
