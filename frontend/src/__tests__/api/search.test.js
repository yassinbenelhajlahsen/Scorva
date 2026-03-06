import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { search } = await import("../../api/search.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue([]);
});

describe("search", () => {
  it("calls /api/search with the term as a param", async () => {
    await search("lebron");
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/search",
      expect.objectContaining({ params: { term: "lebron" } })
    );
  });

  it("forwards the abort signal", async () => {
    const controller = new AbortController();
    await search("lakers", { signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/search",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("works without options", async () => {
    await search("nba");
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
