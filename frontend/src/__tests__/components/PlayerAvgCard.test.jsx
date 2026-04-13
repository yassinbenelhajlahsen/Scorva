// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

const PlayerAvgCard = (await import("../../components/cards/PlayerAvgCard.jsx")).default;

describe("PlayerAvgCard — empty state", () => {
  it("shows 'No stats available' when averages is null", () => {
    render(<PlayerAvgCard league="nba" averages={null} season="2024-25" />);
    expect(screen.getByText("No stats available.")).toBeInTheDocument();
  });

  it("shows 'No stats available' when averages is empty object", () => {
    render(<PlayerAvgCard league="nba" averages={{}} season="2024-25" />);
    expect(screen.getByText("No stats available.")).toBeInTheDocument();
  });

  it("shows season in header even when no stats", () => {
    render(<PlayerAvgCard league="nba" averages={null} season="2024-25" />);
    expect(screen.getByText(/2024-25 Regular Season/i)).toBeInTheDocument();
  });
});

describe("PlayerAvgCard — NBA stats", () => {
  const nbaAvgs = { points: 25.5, rebounds: 8.2, assists: 7.1, fgPct: 51.3 };

  it("renders NBA stat labels", () => {
    render(<PlayerAvgCard league="nba" averages={nbaAvgs} season="2024-25" />);
    expect(screen.getByText("PTS")).toBeInTheDocument();
    expect(screen.getByText("REB")).toBeInTheDocument();
    expect(screen.getByText("AST")).toBeInTheDocument();
    expect(screen.getByText("FG%")).toBeInTheDocument();
  });

  it("renders NBA stat values", () => {
    render(<PlayerAvgCard league="nba" averages={nbaAvgs} season="2024-25" />);
    expect(screen.getByText("25.5")).toBeInTheDocument();
    expect(screen.getByText("8.2")).toBeInTheDocument();
    expect(screen.getByText("7.1")).toBeInTheDocument();
    // FG% renders value + "%" as sibling text nodes, so the span text is "51.3%"
    expect(screen.getByText("51.3%")).toBeInTheDocument();
  });

  it("shows season header", () => {
    render(<PlayerAvgCard league="nba" averages={nbaAvgs} season="2024-25" />);
    expect(screen.getByText(/2024-25 Regular Season/i)).toBeInTheDocument();
  });
});

describe("PlayerAvgCard — NFL stats", () => {
  const nflAvgs = { yards: 285.4, td: 2.1, interceptions: 0.3 };

  it("renders NFL stat labels", () => {
    render(<PlayerAvgCard league="nfl" averages={nflAvgs} season="2024" />);
    expect(screen.getByText("YDS")).toBeInTheDocument();
    expect(screen.getByText("TD")).toBeInTheDocument();
    expect(screen.getByText("INT")).toBeInTheDocument();
  });
});

describe("PlayerAvgCard — NHL stats", () => {
  const nhlAvgs = { goals: 0.6, assists: 0.8, saves: null };

  it("renders NHL stat labels", () => {
    render(<PlayerAvgCard league="nhl" averages={nhlAvgs} season="2024-25" />);
    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("Assists")).toBeInTheDocument();
    expect(screen.getByText("Saves")).toBeInTheDocument();
  });

  it("renders -- for null stat value", () => {
    render(<PlayerAvgCard league="nhl" averages={nhlAvgs} season="2024-25" />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });
});
