export default function GameRatingPill({ grade, className = "" }) {
  if (grade == null) return null;
  const negative = grade < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-base/60 backdrop-blur-sm border border-white/[0.1] text-[10px] font-semibold tabular-nums ${negative ? "text-loss" : "text-accent"} ${className}`}
      aria-label={`Game rating ${grade.toFixed(1)} out of 10`}
    >
      <span aria-hidden="true">★</span>
      {grade.toFixed(1)}
    </span>
  );
}
