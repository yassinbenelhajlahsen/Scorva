import { Link } from "react-router-dom";
import slugify from "../../HelperFunctions/slugify.js";

const statFormatMap = {
  nba: (stats) => [
    stats.PTS && `${stats.PTS} PTS`,
    stats.REB && `${stats.REB} REB`,
    stats.AST && `${stats.AST} AST`,
  ].filter(Boolean),

  nfl: (stats) => [
    stats.YDS && `${stats.YDS} YDS`,
    stats.TD && `${stats.TD} TD`,
    stats.SCKS && `${stats.SCKS} SCK`,
    stats.INT && `${stats.INT} INT`,
  ].filter(Boolean),

  nhl: (stats) => [
    stats.G && `${stats.G} G`,
    stats.A && `${stats.A} A`,
    stats.SAVES && `${stats.SAVES} SAVES`,
    stats.HT && `${stats.HT} HIT`,
    stats.BS && `${stats.BS} BLK`,
  ].filter(Boolean),
};


export default function TopPerformerCard({ player, title = "Top Performer", league }) {
  if (!player) return null;

  const { name, position, imageUrl, stats } = player;
  const currentLeague = league;
  const path = `/${currentLeague}/players/${slugify(name)}`;

  const formattedStats = statFormatMap[currentLeague]?.(stats) || [];
  return (
    <Link
      to={path}
      className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-xl shadow transition w-full hover:scale-105"
    >
      <img
        src={imageUrl || "/defaultPhoto.png"}
        alt={name}
        className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-full"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/defaultPhoto.png";
        }}
      />
      <div className="flex-1">
        <div className="text-sm text-gray-400 uppercase tracking-wide">{title}</div>
        <div className="text-lg font-bold text-orange-400 group-hover:underline">{name}</div>
        <div className="text-sm text-gray-300">{position}</div>
        <div className="mt-1 text-sm text-gray-200">
          {formattedStats.join(" • ")}
        </div>
      </div>
    </Link>
  );
}
