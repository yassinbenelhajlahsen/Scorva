// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("../../hooks/data/useDuplicatePlayerSlugs.js", () => ({
  useDuplicatePlayerSlugs: () => ({}),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock("../../utils/slugify.js", () => ({
  default: (s) => s.toLowerCase().replace(/\s+/g, "-"),
}));

const TopPerformerCard = (await import("../../components/cards/TopPerformerCard.jsx")).default;

const nbaPlayer = {
  name: "LeBron James",
  position: "F",
  imageUrl: "/lebron.webp",
  stats: { PTS: 30, REB: 8, AST: 10, STL: 2, BLK: 1 },
};

describe("TopPerformerCard", () => {
  it("renders null when player is null", () => {
    const { container } = render(
      <TopPerformerCard player={null} title="Top Performer" league="nba" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders player name", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    expect(screen.getByText("LeBron James")).toBeInTheDocument();
  });

  it("renders player position", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("renders title label", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    expect(screen.getByText("Top Performer")).toBeInTheDocument();
  });

  it("renders different title for Impact Player", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Impact Player" league="nba" />);
    expect(screen.getByText("Impact Player")).toBeInTheDocument();
  });

  it("links to player page with slugified name", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/nba/players/lebron-james");
  });

  it("renders NBA Top Performer as PRA (PTS+REB+AST)", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    expect(screen.getByText("PRA")).toBeInTheDocument();
    expect(screen.getByText("48")).toBeInTheDocument();
  });

  it("renders NBA Top Scorer as PTS", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Scorer" league="nba" />);
    expect(screen.getByText("PTS")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders NBA Impact Player as +/-", () => {
    const player = { ...nbaPlayer, stats: { ...nbaPlayer.stats, "+/-": "+12" } };
    render(<TopPerformerCard player={player} title="Impact Player" league="nba" />);
    expect(screen.getByText("+/-")).toBeInTheDocument();
    expect(screen.getByText("+12")).toBeInTheDocument();
  });

  it("renders NFL Top Performer as TD and YDS", () => {
    const nflPlayer = {
      name: "Patrick Mahomes",
      position: "QB",
      imageUrl: null,
      stats: { YDS: 320, TD: 3, INT: 0, SCKS: 0 },
    };
    render(<TopPerformerCard player={nflPlayer} title="Top Performer" league="nfl" />);
    expect(screen.getByText("TD")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("YDS")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
  });

  it("renders NFL Impact Player as SCK and INT", () => {
    const nflPlayer = {
      name: "Micah Parsons",
      position: "DE",
      imageUrl: null,
      stats: { YDS: 0, TD: 0, INT: 1, SCKS: 2 },
    };
    render(<TopPerformerCard player={nflPlayer} title="Impact Player" league="nfl" />);
    expect(screen.getByText("SCK")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("INT")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders NHL Top Performer as PTS (G+A)", () => {
    const nhlPlayer = {
      name: "Connor McDavid",
      position: "C",
      imageUrl: null,
      stats: { G: 2, A: 1, SAVES: 0, HT: 3, BS: 1 },
    };
    render(<TopPerformerCard player={nhlPlayer} title="Top Performer" league="nhl" />);
    expect(screen.getByText("PTS")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders NHL Top Scorer as G", () => {
    const nhlPlayer = {
      name: "Connor McDavid",
      position: "C",
      imageUrl: null,
      stats: { G: 2, A: 1 },
    };
    render(<TopPerformerCard player={nhlPlayer} title="Top Scorer" league="nhl" />);
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("uses fallback image on error", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    const img = screen.getByAltText("LeBron James");
    fireEvent.error(img);
    expect(img.src).toContain("defaultPhoto.webp");
  });

  it("renders rating column on the right when ratingGrade is provided", () => {
    render(
      <TopPerformerCard
        player={{
          id: 1,
          name: "SGA",
          position: "G",
          imageUrl: "/sga.png",
          stats: { PTS: 38, REB: 5, AST: 7 },
          ratingGrade: 8.0,
        }}
        league="nba"
      />
    );
    expect(screen.getByText("8.0")).toBeInTheDocument();
    const labels = screen.getAllByText(/^Rating$/i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("does NOT render rating column when ratingGrade is missing", () => {
    render(
      <TopPerformerCard
        player={{ id: 1, name: "SGA", position: "G", stats: { PTS: 38 } }}
        league="nba"
      />
    );
    expect(screen.queryByText(/^Rating$/i)).not.toBeInTheDocument();
  });
});
