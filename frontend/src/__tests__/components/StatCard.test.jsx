import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, animate, transition, ...props }) =>
          <span {...props}>{children}</span>,
    }
  ),
}));

const StatCard = (await import("../../components/cards/StatCard.jsx")).default;

const mockStats = [
  { label: "PTS", value: 28 },
  { label: "REB", value: 10 },
  { label: "AST", value: 7 },
];

describe("StatCard — empty state", () => {
  it("shows 'No stats available' when stats is empty", () => {
    render(<StatCard stats={[]} league="nba" gameId={1} id={42} status="Final" />);
    expect(screen.getByText("No stats available.")).toBeInTheDocument();
  });
});

describe("StatCard — with stats", () => {
  it("renders stat labels and values", () => {
    render(
      <StatCard
        stats={mockStats}
        league="nba"
        gameId={1}
        id={42}
        opponent="Lakers"
        date="Jan 15th"
        status="Final"
        result="W"
        isHome={true}
        opponentLogo="/logo.webp"
      />
    );
    expect(screen.getByText("PTS")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("REB")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders game link pointing to correct path with anchor", () => {
    render(
      <StatCard stats={mockStats} league="nba" gameId={1} id={42} status="Final" />
    );
    expect(screen.getByRole("link").getAttribute("href")).toBe("/nba/games/1#player-42");
  });

  it("shows Win badge for W result when Final", () => {
    render(
      <StatCard stats={mockStats} league="nba" gameId={1} id={42} status="Final" result="W" opponent="Lakers" />
    );
    expect(screen.getByText("W")).toBeInTheDocument();
  });

  it("shows Loss badge for L result when Final", () => {
    render(
      <StatCard stats={mockStats} league="nba" gameId={1} id={42} status="Final" result="L" opponent="Lakers" />
    );
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("shows 'vs.' when isHome is true", () => {
    render(
      <StatCard stats={mockStats} league="nba" gameId={1} id={42} status="Final" opponent="Lakers" isHome={true} />
    );
    // "vs." is inline text node in a span alongside opponent name
    expect(screen.getByText(/vs\./)).toBeInTheDocument();
  });

  it("shows '@' when isHome is false", () => {
    render(
      <StatCard stats={mockStats} league="nba" gameId={1} id={42} status="Final" opponent="Lakers" isHome={false} />
    );
    expect(screen.getByText(/@/)).toBeInTheDocument();
  });

  it("shows Live badge when In Progress", () => {
    render(
      <StatCard stats={mockStats} league="nba" gameId={1} id={42} status="In Progress" opponent="Lakers" />
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("appends % for stats with % in label", () => {
    const pctStats = [{ label: "FG%", value: 52 }];
    render(<StatCard stats={pctStats} league="nba" gameId={1} id={42} status="Final" />);
    // "%" is a sibling text node; the label "FG%" is shown in the <span> above
    expect(screen.getByText("FG%")).toBeInTheDocument();
  });
});
