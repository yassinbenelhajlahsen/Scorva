// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../components/cards/PredictionCard.jsx", () => ({
  default: ({ prediction }) => (
    <div data-testid="prediction-card">prediction:{String(prediction?.id ?? "loading")}</div>
  ),
}));

vi.mock("../../components/cards/TopPerformerCard.jsx", () => ({
  default: () => <div data-testid="top-performer-card" />,
}));

vi.mock("../../components/ui/GameChart.jsx", () => ({
  default: () => <div data-testid="game-chart" />,
}));

const OverviewTab = (await import("../../components/game/OverviewTab.jsx")).default;

const baseProps = {
  homeTeam: { info: { shortName: "BOS", color: "#007A33" } },
  awayTeam: { info: { shortName: "NYK", color: "#F58426" } },
  league: "nba",
  season: "2024",
  quarterKeys: ["q1", "q2", "q3", "q4"],
  isFinal: false,
  inProgress: false,
  isPreGame: true,
  homeWon: false,
  awayWon: false,
  scoreColor: () => "",
  topPlayers: { topPerformer: null, topScorer: null, impactPlayer: null },
  winProbData: null,
  scoreMargin: null,
};

const baseGame = {
  score: { home: 0, away: 0, quarters: { q1: null, q2: null, q3: null, q4: null, ot: [] } },
};

describe("OverviewTab — prediction gating", () => {
  it("shows placeholder and hides PredictionCard when hasUnplayedPriorSeriesGames is true", () => {
    render(
      <OverviewTab
        {...baseProps}
        game={{ ...baseGame, hasUnplayedPriorSeriesGames: true }}
        prediction={{ id: "p1" }}
        predictionLoading={false}
      />
    );
    expect(
      screen.getByText(/Prediction available after the previous game/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("prediction-card")).not.toBeInTheDocument();
  });

  it("renders PredictionCard when hasUnplayedPriorSeriesGames is false and prediction present", () => {
    render(
      <OverviewTab
        {...baseProps}
        game={{ ...baseGame, hasUnplayedPriorSeriesGames: false }}
        prediction={{ id: "p1" }}
        predictionLoading={false}
      />
    );
    expect(screen.getByTestId("prediction-card")).toBeInTheDocument();
    expect(
      screen.queryByText(/Prediction available after the previous game/i)
    ).not.toBeInTheDocument();
  });

  it("renders PredictionCard for regular-season games (no flag set)", () => {
    render(
      <OverviewTab
        {...baseProps}
        game={baseGame}
        prediction={{ id: "p1" }}
        predictionLoading={false}
      />
    );
    expect(screen.getByTestId("prediction-card")).toBeInTheDocument();
  });

  it("does not render placeholder or PredictionCard when not pre-game", () => {
    render(
      <OverviewTab
        {...baseProps}
        isPreGame={false}
        isFinal={true}
        game={{ ...baseGame, hasUnplayedPriorSeriesGames: true }}
        prediction={{ id: "p1" }}
        predictionLoading={false}
      />
    );
    expect(screen.queryByTestId("prediction-card")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Prediction available after the previous game/i)
    ).not.toBeInTheDocument();
  });
});
