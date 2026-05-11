// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TeamHeroRow from "../../components/highlights/rows/TeamHeroRow.jsx";
import TeamCompactRow from "../../components/highlights/rows/TeamCompactRow.jsx";
import GameHeroRow from "../../components/highlights/rows/GameHeroRow.jsx";
import GameCompactRow from "../../components/highlights/rows/GameCompactRow.jsx";

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Team rows", () => {
  test("TeamHeroRow renders rank, name, abbr, and value", () => {
    wrap(<TeamHeroRow rank={1} to="/nba/teams/lakers" name="Los Angeles Lakers" abbr="LAL" value="9.2" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles Lakers")).toBeInTheDocument();
    expect(screen.getByText("LAL")).toBeInTheDocument();
    expect(screen.getByText("9.2")).toBeInTheDocument();
  });

  test("TeamCompactRow renders rank and value", () => {
    wrap(<TeamCompactRow rank={5} to="/nba/teams/celtics" name="Celtics" abbr="BOS" value="7.8" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Celtics")).toBeInTheDocument();
    expect(screen.getByText("7.8")).toBeInTheDocument();
  });
});

describe("Game rows", () => {
  const home = { abbr: "LAL", logo: "/lal.svg", primary_color: "#552583" };
  const away = { abbr: "BOS", logo: "/bos.svg", primary_color: "#007A33" };

  test("GameHeroRow renders matchup, score, tier, value", () => {
    wrap(<GameHeroRow rank={1} to="/nba/games/7" homeTeam={home} awayTeam={away} score="118-115" tierLabel="Elite" value="8.4" />);
    expect(screen.getByText(/LAL/)).toBeInTheDocument();
    expect(screen.getByText(/BOS/)).toBeInTheDocument();
    expect(screen.getByText(/118-115/)).toBeInTheDocument();
    expect(screen.getByText(/Elite/)).toBeInTheDocument();
    expect(screen.getByText("8.4")).toBeInTheDocument();
  });

  test("GameCompactRow renders Live badge", () => {
    wrap(<GameCompactRow rank={4} to="/nba/games/8" homeTeam={home} awayTeam={away} score="50-48" value="3.5" isLive />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
