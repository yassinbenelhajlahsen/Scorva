// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerStatusBadge from "../../components/player/PlayerStatusBadge.jsx";

describe("PlayerStatusBadge", () => {
  it("renders Available label for null status", () => {
    render(<PlayerStatusBadge status={null} />);
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("maps out status to the Out label with loss tone", () => {
    const { container } = render(<PlayerStatusBadge status="out" />);
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(container.querySelector(".text-loss")).not.toBeNull();
  });

  it("returns null for an unknown status", () => {
    const { container } = render(<PlayerStatusBadge status="lolwut" />);
    expect(container.firstChild).toBeNull();
  });

  it("sets the hover title to the passed description", () => {
    render(<PlayerStatusBadge status="day-to-day" title="left ankle soreness" />);
    expect(screen.getByText("Day-to-Day").closest("div")).toHaveAttribute(
      "title",
      "left ankle soreness"
    );
  });

  it("uses the md size by default", () => {
    const { container } = render(<PlayerStatusBadge status="available" />);
    const pill = container.firstChild;
    expect(pill.className).toContain("px-3");
    expect(pill.className).toContain("text-xs");
  });

  it("applies compact styling when size is sm", () => {
    const { container } = render(<PlayerStatusBadge status="available" size="sm" />);
    const pill = container.firstChild;
    expect(pill.className).toContain("px-2");
    expect(pill.className).toContain("text-[10px]");
  });
});
