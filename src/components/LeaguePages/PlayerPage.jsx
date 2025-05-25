import { useParams } from "react-router-dom";
import nbaPlayers from "../../mock/mockNbaData/nbaPlayers.js";
import nflPlayers from "../../mock/mockNflData/nflPlayers.js";
import nhlPlayers from "../../mock/mockNhlData/nhlPlayers.js";
import { Link } from "react-router-dom";

const slugify = (name) => name.toLowerCase().replace(/\s+/g, "-");

export default function PlayerPage() {
  const { league, playerId } = useParams();

  let players = [];

  if (league === "nba") players = nbaPlayers;
  else if (league === "nfl") players = nflPlayers;
  else if (league === "nhl") players = nhlPlayers;

  const player = players.find((p) => slugify(p.name) === playerId);

  if (!player)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold">Player not found</h1>
        <Link
          to="/"
          className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
        >
          Return to Home
        </Link>
      </div>
    );
  return (
    <div className="text-white p-8">
      <h1 className="text-4xl font-bold mb-4">{player.name}</h1>
      <img
        src={player.image || "/images/placeholder.png"}
        alt={player.name}
        className="w-40 h-40 object-cover rounded-full mb-4"
      />
      <p>Position: {player.position}</p>

      <Link
        to={`/${league}/teams/${slugify(player.team)}`}
        className="hover:text-orange-400 transition"
      >
        <p>Team: {player.team}</p>
      </Link>
      <p>Height: {player.height}</p>
    </div>
  );
}
