import { RowChrome } from "./RowChrome.jsx";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { relativeTime } from "../../utils/relativeTime.js";
import teamUrl from "../../utils/teamUrl.js";

function TeamLogo({ team }) {
  if (team?.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt={team.name}
        className="w-9 h-9 rounded-full object-contain bg-surface-overlay/40 ring-1 ring-white/[0.06] shrink-0"
        loading="lazy"
      />
    );
  }
  const initials = (team?.abbreviation || team?.shortname || team?.name || "?")
    .slice(0, 3)
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-surface-overlay/40 ring-1 ring-white/[0.06] flex items-center justify-center text-[10px] font-semibold text-text-tertiary shrink-0">
      {initials}
    </div>
  );
}

export default function StreakReportRow({ report }) {
  const { streakLength, statLabel, emoji, date } = report;

  if (report.team) {
    const team = report.team;
    return (
      <RowChrome to={teamUrl(team.league, team)}>
        <TeamLogo team={team} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">{team.name}</div>
          <div className="text-[13px] text-text-secondary mt-0.5">
            {streakLength}-game {statLabel} streak {emoji && <span aria-hidden>{emoji}</span>}
          </div>
        </div>
        <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
      </RowChrome>
    );
  }

  const player = report.player;
  const playerHref = `/${player.league}/players/${player.slug}`;
  return (
    <RowChrome to={playerHref}>
      <PlayerAvatar player={player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">{player.name}</div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          {streakLength}-game {statLabel} streak {emoji && <span aria-hidden>{emoji}</span>}
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </RowChrome>
  );
}
