import { describe, it, expect } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { finalsSignature } from "../../src/ingestion/finalsSignature.js";

describe("finalsSignature", () => {
  it("encodes the count and latest date of Final games for the league season", async () => {
    const pool = createMockPool();
    pool.query.mockResolvedValue({ rows: [{ finals: 412, last_date: "2026-01-14" }] });

    const sig = await finalsSignature(pool, "nba", "2025-26");

    expect(sig).toBe("412:2026-01-14");
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM games/);
    expect(sql).toMatch(/status\s+ILIKE\s+'Final%'/i);
    expect(params).toEqual(["nba", "2025-26"]);
  });

  it("is stable when no game has gone Final yet", async () => {
    const pool = createMockPool();
    pool.query.mockResolvedValue({ rows: [{ finals: 0, last_date: null }] });

    expect(await finalsSignature(pool, "nhl", "2026-27")).toBe("0:none");
  });
});
