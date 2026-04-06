import { Fragment } from "react";
import formatDate, { formatDateWithTime } from "../../utils/formatDate.js";

export default function GameInfoCard({ game, isFinal, inProgress }) {
  const rows = [
    {
      label: "Date",
      value:
        game.startTime && !isFinal && !inProgress
          ? formatDateWithTime(game.date, game.startTime)
          : formatDate(game.date),
    },
    { label: "Status", value: game.status },
    { label: "Location", value: game.venue },
    ...(game.broadcast ? [{ label: "Broadcast", value: game.broadcast }] : []),
  ];

  return (
    <div className="mb-6">
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-3">
        {rows.map(({ label, value }, i) => (
          <Fragment key={label}>
            {i > 0 && <div className="border-t border-white/[0.06]" />}
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs uppercase tracking-wider text-text-tertiary shrink-0">
                {label}
              </span>
              <span className="text-sm font-medium text-text-primary text-right">
                {value}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
