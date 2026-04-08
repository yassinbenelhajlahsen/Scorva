import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getHeadToHead } = await import("../../api/compare.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ games: [] });
});

describe("getHeadToHead", () => {
  it("calls apiFetch with correct path and params for teams", async () => {
    await getHeadToHead("nba", "teams", [1, 2]);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/head-to-head",
      expect.objectContaining({
        params: { type: "teams", ids: "1,2" },
      })
    );
  });

  it("calls apiFetch with correct path and params for players", async () => {
    await getHeadToHead("nfl", "players", [10, 20]);

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nfl/head-to-head",
      expect.objectContaining({
        params: { type: "players", ids: "10,20" },
      })
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getHeadToHead("nba", "teams", [1, 2], { signal: controller.signal });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/head-to-head",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    const mockData = { games: [{ id: 1 }] };
    apiFetch.mockResolvedValue(mockData);

    const result = await getHeadToHead("nba", "teams", [1, 2]);

    expect(result).toEqual(mockData);
  });

  it("works with different leagues", async () => {
    for (const league of ["nba", "nfl", "nhl"]) {
      await getHeadToHead(league, "teams", [1, 2]);
    }

    expect(apiFetch).toHaveBeenCalledTimes(3);
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/api/nba/head-to-head", expect.any(Object));
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/api/nfl/head-to-head", expect.any(Object));
    expect(apiFetch).toHaveBeenNthCalledWith(3, "/api/nhl/head-to-head", expect.any(Object));
  });
});
