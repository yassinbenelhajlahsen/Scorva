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

export default function PlayerStatusBadge({ status, title }) {
  const key = status ?? "available";
  const label = STATUS_LABELS[key];
  const tone = STATUS_TONE[key];
  if (!label || !tone) return null;

  return (
    <div
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      <span className="uppercase tracking-wider">{label}</span>
    </div>
  );
}
