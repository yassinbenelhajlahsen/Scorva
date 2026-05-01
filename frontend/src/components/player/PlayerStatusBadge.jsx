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

const TONES = {
  green: {
    bar: "from-[#86efac] via-[#34c759] to-[#15803d]",
    label: "text-win",
    ring: "ring-win/25",
    bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(52,199,89,0.24)_0%,rgba(10,12,16,0.94)_55%)]",
    glow: "shadow-[0_0_22px_-6px_rgba(52,199,89,0.5),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    dot: "bg-win",
  },
  amber: {
    bar: "from-[#fcd34d] via-[#f59e0b] to-[#92400e]",
    label: "text-amber-400",
    ring: "ring-amber-500/25",
    bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(245,158,11,0.26)_0%,rgba(10,12,16,0.94)_55%)]",
    glow: "shadow-[0_0_22px_-6px_rgba(245,158,11,0.5),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    dot: "bg-amber-400",
  },
  red: {
    bar: "from-[#fca5a5] via-[#ff453a] to-[#7f1d1d]",
    label: "text-loss",
    ring: "ring-loss/25",
    bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(255,69,58,0.26)_0%,rgba(10,12,16,0.94)_55%)]",
    glow: "shadow-[0_0_22px_-6px_rgba(255,69,58,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
    dot: "bg-loss",
  },
};

const STATUS_TONE = {
  available: TONES.green,
  active: TONES.green,
  "day-to-day": TONES.amber,
  questionable: TONES.amber,
  doubtful: TONES.amber,
  out: TONES.red,
  ir: TONES.red,
  suspended: TONES.red,
};

export default function PlayerStatusBadge({ status, title, size = "md" }) {
  const key = status ?? "available";
  const label = STATUS_LABELS[key];
  const tone = STATUS_TONE[key];
  if (!label || !tone) return null;
  const isSm = size === "sm";

  const sizeClasses = isSm
    ? "text-[10px] gap-1.5 pr-2.5 py-1"
    : "text-[11px] gap-2 pr-3 py-1.5";

  return (
    <div
      title={title}
      className={`relative inline-flex items-center isolate rounded-tl-[14px] rounded-br-[14px] rounded-tr-[3px] rounded-bl-[3px] backdrop-blur-sm ring-1 ${tone.ring} ${tone.bg} ${tone.glow} ${sizeClasses}`}
    >
      <span
        aria-hidden
        className={`self-stretch w-[3px] my-1 ml-1.5 mr-1.5 rounded-full bg-gradient-to-b ${tone.bar}`}
      />
      <span
        className={`uppercase tracking-[0.16em] font-semibold ${tone.label}`}
      >
        {label}
      </span>
      <span aria-hidden className="relative inline-flex w-1.5 h-1.5 ml-0.5">
        <span
          className={`absolute inset-0 rounded-full ${tone.dot} animate-ping opacity-60`}
        />
        <span
          className={`relative inline-flex w-1.5 h-1.5 rounded-full ${tone.dot}`}
        />
      </span>
    </div>
  );
}
