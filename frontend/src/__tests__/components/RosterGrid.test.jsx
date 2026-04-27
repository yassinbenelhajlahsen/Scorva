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
  containerVariants: {},
  itemVariants: {},
}));

const RosterGrid = (await import("../../components/team/RosterGrid.jsx")).default;

const lebron = {
  id: 1,
  name: "LeBron James",
  position: "F",
  jerseynum: 23,
  image_url: "https://example.com/lebron.jpg",
  status: null,
  status_description: null,
  espn_playerid: 1966,
  averages: { points: 24.3, rebounds: 7.5, assists: 8.1, fgPct: 51.2 },
};

const out = {
  id: 2,
  name: "Anthony Davis",
  position: "F-C",
  jerseynum: 3,
  image_url: null,
  status: "out",
  status_description: "left calf strain",
  espn_playerid: 6583,
  averages: { points: 0, rebounds: 0, assists: 0, fgPct: 0 },
};

describe("RosterGrid", () => {
  it("renders one card per player", () => {
    render(<RosterGrid league="nba" season="2025-26" players={[lebron, out]} />);
    expect(screen.getByText("James")).toBeInTheDocument();
    expect(screen.getByText("Davis")).toBeInTheDocument();
  });

  it("links each card to the player page with season query param", () => {
    render(<RosterGrid league="nba" season="2025-26" players={[lebron]} />);
    const link = screen.getByText("James").closest("a");
    expect(link).toHaveAttribute("href", "/nba/players/lebron-james?season=2025-26");
  });

  it("omits the season query param when season is null", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    const link = screen.getByText("James").closest("a");
    expect(link).toHaveAttribute("href", "/nba/players/lebron-james");
  });

  it("renders jersey number and position", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("splits the name into first and last lines", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    expect(screen.getByText("LeBron")).toBeInTheDocument();
    expect(screen.getByText("James")).toBeInTheDocument();
  });

  it("does not render the status badge when status is null", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    expect(screen.queryByText(/Out|Day-to-Day|Questionable/)).not.toBeInTheDocument();
  });

  it("renders the status badge when status is non-available", () => {
    render(<RosterGrid league="nba" season={null} players={[out]} />);
    expect(screen.getByText("Out")).toBeInTheDocument();
  });

  it("hides the status badge when showStatus is false", () => {
    render(<RosterGrid league="nba" season="2022-23" players={[out]} showStatus={false} />);
    expect(screen.queryByText("Out")).not.toBeInTheDocument();
    expect(screen.getByText("Davis")).toBeInTheDocument();
  });

  it("shows an empty-state message when players is empty", () => {
    render(<RosterGrid league="nba" season={null} players={[]} />);
    expect(screen.getByText(/No roster data/i)).toBeInTheDocument();
  });

  it("renders NBA averages with PTS/REB/AST/FG% labels", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    expect(screen.getByText("PTS")).toBeInTheDocument();
    expect(screen.getByText("24.3")).toBeInTheDocument();
    expect(screen.getByText("FG%")).toBeInTheDocument();
    expect(screen.getByText(/51\.2/)).toBeInTheDocument();
  });

  it("renders NFL averages with YDS/TD/INT labels", () => {
    const qb = {
      id: 3,
      name: "Patrick Mahomes",
      position: "QB",
      jerseynum: 15,
      image_url: null,
      status: null,
      espn_playerid: 1,
      averages: { yards: 280.5, td: 2.1, interceptions: 0.7 },
    };
    render(<RosterGrid league="nfl" season={null} players={[qb]} />);
    expect(screen.getByText("YDS")).toBeInTheDocument();
    expect(screen.getByText("280.5")).toBeInTheDocument();
    expect(screen.getByText("TD")).toBeInTheDocument();
    expect(screen.getByText("INT")).toBeInTheDocument();
  });

  it("renders NHL averages with G/A/SV labels", () => {
    const skater = {
      id: 4,
      name: "Connor McDavid",
      position: "C",
      jerseynum: 97,
      image_url: null,
      status: null,
      espn_playerid: 2,
      averages: { goals: 1.2, assists: 1.8, saves: 0 },
    };
    render(<RosterGrid league="nhl" season={null} players={[skater]} />);
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("SV")).toBeInTheDocument();
    expect(screen.getByText("1.2")).toBeInTheDocument();
  });

  it("hides the stats row when all averages are zero or missing", () => {
    const inactive = {
      id: 5,
      name: "Bench Warmer",
      position: "G",
      jerseynum: 99,
      image_url: null,
      status: null,
      espn_playerid: 3,
      averages: { points: 0, rebounds: 0, assists: 0, fgPct: 0 },
    };
    render(<RosterGrid league="nba" season={null} players={[inactive]} />);
    expect(screen.queryByText("PTS")).not.toBeInTheDocument();
    expect(screen.getByText("Warmer")).toBeInTheDocument();
  });
});
