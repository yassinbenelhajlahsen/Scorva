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
    label: "text-win",
    ring: "ring-win/25",
    bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(52,199,89,0.24)_0%,rgba(10,12,16,0.94)_55%)]",
    glow: "shadow-[0_0_22px_-6px_rgba(52,199,89,0.5),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
  },
  amber: {
    label: "text-amber-400",
    ring: "ring-amber-500/25",
    bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(245,158,11,0.26)_0%,rgba(10,12,16,0.94)_55%)]",
    glow: "shadow-[0_0_22px_-6px_rgba(245,158,11,0.5),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
  },
  red: {
    label: "text-loss",
    ring: "ring-loss/25",
    bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(255,69,58,0.26)_0%,rgba(10,12,16,0.94)_55%)]",
    glow: "shadow-[0_0_22px_-6px_rgba(255,69,58,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
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
        className={`self-stretch w-[3px] rounded-full bg-gradient-to-b`}
      />
      <span
        className={`uppercase tracking-[0.16em] font-semibold ${tone.label}`}
      >
        {label}
      </span>
    </div>
  );
}
