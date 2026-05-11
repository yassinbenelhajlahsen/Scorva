// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GameRatingPill from "../../components/cards/GameRatingPill.jsx";

describe("GameRatingPill", () => {
  test("renders grade with star prefix when grade is a number", () => {
    render(<GameRatingPill grade={8.4} />);
    expect(screen.getByText(/8\.4/)).toBeInTheDocument();
  });

  test("renders nothing when grade is null", () => {
    const { container } = render(<GameRatingPill grade={null} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when grade is undefined", () => {
    const { container } = render(<GameRatingPill grade={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  test("applies loss color class for negative grade", () => {
    render(<GameRatingPill grade={-2.3} />);
    const el = screen.getByText(/-2\.3/);
    expect(el.className).toMatch(/text-loss|red/);
  });
});
