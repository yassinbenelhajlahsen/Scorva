import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../api/search.js", () => ({ search: vi.fn() }));

const { search } = await import("../../api/search.js");
const { useSearch } = await import("../../hooks/useSearch.js");

const mockResults = [
  { type: "player", id: 1, name: "LeBron James" },
  { type: "team",   id: 2, name: "Lakers" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSearch — empty / whitespace query", () => {
  it("returns empty results and false loading for empty string", () => {
    const { result } = renderHook(() => useSearch(""));
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(search).not.toHaveBeenCalled();
  });

  it("returns empty results for whitespace-only query", () => {
    const { result } = renderHook(() => useSearch("   "));
    expect(result.current.results).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});

describe("useSearch — debouncing", () => {
  it("does not call search before debounce delay elapses", () => {
    search.mockResolvedValue(mockResults);
    renderHook(() => useSearch("lebron"));
    expect(search).not.toHaveBeenCalled();
  });

  it("calls search after debounce delay", async () => {
    search.mockResolvedValue(mockResults);
    renderHook(() => useSearch("lebron"));

    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("lebron", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("respects custom debounce delay", async () => {
    search.mockResolvedValue(mockResults);
    renderHook(() => useSearch("lebron", 500));

    await act(() => vi.advanceTimersByTimeAsync(499));
    expect(search).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("cancels pending timer when query changes before delay", async () => {
    search.mockResolvedValue(mockResults);
    const { rerender } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "leb" },
    });

    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ q: "lebron" });
    await act(() => vi.advanceTimersByTimeAsync(100));

    // Still within debounce of second query — should not have fired yet
    expect(search).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("lebron", expect.any(Object));
  });
});

describe("useSearch — successful fetch", () => {
  it("sets results after debounce + fetch", async () => {
    search.mockResolvedValue(mockResults);
    const { result } = renderHook(() => useSearch("lebron"));

    // Advance fake timer to fire debounce, then drain resolved promise microtasks
    await act(() => vi.advanceTimersByTimeAsync(200));
    await act(async () => {});

    expect(result.current.results).toEqual(mockResults);
    expect(result.current.loading).toBe(false);
  });
});

describe("useSearch — error handling", () => {
  it("sets results to empty and clears loading on non-abort error", async () => {
    search.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useSearch("lebron"));

    await act(() => vi.advanceTimersByTimeAsync(200));
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it("does not wipe results on AbortError", async () => {
    // First query succeeds
    search.mockResolvedValue(mockResults);
    const { result, rerender } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "lebron" },
    });
    await act(() => vi.advanceTimersByTimeAsync(200));
    await act(async () => {});
    expect(result.current.results).toEqual(mockResults);

    // Second query aborts — results should stay, loading should clear
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    search.mockRejectedValue(abortErr);

    rerender({ q: "lakers" });
    await act(() => vi.advanceTimersByTimeAsync(200));
    await act(async () => {});

    expect(result.current.loading).toBe(false);
  });
});

describe("useSearch — query cleared after results", () => {
  it("clears results when query becomes empty", async () => {
    search.mockResolvedValue(mockResults);
    const { result, rerender } = renderHook(({ q }) => useSearch(q), {
      initialProps: { q: "lebron" },
    });

    await act(() => vi.advanceTimersByTimeAsync(200));
    await act(async () => {});
    expect(result.current.results).toEqual(mockResults);

    rerender({ q: "" });
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
