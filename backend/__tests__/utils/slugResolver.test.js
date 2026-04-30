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

  it("SQL strips punctuation and normalizes whitespace for slug matching", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await getPlayerIdBySlug("some-player", "nfl");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("REGEXP_REPLACE(name");
    expect(sql).toContain("[^A-Za-z0-9_\\s-]");
    expect(sql).toContain("\\s+");
  });

  it("resolves names with periods like 'Chris Paul Jr.' via stripped slug", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });

    const result = await getPlayerIdBySlug("chris-paul-jr", "nba");

    expect(result).toBe(42);
    const [, params] = mockPool.query.mock.calls[0];
    expect(params).toEqual(["nba", "chris-paul-jr"]);
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

  it("resolves slug-id form by id when name slug matches", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 3144, name: "John Smith" }] });

    const result = await getPlayerIdBySlug("john-smith-3144", "nba");

    expect(result).toBe(3144);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain("FROM players WHERE id");
    expect(params).toEqual([3144, "nba"]);
  });

  it("falls back to slug-only path when id-form prefix mismatches name", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 3144, name: "Jane Doe" }] })
      .mockResolvedValueOnce({ rows: [{ id: 9999 }] });

    const result = await getPlayerIdBySlug("john-smith-3144", "nba");

    expect(result).toBe(9999);
    expect(mockPool.query).toHaveBeenCalledTimes(2);
  });

  it("falls back to slug-only path when id-form id is not found", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] });

    const result = await getPlayerIdBySlug("john-smith-3144", "nba");

    expect(result).toBe(5);
    expect(mockPool.query).toHaveBeenCalledTimes(2);
  });

  it("slug-only path orders by id ascending so canonical (lowest id) wins", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await getPlayerIdBySlug("john-smith", "nba");

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("ORDER BY id ASC");
  });
});
