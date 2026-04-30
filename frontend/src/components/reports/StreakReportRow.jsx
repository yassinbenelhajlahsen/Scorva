import { Link } from "react-router-dom";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { relativeTime } from "../../utils/relativeTime.js";

export default function StreakReportRow({ report }) {
  const { player, streakLength, statLabel, emoji, date } = report;
  const playerHref = `/${player.league}/players/${player.slug}`;

  return (
    <div className="flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay transition-colors duration-200">
      <Link to={playerHref}><PlayerAvatar player={player} /></Link>
      <div className="flex-1 min-w-0">
        <Link to={playerHref} className="text-sm font-semibold text-text-primary hover:text-accent">
          {player.name}
        </Link>
        <div className="text-[13px] text-text-secondary mt-0.5">
          {streakLength}-game {statLabel} streak {emoji && <span aria-hidden>{emoji}</span>}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </div>
  );
}
