import { Link } from "react-router-dom";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { relativeTime } from "../../utils/relativeTime.js";

const STATUS_CLASS = {
  active: "text-win",
  questionable: "text-accent",
  doubtful: "text-accent",
  out: "text-loss",
  ir: "text-loss",
  suspended: "text-loss",
  "day-to-day": "text-accent",
};

function StatusPill({ status, label }) {
  if (!status) return <span className="text-text-tertiary">Active</span>;
  const cls = `${STATUS_CLASS[status] ?? "text-text-secondary"} capitalize`;
  return <span className={cls}>{label || status}</span>;
}

export default function InjuryReportRow({ report }) {
  const { player, prevStatus, newStatus, newStatusDescription, date } = report;
  const playerHref = `/${player.league}/players/${player.slug}`;

  return (
    <Link
      to={playerHref}
      className="flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay transition-colors duration-200"
    >
      <PlayerAvatar player={player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">
          {player.name}
        </div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          <StatusPill status={prevStatus} /> <span className="text-text-tertiary mx-1">→</span> <StatusPill status={newStatus} />
          {newStatusDescription && (
            <span className="text-text-tertiary"> · {newStatusDescription}</span>
          )}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </Link>
  );
}
