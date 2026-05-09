// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../helpers/testUtils.jsx";
import RankingsList from "../../components/highlights/tabs/RankingsList.jsx";
import PerformancesList from "../../components/highlights/tabs/PerformancesList.jsx";
import PlaysList from "../../components/highlights/tabs/PlaysList.jsx";

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";

const player = (id, name = "Player " + id) => ({
  id, name, slug: name.toLowerCase().replace(/\s+/g, "-"),
  imageUrl: "/p.png", position: "G",
  team: { id: 1, abbreviation: "GSW", primary_color: "#1D428A" },
});
const game = (id, opp = "LAL") => ({
  id, date: "2026-05-08T00:00:00Z",
  opponent: { id: 2, abbreviation: opp }, isHome: true, result: "W",
});

beforeEach(() => useTopPerformances.mockReset());

describe("RankingsList", () => {
  test("renders top 3 as heroes and rest as compact", () => {
    useTopPerformances.mockReturnValue({
      isLoading: false,
      data: { performances: Array.from({ length: 5 }, (_, i) => ({
        player: player(i + 1), totalRating: 100 - i, gamesPlayed: 5, avgPerGame: 20 - i,
      })) },
    });
    renderWithProviders(<MemoryRouter><RankingsList window="week" sort="desc" position="all" /></MemoryRouter>);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});

describe("PerformancesList", () => {
  test("row links to ?tab=analysis#slug", () => {
    useTopPerformances.mockReturnValue({
      isLoading: false,
      data: { performances: [{
        player: player(1, "Curry"),
        game: game(100),
        ratingGrade: 9.5,
        stats: { points: 40, rebounds: 5, assists: 7 },
      }] },
    });
    renderWithProviders(<MemoryRouter><PerformancesList window="week" sort="desc" position="all" /></MemoryRouter>);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toMatch(/\/games\/100\?tab=analysis#curry$/);
  });
});

describe("PlaysList", () => {
  test("row links to ?tab=plays#play-<id>", () => {
    useTopPerformances.mockReturnValue({
      isLoading: false,
      data: { performances: [{
        player: player(1),
        game: game(100),
        play: { id: 9001, description: "Curry 3PT", period: 4, clock: "0:32", weightedValue: 4.8 },
      }] },
    });
    renderWithProviders(<MemoryRouter><PlaysList window="week" sort="desc" position="all" /></MemoryRouter>);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toMatch(/\/games\/100\?tab=plays#play-9001$/);
  });
});
