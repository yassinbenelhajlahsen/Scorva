/**
 * Tests for liveSync.js worker utilities
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the shared db pool so liveSync doesn't open real connections
let mockPoolInstance;
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => {
  mockPoolInstance = {
    connect: jest.fn(),
    end: jest.fn(),
    query: jest.fn(),
  };
  return { default: mockPoolInstance };
});

// Mock eventProcessor so processEvent doesn't make real ESPN calls
const eventProcessorPath = resolve(
  __dirname,
  "../../src/populate/src/eventProcessor.js"
);
jest.unstable_mockModule(eventProcessorPath, () => ({
  processEvent: jest.fn().mockResolvedValue(1),
  clearPlayerCache: jest.fn(),
}));

// Import liveSync after mocks are set up
const { upsertGameScoreboard, tick, eventState } = await import(
  "../../src/populate/liveSync.js"
);

const { processEvent } = await import(
  "../../src/populate/src/eventProcessor.js"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
}

function makeEvent(overrides = {}) {
  return {
    id: "401584583",
    status: {
      type: { state: "in", description: "In Progress" },
      period: 3,
      displayClock: "2:34",
    },
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            score: "95",
            linescores: [
              { period: 1, value: 28 },
              { period: 2, value: 24 },
              { period: 3, value: 18 },
            ],
          },
          {
            homeAway: "away",
            score: "88",
            linescores: [
              { period: 1, value: 25 },
              { period: 2, value: 22 },
              { period: 3, value: 15 },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeFinalEvent(id = "401584583") {
  return makeEvent({
    id,
    status: {
      type: { state: "post", description: "Final" },
      period: 4,
      displayClock: "0:00",
    },
  });
}

function mockFetch(events) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ events }),
  });
}

// ---------------------------------------------------------------------------
// upsertGameScoreboard
// ---------------------------------------------------------------------------

describe("upsertGameScoreboard", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  });

  it("issues an UPDATE with scores, status, clock, and current_period", async () => {
    await upsertGameScoreboard(mockClient, "nba", makeEvent());

    // 2 calls: UPDATE games + pg_notify
    expect(mockClient.query).toHaveBeenCalledTimes(2);
    const [sql, params] = mockClient.query.mock.calls[0];
    expect(sql).toContain("UPDATE games");
    expect(sql).toContain("current_period");
    expect(sql).toContain("clock");
    expect(params).toContain(95);           // homeScore
    expect(params).toContain(88);           // awayScore
    expect(params).toContain("In Progress"); // status
    expect(params).toContain(3);            // currentPeriod
    expect(params).toContain("2:34");       // clock
    expect(params).toContain(401584583);    // eventid
    expect(params).toContain("nba");        // league
  });

  it("includes quarter strings derived from linescores", async () => {
    await upsertGameScoreboard(mockClient, "nba", makeEvent());

    const params = mockClient.query.mock.calls[0][1];
    expect(params).toContain("28-25"); // firstqtr
    expect(params).toContain("24-22"); // secondqtr
    expect(params).toContain("18-15"); // thirdqtr
  });

  it("skips update when eventid is invalid", async () => {
    const badEvent = makeEvent({ id: "not-a-number" });
    await upsertGameScoreboard(mockClient, "nba", badEvent);
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it("skips update when home or away competitor is missing", async () => {
    const noCompetitors = makeEvent();
    noCompetitors.competitions[0].competitors = [];
    await upsertGameScoreboard(mockClient, "nba", noCompetitors);
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it("handles missing linescores gracefully (no quarter data)", async () => {
    const event = makeEvent();
    event.competitions[0].competitors[0].linescores = undefined;
    event.competitions[0].competitors[1].linescores = undefined;

    await upsertGameScoreboard(mockClient, "nba", event);

    // Should still run the update — quarter COALESCE keeps existing DB values
    // 2 calls: UPDATE games + pg_notify
    expect(mockClient.query).toHaveBeenCalledTimes(2);
    const params = mockClient.query.mock.calls[0][1];
    // Quarter params should be null (COALESCE in SQL preserves DB values)
    expect(params[5]).toBeNull(); // firstqtr
    expect(params[6]).toBeNull(); // secondqtr
  });

  it("handles null score values", async () => {
    const event = makeEvent();
    delete event.competitions[0].competitors[0].score;
    delete event.competitions[0].competitors[1].score;

    await upsertGameScoreboard(mockClient, "nba", event);

    const params = mockClient.query.mock.calls[0][1];
    expect(params[0]).toBeNull(); // homeScore
    expect(params[1]).toBeNull(); // awayScore
  });

  it("handles overtime periods (period > 4 → ot1, ot2...)", async () => {
    const event = makeEvent();
    event.competitions[0].competitors[0].linescores = [
      { period: 1, value: 28 },
      { period: 2, value: 24 },
      { period: 3, value: 30 },
      { period: 4, value: 18 },
      { period: 5, value: 6 },
    ];
    event.competitions[0].competitors[1].linescores = [
      { period: 1, value: 25 },
      { period: 2, value: 22 },
      { period: 3, value: 29 },
      { period: 4, value: 22 },
      { period: 5, value: 4 },
    ];

    await upsertGameScoreboard(mockClient, "nba", event);

    const params = mockClient.query.mock.calls[0][1];
    expect(params).toContain("6-4"); // ot1
  });

  it("works for nhl league slug", async () => {
    await upsertGameScoreboard(mockClient, "nhl", makeEvent());

    const params = mockClient.query.mock.calls[0][1];
    expect(params).toContain("nhl");
  });
});

// ---------------------------------------------------------------------------
// tick — justFinalized handling
// ---------------------------------------------------------------------------

describe("tick — justFinalized handling", () => {
  let mockClient;

  beforeEach(() => {
    eventState.clear();
    processEvent.mockClear();
    mockClient = makeClient();
    mockPoolInstance.connect = jest.fn().mockResolvedValue(mockClient);
  });

  it("calls processEvent and removes from eventState when a tracked game goes Final", async () => {
    const eventId = 401584583;
    eventState.set(eventId, { lastFullUpdate: Date.now() - 1000, lastPeriod: 4 });

    const finalEvent = makeFinalEvent(String(eventId));
    mockFetch([finalEvent]);

    await tick([{ slug: "nba", sport: "basketball" }]);

    expect(processEvent).toHaveBeenCalledWith(mockClient, "nba", finalEvent);
    expect(eventState.has(eventId)).toBe(false);
  });

  it("fires pg_notify after writing Final status", async () => {
    const eventId = 401584583;
    eventState.set(eventId, { lastFullUpdate: Date.now() - 1000, lastPeriod: 4 });

    mockFetch([makeFinalEvent(String(eventId))]);

    await tick([{ slug: "nba", sport: "basketball" }]);

    const notifyCalls = mockClient.query.mock.calls.filter(([sql]) =>
      sql.includes("pg_notify")
    );
    expect(notifyCalls.length).toBeGreaterThan(0);
    const notifyArgs = notifyCalls[0][1];
    expect(notifyArgs).toContain(String(eventId));
  });

  it("ignores post-state events that were NOT being tracked", async () => {
    // eventState is empty — this game was never tracked
    const untrackedFinalEvent = makeFinalEvent("999999999");
    mockFetch([untrackedFinalEvent]);

    await tick([{ slug: "nba", sport: "basketball" }]);

    expect(processEvent).not.toHaveBeenCalled();
  });

  it("does not include a league in stillLive when all its games are post-state", async () => {
    const eventId = 401584583;
    eventState.set(eventId, { lastFullUpdate: Date.now() - 1000, lastPeriod: 4 });

    mockFetch([makeFinalEvent(String(eventId))]);

    const stillLive = await tick([{ slug: "nba", sport: "basketball" }]);

    expect(stillLive).not.toContainEqual(
      expect.objectContaining({ slug: "nba" })
    );
  });

  it("keeps a league in stillLive when it still has in-progress games alongside finalized ones", async () => {
    const finishedId = 401584583;
    const liveId = 401584584;
    eventState.set(finishedId, { lastFullUpdate: Date.now() - 1000, lastPeriod: 4 });
    eventState.set(liveId, { lastFullUpdate: Date.now() - 1000, lastPeriod: 3 });

    const finalEvent = makeFinalEvent(String(finishedId));
    const liveEvent = makeEvent({ id: String(liveId) });
    mockFetch([finalEvent, liveEvent]);

    const stillLive = await tick([{ slug: "nba", sport: "basketball" }]);

    expect(stillLive).toContainEqual(
      expect.objectContaining({ slug: "nba" })
    );
    expect(eventState.has(finishedId)).toBe(false); // finalized game removed
    expect(eventState.has(liveId)).toBe(true);      // live game still tracked
  });

  it("falls back to upsertGameScoreboard when processEvent throws for a finalized game", async () => {
    const eventId = 401584583;
    eventState.set(eventId, { lastFullUpdate: Date.now() - 1000, lastPeriod: 4 });

    processEvent.mockRejectedValueOnce(new Error("DB error"));
    mockFetch([makeFinalEvent(String(eventId))]);

    await tick([{ slug: "nba", sport: "basketball" }]);

    // Should still remove from eventState even after fallback
    expect(eventState.has(eventId)).toBe(false);

    // upsertGameScoreboard UPDATE + pg_notify (no ROLLBACK — processEvent handles its own tx)
    const updateCalls = mockClient.query.mock.calls.filter(([sql]) =>
      sql.includes("UPDATE games")
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it("handles multiple games finalizing in the same tick", async () => {
    const id1 = 401584583;
    const id2 = 401584584;
    eventState.set(id1, { lastFullUpdate: Date.now() - 1000, lastPeriod: 4 });
    eventState.set(id2, { lastFullUpdate: Date.now() - 1000, lastPeriod: 4 });

    mockFetch([makeFinalEvent(String(id1)), makeFinalEvent(String(id2))]);

    await tick([{ slug: "nba", sport: "basketball" }]);

    expect(processEvent).toHaveBeenCalledTimes(2);
    expect(eventState.has(id1)).toBe(false);
    expect(eventState.has(id2)).toBe(false);
  });
});
