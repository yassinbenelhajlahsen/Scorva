import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const loggerPath = resolve(__dirname, "../../src/logger.js");
jest.unstable_mockModule(loggerPath, () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const servicePath = resolve(__dirname, "../../src/services/chat/tools/webSearch.js");
const { webSearch } = await import(servicePath);

const mockFetch = jest.fn();

describe("webSearchService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = mockFetch;
    process.env.TAVILY_SECRET_KEY = "test-tavily-key";
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    delete process.env.TAVILY_SECRET_KEY;
    delete process.env.TAVILY_API_KEY;
  });

  it("returns structured results on successful search", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        answer: "LeBron is averaging 28 points.",
        results: [
          {
            title: "LeBron stats",
            url: "https://example.com/lebron",
            content: "LeBron James is having a great season.",
            published_date: "2025-01-10",
          },
        ],
      }),
    });

    const result = await webSearch("LeBron James stats");

    expect(result).toMatchObject({
      _dataSource: "external-web",
      answer: "LeBron is averaging 28 points.",
      results: [
        {
          title: "LeBron stats",
          url: "https://example.com/lebron",
          snippet: "LeBron James is having a great season.",
          publishedDate: "2025-01-10",
        },
      ],
    });
  });

  it("maps published_date to publishedDate", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ title: "T", url: "u", content: "c", published_date: "2025-03-01" }],
      }),
    });

    const result = await webSearch("test");

    expect(result.results[0].publishedDate).toBe("2025-03-01");
  });

  it("truncates snippet to 400 characters", async () => {
    const longContent = "x".repeat(600);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ title: "T", url: "u", content: longContent, published_date: null }],
      }),
    });

    const result = await webSearch("test");

    expect(result.results[0].snippet).toHaveLength(400);
  });

  it("returns error when no API key is configured", async () => {
    delete process.env.TAVILY_SECRET_KEY;
    delete process.env.TAVILY_API_KEY;

    const result = await webSearch("test");

    expect(result).toEqual({ error: "Web search not configured" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("falls back to TAVILY_API_KEY when TAVILY_SECRET_KEY is not set", async () => {
    delete process.env.TAVILY_SECRET_KEY;
    process.env.TAVILY_API_KEY = "fallback-key";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await webSearch("test");

    expect(result).not.toHaveProperty("error");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.api_key).toBe("fallback-key");
  });

  it("returns error on non-OK HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const result = await webSearch("test");

    expect(result).toEqual({ error: "Web search temporarily unavailable" });
  });

  it("returns error on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Network error"));

    const result = await webSearch("test");

    expect(result).toEqual({ error: "Web search temporarily unavailable" });
  });

  it("sends correct request body to Tavily", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await webSearch("NBA injury report");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      api_key: "test-tavily-key",
      query: "NBA injury report",
      search_depth: "advanced",
      max_results: 5,
      include_answer: true,
      topic: "news",
    });
  });

  it("handles null/missing answer from Tavily", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await webSearch("test");

    expect(result.answer).toBeNull();
  });

  it("handles missing content in results gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ title: "T", url: "u" }],
      }),
    });

    const result = await webSearch("test");

    expect(result.results[0].snippet).toBe("");
  });

  it("handles null publishedDate gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ title: "T", url: "u", content: "c" }],
      }),
    });

    const result = await webSearch("test");

    expect(result.results[0].publishedDate).toBeNull();
  });
});
