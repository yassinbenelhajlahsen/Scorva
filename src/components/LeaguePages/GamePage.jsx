import { useParams } from "react-router-dom";
import nbaGames from "../../mock/mockNbaData/nbaGames.js";
import nflGames from "../../mock/mockNflData/nflGames";
import nhlGames from "../../mock/mockNhlData/nhlGames";

const leagueMap = {
  nba: nbaGames,
  nfl: nflGames,
  nhl: nhlGames,
};

export default function GamePage() {
  const { league, gameId } = useParams();

  const games = leagueMap[league.toLowerCase()] || [];
  const game = games.find((g) => String(g.id) === String(gameId));

  if (!game) return <div className="text-white">Game not found</div>;

  return (
    <div className="text-white p-6">
      <h2 className="text-3xl font-bold mb-2">
        {game.homeTeam} vs {game.awayTeam}
      </h2>
      <p className="text-lg">Date: {game.date}</p>
      <p className="text-lg">Status: {game.status}</p>

    </div>
  );
}
