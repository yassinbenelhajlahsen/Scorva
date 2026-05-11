/**
 * Tests for SSE live endpoints:
 *   GET /api/live/:league/games
 *   GET /api/live/:league/games/:gameId
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool, fixtures } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Mock notificationBus — subscribe/unsubscribe instead of pool.connect
// ---------------------------------------------------------------------------

let subscribedCallbacks = [];

const mockSubscribe = jest.fn(async (cb) => { subscribedCallbacks.push(cb); });
const mockUnsubscribe = jest.fn(async (cb) => {
  subscribedCallbacks = subscribedCallbacks.filter((s) => s !== cb);
});
const mockShutdown = jest.fn();

const busPath = resolve(__dirname, "../../src/db/notificationBus.js");
jest.unstable_mockModule(busPath, () => ({
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  shutdown: mockShutdown,
}));

// Mock pool for getGames / getGameInfo queries (pool.query, not pool.connect)
const mockPool = createMockPool();
const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({
  default: mockPool,
}));

// Mock ratingAggregates so live partial + gameDetail don't consume extra pool.query mocks
const ratingAggregatesPath = resolve(__dirname, "../../src/services/games/ratingAggregates.js");
jest.unstable_mockModule(ratingAggregatesPath, () => ({
  ratingsForGames: jest.fn().mockResolvedValue(new Map()),
}));

const controllerPath = resolve(
  __dirname,
  "../../src/controllers/games/liveController.js"
);
const { streamGames, streamGame } = await import(controllerPath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import EventEmitter from "events";

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

// Fire all currently subscribed notification callbacks
async function fireNotification() {
  await Promise.all(subscribedCallbacks.map((cb) => cb()));
}

// ---------------------------------------------------------------------------
// streamGames
// ---------------------------------------------------------------------------

describe("streamGames", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscribedCallbacks = [];
    mockPool.query.mockReset();
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

  it("does not push an initial data: frame before any notification", async () => {
    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    expect(res.written.find((w) => w.startsWith("data:"))).toBeUndefined();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("never emits event: done for terminal slates (frontend handles teardown)", async () => {
    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    // Simulate a notification with no matching live game (partial returns null).
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await Promise.all(subscribedCallbacks.map((cb) => cb({ channel: "game_updated", payload: "401705234" })));

    expect(res.written).not.toContain("event: done\ndata: final\n\n");
    expect(res.end).not.toHaveBeenCalled();
  });

  it("subscribes to notificationBus on setup", async () => {
    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it("emits one partial per notification using msg.payload as eventid", async () => {
    const liveGame = makeLiveGame({ id: 42, eventid: "401705234" });
    // getLiveGamePartial query path: a single SELECT keyed by eventid.
    mockPool.query.mockResolvedValueOnce({ rows: [liveGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    const framesBefore = res.written.filter((w) => w.startsWith("data:")).length;
    expect(framesBefore).toBe(0);

    await Promise.all(
      subscribedCallbacks.map((cb) =>
        cb({ channel: "game_updated", payload: "401705234" }),
      ),
    );

    const framesAfter = res.written.filter((w) => w.startsWith("data:")).length;
    expect(framesAfter).toBe(1);
  });

  it("skips emit when the partial is null (eventid not in this league)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // no row → partial is null

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    await Promise.all(
      subscribedCallbacks.map((cb) =>
        cb({ channel: "game_updated", payload: "999999" }),
      ),
    );

    const dataFrames = res.written.filter((w) => w.startsWith("data:"));
    expect(dataFrames).toHaveLength(0);
  });

  it("does not crash on DB error during notification handling", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB down"));

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    await expect(
      Promise.all(
        subscribedCallbacks.map((cb) =>
          cb({ channel: "game_updated", payload: "1" }),
        ),
      ),
    ).resolves.toBeDefined();
    expect(res.end).toHaveBeenCalled();
  });

  it("unsubscribes from notificationBus on close", async () => {
    const liveGame = makeLiveGame();
    mockPool.query.mockResolvedValueOnce({ rows: [liveGame] });

    const req = makeReq({ league: "nba" });
    const res = makeRes();
    await streamGames(req, res);

    req.emit("close");
    await new Promise((r) => setImmediate(r));

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// streamGame
// ---------------------------------------------------------------------------

describe("streamGame", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscribedCallbacks = [];
    mockPool.query.mockReset();
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

  it("subscribes to notificationBus on setup", async () => {
    const gameRow = { json_build_object: { game: { status: "In Progress" } } };
    mockPool.query.mockResolvedValueOnce({ rows: [gameRow] });

    const req = makeReq({ league: "nba", gameId: "1" });
    const res = makeRes();
    await streamGame(req, res);

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes from notificationBus on close", async () => {
    const gameRow = { json_build_object: { game: { status: "In Progress" } } };
    mockPool.query.mockResolvedValueOnce({ rows: [gameRow] });

    const req = makeReq({ league: "nba", gameId: "1" });
    const res = makeRes();
    await streamGame(req, res);

    req.emit("close");
    await new Promise((r) => setImmediate(r));

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
