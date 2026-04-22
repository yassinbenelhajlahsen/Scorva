// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

const MOTION_PROPS = new Set([
  "animate", "initial", "exit", "transition",
  "whileHover", "whileTap", "layout", "custom", "variants",
]);

vi.mock("framer-motion", () => ({
  m: new Proxy({}, {
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
  }),
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

vi.mock("../../hooks/data/usePlayoffs.js", () => ({ usePlayoffs: vi.fn() }));

vi.mock("../../components/skeletons/PlayoffsSkeleton.jsx", () => ({
  default: () => <div data-testid="skeleton" />,
}));

vi.mock("../../components/ui/ErrorState.jsx", () => ({
  default: ({ message }) => <div>{message}</div>,
}));

const { usePlayoffs } = await import("../../hooks/data/usePlayoffs.js");
const PlayoffsBracket = (await import("../../components/playoffs/PlayoffsBracket.jsx")).default;

const mockEasternSeries = {
  teamA: { id: 1, shortname: "BOS", name: "Boston Celtics", seed: 1, logo_url: null },
  teamB: { id: 2, shortname: "NYK", name: "New York Knicks", seed: 8, logo_url: null },
  wins: {}, winnerId: null, isComplete: false, games: [],
};

const mockWesternSeries = {
  teamA: { id: 3, shortname: "OKC", name: "Oklahoma City Thunder", seed: 1, logo_url: null },
  teamB: { id: 4, shortname: "LAL", name: "Los Angeles Lakers", seed: 8, logo_url: null },
  wins: {}, winnerId: null, isComplete: false, games: [],
};

const mockData = {
  unsupported: false,
  playIn: null,
  bracket: {
    eastern: { r1: [mockEasternSeries], semis: [], confFinals: [] },
    western: { r1: [mockWesternSeries], semis: [], confFinals: [] },
    finals: [{
      teamA: { id: 1, shortname: "BOS", name: "Boston Celtics", seed: 1, logo_url: null },
      teamB: null,
      wins: {}, winnerId: null, isComplete: false, games: [],
    }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  usePlayoffs.mockReturnValue({ data: mockData, loading: false, error: null, retry: vi.fn() });
});

describe("PlayoffsBracket", () => {
  it("renders conference tab buttons for mobile", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    expect(screen.getByRole("button", { name: "Eastern" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Western" })).toBeInTheDocument();
  });

  it("shows eastern conference content in mobile bracket by default", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    const mobileBracket = screen.getByTestId("mobile-bracket");
    expect(within(mobileBracket).getByText("BOS")).toBeInTheDocument();
  });

  it("switches to western conference when western tab is clicked", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    fireEvent.click(screen.getByRole("button", { name: "Western" }));
    const mobileBracket = screen.getByTestId("mobile-bracket");
    expect(within(mobileBracket).getByText("OKC")).toBeInTheDocument();
  });

  it("renders the finals label when finals data is present", () => {
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    expect(screen.getByText("NBA Finals")).toBeInTheDocument();
  });

  it("renders skeleton when loading", () => {
    usePlayoffs.mockReturnValue({ data: null, loading: true, error: null, retry: vi.fn() });
    render(<PlayoffsBracket league="nba" season="2024-25" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });
});
