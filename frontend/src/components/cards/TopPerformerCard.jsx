import { Link } from "react-router-dom";
import slugify from "../../utilities/slugify.js";

const statFormatMap = {
  nba: (stats) =>
    [
      stats.PTS && `${stats.PTS} PTS`,
      stats.REB && `${stats.REB} REB`,
      stats.AST && `${stats.AST} AST`,
    ].filter(Boolean),

  nfl: (stats) =>
    [
      stats.YDS  && `${stats.YDS} YDS`,
      stats.TD   && `${stats.TD} TD`,
      stats.SCKS && `${stats.SCKS} SCK`,
      stats.INT  && `${stats.INT} INT`,
    ].filter(Boolean),

  nhl: (stats) =>
    [
      stats.G     && `${stats.G} G`,
      stats.A     && `${stats.A} A`,
      stats.SAVES && `${stats.SAVES} SV`,
      stats.HT    && `${stats.HT} HIT`,
      stats.BS    && `${stats.BS} BLK`,
    ].filter(Boolean),
};

export default function TopPerformerCard({ player, title = "Top Performer", league }) {
  if (!player) return null;

  const { name, position, imageUrl, stats } = player;
  const path = `/${league}/players/${slugify(name)}`;
  const formattedStats = statFormatMap[league]?.(stats) || [];

  return (
    <Link
      to={path}
      className="group flex items-center gap-4 bg-surface-elevated border border-white/[0.08] p-4 rounded-2xl transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 w-full"
    >
      <img
        src={imageUrl || "/defaultPhoto.webp"}
        alt={name}
        className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-full flex-shrink-0 ring-2 ring-white/[0.06]"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/defaultPhoto.webp";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{title}</div>
        <div className="text-sm font-semibold text-accent group-hover:text-accent-hover transition-colors duration-200 truncate mt-0.5">
          {name}
        </div>
        <div className="text-xs text-text-secondary mt-0.5">{position}</div>
        <div className="mt-1 text-xs text-text-tertiary">
          {formattedStats.join("  ·  ")}
        </div>
      </div>
    </Link>
  );
}
