export default function StreakBadge({ streak, size = "md" }) {
  if (!streak) return null;
  const { length, statLabel, subjectType } = streak;
  const isLoss = subjectType === "team" && statLabel === "loss";
  const emoji = isLoss ? "❄️" : "🔥";
  const tone = isLoss
    ? "bg-loss/15 text-loss border-loss/30"
    : "bg-accent/15 text-accent border-accent/30";
  const sizeClasses = size === "sm"
    ? "gap-1.5 px-2 py-0.5 text-[10px]"
    : "gap-2 px-3 py-1 text-xs";
  return (
    <div
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClasses} ${tone}`}
    >
      <span aria-hidden>{emoji}</span>
      <span className="uppercase tracking-wider">
        {length}-game {statLabel} streak
      </span>
    </div>
  );
}
