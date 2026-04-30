// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../helpers/testUtils.jsx";

vi.mock("../../api/reports.js", () => ({
  getReports: vi.fn(),
}));

import { getReports } from "../../api/reports.js";
import ReportsTab from "../../components/reports/ReportsTab.jsx";

const player = { id: 1, name: "P", slug: "p", imageUrl: null, league: "nba" };

function makeReport(type, idx, date = "2026-04-30T00:00:00Z") {
  if (type === "injury") return { id: `i${idx}`, type, date, league: "nba", player, prevStatus: null, newStatus: "out" };
  if (type === "move") return { id: `m${idx}`, type, date, league: "nba", player, action: "sign", fromTeam: null, toTeam: { id: 1, abbreviation: "BKN", name: "Nets", logoUrl: "x" } };
  if (type === "birthday") return { id: `b${idx}`, type, date, league: "nba", player, age: 25 };
  return { id: `s${idx}`, type, date, league: "nba", player, streakLength: 5, statLabel: "double-double", emoji: "🔥" };
}

describe("ReportsTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders type filter pills and the list", async () => {
    getReports.mockResolvedValueOnce({
      reports: [makeReport("injury", 1), makeReport("move", 1)],
      total: 2, hasMore: false,
    });
    renderWithProviders(<MemoryRouter><ReportsTab league="nba" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("P").length).toBeGreaterThan(0));

    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Injuries" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moves" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Birthdays" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Streaks" })).toBeInTheDocument();
  });

  it("clicking a type pill refetches with that ?type", async () => {
    getReports
      .mockResolvedValueOnce({ reports: [makeReport("injury", 1)], total: 1, hasMore: false })
      .mockResolvedValueOnce({ reports: [makeReport("move", 1)], total: 1, hasMore: false });
    renderWithProviders(<MemoryRouter><ReportsTab league="nba" /></MemoryRouter>);
    await waitFor(() => expect(getReports).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Moves" }));
    await waitFor(() =>
      expect(getReports).toHaveBeenCalledWith(expect.objectContaining({ league: "nba", type: "move" }))
    );
  });

  it("Load More appends and disappears when hasMore=false", async () => {
    // Each report renders the player name twice (link + avatar initials), so
    // 20 reports → 40 occurrences of "P"; after Load More (10 more) → 60.
    getReports
      .mockResolvedValueOnce({
        reports: Array.from({ length: 20 }, (_, i) => makeReport("injury", i)),
        total: 30, hasMore: true,
      })
      .mockResolvedValueOnce({
        reports: Array.from({ length: 10 }, (_, i) => makeReport("move", i + 100)),
        total: 30, hasMore: false,
      });
    renderWithProviders(<MemoryRouter><ReportsTab league="nba" /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("P").length).toBe(40));

    fireEvent.click(screen.getByRole("button", { name: /Load More/i }));
    await waitFor(() => expect(screen.getAllByText("P").length).toBe(60));
    expect(screen.queryByRole("button", { name: /Load More/i })).not.toBeInTheDocument();
  });
});
