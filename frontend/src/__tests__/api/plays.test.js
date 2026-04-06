import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getGamePlays } = await import("../../api/plays.js");

describe("getGamePlays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue({ plays: [], source: "db" });
  });

  it("calls apiFetch with the correct path", async () => {
    await getGamePlays("nba", 42);
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/games/42/plays",
      expect.any(Object),
    );
  });

  it("passes signal option when provided", async () => {
    const controller = new AbortController();
    await getGamePlays("nfl", 1, { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nfl/games/1/plays",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    const data = { plays: [{ id: 1, description: "Test" }], source: "db" };
    apiFetch.mockResolvedValue(data);
    const result = await getGamePlays("nba", 1);
    expect(result).toEqual(data);
  });

  it("propagates errors from apiFetch", async () => {
    apiFetch.mockRejectedValue(new Error("HTTP 404"));
    await expect(getGamePlays("nba", 999)).rejects.toThrow("HTTP 404");
  });
});
