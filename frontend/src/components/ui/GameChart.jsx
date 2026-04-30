import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const REGULATION_COUNT = 4;
const PERIOD_LABELS = ["Q1", "Q2", "Q3", "Q4"];

const DEFAULT_HOME_COLOR = "#e8863a";
const DEFAULT_AWAY_COLOR = "#60A5FA";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Perceptual distance between two hex colors (0–441)
function colorDistance(a, b) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function relativeLuminance(hex) {
  return hexToRgb(hex)
    .map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

// If the two team colors are too similar, fall back to defaults so the
// chart line stays readable (e.g. Cowboys vs Patriots are both #002a5c).
// If a color is too dark to see on the dark background, use white instead.
function resolveColors(rawHome, rawAway) {
  const DARK_THRESHOLD = 0.04;
  const home = rawHome ?? DEFAULT_HOME_COLOR;
  const away = rawAway ?? DEFAULT_AWAY_COLOR;
  const resolvedHome =
    relativeLuminance(home) < DARK_THRESHOLD ? "#ffffff" : home;
  const resolvedAway =
    relativeLuminance(away) < DARK_THRESHOLD ? "#ffffff" : away;
  if (colorDistance(resolvedHome, resolvedAway) < 60) {
    return [DEFAULT_HOME_COLOR, DEFAULT_AWAY_COLOR];
  }
  return [resolvedHome, resolvedAway];
}

function downsample(raw, target = 60) {
  if (raw.length <= target) return raw;
  const step = raw.length / target;
  return Array.from({ length: target }, (_, i) => raw[Math.round(i * step)]);
}

function periodLabel(periodNum) {
  if (periodNum >= 1 && periodNum <= PERIOD_LABELS.length) {
    return PERIOD_LABELS[periodNum - 1];
  }
  const otIndex = periodNum - PERIOD_LABELS.length;
  return otIndex === 1 ? "OT" : `OT${otIndex}`;
}

// Each period's length is the largest clock value observed in that period
// (the clock counts down, so the first play of a period has the max).
function computePeriodLengths(sampled) {
  const lengths = new Map();
  for (const dp of sampled) {
    if (dp.period == null || dp.clock == null) continue;
    const cur = lengths.get(dp.period) ?? 0;
    if (dp.clock > cur) lengths.set(dp.period, dp.clock);
  }
  return lengths;
}

function hasTimeInfo(sampled) {
  return sampled.some((dp) => dp.period != null && dp.clock != null);
}

// xPos = (period - 1) + elapsedFraction. End of period 4 = 4.0.
function computeXPos(dp, periodLengths) {
  const len = periodLengths.get(dp.period);
  if (!len || len <= 0) return dp.period - 1;
  const elapsedFraction = (len - dp.clock) / len;
  return (dp.period - 1) + elapsedFraction;
}

function buildPositioned(sampled) {
  const useTime = hasTimeInfo(sampled);
  const periodLengths = useTime ? computePeriodLengths(sampled) : null;
  const xPositions = sampled.map((dp, i) =>
    useTime && dp.period != null && dp.clock != null
      ? computeXPos(dp, periodLengths)
      : i,
  );
  const maxPeriod = useTime
    ? Math.max(0, ...sampled.map((dp) => dp.period ?? 0))
    : 0;
  return { useTime, xPositions, maxPeriod };
}

function buildChartData(raw) {
  const sampled = downsample(raw);
  const { useTime, xPositions, maxPeriod } = buildPositioned(sampled);
  const points = sampled.map((dp, i) => ({
    xPos: xPositions[i],
    home: Math.round(dp.homeWinPercentage * 100),
    away: Math.round((1 - dp.homeWinPercentage) * 100),
  }));
  return { points, useTime, maxPeriod };
}

function buildMarginData(raw) {
  const sampled = downsample(raw);
  const { useTime, xPositions, maxPeriod } = buildPositioned(sampled);
  const points = sampled.map((dp, i) => ({
    xPos: xPositions[i],
    margin: dp.margin,
  }));
  return { points, useTime, maxPeriod };
}

function buildPeriodTicks(series) {
  if (series.useTime) {
    const totalPeriods = Math.max(REGULATION_COUNT, series.maxPeriod);
    return Array.from({ length: totalPeriods }, (_, i) => ({
      value: i,
      label: periodLabel(i + 1),
    }));
  }
  // Legacy fallback (no period/clock info): evenly distribute across data.
  const total = series.points.length;
  return PERIOD_LABELS.map((label, i) => ({
    value: Math.round((i / REGULATION_COUNT) * (total - 1)),
    label,
  }));
}

function CustomTooltip({
  active,
  payload,
  homeShortName,
  awayShortName,
  homeColor,
  awayColor,
}) {
  if (!active || !payload?.length) return null;
  const { home, away } = payload[0].payload;
  const homeWinning = home >= 50;
  return (
    <div className="bg-surface-overlay border border-white/[0.1] rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: homeColor }}
        />
        <span className="text-text-secondary">{homeShortName}</span>
        <span
          className="font-semibold ml-auto"
          style={{ color: homeWinning ? homeColor : "rgba(255,255,255,0.5)" }}
        >
          {home}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: awayColor }}
        />
        <span className="text-text-secondary">{awayShortName}</span>
        <span
          className="font-semibold ml-auto"
          style={{ color: !homeWinning ? awayColor : "rgba(255,255,255,0.5)" }}
        >
          {away}%
        </span>
      </div>
    </div>
  );
}

function MarginTooltip({
  active,
  payload,
  homeShortName,
  awayShortName,
  homeColor,
  awayColor,
}) {
  if (!active || !payload?.length) return null;
  const { margin } = payload[0].payload;
  const leader = margin > 0 ? homeShortName : margin < 0 ? awayShortName : null;
  const color =
    margin > 0 ? homeColor : margin < 0 ? awayColor : "rgba(255,255,255,0.5)";
  return (
    <div className="bg-surface-overlay border border-white/[0.1] rounded-lg px-3 py-2 text-xs shadow-lg">
      <span style={{ color }} className="font-semibold">
        {leader ? `${leader} +${Math.abs(margin)}` : "Tied"}
      </span>
    </div>
  );
}

function PeriodTick({ x, y, payload, periodTicks }) {
  const match = periodTicks.find((t) => t.value === payload.value);
  if (!match) return null;
  return (
    <text
      x={x}
      y={y + 14}
      textAnchor="middle"
      fontSize={10}
      fill="rgba(255,255,255,0.3)"
    >
      {match.label}
    </text>
  );
}

export default function GameChart({
  data,
  scoreMargin,
  homeTeam,
  awayTeam,
}) {
  const [viewMode, setViewMode] = useState("winProb");

  if (!data || data.length === 0) return null;

  const chart = buildChartData(data);
  const margin =
    scoreMargin?.length > 0 ? buildMarginData(scoreMargin) : null;
  const isMarginMode = viewMode === "margin" && margin;
  const active = isMarginMode ? margin : chart;
  const periodTicks = buildPeriodTicks(active);
  const tickValues = periodTicks.map((t) => t.value);

  // X-axis domain: time-based games span [0, totalPeriods]; legacy spans [0, len-1].
  // The line stops at the last data point's xPos — that's the live-game truncation.
  const xDomain = active.useTime
    ? [0, Math.max(REGULATION_COUNT, active.maxPeriod)]
    : [0, active.points.length - 1];

  const homeShortName = homeTeam?.info?.shortName ?? "Home";
  const awayShortName = awayTeam?.info?.shortName ?? "Away";
  const [homeColor, awayColor] = resolveColors(
    homeTeam?.info?.color,
    awayTeam?.info?.color,
  );

  // Y-axis config per view
  let yDomain, yTicks, yFormatter;
  if (isMarginMode) {
    const maxAbs = Math.max(
      ...margin.points.map((d) => Math.abs(d.margin)),
      5,
    );
    const paddedMax = Math.ceil(maxAbs / 5) * 5;
    yDomain = [-paddedMax, paddedMax];
    const half = Math.round(paddedMax / 2);
    yTicks = [-paddedMax, -half, 0, half, paddedMax];
    yFormatter = (v) => (v > 0 ? `+${v}` : String(v));
  } else {
    yDomain = [0, 100];
    yTicks = [0, 25, 50, 75, 100];
    yFormatter = (v) => `${v}%`;
  }

  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        {margin ? (
          <div className="relative inline-flex items-center">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-xs font-semibold uppercase tracking-wider px-3 py-1.5 pr-7 min-h-[44px] cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
              <option
                value="winProb"
                className="bg-surface-primary normal-case tracking-normal font-normal"
              >
                Win Probability
              </option>
              <option
                value="margin"
                className="bg-surface-primary normal-case tracking-normal font-normal"
              >
                Point Differential
              </option>
            </select>
            <svg
              className="pointer-events-none absolute right-2 w-3 h-3 text-text-tertiary"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2 4l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : (
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Win Probability
          </h3>
        )}

        {/*
          Legend: zone swatches (not line dashes) — there is only ONE line in this
          chart (home win % or score margin). The colored squares match the background
          zone tinting so users understand which half belongs to which team.
        */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: homeColor + "55" }}
            />
            <span className="text-text-secondary">{homeShortName}</span>
          </div>
          <span className="text-text-tertiary/50">·</span>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: awayColor + "55" }}
            />
            <span className="text-text-secondary">{awayShortName}</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={active.points}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="homeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={homeColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={homeColor} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            {/*
              Zone background tinting. For win prob: top half = home, bottom = away.
              For margin: positive = home leading, negative = away leading.
            */}
            {isMarginMode ? (
              <>
                <ReferenceArea
                  y1={0}
                  y2={yDomain[1]}
                  fill={homeColor}
                  fillOpacity={0.05}
                />
                <ReferenceArea
                  y1={yDomain[0]}
                  y2={0}
                  fill={awayColor}
                  fillOpacity={0.05}
                />
              </>
            ) : (
              <>
                <ReferenceArea
                  y1={50}
                  y2={100}
                  fill={homeColor}
                  fillOpacity={0.05}
                />
                <ReferenceArea
                  y1={0}
                  y2={50}
                  fill={awayColor}
                  fillOpacity={0.05}
                />
              </>
            )}

            <XAxis
              dataKey="xPos"
              type="number"
              domain={xDomain}
              ticks={tickValues}
              tick={(props) => (
                <PeriodTick {...props} periodTicks={periodTicks} />
              )}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              tickLine={false}
              allowDataOverflow={false}
            />

            <YAxis
              width={36}
              domain={yDomain}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
              tickFormatter={yFormatter}
              ticks={yTicks}
            />

            {/* Key reference: 50% for win prob, 0 (tied) for margin */}
            <ReferenceLine
              y={isMarginMode ? 0 : 50}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="3 3"
              label={false}
            />

            <Tooltip
              content={
                isMarginMode ? (
                  <MarginTooltip
                    homeShortName={homeShortName}
                    awayShortName={awayShortName}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                ) : (
                  <CustomTooltip
                    homeShortName={homeShortName}
                    awayShortName={awayShortName}
                    homeColor={homeColor}
                    awayColor={awayColor}
                  />
                )
              }
              cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
            />

            {/*
              Single line: home win probability (win prob mode) or score margin (margin mode).
              Line is always homeColor — positive values favor the home team.
            */}
            {isMarginMode ? (
              <Area
                type="monotoneX"
                dataKey="margin"
                stroke={homeColor}
                strokeWidth={1.5}
                fill="url(#homeAreaGrad)"
                dot={false}
                activeDot={{ r: 3, fill: homeColor, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ) : (
              <Area
                type="monotoneX"
                dataKey="home"
                stroke={homeColor}
                strokeWidth={1.5}
                fill="url(#homeAreaGrad)"
                dot={false}
                activeDot={{ r: 3, fill: homeColor, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
