import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const { getUser, updateUser, deleteUser } = await import(
  resolve(__dirname, "../../src/services/user/userService.js")
);

const mockUserRow = {
  id: "user-1",
  email: "alice@example.com",
  first_name: "Alice",
  last_name: "Smith",
  default_league: "nba",
};

describe("userService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── getUser ───────────────────────────────────────────────────────────────

  describe("getUser", () => {
    it("returns the user row when found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      const result = await getUser("user-1");

      expect(result).toEqual(mockUserRow);
    });

    it("returns null when user not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getUser("nonexistent");

      expect(result).toBeNull();
    });

    it("passes userId to query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      await getUser("user-42");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1"),
        ["user-42"]
      );
    });

    it("selects only the expected columns", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      await getUser("user-1");

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("email");
      expect(sql).toContain("first_name");
      expect(sql).toContain("last_name");
      expect(sql).toContain("default_league");
    });
  });

  // ─── updateUser ────────────────────────────────────────────────────────────

  describe("updateUser", () => {
    it("returns the updated user row", async () => {
      const updated = { ...mockUserRow, first_name: "Alicia" };
      mockPool.query.mockResolvedValueOnce({ rows: [updated] });

      const result = await updateUser("user-1", { firstName: "Alicia" });

      expect(result).toEqual(updated);
    });

    it("returns null when user not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await updateUser("ghost", { firstName: "X" });

      expect(result).toBeNull();
    });

    it("passes all fields including nulls for omitted ones", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      await updateUser("user-1", { firstName: "Alice", lastName: "Jones", defaultLeague: "nfl" });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["user-1", "Alice", "Jones", "nfl"]
      );
    });

    it("passes null for undefined fields (COALESCE preserves existing)", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      await updateUser("user-1", { firstName: "Alice" });

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[0]).toBe("user-1");
      expect(params[1]).toBe("Alice");
      expect(params[2]).toBeNull(); // lastName undefined → null
      expect(params[3]).toBeNull(); // defaultLeague undefined → null
    });

    it("SQL uses COALESCE to preserve existing values", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      await updateUser("user-1", { firstName: "Alice" });

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("COALESCE");
    });

    it("SQL includes RETURNING clause", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      await updateUser("user-1", { firstName: "Alice" });

      const [sql] = mockPool.query.mock.calls[0];
      expect(sql).toContain("RETURNING");
    });
  });

  // ─── deleteUser ────────────────────────────────────────────────────────────

  describe("deleteUser", () => {
    it("executes DELETE query", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await deleteUser("user-1");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM users"),
        ["user-1"]
      );
    });

    it("returns undefined (void)", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await deleteUser("user-1");

      expect(result).toBeUndefined();
    });

    it("passes userId to DELETE query", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await deleteUser("user-xyz");

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[0]).toBe("user-xyz");
    });
  });
});
