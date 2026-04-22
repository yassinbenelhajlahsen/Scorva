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

describe("GameMatchupHeader — playoff series label", () => {
  it("shows home-team lead label", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 0 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("BOS lead 2-0")).toBeInTheDocument();
  });

  it("shows away-team lead label", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 1, awayWins: 3 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("NYK lead 3-1")).toBeInTheDocument();
  });

  it("shows tied label", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 2 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("Tied 2-2")).toBeInTheDocument();
  });

  it("shows win-series label when home wins series", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 4, awayWins: 1 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("BOS win series 4-1")).toBeInTheDocument();
  });

  it("shows win-series label when away wins series", () => {
    const props = makeProps();
    props.game.seriesScore = { homeWins: 2, awayWins: 4 };
    render(<GameMatchupHeader {...props} />);
    expect(screen.getByText("NYK win series 4-2")).toBeInTheDocument();
  });

  it("hides series label when both wins are 0", () => {
    render(<GameMatchupHeader {...makeProps()} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("hides series label when seriesScore is absent", () => {
    const props = makeProps();
    props.game.seriesScore = null;
    render(<GameMatchupHeader {...props} />);
    expect(screen.queryByText(/lead|Tied|win series/)).toBeNull();
  });

  it("renders game label text", () => {
    render(<GameMatchupHeader {...makeProps()} />);
    expect(screen.getByText("Game 3, First Round")).toBeInTheDocument();
  });
});
