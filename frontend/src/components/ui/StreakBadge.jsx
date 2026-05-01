export default function StreakBadge({ streak, size = "md" }) {
  if (!streak) return null;
  const { length, statLabel, subjectType } = streak;
  const isLoss = subjectType === "team" && statLabel === "loss";
  const emoji = isLoss ? "❄️" : "🔥";
  const isSm = size === "sm";

  const tone = isLoss
    ? {
        bar: "from-[#9ed4ff] via-[#3a8fdc] to-[#1d4f9e]",
        num: "text-[#dceeff]",
        label: "text-[#9cc8f0]",
        ring: "ring-[#3a8fdc]/25",
        bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(58,143,220,0.28)_0%,rgba(10,12,16,0.94)_55%)]",
        glow: "shadow-[0_0_24px_-6px_rgba(58,143,220,0.55),inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        dot: "bg-[#7cc1ff]",
      }
    : {
        bar: "from-[#ffd089] via-[#ff7a18] to-[#c43108]",
        num: "text-[#ffe7c6]",
        label: "text-[#f0b478]",
        ring: "ring-[#ff7a18]/25",
        bg: "bg-[radial-gradient(130%_160%_at_0%_50%,rgba(255,122,24,0.28)_0%,rgba(10,12,16,0.94)_55%)]",
        glow: "shadow-[0_0_24px_-6px_rgba(255,122,24,0.55),inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        dot: "bg-[#ffa84d]",
      };

  const sizeClasses = isSm
    ? "text-[10px] gap-1.5 pr-2.5 py-1"
    : "text-[11px] gap-2 pr-3 py-1.5";

  const numClass = isSm ? "text-base" : "text-xl";

  return (
    <div
      className={`relative inline-flex items-center isolate rounded-tl-[14px] rounded-br-[14px] rounded-tr-[3px] rounded-bl-[3px] backdrop-blur-sm ring-1 ${tone.ring} ${tone.bg} ${tone.glow} ${sizeClasses}`}
    >
      <span
        aria-hidden
        className={`self-stretch w-[3px] my-1 ml-1.5 mr-1 rounded-full bg-gradient-to-b ${tone.bar}`}
      />
      <span
        className={`font-black tabular-nums leading-none tracking-tight ${tone.num} ${numClass}`}
      >
        {length}
      </span>
      <span aria-hidden className="leading-none -mt-0.5">
        {emoji}
      </span>
      <span
        className={`uppercase tracking-[0.16em] font-semibold ${tone.label}`}
      >
        {statLabel} streak
      </span>
      <span aria-hidden className="relative inline-flex w-1.5 h-1.5 ml-0.5">
        <span
          className={`absolute inset-0 rounded-full ${tone.dot} animate-ping opacity-60`}
        />
        <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      </span>
      <span className="sr-only">
        {length}-game {statLabel} streak
      </span>
    </div>
  );
}
