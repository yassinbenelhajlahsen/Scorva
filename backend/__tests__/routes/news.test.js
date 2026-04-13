import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockGetNews = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/meta/newsService.js"),
  () => ({ getNews: mockGetNews })
);

const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: newsRouter } = await import(
  resolve(__dirname, "../../src/routes/meta/news.js")
);

const sampleArticles = [
  { headline: "A1", description: "", url: null, imageUrl: null, published: "2026-04-08T12:00:00Z", league: "nba" },
  { headline: "A2", description: "", url: null, imageUrl: null, published: "2026-04-08T11:00:00Z", league: "nfl" },
  { headline: "A3", description: "", url: null, imageUrl: null, published: "2026-04-08T10:00:00Z", league: "nhl" },
  { headline: "A4", description: "", url: null, imageUrl: null, published: "2026-04-08T09:00:00Z", league: "nba" },
  { headline: "A5", description: "", url: null, imageUrl: null, published: "2026-04-08T08:00:00Z", league: "nfl" },
];

describe("News Route - GET /api/news", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", newsRouter);
    jest.clearAllMocks();
    mockGetNews.mockResolvedValue(sampleArticles);
  });

  it("returns 200 with articles", async () => {
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(4);
  });

  it("defaults limit to 4", async () => {
    const res = await request(app).get("/api/news");
    expect(res.body.articles).toHaveLength(4);
  });

  it("respects custom limit", async () => {
    const res = await request(app).get("/api/news?limit=2");
    expect(res.body.articles).toHaveLength(2);
  });

  it("caps limit at 10", async () => {
    const res = await request(app).get("/api/news?limit=99");
    expect(res.body.articles).toHaveLength(5);
  });

  it("treats limit=0 as default (falsy parseInt result)", async () => {
    const res = await request(app).get("/api/news?limit=0");
    expect(res.body.articles).toHaveLength(4);
  });

  it("floors negative limit to 1", async () => {
    const res = await request(app).get("/api/news?limit=-5");
    expect(res.body.articles).toHaveLength(1);
  });

  it("uses default limit for non-numeric input", async () => {
    const res = await request(app).get("/api/news?limit=abc");
    expect(res.body.articles).toHaveLength(4);
  });

  it("returns 500 on service error", async () => {
    mockGetNews.mockRejectedValue(new Error("Service failure"));

    const res = await request(app).get("/api/news");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Failed to fetch news." });
  });
});
