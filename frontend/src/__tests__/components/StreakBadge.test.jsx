// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StreakBadge from "../../components/ui/StreakBadge.jsx";

describe("StreakBadge", () => {
  it("renders nothing when streak is null", () => {
    const { container } = render(<StreakBadge streak={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a player streak with fire emoji", () => {
    render(<StreakBadge streak={{ length: 5, statLabel: "triple-double", subjectType: "player" }} />);
    expect(screen.getByText(/5-game triple-double streak/i)).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("renders a team win streak with fire emoji", () => {
    render(<StreakBadge streak={{ length: 4, statLabel: "win", subjectType: "team" }} />);
    expect(screen.getByText(/4-game win streak/i)).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("renders a team loss streak with ice emoji", () => {
    render(<StreakBadge streak={{ length: 3, statLabel: "loss", subjectType: "team" }} />);
    expect(screen.getByText(/3-game loss streak/i)).toBeInTheDocument();
    expect(screen.getByText("❄️")).toBeInTheDocument();
  });

  it("supports a smaller size variant", () => {
    const { container } = render(
      <StreakBadge streak={{ length: 5, statLabel: "win", subjectType: "team" }} size="sm" />,
    );
    expect(container.firstChild.className).toMatch(/text-\[10px\]/);
  });
});
