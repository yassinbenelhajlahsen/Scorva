import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getPlayer } = await import("../../api/players.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({});
});

describe("getPlayer", () => {
  it("calls apiFetch with the correct path", async () => {
    await getPlayer("nba", "lebron-james");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/players/lebron-james",
      expect.any(Object)
    );
  });

  it("passes season param when provided", async () => {
    await getPlayer("nba", "lebron-james", { season: "2024-25" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/players/lebron-james",
      expect.objectContaining({ params: expect.objectContaining({ season: "2024-25" }) })
    );
  });

  it("passes undefined season when not provided", async () => {
    await getPlayer("nba", "lebron-james");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/players/lebron-james",
      expect.objectContaining({ params: expect.objectContaining({ season: undefined }) })
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getPlayer("nba", "lebron-james", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/players/lebron-james",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("works with different leagues", async () => {
    await getPlayer("nfl", "patrick-mahomes");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nfl/players/patrick-mahomes",
      expect.any(Object)
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    const player = { id: 1, name: "LeBron James", stats: [] };
    apiFetch.mockResolvedValue(player);
    const result = await getPlayer("nba", "lebron-james");
    expect(result).toEqual(player);
  });
});
