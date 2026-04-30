import { Link, useNavigate } from "react-router-dom";
import PlayerAvatar from "./PlayerAvatar.jsx";
import NRBadge from "./NRBadge.jsx";
import { relativeTime } from "../../utils/relativeTime.js";

const ACTION_LABEL = { sign: "Signed", waive: "Waived", trade: "Traded" };

function TeamBadge({ team, league, navigate }) {
  if (!team) return <NRBadge />;
  const href = `/${league}/teams/${(team.abbreviation || "").toLowerCase()}`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        navigate(href);
      }}
      aria-label={`View ${team.name}`}
      className="shrink-0"
    >
      <img
        src={team.logoUrl}
        alt={team.name}
        className="w-6 h-6 rounded-full object-contain bg-surface-overlay border border-white/[0.08]"
        loading="lazy"
      />
    </button>
  );
}

export default function MoveReportRow({ report }) {
  const { player, action, fromTeam, toTeam, league, date } = report;
  const playerHref = `/${player.league}/players/${player.slug}`;
  const navigate = useNavigate();

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
        <div className="flex items-center gap-2 mt-1">
          <TeamBadge team={fromTeam} league={league} navigate={navigate} />
          <span className="text-text-tertiary text-xs">→</span>
          <TeamBadge team={toTeam} league={league} navigate={navigate} />
          <span className="text-[11px] uppercase tracking-wider text-text-tertiary ml-1">
            {ACTION_LABEL[action] ?? action}
          </span>
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </Link>
  );
}
