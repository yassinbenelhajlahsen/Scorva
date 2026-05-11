const TIER_TONE = {
  Elite:   "text-accent",
  Great:   "text-accent/90",
  Solid:   "text-text-secondary",
  Routine: "text-text-tertiary",
  Close:   "text-live",
};

export default function GameRatingCard({ rating, homeTeam, awayTeam }) {
  if (!rating || rating.grade == null) return null;
  const tone = TIER_TONE[rating.tierLabel] ?? "text-text-secondary";
  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-wider text-text-tertiary">Game Rating</span>
        <span className={`text-sm font-semibold ${tone}`}>{rating.tierLabel}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-3xl font-bold tabular-nums ${rating.grade < 0 ? "text-loss" : "text-text-primary"}`} aria-label={`Game grade ${rating.grade.toFixed(1)} out of 10`}>
          <span className="text-accent mr-1" aria-hidden="true">★</span>
          {rating.grade.toFixed(1)}
        </span>
        <span className="text-xs text-text-tertiary">/ 10</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TeamChip abbr={homeTeam?.abbr} grade={rating.home?.grade} primary={homeTeam?.primary_color} />
        <TeamChip abbr={awayTeam?.abbr} grade={rating.away?.grade} primary={awayTeam?.primary_color} />
      </div>
    </div>
  );
}

function TeamChip({ abbr, grade, primary }) {
  if (grade == null) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-primary border border-white/[0.06]">
        <span className="text-sm font-semibold text-text-primary">{abbr ?? "—"}</span>
        <span className="text-sm text-text-tertiary">—</span>
      </div>
    );
  }
  const negative = grade < 0;
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-primary border border-white/[0.06]"
      style={primary ? { boxShadow: `inset 3px 0 0 ${primary}` } : undefined}
    >
      <span className="text-sm font-semibold text-text-primary">{abbr ?? "—"}</span>
      <span className={`text-sm font-bold tabular-nums ${negative ? "text-loss" : "text-accent"}`}>
        <span aria-hidden="true">★</span> {grade.toFixed(1)}
      </span>
    </div>
  );
}
