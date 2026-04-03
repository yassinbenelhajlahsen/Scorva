import { memo } from "react";
import { Link } from "react-router-dom";
import slugify from "../../utils/slugify.js";

const colorMap = {
  "Top Performer": "#e8863a",
  "Top Scorer":    "#4f8eff",
  "Impact Player": "#34c759",
};

const statFormatMap = {
  nba: (stats) =>
    [
      stats.PTS  && { label: "PTS", value: stats.PTS },
      stats.REB  && { label: "REB", value: stats.REB },
      stats.AST  && { label: "AST", value: stats.AST },
    ].filter(Boolean),

  nfl: (stats) =>
    [
      stats.YDS  && { label: "YDS",  value: stats.YDS },
      stats.TD   && { label: "TD",   value: stats.TD },
      stats.SCKS && { label: "SCK",  value: stats.SCKS },
      stats.INT  && { label: "INT",  value: stats.INT },
    ].filter(Boolean),

  nhl: (stats) =>
    [
      stats.G     && { label: "G",   value: stats.G },
      stats.A     && { label: "A",   value: stats.A },
      stats.SAVES && { label: "SV",  value: stats.SAVES },
      stats.HT    && { label: "HIT", value: stats.HT },
      stats.BS    && { label: "BLK", value: stats.BS },
    ].filter(Boolean),
};

function TopPerformerCard({ player, title = "Top Performer", league }) {
  if (!player) return null;

  const { name, position, imageUrl, stats } = player;
  const path = `/${league}/players/${slugify(name)}`;
  const formattedStats = statFormatMap[league]?.(stats) || [];
  const color = colorMap[title] ?? "#e8863a";

  return (
    <Link
      to={path}
      className="group flex items-stretch bg-surface-elevated border border-white/[0.08] rounded-2xl h-[108px] overflow-hidden transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 w-full"
    >
      {/* Left zone — gradient slab */}
      <div
        className="w-[88px] shrink-0 flex flex-col items-center justify-center gap-1.5 px-2"
        style={{
          background: `linear-gradient(150deg, ${color}1f 0%, ${color}0a 100%)`,
          borderRight: `1px solid ${color}26`,
        }}
      >
        <img
          loading="lazy"
          src={imageUrl || "/defaultPhoto.webp"}
          alt={name}
          className="w-12 h-12 object-cover rounded-full ring-2 flex-shrink-0"
          style={{ ringColor: `${color}40` , boxShadow: `0 0 0 2px ${color}33` }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/defaultPhoto.webp";
          }}
        />
        <span
          className="text-[9px] uppercase tracking-widest font-semibold text-center leading-tight"
          style={{ color }}
        >
          {title}
        </span>
      </div>

      {/* Right zone — info */}
      <div className="flex-1 flex flex-col justify-between px-3.5 py-3 min-w-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors duration-200 truncate">
            {name}
          </div>
          <div className="text-xs text-text-tertiary mt-0.5 truncate">{position}</div>
        </div>

        {/* Stat blocks */}
        {formattedStats.length > 0 && (
          <div className="flex items-end gap-3.5">
            {formattedStats.slice(0, 4).map(({ label, value }) => (
              <div key={label} className="flex flex-col items-start">
                <span className="text-sm font-bold text-text-primary tabular-nums leading-none">
                  {value}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-0.5">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default memo(TopPerformerCard, (prev, next) => {
  return prev.player?.name === next.player?.name &&
    prev.title === next.title &&
    prev.league === next.league;
});
