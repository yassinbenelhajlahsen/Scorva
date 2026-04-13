// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/news.js", () => ({ getNews: vi.fn() }));

const { getNews } = await import("../../api/news.js");
const { useNews } = await import("../../hooks/data/useNews.js");

beforeEach(() => {
  vi.clearAllMocks();
  getNews.mockResolvedValue({ articles: [] });
});

describe("useNews", () => {
  it("returns loading true initially", () => {
    const { result } = renderHook(() => useNews(), { wrapper: createWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it("returns articles after loading", async () => {
    const articles = [{ headline: "Test", league: "nba" }];
    getNews.mockResolvedValue({ articles });

    const { result } = renderHook(() => useNews(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toEqual(articles);
    expect(result.current.error).toBe(false);
  });

  it("returns empty articles when data is undefined", async () => {
    getNews.mockResolvedValue({});

    const { result } = renderHook(() => useNews(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.articles).toEqual([]);
  });

  it("returns error true on failure", async () => {
    getNews.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useNews(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBe(true), {
      timeout: 5000,
    });
  });

  it("passes signal to getNews", async () => {
    const { result } = renderHook(() => useNews(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getNews).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
