import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getSeasons } = await import("../../api/seasons.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue([]);
});

describe("getSeasons", () => {
  it("calls apiFetch with the correct path", async () => {
    await getSeasons("nba");
    expect(apiFetch).toHaveBeenCalledWith("/api/nba/seasons", expect.any(Object));
  });

  it("works with different leagues", async () => {
    await getSeasons("nfl");
    expect(apiFetch).toHaveBeenCalledWith("/api/nfl/seasons", expect.any(Object));
    await getSeasons("nhl");
    expect(apiFetch).toHaveBeenCalledWith("/api/nhl/seasons", expect.any(Object));
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getSeasons("nba", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/nba/seasons",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the resolved value from apiFetch", async () => {
    const seasons = ["2024-25", "2023-24", "2022-23"];
    apiFetch.mockResolvedValue(seasons);
    const result = await getSeasons("nba");
    expect(result).toEqual(seasons);
  });
});
