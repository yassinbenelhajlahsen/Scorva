import { m } from "framer-motion";

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

function ProbabilityBar({ team, isFavored, isHome, color }) {
  return (
    <div className="flex items-center gap-3">
      {/* Team logo */}
      <img
        src={team.logoUrl}
        alt={team.shortName}
        className="w-7 h-7 object-contain flex-shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />

      {/* Name + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-semibold ${isFavored ? "text-text-primary" : "text-text-secondary"}`}>
            {team.shortName}
            {isHome && (
              <span className="ml-1.5 text-[10px] font-normal text-text-tertiary uppercase tracking-wider">Home</span>
            )}
          </span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: isFavored ? color : "rgba(255,255,255,0.35)" }}
          >
            {team.winProbability}%
          </span>
        </div>

        {/* Bar track */}
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <m.div
            className="h-full rounded-full"
            style={{ background: isFavored ? color : "rgba(255,255,255,0.18)" }}
            initial={{ width: 0 }}
            animate={{ width: `${team.winProbability}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PredictionCard({ prediction, loading, homeColor: rawHomeColor, awayColor: rawAwayColor }) {
  const [homeColor, awayColor] = resolveColors(rawHomeColor, rawAwayColor);
  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
          <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Prediction</h2>
          <p className="text-xs text-text-tertiary mt-0.5">Win probability based on season performance</p>
        </div>
      </div>

      {/* Content card */}
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="space-y-5 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-white/[0.06] rounded-full flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1.5">
                      <div className="h-3.5 w-16 bg-white/[0.06] rounded-full" />
                      <div className="h-3.5 w-8 bg-white/[0.04] rounded-full" />
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full" />
                  </div>
                </div>
              ))}
              <div className="border-t border-white/[0.06] pt-5 space-y-2.5">
                {[0.6, 0.8, 0.5].map((w, i) => (
                  <div key={i} className="flex gap-2.5 items-center">
                    <div className="w-1.5 h-1.5 bg-white/[0.06] rounded-full flex-shrink-0" />
                    <div className="h-3 bg-white/[0.05] rounded-full" style={{ width: `${w * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
          ) : prediction ? (
            <>
              {/* Probability bars */}
              <div className="space-y-4">
                <ProbabilityBar
                  team={prediction.homeTeam}
                  isFavored={prediction.homeTeam.winProbability >= prediction.awayTeam.winProbability}
                  isHome
                  color={homeColor}
                />
                <ProbabilityBar
                  team={prediction.awayTeam}
                  isFavored={prediction.awayTeam.winProbability > prediction.homeTeam.winProbability}
                  isHome={false}
                  color={awayColor}
                />
              </div>

              {/* Key factors */}
              {prediction.keyFactors?.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/[0.06]">
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary mb-3">Key Factors</p>
                  <ul className="space-y-2.5">
                    {prediction.keyFactors.map((factor, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: homeColor }} />
                        <span className="text-sm text-text-secondary">{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>

        {!loading && prediction && (
          <div className="px-6 sm:px-8 py-3 bg-surface-base/40 border-t border-white/[0.05]">
            <p className="text-[11px] text-text-tertiary">
              {prediction.confidence === "low"
                ? "Limited data — fewer than 5 games played"
                : "Basic model"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
