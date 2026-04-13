// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ─── Framer Motion mock ───────────────────────────────────────────────────────
const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition", "layout",
  "whileHover", "whileTap",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy(
    {},
    {
      get: (_, tag) => {
        const El = ({ children, className, onClick, ...rest }) => {
          const Tag = tag;
          const props = Object.fromEntries(
            Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k)),
          );
          return <Tag className={className} onClick={onClick} {...props}>{children}</Tag>;
        };
        El.displayName = tag;
        return El;
      },
    },
  ),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// ─── Hook mock ────────────────────────────────────────────────────────────────
vi.mock("../../hooks/data/usePlays.js", () => ({ usePlays: vi.fn() }));

const { usePlays } = await import("../../hooks/data/usePlays.js");
const { default: PlayByPlay } = await import("../../components/ui/PlayByPlay.jsx");

// ─── Fixtures ─────────────────────────────────────────────────────────────────
function makePlay(overrides = {}) {
  return {
    id: 1,
    espn_play_id: "100",
    sequence: 1,
    period: 1,
    clock: "12:00",
    description: "LeBron makes 2pt shot",
    short_text: "LeBron 2pt",
    home_score: 2,
    away_score: 0,
    scoring_play: false,
    team_id: 1,
    team_logo: null,
    team_short: null,
    play_type: "Made Shot",
    drive_number: null,
    drive_description: null,
    drive_result: null,
    ...overrides,
  };
}

const defaultProps = {
  league: "nba",
  gameId: 1,
  isLive: false,
};

describe("PlayByPlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading state", () => {
    it("renders a skeleton when loading", () => {
      usePlays.mockReturnValue({ plays: null, loading: true, error: false });
      const { container } = render(<PlayByPlay {...defaultProps} />);
      // The skeleton has an animate-pulse element
      expect(container.querySelector(".animate-pulse")).toBeTruthy();
    });
  });

  describe("Empty / error states", () => {
    it("renders nothing when plays is empty", () => {
      usePlays.mockReturnValue({
        plays: { plays: [], source: "db" },
        loading: false,
        error: false,
        retry: vi.fn(),
      });
      const { container } = render(<PlayByPlay {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders error state on error", () => {
      usePlays.mockReturnValue({ plays: null, loading: false, error: true, retry: vi.fn() });
      render(<PlayByPlay {...defaultProps} />);
      expect(screen.getByText("Could not load play-by-play data.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });
  });

  describe("Loaded state — NBA", () => {
    beforeEach(() => {
      usePlays.mockReturnValue({
        plays: { plays: [makePlay(), makePlay({ id: 2, sequence: 2, period: 2, clock: "5:00", description: "Curry 3pt" })], source: "db" },
        loading: false,
        error: false,
      });
    });

    it("renders the section header", () => {
      render(<PlayByPlay {...defaultProps} />);
      expect(screen.getByText("Play by Play")).toBeInTheDocument();
    });

    it("renders all play descriptions when isLive (defaults to All)", () => {
      render(<PlayByPlay {...defaultProps} isLive={true} />);
      expect(screen.getByText("LeBron makes 2pt shot")).toBeInTheDocument();
      expect(screen.getByText("Curry 3pt")).toBeInTheDocument();
    });

    it("renders filter pills including All and Scoring", () => {
      render(<PlayByPlay {...defaultProps} />);
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Scoring")).toBeInTheDocument();
    });

    it("renders period filter pills for each distinct period", () => {
      render(<PlayByPlay {...defaultProps} />);
      expect(screen.getByText("Q1")).toBeInTheDocument();
      expect(screen.getByText("Q2")).toBeInTheDocument();
    });

    it("filters to scoring plays only when Scoring pill is clicked", () => {
      usePlays.mockReturnValue({
        plays: {
          plays: [
            makePlay({ description: "Scoring play", scoring_play: true }),
            makePlay({ id: 2, sequence: 2, description: "Non-scoring play", scoring_play: false }),
          ],
          source: "db",
        },
        loading: false,
        error: false,
      });

      render(<PlayByPlay {...defaultProps} />);
      fireEvent.click(screen.getByText("Scoring"));

      expect(screen.getByText("Scoring play")).toBeInTheDocument();
      expect(screen.queryByText("Non-scoring play")).not.toBeInTheDocument();
    });

    it("filters to Q1 plays when Q1 pill is clicked", () => {
      usePlays.mockReturnValue({
        plays: {
          plays: [
            makePlay({ description: "Q1 play", period: 1 }),
            makePlay({ id: 2, sequence: 2, description: "Q2 play", period: 2 }),
          ],
          source: "db",
        },
        loading: false,
        error: false,
      });

      render(<PlayByPlay {...defaultProps} />);
      fireEvent.click(screen.getByText("Q1"));

      expect(screen.getByText("Q1 play")).toBeInTheDocument();
      expect(screen.queryByText("Q2 play")).not.toBeInTheDocument();
    });

    it("shows clock values in play rows", () => {
      render(<PlayByPlay {...defaultProps} isLive={true} />);
      expect(screen.getByText("12:00")).toBeInTheDocument();
    });

    it("does not show subtitle text", () => {
      render(<PlayByPlay {...defaultProps} isLive={true} />);
      expect(screen.queryByText(/Live — updating every/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/scoring plays/)).not.toBeInTheDocument();
    });
  });

  describe("Scoring play highlight", () => {
    it("applies accent highlight class to scoring plays when filter is All", () => {
      usePlays.mockReturnValue({
        plays: {
          plays: [makePlay({ scoring_play: true, description: "Scoring!" })],
          source: "db",
        },
        loading: false,
        error: false,
      });

      render(<PlayByPlay {...defaultProps} isLive={true} />);

      const playRow = screen.getByText("Scoring!").closest("[class*='border-l-2']");
      expect(playRow?.className).toContain("border-win");
    });
  });

  describe("NHL period labels", () => {
    it("uses P1/P2/P3 labels for NHL", () => {
      usePlays.mockReturnValue({
        plays: {
          plays: [
            makePlay({ period: 1, description: "NHL play P1" }),
            makePlay({ id: 2, sequence: 2, period: 2, description: "NHL play P2" }),
          ],
          source: "db",
        },
        loading: false,
        error: false,
      });

      render(<PlayByPlay {...defaultProps} league="nhl" />);
      expect(screen.getByText("P1")).toBeInTheDocument();
      expect(screen.getByText("P2")).toBeInTheDocument();
    });
  });

  describe("NFL drives", () => {
    beforeEach(() => {
      usePlays.mockReturnValue({
        plays: {
          plays: [
            makePlay({
              description: "Mahomes pass for 10 yds",
              scoring_play: true,
              drive_number: 1,
              drive_description: "10 plays, 60 yards",
              drive_result: "Touchdown",
            }),
          ],
          source: "db",
        },
        loading: false,
        error: false,
      });
    });

    it("renders drive header with description and result", () => {
      render(<PlayByPlay {...defaultProps} league="nfl" />);
      expect(screen.getByText("10 plays, 60 yards")).toBeInTheDocument();
      expect(screen.getByText("Touchdown")).toBeInTheDocument();
    });

    it("shows drive play when drive is expanded", () => {
      render(<PlayByPlay {...defaultProps} league="nfl" />);

      // Drive starts collapsed — play is not visible
      expect(screen.queryByText("Mahomes pass for 10 yds")).not.toBeInTheDocument();

      // Click the drive header to expand
      fireEvent.click(screen.getByText("10 plays, 60 yards"));
      expect(screen.getByText("Mahomes pass for 10 yds")).toBeInTheDocument();
    });

    it("collapses drive when clicked again", () => {
      render(<PlayByPlay {...defaultProps} league="nfl" />);

      const driveBtn = screen.getByText("10 plays, 60 yards");
      fireEvent.click(driveBtn); // expand
      fireEvent.click(driveBtn); // collapse

      expect(screen.queryByText("Mahomes pass for 10 yds")).not.toBeInTheDocument();
    });
  });

  describe("usePlays is called correctly", () => {
    it("passes league, gameId, and isLive to usePlays", () => {
      usePlays.mockReturnValue({ plays: null, loading: true, error: false });
      render(<PlayByPlay league="nfl" gameId={7} isLive={true} />);
      expect(usePlays).toHaveBeenCalledWith("nfl", 7, true);
    });
  });
});
