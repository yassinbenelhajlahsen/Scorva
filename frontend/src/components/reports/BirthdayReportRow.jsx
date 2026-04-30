import { Link } from "react-router-dom";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { relativeTime } from "../../utils/relativeTime.js";

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function BirthdayReportRow({ report }) {
  const { player, age, date } = report;
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
          Happy {ordinal(age)} Birthday <span aria-hidden>🎉</span>
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </Link>
  );
}
