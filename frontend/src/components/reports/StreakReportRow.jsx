import { Link } from "react-router-dom";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { relativeTime } from "../../utils/relativeTime.js";

function teamHref(team) {
  const slug = team.abbreviation || team.shortname || team.name;
  return `/${team.league}/teams/${slug}`;
}

function TeamLogo({ team }) {
  if (team?.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt={team.name}
        className="w-9 h-9 rounded-full object-contain bg-surface-overlay border border-white/[0.08] shrink-0"
        loading="lazy"
      />
    );
  }
  const initials = (team?.abbreviation || team?.shortname || team?.name || "?")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-surface-overlay border border-white/[0.08] flex items-center justify-center text-[10px] font-semibold text-text-tertiary shrink-0">
      {initials}
    </div>
  );
}

export default function StreakReportRow({ report }) {
  const { streakLength, statLabel, emoji, date } = report;

  if (report.team) {
    const team = report.team;
    return (
      <Link
        to={teamHref(team)}
        className="flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay transition-colors duration-200"
      >
        <TeamLogo team={team} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">{team.name}</div>
          <div className="text-[13px] text-text-secondary mt-0.5">
            {streakLength}-game {statLabel} streak {emoji && <span aria-hidden>{emoji}</span>}
          </div>
        </div>
        <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
      </Link>
    );
  }

  const player = report.player;
  const playerHref = `/${player.league}/players/${player.slug}`;
  return (
    <Link
      to={playerHref}
      className="flex items-start gap-3 px-3.5 py-3 hover:bg-surface-overlay transition-colors duration-200"
    >
      <PlayerAvatar player={player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{player.name}</div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          {streakLength}-game {statLabel} streak {emoji && <span aria-hidden>{emoji}</span>}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </Link>
  );
}
