// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
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

  it("renders NBA stats (PTS, REB, AST)", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    expect(screen.getByText("PTS")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("REB")).toBeInTheDocument();
    expect(screen.getByText("AST")).toBeInTheDocument();
  });

  it("renders NFL stats", () => {
    const nflPlayer = {
      name: "Patrick Mahomes",
      position: "QB",
      imageUrl: null,
      stats: { YDS: 320, TD: 3, INT: 0, SCKS: 0 },
    };
    render(<TopPerformerCard player={nflPlayer} title="Top Scorer" league="nfl" />);
    expect(screen.getByText("YDS")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
  });

  it("renders NHL stats", () => {
    const nhlPlayer = {
      name: "Connor McDavid",
      position: "C",
      imageUrl: null,
      stats: { G: 2, A: 1, SAVES: 0, HT: 3, BS: 1 },
    };
    render(<TopPerformerCard player={nhlPlayer} title="Top Performer" league="nhl" />);
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("uses fallback image on error", () => {
    render(<TopPerformerCard player={nbaPlayer} title="Top Performer" league="nba" />);
    const img = screen.getByAltText("LeBron James");
    fireEvent.error(img);
    expect(img.src).toContain("defaultPhoto.webp");
  });
});
