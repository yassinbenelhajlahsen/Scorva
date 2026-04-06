import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock Recharts — the SVG rendering is not meaningful in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children, data }) => (
    <div data-testid="area-chart" data-points={data?.length}>{children}</div>
  ),
  Area: ({ dataKey }) => <div data-testid={`area-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
  ReferenceArea: () => <div data-testid="reference-area" />,
  Tooltip: () => <div data-testid="tooltip" />,
  defs: ({ children }) => <>{children}</>,
  linearGradient: ({ children }) => <>{children}</>,
  stop: () => null,
}));

const WinProbabilityChart = (await import("../../components/ui/WinProbabilityChart.jsx")).default;

const homeTeam = { info: { shortName: "LAL" } };
const awayTeam  = { info: { shortName: "BOS" } };

const SAMPLE_DATA = [
  { homeWinPercentage: 0.65, playId: "p1" },
  { homeWinPercentage: 0.55, playId: "p2" },
  { homeWinPercentage: 0.82, playId: "p3" },
];

const SAMPLE_MARGIN = [
  { playId: "p1", margin: 0 },
  { playId: "p2", margin: -5 },
  { playId: "p3", margin: 3 },
];

describe("WinProbabilityChart — null/empty data", () => {
  it("renders nothing when data is null", () => {
    const { container } = render(
      <WinProbabilityChart data={null} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when data is an empty array", () => {
    const { container } = render(
      <WinProbabilityChart data={[]} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("WinProbabilityChart — renders with data", () => {
  it("renders the chart container", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders home Area element in win probability mode", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByTestId("area-home")).toBeInTheDocument();
  });

  it("shows the section heading when no scoreMargin provided", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByText("Win Probability")).toBeInTheDocument();
  });

  it("shows home team short name in the legend", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByText("LAL")).toBeInTheDocument();
  });

  it("shows away team short name in the legend", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByText("BOS")).toBeInTheDocument();
  });

  it("passes correct number of data points to AreaChart", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByTestId("area-chart").dataset.points).toBe("3");
  });
});

describe("WinProbabilityChart — fallback team names", () => {
  it("falls back to 'Home' when homeTeam is undefined", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={undefined} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("falls back to 'Away' when awayTeam is undefined", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={undefined} league="nba" />
    );
    expect(screen.getByText("Away")).toBeInTheDocument();
  });
});

describe("WinProbabilityChart — data transformation", () => {
  it("renders without error for varied data", () => {
    const data = [
      { homeWinPercentage: 0.5, playId: "a" },
      { homeWinPercentage: 0.7, playId: "b" },
      { homeWinPercentage: 0.9, playId: "c" },
    ];
    render(
      <WinProbabilityChart data={data} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    expect(screen.getByTestId("area-chart").dataset.points).toBe("3");
  });
});

describe("WinProbabilityChart — view mode dropdown", () => {
  it("does not render a dropdown when scoreMargin is not provided", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Win Probability")).toBeInTheDocument();
  });

  it("does not render a dropdown when scoreMargin is null", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} scoreMargin={null} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("renders dropdown when scoreMargin is provided", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} scoreMargin={SAMPLE_MARGIN} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("defaults to win probability mode", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} scoreMargin={SAMPLE_MARGIN} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    expect(screen.getByRole("combobox")).toHaveValue("winProb");
    expect(screen.getByTestId("area-home")).toBeInTheDocument();
    expect(screen.queryByTestId("area-margin")).toBeNull();
  });

  it("switches to margin chart when 'margin' selected", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} scoreMargin={SAMPLE_MARGIN} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "margin" } });
    expect(screen.getByTestId("area-margin")).toBeInTheDocument();
    expect(screen.queryByTestId("area-home")).toBeNull();
  });

  it("switches back to win probability when 'winProb' selected after toggling", () => {
    render(
      <WinProbabilityChart data={SAMPLE_DATA} scoreMargin={SAMPLE_MARGIN} homeTeam={homeTeam} awayTeam={awayTeam} league="nba" />
    );
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "margin" } });
    fireEvent.change(select, { target: { value: "winProb" } });
    expect(screen.getByTestId("area-home")).toBeInTheDocument();
    expect(screen.queryByTestId("area-margin")).toBeNull();
  });
});
