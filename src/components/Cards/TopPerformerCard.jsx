import { Link } from "react-router-dom";
import slugify from "../../HelperFunctions/slugify.js";
import getLeague from "../../HelperFunctions/getLeagueFromTeam.js";

const statFormatMap = {
  nba: (stats) => [
    stats.points && `${stats.points} PTS`,
    stats.rebounds && `${stats.rebounds} REB`,
    stats.assists && `${stats.assists} AST`,

  ].filter(Boolean),

  nfl: (stats) => [
    stats.yards && `${stats.yards} YDS`,
    stats.touchdowns && `${stats.touchdowns} TD`,
    stats.tackles && `${stats.tackles} TKL`,
    stats.interceptions && `${stats.interceptions} INT`,
  ].filter(Boolean),

  nhl: (stats) => [
    stats.goals && `${stats.goals} G`,
    stats.assists && `${stats.assists} A`,
    stats.points && `${stats.points} P`,
    stats.hits && `${stats.hits} HIT`,
    stats.blocks && `${stats.blocks} BLK`,
  ].filter(Boolean),
};

export default function TopPerformerCard({ player, title = "Top Performer", league }) {
  if (!player) return null;

  const { name, position, image, stats } = player;
  const currentLeague = league || getLeague(player.team);
  const path = `/${currentLeague}/players/${slugify(name)}`;

  const formattedStats = statFormatMap[currentLeague]?.(stats) || [];
  return (
    <Link
      to={path}
      className="group flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-xl shadow transition w-full hover:scale-105"
    >
      <img
        src={image || "/defaultPhoto.png"}
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
