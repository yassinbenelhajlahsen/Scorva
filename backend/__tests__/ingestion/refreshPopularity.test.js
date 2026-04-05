import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// refreshPopularity imports logger but takes pool as a parameter
const { refreshPopularity } = await import(
  resolve(__dirname, "../../src/ingestion/refreshPopularity.js")
);

describe("refreshPopularity", () => {
  let mockPool;

  beforeEach(() => {
    mockPool = createMockPool();
    jest.clearAllMocks();
  });

  it("calls pool.query with an UPDATE statement", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 100 });

    await refreshPopularity(mockPool);

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("UPDATE players");
  });

  it("SQL sets popularity from a stats count subquery", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 50 });

    await refreshPopularity(mockPool);

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("GROUP BY playerid");
    expect(sql).toContain("popularity");
  });

  it("uses the pool passed as parameter, not a module-level import", async () => {
    const anotherPool = createMockPool();
    anotherPool.query.mockResolvedValueOnce({ rowCount: 0 });

    await refreshPopularity(anotherPool);

    expect(anotherPool.query).toHaveBeenCalledTimes(1);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("completes without throwing on success", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 200 });

    await expect(refreshPopularity(mockPool)).resolves.toBeUndefined();
  });
});
