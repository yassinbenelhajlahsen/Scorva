// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../helpers/testUtils.jsx";

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));

const TopPerformancesCard = (await import("../../components/cards/TopPerformancesCard.jsx")).default;
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

describe("TopPerformancesCard", () => {
  test("renders Best Games tab by default with hero #1 and rest list", () => {
    useTopPerformances.mockImplementation((_, { type }) => ({
      isLoading: false,
      data: type === "games" ? games : cumulative,
    }));
    renderWithProviders(<TopPerformancesCard league="nba" />);
    expect(screen.getByText("Top Performances")).toBeInTheDocument();
    expect(screen.getByText("Luka Dončić")).toBeInTheDocument();
    expect(screen.getByText("8.6")).toBeInTheDocument();
    // raw is hidden on Best Games
    expect(screen.queryByText("47.3")).not.toBeInTheDocument();
  });

  test("switching to Last 7 Days tab shows cumulative totals (raw)", () => {
    useTopPerformances.mockImplementation((_, { type }) => ({
      isLoading: false,
      data: type === "games" ? games : cumulative,
    }));
    renderWithProviders(<TopPerformancesCard league="nba" />);
    fireEvent.click(screen.getByRole("button", { name: /last 7 days/i }));
    expect(screen.getByText("Nikola Jokić")).toBeInTheDocument();
    expect(screen.getByText("234.7")).toBeInTheDocument();
    expect(screen.getByText(/5 GP/i)).toBeInTheDocument();
  });

  test("renders skeleton while loading", () => {
    useTopPerformances.mockReturnValue({ isLoading: true });
    renderWithProviders(<TopPerformancesCard league="nba" />);
    expect(screen.getByTestId("top-performances-skeleton")).toBeInTheDocument();
  });
});
