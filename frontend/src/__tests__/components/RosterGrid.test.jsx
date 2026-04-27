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
};

describe("RosterGrid", () => {
  it("renders one card per player", () => {
    render(<RosterGrid league="nba" season="2025-26" players={[lebron, out]} />);
    expect(screen.getByText("LeBron James")).toBeInTheDocument();
    expect(screen.getByText("Anthony Davis")).toBeInTheDocument();
  });

  it("links each card to the player page with season query param", () => {
    render(<RosterGrid league="nba" season="2025-26" players={[lebron]} />);
    const link = screen.getByText("LeBron James").closest("a");
    expect(link).toHaveAttribute("href", "/nba/players/lebron-james?season=2025-26");
  });

  it("omits the season query param when season is null", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    const link = screen.getByText("LeBron James").closest("a");
    expect(link).toHaveAttribute("href", "/nba/players/lebron-james");
  });

  it("renders jersey and position", () => {
    render(<RosterGrid league="nba" season={null} players={[lebron]} />);
    expect(screen.getByText(/#23/)).toBeInTheDocument();
    expect(screen.getByText(/F/)).toBeInTheDocument();
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
    expect(screen.getByText("Anthony Davis")).toBeInTheDocument();
  });

  it("shows an empty-state message when players is empty", () => {
    render(<RosterGrid league="nba" season={null} players={[]} />);
    expect(screen.getByText(/No roster data/i)).toBeInTheDocument();
  });
});
