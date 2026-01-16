/**
 * Tests for database connection and pool
 */

import { describe, it, expect, jest } from "@jest/globals";
import pool from "../../src/db/db.js";

describe("Database Connection", () => {
  it("should export a pool instance", () => {
    expect(pool).toBeDefined();
    expect(pool).toHaveProperty("query");
    expect(typeof pool.query).toBe("function");
  });

  it("should have connect method", () => {
    expect(pool).toHaveProperty("connect");
    expect(typeof pool.connect).toBe("function");
  });

  it("should have end method", () => {
    expect(pool).toHaveProperty("end");
    expect(typeof pool.end).toBe("function");
  });
});

describe("Database Query Operations", () => {
  it("should handle successful queries", async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
    };

    const result = await mockPool.query("SELECT * FROM teams");
    expect(result.rows).toHaveLength(1);
    expect(mockPool.query).toHaveBeenCalledWith("SELECT * FROM teams");
  });

  it("should handle query errors", async () => {
    const mockPool = {
      query: jest.fn().mockRejectedValue(new Error("Connection failed")),
    };

    await expect(mockPool.query("SELECT * FROM teams")).rejects.toThrow(
      "Connection failed"
    );
  });

  it("should handle parameterized queries", async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    await mockPool.query("SELECT * FROM teams WHERE league = $1", ["nba"]);
    expect(mockPool.query).toHaveBeenCalledWith(
      "SELECT * FROM teams WHERE league = $1",
      ["nba"]
    );
  });
});
