// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../hooks/data/useGlobalSlate.js", () => ({ useGlobalSlate: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

const { useGlobalSlate } = await import("../../hooks/data/useGlobalSlate.js");
const GlobalSlate = (await import("../../components/layout/GlobalSlate.jsx")).default;

function renderAt(path, props = { leagueFilter: null }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GlobalSlate {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GlobalSlate", () => {
  it("renders nothing when games is empty and not loading", () => {
    useGlobalSlate.mockReturnValue({ games: [], loading: false, error: false });
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when error and games empty", () => {
    useGlobalSlate.mockReturnValue({ games: [], loading: false, error: true });
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });

  it("renders skeleton while loading", () => {
    useGlobalSlate.mockReturnValue({ games: [], loading: true, error: false });
    renderAt("/");
    expect(screen.getByTestId("global-slate-skeleton")).toBeInTheDocument();
  });

  it("renders pills for each game", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 1,
          league: "nba",
          status: "Final",
          start_time: "7PM ET",
          home_shortname: "Lakers",
          away_shortname: "Celtics",
          home_logo: null,
          away_logo: null,
          homescore: 102,
          awayscore: 99,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: 1,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/");
    expect(screen.getByText("Lakers")).toBeInTheDocument();
    expect(screen.getByText("Celtics")).toBeInTheDocument();
    expect(screen.getByText("FINAL")).toBeInTheDocument();
  });

  it("shows league tag in multi-league mode (leagueFilter=null)", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 1,
          league: "nba",
          status: "In Progress",
          home_shortname: "Lakers",
          away_shortname: "Celtics",
          home_logo: null,
          away_logo: null,
          homescore: 50,
          awayscore: 48,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: null,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/", { leagueFilter: null });
    expect(screen.getByText("NBA")).toBeInTheDocument();
  });

  it("hides league tag when leagueFilter is set", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 1,
          league: "nba",
          status: "In Progress",
          home_shortname: "Lakers",
          away_shortname: "Celtics",
          home_logo: null,
          away_logo: null,
          homescore: 50,
          awayscore: 48,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: null,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/nba", { leagueFilter: "nba" });
    expect(screen.queryByText("NBA")).not.toBeInTheDocument();
  });

  it("hides on /about", () => {
    useGlobalSlate.mockReturnValue({
      games: [{ id: 1, league: "nba", status: "Final", home_shortname: "X", away_shortname: "Y" }],
      loading: false,
      error: false,
    });
    const { container } = renderAt("/about");
    expect(container.firstChild).toBeNull();
  });

  it("hides on /privacy", () => {
    useGlobalSlate.mockReturnValue({
      games: [{ id: 1, league: "nba", status: "Final", home_shortname: "X", away_shortname: "Y" }],
      loading: false,
      error: false,
    });
    const { container } = renderAt("/privacy");
    expect(container.firstChild).toBeNull();
  });

  it("links each pill to /{league}/games/{id}", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 42,
          league: "nfl",
          status: "Scheduled",
          start_time: "1PM ET",
          home_shortname: "Bills",
          away_shortname: "Chiefs",
          home_logo: null,
          away_logo: null,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: null,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/");
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/nfl/games/42");
  });
});
