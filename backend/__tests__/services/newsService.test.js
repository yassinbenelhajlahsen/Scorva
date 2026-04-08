import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockAxiosGet = jest.fn();
jest.unstable_mockModule("axios", () => ({
  default: { get: mockAxiosGet },
}));

const mockCached = jest.fn().mockImplementation(async (_k, _t, fn, _o) => fn());
jest.unstable_mockModule(resolve(__dirname, "../../src/cache/cache.js"), () => ({
  cached: mockCached,
}));

const { getNews } = await import(
  resolve(__dirname, "../../src/services/newsService.js")
);

function espnResponse(articles) {
  return { data: { articles } };
}

function espnArticle(headline, overrides = {}) {
  return {
    headline,
    description: "desc",
    links: { web: { href: "https://espn.com/article" } },
    images: [{ url: "https://espn.com/image.jpg" }],
    published: "2026-04-08T12:00:00Z",
    ...overrides,
  };
}

describe("newsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockImplementation(async (_k, _t, fn, _o) => fn());
  });

  it("fetches news from all three leagues in parallel", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(espnResponse([espnArticle("NBA News")]))
      .mockResolvedValueOnce(espnResponse([espnArticle("NFL News")]))
      .mockResolvedValueOnce(espnResponse([espnArticle("NHL News")]));

    const articles = await getNews();

    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining("basketball/nba/news")
    );
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining("football/nfl/news")
    );
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining("hockey/nhl/news")
    );
    expect(articles).toHaveLength(3);
  });

  it("maps ESPN article shape to internal shape", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        espnResponse([
          {
            headline: "Test",
            description: "A description",
            links: { web: { href: "https://espn.com/test" } },
            images: [{ url: "https://img.com/1.jpg" }],
            published: "2026-04-08T10:00:00Z",
          },
        ])
      )
      .mockResolvedValueOnce(espnResponse([]))
      .mockResolvedValueOnce(espnResponse([]));

    const [article] = await getNews();

    expect(article).toEqual({
      headline: "Test",
      description: "A description",
      url: "https://espn.com/test",
      imageUrl: "https://img.com/1.jpg",
      published: "2026-04-08T10:00:00Z",
      league: "nba",
    });
  });

  it("handles missing optional fields gracefully", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        espnResponse([{ headline: "Minimal" }])
      )
      .mockResolvedValueOnce(espnResponse([]))
      .mockResolvedValueOnce(espnResponse([]));

    const [article] = await getNews();

    expect(article.description).toBe("");
    expect(article.url).toBeNull();
    expect(article.imageUrl).toBeNull();
    expect(article.published).toBeNull();
  });

  it("filters roundup articles", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        espnResponse([
          espnArticle("Player Trade News"),
          espnArticle("NBA Buzz Report"),
          espnArticle("Fantasy Picks for Week 5"),
          espnArticle("Mock Draft 2026"),
          espnArticle("Betting Lines Today"),
          espnArticle("Real Article"),
        ])
      )
      .mockResolvedValueOnce(espnResponse([]))
      .mockResolvedValueOnce(espnResponse([]));

    const articles = await getNews();
    const headlines = articles.map((a) => a.headline);

    expect(headlines).toContain("Player Trade News");
    expect(headlines).toContain("Real Article");
    expect(headlines).not.toContain("NBA Buzz Report");
    expect(headlines).not.toContain("Fantasy Picks for Week 5");
    expect(headlines).not.toContain("Mock Draft 2026");
    expect(headlines).not.toContain("Betting Lines Today");
  });

  it("sorts articles by published date descending", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        espnResponse([espnArticle("Old", { published: "2026-04-01T00:00:00Z" })])
      )
      .mockResolvedValueOnce(
        espnResponse([espnArticle("New", { published: "2026-04-08T00:00:00Z" })])
      )
      .mockResolvedValueOnce(
        espnResponse([espnArticle("Mid", { published: "2026-04-05T00:00:00Z" })])
      );

    const articles = await getNews();

    expect(articles[0].headline).toBe("New");
    expect(articles[1].headline).toBe("Mid");
    expect(articles[2].headline).toBe("Old");
  });

  it("guarantees at least one article per league in top results", async () => {
    const nbaArticles = Array.from({ length: 8 }, (_, i) =>
      espnArticle(`NBA ${i}`, { published: `2026-04-08T${String(10 + i).padStart(2, "0")}:00:00Z` })
    );
    mockAxiosGet
      .mockResolvedValueOnce(espnResponse(nbaArticles))
      .mockResolvedValueOnce(
        espnResponse([espnArticle("NFL Only", { published: "2026-04-01T00:00:00Z" })])
      )
      .mockResolvedValueOnce(
        espnResponse([espnArticle("NHL Only", { published: "2026-04-01T00:00:00Z" })])
      );

    const articles = await getNews();
    const leagues = articles.map((a) => a.league);

    expect(leagues).toContain("nba");
    expect(leagues).toContain("nfl");
    expect(leagues).toContain("nhl");
  });

  it("caps results at 10 articles", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      espnArticle(`Article ${i}`, { published: `2026-04-08T${String(i).padStart(2, "0")}:00:00Z` })
    );
    mockAxiosGet
      .mockResolvedValueOnce(espnResponse(many))
      .mockResolvedValueOnce(espnResponse(many))
      .mockResolvedValueOnce(espnResponse(many));

    const articles = await getNews();

    expect(articles.length).toBeLessThanOrEqual(10);
  });

  it("handles one league failing gracefully", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(espnResponse([espnArticle("NBA News")]))
      .mockRejectedValueOnce(new Error("NFL API down"))
      .mockResolvedValueOnce(espnResponse([espnArticle("NHL News")]));

    const articles = await getNews();
    const leagues = articles.map((a) => a.league);

    expect(leagues).toContain("nba");
    expect(leagues).toContain("nhl");
    expect(leagues).not.toContain("nfl");
  });

  it("returns empty array when all leagues fail", async () => {
    mockAxiosGet
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"));

    const articles = await getNews();

    expect(articles).toEqual([]);
  });

  it("calls cached with correct key, TTL, and cacheIf", async () => {
    mockAxiosGet.mockResolvedValue(espnResponse([]));

    await getNews();

    expect(mockCached).toHaveBeenCalledWith(
      "news:headlines",
      300,
      expect.any(Function),
      { cacheIf: expect.any(Function) }
    );

    const [, , , opts] = mockCached.mock.calls[0];
    expect(opts.cacheIf([])).toBeFalsy();
    expect(opts.cacheIf([{ headline: "test" }])).toBeTruthy();
  });
});
