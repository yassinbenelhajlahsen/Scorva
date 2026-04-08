import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/client.js", () => ({ apiFetch: vi.fn() }));

const { apiFetch } = await import("../../api/client.js");
const { getNews } = await import("../../api/news.js");

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue({ articles: [] });
});

describe("getNews", () => {
  it("calls apiFetch with correct path", async () => {
    await getNews();
    expect(apiFetch).toHaveBeenCalledWith("/api/news", expect.any(Object));
  });

  it("passes default limit of 4", async () => {
    await getNews();
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/news",
      expect.objectContaining({ params: { limit: 4 } })
    );
  });

  it("passes custom limit", async () => {
    await getNews({ limit: 8 });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/news",
      expect.objectContaining({ params: { limit: 8 } })
    );
  });

  it("passes signal when provided", async () => {
    const controller = new AbortController();
    await getNews({ signal: controller.signal });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/news",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns the resolved value", async () => {
    const data = { articles: [{ headline: "Test" }] };
    apiFetch.mockResolvedValue(data);
    const result = await getNews();
    expect(result).toEqual(data);
  });
});
