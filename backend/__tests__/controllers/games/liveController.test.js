import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the controller
// ---------------------------------------------------------------------------

const mockGetLiveGamePartial = jest.fn();
const mockGetNbaGame = jest.fn();
const mockGetNflGame = jest.fn();
const mockGetNhlGame = jest.fn();
const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();

jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/games/gamesService.js"),
  () => ({
    getGames: jest.fn(),
    getLiveGamePartial: mockGetLiveGamePartial,
    getGameDates: jest.fn(),
  }),
);

jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/games/gameDetailService.js"),
  () => ({
    getNbaGame: mockGetNbaGame,
    getNflGame: mockGetNflGame,
    getNhlGame: mockGetNhlGame,
  }),
);

jest.unstable_mockModule(
  resolve(__dirname, "../../../src/db/notificationBus.js"),
  () => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  }),
);

const { streamGames } = await import(
  resolve(__dirname, "../../../src/controllers/games/liveController.js")
);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    writeHead: jest.fn(),
    write: jest.fn(),
    end: jest.fn(() => { res.writableEnded = true; }),
    status: jest.fn(function () { return this; }),
    json: jest.fn(),
    writableEnded: false,
  };
  return res;
}

function makeReq(league = "nba") {
  const handlers = {};
  return {
    params: { league },
    on: jest.fn((event, fn) => { handlers[event] = fn; }),
    _trigger: (event) => handlers[event]?.(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // Capture the registered notification callback so tests can fire it.
  mockSubscribe.mockImplementation(async (cb) => {
    mockSubscribe._cb = cb;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("liveController.streamGames", () => {
  it("rejects invalid league with 400", async () => {
    const req = makeReq("xyz");
    const res = makeRes();
    await streamGames(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid league" });
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("opens SSE headers and subscribes to the notification bus", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "text/event-stream",
    }));
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it("does NOT push an initial data: message before any notification", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);
    // Only the retry: ... and possibly headers are written. No `data:` line yet.
    const writes = res.write.mock.calls.map((c) => c[0]);
    expect(writes.some((w) => typeof w === "string" && w.startsWith("data:"))).toBe(false);
  });

  it("emits one partial per notification using msg.payload as eventid", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockResolvedValueOnce({
      id: 42, status: "In Progress - Q3", homescore: 88, awayscore: 91, current_period: 3, clock: "5:42",
    });

    await mockSubscribe._cb({ channel: "game_updated", payload: "401705234" });

    expect(mockGetLiveGamePartial).toHaveBeenCalledWith("nba", "401705234");
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        id: 42, status: "In Progress - Q3", homescore: 88, awayscore: 91, current_period: 3, clock: "5:42",
      })}\n\n`,
    );
  });

  it("skips notifications whose eventid does not match this league (partial is null)", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockResolvedValueOnce(null);
    await mockSubscribe._cb({ channel: "game_updated", payload: "999999" });

    const dataWrites = res.write.mock.calls
      .map((c) => c[0])
      .filter((w) => typeof w === "string" && w.startsWith("data:"));
    expect(dataWrites).toHaveLength(0);
  });

  it("never emits an event: done message", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockResolvedValueOnce({
      id: 1, status: "Final", homescore: 100, awayscore: 99, current_period: 4, clock: "0:00",
    });
    await mockSubscribe._cb({ channel: "game_updated", payload: "1" });

    const writes = res.write.mock.calls.map((c) => c[0]);
    expect(writes.some((w) => typeof w === "string" && w.includes("event: done"))).toBe(false);
    expect(res.end).not.toHaveBeenCalled();
  });

  it("starts the heartbeat after subscribing", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    res.write.mockClear();
    jest.advanceTimersByTime(15_000);
    expect(res.write).toHaveBeenCalledWith(": ping\n\n");
  });

  it("unsubscribes and clears heartbeat when the request closes", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    await req._trigger("close");
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("swallows handler errors and unsubscribes", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockRejectedValueOnce(new Error("db down"));
    await mockSubscribe._cb({ channel: "game_updated", payload: "1" });

    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it("cleanup is idempotent — error path then req.close calls unsubscribe only once", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockRejectedValueOnce(new Error("db down"));
    await mockSubscribe._cb({ channel: "game_updated", payload: "1" });

    // Error path called cleanup once and then res.end(). Now simulate the
    // socket close that res.end() would trigger.
    await req._trigger("close");

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
