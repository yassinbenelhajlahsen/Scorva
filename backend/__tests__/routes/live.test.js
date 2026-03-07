/**
 * Tests for SSE live endpoints:
 *   GET /api/live/:league/games
 *   GET /api/live/:league/games/:gameId
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool, fixtures } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import EventEmitter from "events";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Mock pool — client must be an EventEmitter so LISTEN notifications work
// ---------------------------------------------------------------------------

const mockPool = createMockPool();

// Replace the connect mock with an EventEmitter-based client
const mockListenClient = new EventEmitter();
mockListenClient.query = jest.fn().mockResolvedValue({ rows: [] });
mockListenClient.release = jest.fn();
mockPool.connect = jest.fn().mockResolvedValue(mockListenClient);

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({
  default: mockPool,
}));

const controllerPath = resolve(
  __dirname,
  "../../src/controllers/liveController.js"
);
const { streamGames, streamGame } = await import(controllerPath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(params = {}) {
  const emitter = new EventEmitter();
  emitter.params = params;
  return emitter;
}

function makeRes() {
  const res = {
    writableEnded: false,
    written: [],
    headers: {},
    statusCode: null,
    jsonBody: null,
    writeHead: jest.fn(function (code, headers) {
      this.headers = headers;
    }),
    write: jest.fn(function (chunk) {
      this.written.push(chunk);
    }),
    end: jest.fn(function () {
      this.writableEnded = true;
    }),
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (body) {
      this.jsonBody = body;
    }),
  };
  return res;
}

function makeLiveGame(overrides = {}) {
  return { ...fixtures.game(), status: "In Progress", ...overrides };
}

// ---------------------------------------------------------------------------
// streamGames
// ---------------------------------------------------------------------------

describe("streamGames", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockListenClient);
    mockListenClient.query.mockResolvedValue({ rows: [] });
    mockListenClient.release.mockReset();
    mockListenClient.removeAllListeners();
  });

  it("returns 400 for invalid league", async () => {
    const req = makeReq({ league: "mlb" });
    const res = makeRes();
    await streamGames(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid league" });
  });

  it("sets SSE headers and retry for valid league", async () => {
    const liveGame = makeLiveGame();
    mockPool.query.mockResolvedValueOnce({ rows: [liveGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      })
    );
    expect(res.written[0]).toBe("retry: 30000\n\n");
  });

  it("sends data event with game list on first tick", async () => {
    const liveGame = makeLiveGame();
    mockPool.query.mockResolvedValueOnce({ rows: [liveGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    const dataFrame = res.written.find((w) => w.startsWith("data:"));
    expect(dataFrame).toBeDefined();
    const parsed = JSON.parse(dataFrame.replace("data: ", "").replace("\n\n", ""));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].status).toBe("In Progress");
  });

  it("sends event: done and ends stream when no live games", async () => {
    const finalGame = { ...fixtures.game(), status: "Final" };
    mockPool.query.mockResolvedValueOnce({ rows: [finalGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    expect(res.written).toContain("event: done\ndata: final\n\n");
    expect(res.end).toHaveBeenCalled();
  });

  it("calls LISTEN game_updated on setup", async () => {
    const liveGame = makeLiveGame();
    mockPool.query.mockResolvedValueOnce({ rows: [liveGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    expect(mockListenClient.query).toHaveBeenCalledWith("LISTEN game_updated");
  });

  it("pushes data on pg notification", async () => {
    const liveGame = makeLiveGame();
    // First call: initial send. Second call: notification-triggered send.
    mockPool.query
      .mockResolvedValueOnce({ rows: [liveGame] })
      .mockResolvedValueOnce({ rows: [liveGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    const framesBefore = res.written.filter((w) => w.startsWith("data:")).length;

    // Simulate pg notification
    await new Promise((resolve) => {
      mockListenClient.emit("notification", { channel: "game_updated", payload: "12345" });
      setImmediate(resolve);
    });

    const framesAfter = res.written.filter((w) => w.startsWith("data:")).length;
    expect(framesAfter).toBeGreaterThan(framesBefore);
  });

  it("does not crash on DB error", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB down"));

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await expect(streamGames(req, res)).resolves.toBeUndefined();
  });

  it("UNLISTENs and releases client on close", async () => {
    const liveGame = makeLiveGame();
    mockPool.query.mockResolvedValueOnce({ rows: [liveGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    req.emit("close");
    // Allow async cleanup
    await new Promise((r) => setImmediate(r));

    expect(mockListenClient.query).toHaveBeenCalledWith("UNLISTEN game_updated");
    expect(mockListenClient.release).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// streamGame
// ---------------------------------------------------------------------------

describe("streamGame", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockListenClient);
    mockListenClient.query.mockResolvedValue({ rows: [] });
    mockListenClient.release.mockReset();
    mockListenClient.removeAllListeners();
  });

  it("returns 400 for invalid league", async () => {
    const req = makeReq({ league: "mlb", gameId: "1" });
    const res = makeRes();
    await streamGame(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("sets SSE headers for valid request", async () => {
    const gameRow = { json_build_object: { game: { status: "In Progress" } } };
    mockPool.query.mockResolvedValueOnce({ rows: [gameRow] });

    const req = makeReq({ league: "nba", gameId: "1" });
    const res = makeRes();
    await streamGame(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({ "Content-Type": "text/event-stream" })
    );
  });

  it("sends data event with game detail", async () => {
    const gameRow = { json_build_object: { game: { id: 1, status: "In Progress" } } };
    mockPool.query.mockResolvedValueOnce({ rows: [gameRow] });

    const req = makeReq({ league: "nba", gameId: "1" });
    const res = makeRes();
    await streamGame(req, res);

    const dataFrame = res.written.find((w) => w.startsWith("data:"));
    expect(dataFrame).toBeDefined();
    const parsed = JSON.parse(dataFrame.replace("data: ", "").replace("\n\n", ""));
    expect(parsed.json_build_object.game.status).toBe("In Progress");
  });

  it("sends event: done when game is Final", async () => {
    const gameRow = { json_build_object: { game: { id: 1, status: "Final" } } };
    mockPool.query.mockResolvedValueOnce({ rows: [gameRow] });

    const req = makeReq({ league: "nba", gameId: "1" });
    const res = makeRes();
    await streamGame(req, res);

    expect(res.written).toContain("event: done\ndata: final\n\n");
    expect(res.end).toHaveBeenCalled();
  });

  it("sends event: done when game not found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const req = makeReq({ league: "nba", gameId: "999" });
    const res = makeRes();
    await streamGame(req, res);

    expect(res.written).toContain("event: done\ndata: final\n\n");
    expect(res.end).toHaveBeenCalled();
  });

  it("does not crash on DB error", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB down"));

    const req = makeReq({ league: "nba", gameId: "1" });
    const res = makeRes();
    await expect(streamGame(req, res)).resolves.toBeUndefined();
  });
});
