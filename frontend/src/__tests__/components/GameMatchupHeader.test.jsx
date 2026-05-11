// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition", "whileHover", "whileTap",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: (_, tag) => {
        const El = ({ children, className, onClick, ...rest }) => {
          const Tag = tag;
          const props = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k))
          );
          return <Tag className={className} onClick={onClick} {...props}>{children}</Tag>;
        };
        El.displayName = tag;
        return El;
      },
    }
  ),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock("../../utils/motion.js", () => ({ scoreUpdateVariants: {} }));
vi.mock("../../utils/slugify.js", () => ({ default: (s) => s.toLowerCase().replace(/\s+/g, "-") }));

const GameMatchupHeader = (await import("../../components/game/GameMatchupHeader.jsx")).default;

function makeProps(overrides = {}) {
  return {
    homeTeam: {
      info: { id: 1, name: "Boston Celtics", shortName: "BOS", logoUrl: "/bos.png", record: "50-20" },
    },
    awayTeam: {
      info: { id: 2, name: "New York Knicks", shortName: "NYK", logoUrl: "/nyk.png", record: "45-25" },
    },
    game: {
      gameLabel: "Game 3, First Round",
      seriesScore: { homeWins: 0, awayWins: 0 },
      score: { home: 110, away: 98 },
      status: "Final",
      clock: null,
      currentPeriod: null,
    },
    league: "nba",
    isFinal: true,
    inProgress: false,
    homeWon: true,
    awayWon: false,
    playoffLogo: "/nba-playoffs.png",
    scoreColor: () => "text-text-primary",
    ...overrides,
  };
}

// Count filled dots (bg-text-primary) across both home and away dot groups.
function countFilledDots(container) {
  return container.querySelectorAll("span.bg-text-primary.rounded-full").length;
}

describe("GameMatchupHeader — playoff series dots", () => {
  it("shows 2 filled dots when home leads 2-0", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 0 };
    const { container } = render(<GameMatchupHeader {...props} />);
    expect(countFilledDots(container)).toBe(2);
  });

  it("shows 4 filled dots when away leads 1-3", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 1, awayWins: 3 };
    const { container } = render(<GameMatchupHeader {...props} />);
    expect(countFilledDots(container)).toBe(4);
  });

  it("shows 4 filled dots when tied 2-2", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 2 };
    const { container } = render(<GameMatchupHeader {...props} />);
    expect(countFilledDots(container)).toBe(4);
  });

  it("shows 5 filled dots when home wins series 4-1", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 4, awayWins: 1 };
    const { container } = render(<GameMatchupHeader {...props} />);
    expect(countFilledDots(container)).toBe(5);
  });

  it("shows 6 filled dots when away wins series 4-2", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 4 };
    const { container } = render(<GameMatchupHeader {...props} />);
    expect(countFilledDots(container)).toBe(6);
  });

  it("hides dots when both wins are 0", () => {
    const { container } = render(<GameMatchupHeader {...makeProps()} />);
    expect(countFilledDots(container)).toBe(0);
  });

  it("hides dots when seriesScore is absent", () => {
    const props = makeProps();
    props.game.seriesScore = null;
    const { container } = render(<GameMatchupHeader {...props} />);
    expect(countFilledDots(container)).toBe(0);
  });

  it("renders game label text", () => {
    render(<GameMatchupHeader {...makeProps()} />);
    expect(screen.getByText("Game 3, First Round")).toBeInTheDocument();
  });
});
