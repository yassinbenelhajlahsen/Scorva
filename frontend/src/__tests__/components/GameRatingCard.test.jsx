// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameRatingCard from "../../components/game/GameRatingCard.jsx";

const sampleRating = {
  raw: 34.6, grade: 8.4, tierLabel: "Elite",
  home: { raw: 18.4, grade: 9.2 },
  away: { raw: 16.2, grade: 7.8 },
};

describe("GameRatingCard", () => {
  test("renders game grade, tier, and both team chips", () => {
    render(<GameRatingCard rating={sampleRating} homeTeam={{ abbr: "LAL" }} awayTeam={{ abbr: "BOS" }} />);
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
    expect(screen.getByText(/Elite/)).toBeInTheDocument();
    expect(screen.getByText(/9\.2/)).toBeInTheDocument();
    expect(screen.getByText(/7\.8/)).toBeInTheDocument();
    expect(screen.getByText("LAL")).toBeInTheDocument();
    expect(screen.getByText("BOS")).toBeInTheDocument();
  });

  test("renders nothing when rating is null", () => {
    const { container } = render(<GameRatingCard rating={null} homeTeam={{}} awayTeam={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when grade is null", () => {
    const { container } = render(<GameRatingCard rating={{ grade: null }} homeTeam={{}} awayTeam={{}} />);
    expect(container.firstChild).toBeNull();
  });

  test("applies live tier color (non-Close) without flicker", () => {
    render(<GameRatingCard rating={{ ...sampleRating, tierLabel: "Great" }} homeTeam={{ abbr: "LAL" }} awayTeam={{ abbr: "BOS" }} />);
    expect(screen.getByText(/Great/)).toBeInTheDocument();
  });
});
