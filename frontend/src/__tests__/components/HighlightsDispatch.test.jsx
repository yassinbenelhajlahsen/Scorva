// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PerformancesList from "../../components/highlights/tabs/PerformancesList.jsx";
import RankingsList from "../../components/highlights/tabs/RankingsList.jsx";

vi.mock("../../hooks/data/useTopPerformances.js", () => ({
  useTopPerformances: vi.fn(),
}));
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";

const wrap = (ui) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
};

const teamItem = (rank) => ({
  team: { id: rank, name: `Team ${rank}`, abbr: "AAA", logo: null, primary_color: null },
  game: { id: rank * 10, date: "2026-05-09", opponent: { id: 99, abbreviation: "BBB", logo: null }, isHome: true, isLive: false, homeScore: 100, awayScore: 95, result: "W" },
  rating: 18.4, ratingGrade: 9.2,
});

const gameItem = (rank) => ({
  game: {
    id: rank, date: "2026-05-09",
    homeTeam: { id: 1, name: "Lakers", abbr: "LAL", logo: null, primary_color: null },
    awayTeam: { id: 2, name: "Celtics", abbr: "BOS", logo: null, primary_color: null },
    homeScore: 118, awayScore: 115, isLive: false,
  },
  homeTeamRating: 18.4, awayTeamRating: 16.2,
  rating: 34.6, ratingGrade: 8.4, tierLabel: "Elite",
});

describe("PerformancesList — entity dispatch", () => {
  test("entity=team renders team row", () => {
    useTopPerformances.mockReturnValue({ data: { performances: [teamItem(1), teamItem(2)] }, isLoading: false });
    wrap(<PerformancesList league="nba" window="week" sort="desc" entity="team" />);
    expect(screen.getByText("Team 1")).toBeInTheDocument();
  });

  test("entity=game renders matchup row", () => {
    useTopPerformances.mockReturnValue({ data: { performances: [gameItem(1)] }, isLoading: false });
    wrap(<PerformancesList league="nba" window="week" sort="desc" entity="game" />);
    expect(screen.getByText(/Elite/)).toBeInTheDocument();
  });
});

describe("RankingsList — entity dispatch", () => {
  test("entity=team renders team row with totalRating", () => {
    useTopPerformances.mockReturnValue({
      data: {
        performances: [{
          team: { id: 1, name: "Lakers", abbr: "LAL", logo: null, primary_color: null },
          totalRating: 152.3, gamesPlayed: 8, avgPerGame: 19.0,
          bestGame: { gameId: 7, rating: 26.4, opponentAbbreviation: "BOS" },
        }],
      },
      isLoading: false,
    });
    wrap(<RankingsList league="nba" window="week" sort="desc" entity="team" />);
    expect(screen.getByText("Lakers")).toBeInTheDocument();
    expect(screen.getByText(/152\.3/)).toBeInTheDocument();
  });
});
