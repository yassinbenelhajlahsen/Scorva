/**
 * Tests for the shared LISTEN notification bus.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import EventEmitter from "events";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Mock pool with an EventEmitter-based client (simulates pg client events)
// ---------------------------------------------------------------------------

function makeMockClient() {
  const client = new EventEmitter();
  client.query = jest.fn().mockResolvedValue({});
  client.release = jest.fn();
  return client;
}

let mockClient;
const mockPool = {
  connect: jest.fn(),
};

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

// We also need to mock the logger so tests don't spew output
const loggerPath = resolve(__dirname, "../../src/logger.js");
jest.unstable_mockModule(loggerPath, () => ({
  default: { info: jest.fn(), error: jest.fn() },
}));

// Import the bus fresh for each test by using a module registry reset
// Jest ESM doesn't support jest.resetModules() with unstable_mockModule cleanly,
// so we import once and test the state machine through the exported functions.
const busPath = resolve(__dirname, "../../src/db/notificationBus.js");
const { subscribe, unsubscribe, shutdown } = await import(busPath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("notificationBus", () => {
  beforeEach(() => {
    mockClient = makeMockClient();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  afterEach(async () => {
    // Clean up by shutting down after each test to reset state
    await shutdown();
    jest.clearAllMocks();
  });

  it("acquires a PG connection on first subscribe", async () => {
    const cb = jest.fn();
    await subscribe(cb);
    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    await unsubscribe(cb);
  });

  it("issues LISTEN on connect", async () => {
    const cb = jest.fn();
    await subscribe(cb);
    expect(mockClient.query).toHaveBeenCalledWith("LISTEN game_updated");
    await unsubscribe(cb);
  });

  it("reuses the same connection for a second subscriber", async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    await subscribe(cb1);
    await subscribe(cb2);
    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    await unsubscribe(cb1);
    await unsubscribe(cb2);
  });

  it("fans out a notification to all subscribers", async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    await subscribe(cb1);
    await subscribe(cb2);

    const msg = { channel: "game_updated", payload: "12345" };
    mockClient.emit("notification", msg);

    expect(cb1).toHaveBeenCalledWith(msg);
    expect(cb2).toHaveBeenCalledWith(msg);

    await unsubscribe(cb1);
    await unsubscribe(cb2);
  });

  it("UNLISTENs and releases client when last subscriber leaves", async () => {
    const cb = jest.fn();
    await subscribe(cb);
    await unsubscribe(cb);

    expect(mockClient.query).toHaveBeenCalledWith("UNLISTEN game_updated");
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("does not release client until the last subscriber unsubscribes", async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    await subscribe(cb1);
    await subscribe(cb2);

    await unsubscribe(cb1);
    expect(mockClient.release).not.toHaveBeenCalled();

    await unsubscribe(cb2);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it("reconnects after client error if subscribers remain", async () => {
    const cb = jest.fn();
    await subscribe(cb);

    const newClient = makeMockClient();
    mockPool.connect.mockResolvedValue(newClient);

    // Simulate PG client error
    mockClient.emit("error", new Error("connection lost"));

    // Wait for reconnect delay (1s) + async connect
    await delay(1100);

    expect(mockPool.connect).toHaveBeenCalledTimes(2);
    expect(newClient.query).toHaveBeenCalledWith("LISTEN game_updated");

    await unsubscribe(cb);
  });

  it("shutdown() releases the client and clears all listeners", async () => {
    const cb = jest.fn();
    await subscribe(cb);
    await shutdown();

    expect(mockClient.query).toHaveBeenCalledWith("UNLISTEN game_updated");
    expect(mockClient.release).toHaveBeenCalledTimes(1);

    // Notification after shutdown should not reach subscriber
    mockClient.emit("notification", { channel: "game_updated", payload: "x" });
    expect(cb).not.toHaveBeenCalled();
  });
});
