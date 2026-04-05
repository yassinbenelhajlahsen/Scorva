import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

// Logger is configured silent in test env — no need to mock
const { getPlayerIdBySlug } = await import(
  resolve(__dirname, "../../src/utils/slugResolver.js")
);

describe("getPlayerIdBySlug", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns parsed integer for a numeric string without querying DB", async () => {
    const result = await getPlayerIdBySlug("42", "nba");

    expect(result).toBe(42);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("returns parsed integer for a numeric string with leading whitespace", async () => {
    const result = await getPlayerIdBySlug("  99  ", "nba");

    expect(result).toBe(99);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("queries DB for a slug string", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 7 }] });

    const result = await getPlayerIdBySlug("lebron-james", "nba");

    expect(result).toBe(7);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it("passes league and lowercased slug to query", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });

    await getPlayerIdBySlug("LeBron-James", "nba");

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.any(String),
      ["nba", "lebron-james"]
    );
  });

  it("SQL uses LOWER(REPLACE(name, ' ', '-')) for slug matching", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await getPlayerIdBySlug("some-player", "nfl");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("LOWER(REPLACE(name");
    expect(sql).toContain("'-'");
  });

  it("returns null when player is not found", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getPlayerIdBySlug("unknown-player", "nba");

    expect(result).toBeNull();
  });

  it("returns null and does not throw when DB query errors", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("DB connection failed"));

    const result = await getPlayerIdBySlug("some-player", "nba");

    expect(result).toBeNull();
  });

  it("trims whitespace from slug input before querying", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    await getPlayerIdBySlug("  lebron-james  ", "nba");

    const [, params] = mockPool.query.mock.calls[0];
    expect(params[1]).toBe("lebron-james");
  });
});
