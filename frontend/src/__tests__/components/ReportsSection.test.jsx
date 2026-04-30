// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../helpers/testUtils.jsx";

vi.mock("../../api/reports.js", () => ({
  getReports: vi.fn(),
}));

import { getReports } from "../../api/reports.js";
import ReportsSection from "../../components/reports/ReportsSection.jsx";

describe("ReportsSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 5 reports + 3 league buttons", async () => {
    const player = { id: 1, name: "Test Player", slug: "test-player", imageUrl: null, league: "nba" };
    const reports = Array.from({ length: 5 }, (_, i) => ({
      id: `i${i}`, type: "injury", date: `2026-04-${30 - i}T00:00:00Z`,
      league: "nba", player, prevStatus: null, newStatus: "out",
    }));
    getReports.mockResolvedValueOnce({ reports, total: 5, hasMore: false });

    renderWithProviders(<MemoryRouter><ReportsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("Test Player")).toHaveLength(5));

    expect(screen.getByRole("link", { name: /View NBA Reports/ })).toHaveAttribute("href", "/nba?tab=reports");
    expect(screen.getByRole("link", { name: /View NFL Reports/ })).toHaveAttribute("href", "/nfl?tab=reports");
    expect(screen.getByRole("link", { name: /View NHL Reports/ })).toHaveAttribute("href", "/nhl?tab=reports");
  });

  it("renders nothing when fetch returns empty + not loading", async () => {
    getReports.mockResolvedValueOnce({ reports: [], total: 0, hasMore: false });
    const { container } = renderWithProviders(<MemoryRouter><ReportsSection /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector("h2")).toBeNull());
  });
});
