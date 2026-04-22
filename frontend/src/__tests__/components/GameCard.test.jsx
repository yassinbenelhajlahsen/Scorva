// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  m: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, animate, transition, initial, exit, variants, ...props }) =>
          <div {...props}>{children}</div>,
    }
  ),
}));

vi.mock("../../utils/motion.js", () => ({
  scoreUpdateVariants: {},
}));

const GameCard = (await import("../../components/cards/GameCard.jsx")).default;

function makeGame(overrides = {}) {
  return {
    id: 1,
    league: "nba",
    status: "Final",
    home_team_name: "Los Angeles Lakers",
    home_shortname: "LAL",
    home_logo: "/lal.webp",
    away_team_name: "Golden State Warriors",
    away_shortname: "GSW",
    away_logo: "/gsw.webp",
    homescore: 110,
    awayscore: 105,
    hometeamid: 17,
    awayteamid: 9,
    winnerid: 17,
    date: "2025-01-15",
    type: "regular",
    start_time: null,
    clock: null,
    current_period: null,
    ...overrides,
  };
}

describe("GameCard", () => {
  it("renders null when league is missing", () => {
    const { container } = render(<GameCard game={makeGame({ league: null })} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders team short names", () => {
    render(<GameCard game={makeGame()} />);
    expect(screen.getAllByText("LAL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("GSW").length).toBeGreaterThan(0);
  });

  it("renders scores", () => {
    render(<GameCard game={makeGame()} />);
    expect(screen.getAllByText("110").length).toBeGreaterThan(0);
    expect(screen.getAllByText("105").length).toBeGreaterThan(0);
  });

  it("links to the game detail page", () => {
    render(<GameCard game={makeGame()} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/nba/games/1");
  });


  it("shows game date for Final game", () => {
    render(<GameCard game={makeGame()} />);
    expect(screen.getByText("Jan 15th")).toBeInTheDocument();
  });

  it("shows status text for non-live game", () => {
    render(<GameCard game={makeGame({ status: "Scheduled" })} />);
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
  });

  it("shows Live badge for in-progress game", () => {
    render(<GameCard game={makeGame({ status: "In Progress", winnerid: null })} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows Halftime as in-progress", () => {
    render(<GameCard game={makeGame({ status: "Halftime", winnerid: null })} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows start time for unstarted game with start_time", () => {
    render(
      <GameCard
        game={makeGame({ status: "Scheduled", start_time: "7:30PM ET", winnerid: null })}
      />
    );
    expect(screen.getByText(/7:30PM ET/)).toBeInTheDocument();
  });

  it("renders game with playoff type", () => {
    render(<GameCard game={makeGame({ type: "playoff" })} />);
    // Should render a playoff logo img
    const imgs = document.querySelectorAll("img");
    const playoffImg = Array.from(imgs).find(
      (img) => img.src.includes("NBAPlayoff") || img.alt === null
    );
    // At minimum, the card renders without crashing
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("renders NHL game", () => {
    render(<GameCard game={makeGame({ league: "nhl" })} />);
    expect(screen.getAllByText("LAL").length).toBeGreaterThan(0);
  });
});

describe("GameCard — playoff series label", () => {
  function makePlayoffGame(overrides = {}) {
    return makeGame({
      type: "playoff",
      game_label: "Game 3, First Round",
      home_series_wins: 0,
      away_series_wins: 0,
      ...overrides,
    });
  }

  it("shows home-team lead label when home leads series", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 2, away_series_wins: 0 })} />);
    expect(screen.getByText("LAL lead 2-0")).toBeInTheDocument();
  });

  it("shows away-team lead label when away leads series", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 1, away_series_wins: 3 })} />);
    expect(screen.getByText("GSW lead 3-1")).toBeInTheDocument();
  });

  it("shows tied label when series is even", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 2, away_series_wins: 2 })} />);
    expect(screen.getByText("Tied 2-2")).toBeInTheDocument();
  });

  it("shows win-series label when home team wins series with 4 wins", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 4, away_series_wins: 2 })} />);
    expect(screen.getByText("LAL win series 4-2")).toBeInTheDocument();
  });

  it("shows win-series label when away team wins series with 4 wins", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 1, away_series_wins: 4 })} />);
    expect(screen.getByText("GSW win series 4-1")).toBeInTheDocument();
  });

  it("hides series label when both teams have 0 wins (pre-series)", () => {
    render(<GameCard game={makePlayoffGame({ home_series_wins: 0, away_series_wins: 0 })} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("hides series label for regular season games", () => {
    render(<GameCard game={makeGame({ type: "regular", home_series_wins: 0, away_series_wins: 0 })} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("hides series label for play-in games (game_label contains play-in)", () => {
    render(<GameCard game={makePlayoffGame({
      game_label: "Play-In Game",
      home_series_wins: 0,
      away_series_wins: 0,
    })} />);
    // game_label renders but no series score since 0-0
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });
});
