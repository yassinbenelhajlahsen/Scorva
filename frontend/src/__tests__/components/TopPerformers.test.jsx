// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/testUtils.jsx";

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));

const TopPerformers = (await import("../../components/highlights/TopPerformers.jsx")).default;
const { useTopPerformances } = await import("../../hooks/data/useTopPerformances.js");

const games = {
  type: "games",
  days: 7,
  performances: [
    {
      player: {
        id: 1,
        name: "Luka Dončić",
        slug: "luka-doncic",
        imageUrl: "/luka.png",
        team: { abbreviation: "DAL", primary_color: "#00538C" },
      },
      game: { id: 100, opponent: { abbreviation: "LAL" }, isHome: true, result: "W" },
      rating: 47.3,
      ratingGrade: 8.6,
      stats: { points: 32, rebounds: 12, assists: 9 },
    },
    {
      player: {
        id: 2,
        name: "SGA",
        slug: "sga",
        imageUrl: "/sga.png",
        team: { abbreviation: "OKC", primary_color: "#007AC1" },
      },
      game: { id: 101, opponent: { abbreviation: "DEN" }, isHome: false, result: "W" },
      rating: 44.1,
      ratingGrade: 8.0,
      stats: { points: 38, rebounds: 5, assists: 7 },
    },
  ],
};

const cumulative = {
  type: "cumulative",
  days: 7,
  performances: [
    {
      player: {
        id: 3,
        name: "Nikola Jokić",
        imageUrl: "/jokic.png",
        team: { abbreviation: "DEN", primary_color: "#0E2240" },
      },
      totalRating: 234.7,
      gamesPlayed: 5,
      avgPerGame: 46.9,
      bestGame: { gameId: 200, rating: 54.8, opponentAbbreviation: "MIN" },
    },
  ],
};

describe("TopPerformers", () => {
  test("renders games mode with hero #1 and rest list", () => {
    useTopPerformances.mockReturnValue({ isLoading: false, data: games });
    renderWithProviders(<TopPerformers league="nba" mode="games" />);
    expect(screen.getByText("Luka Dončić")).toBeInTheDocument();
    expect(screen.getByText("8.6")).toBeInTheDocument();
    // raw rating not shown in games mode
    expect(screen.queryByText("47.3")).not.toBeInTheDocument();
  });

  test("renders cumulative mode with totals (raw rating)", () => {
    useTopPerformances.mockReturnValue({ isLoading: false, data: cumulative });
    renderWithProviders(<TopPerformers league="nba" mode="cumulative" />);
    expect(screen.getByText("Nikola Jokić")).toBeInTheDocument();
    expect(screen.getByText("234.7")).toBeInTheDocument();
    expect(screen.getByText(/5 GP/i)).toBeInTheDocument();
  });

  test("renders skeleton while loading", () => {
    useTopPerformances.mockReturnValue({ isLoading: true });
    renderWithProviders(<TopPerformers league="nba" />);
    expect(screen.getByTestId("top-performers-skeleton")).toBeInTheDocument();
  });
});
