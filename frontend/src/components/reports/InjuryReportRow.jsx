import { RowChrome } from "./RowChrome.jsx";
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

const STATUS_LABEL = {
  ir: "Injured Reserve",
};

function StatusPill({ status, label }) {
  if (!status) return <span className="text-win">Active</span>;
  const display = label || STATUS_LABEL[status] || status;
  const baseCls = STATUS_CLASS[status] ?? "text-text-secondary";
  const cls = STATUS_LABEL[status] ? baseCls : `${baseCls} capitalize`;
  return <span className={cls}>{display}</span>;
}

export default function InjuryReportRow({ report }) {
  const { player, prevStatus, newStatus, newStatusDescription, date } = report;
  const playerHref = `/${player.league}/players/${player.slug}`;

  return (
    <RowChrome to={playerHref}>
      <PlayerAvatar player={player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">
          {player.name}
        </div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          {prevStatus === newStatus ? (
            <StatusPill status={newStatus} />
          ) : (
            <>
              <StatusPill status={prevStatus} /> <span className="text-text-tertiary mx-1">→</span> <StatusPill status={newStatus} />
            </>
          )}
          {newStatusDescription && (
            <span className="text-text-tertiary"> · {newStatusDescription}</span>
          )}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </RowChrome>
  );
}
