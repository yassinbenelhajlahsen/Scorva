// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/reports.js", () => ({
  getReports: vi.fn(),
}));

import { getReports } from "../../api/reports.js";
import { useReports } from "../../hooks/data/useReports.js";

describe("useReports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns reports for league + type", async () => {
    getReports.mockResolvedValueOnce({
      reports: [{ id: "i1", type: "injury", date: "2026-04-30T18:00:00Z", league: "nba" }],
      total: 1,
      hasMore: false,
    });
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useReports({ league: "nba", type: "injury", limit: 20, offset: 0 }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reports).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
    expect(getReports).toHaveBeenCalledWith({
      league: "nba", type: "injury", limit: 20, offset: 0, signal: expect.any(AbortSignal),
    });
  });

  it("omits league and type from request when not provided (cross-league)", async () => {
    getReports.mockResolvedValueOnce({ reports: [], total: 0, hasMore: false });
    const wrapper = createWrapper();
    renderHook(() => useReports({ limit: 5 }), { wrapper });
    await waitFor(() =>
      expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }))
    );
    const args = getReports.mock.calls[0][0];
    expect(args.league).toBeUndefined();
    expect(args.type).toBeUndefined();
  });

  it("exposes error state", async () => {
    getReports.mockRejectedValueOnce(new Error("boom"));
    const wrapper = createWrapper();
    const { result } = renderHook(() => useReports({ league: "nba" }), { wrapper });
    await waitFor(() => expect(result.current.error).toBe(true));
  });
});
