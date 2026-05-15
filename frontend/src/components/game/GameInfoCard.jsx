import formatDate, { formatDateWithTime } from "../../utils/formatDate.js";
import { displayStartTime } from "../../utils/slateDate.js";

export default function GameInfoCard({ game, isFinal, inProgress }) {
  const rows = [
    {
      label: "Date",
      value:
        game.startTime && !isFinal && !inProgress
          ? formatDateWithTime(game.date, displayStartTime(game.startTime))
          : formatDate(game.date),
    },
    { label: "Status", value: game.status },
    { label: "Location", value: game.venue },
    ...(game.broadcast ? [{ label: "Broadcast", value: game.broadcast }] : []),
  ];

  return (
    <div className="relative pl-4 mb-6">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/40 rounded-full" />
      <div className="flex flex-col">
        {rows.map(({ label, value }, i) => (
          <div key={label} className={`flex items-center justify-between gap-4 py-3 ${i < rows.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-semibold shrink-0">{label}</span>
            <span className="text-sm font-medium text-text-primary text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
