const STATUS_LABELS = {
  available: "Available",
  active: "Active",
  "day-to-day": "Day-to-Day",
  questionable: "Questionable",
  doubtful: "Doubtful",
  out: "Out",
  ir: "Injured Reserve",
  suspended: "Suspended",
};

const STATUS_TONE = {
  available: { pill: "bg-win/15 text-win border-win/30", dot: "bg-win" },
  active: { pill: "bg-win/15 text-win border-win/30", dot: "bg-win" },
  "day-to-day": { pill: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  questionable: { pill: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  doubtful: { pill: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  out: { pill: "bg-loss/15 text-loss border-loss/30", dot: "bg-loss" },
  ir: { pill: "bg-loss/15 text-loss border-loss/30", dot: "bg-loss" },
  suspended: { pill: "bg-loss/15 text-loss border-loss/30", dot: "bg-loss" },
};

export default function PlayerStatusBadge({ status, title, size = "md" }) {
  const key = status ?? "available";
  const label = STATUS_LABELS[key];
  const tone = STATUS_TONE[key];
  if (!label || !tone) return null;

  const sizeClasses = size === "sm"
    ? "gap-1.5 px-2 py-0.5 text-[10px]"
    : "gap-2 px-3 py-1 text-xs";
  const dotSize = size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5";

  return (
    <div
      title={title}
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClasses} ${tone.pill}`}
    >
      <span className={`${dotSize} rounded-full ${tone.dot}`} />
      <span className="uppercase tracking-wider">{label}</span>
    </div>
  );
}
