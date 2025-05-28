import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";

import nbaPlayers from "../../mock/mockNbaData/nbaPlayers";
import nflPlayers from "../../mock/mockNflData/nflPlayers";
import nhlPlayers from "../../mock/mockNhlData/nhlPlayers";
import LoadingPage from "../LoadingPage.jsx"


import PlayerCard from "../Cards/PlayerCard";

const leagueData = {
  nba: {
    logo: "/NBAlogo.png",
    players: nbaPlayers,
  },
  nfl: {
    logo: "/NFLlogo.png",
    players: nflPlayers,
  },
  nhl: {
    logo: "/NHLlogo.png",
    players: nhlPlayers,
  },
};



export default function PlayerListPage() {
  const { league } = useParams();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const data = leagueData[league?.toLowerCase()];

  useEffect(() => {
    setLoading(true);
    try {
      const playerList = data?.players || [];
      setPlayers(playerList.slice(0, 32));
      setLoading(false);
    } catch {
      setError("Failed to load players.");
      setLoading(false);
    }
  }, [league]);

  if (!data) {
    return <div className="text-red-500 p-6">Invalid league: {league}</div>;
  }

   if (loading) return <LoadingPage />;
      if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <>
    <Link
                  to={`/${league}`}
                  className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 ml-6 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
                >
                  Return to {league.toUpperCase()}
                </Link>
    <div className="p-6">
      <div className="flex items-center gap-6 mb-8">
        <img
          src={data.logo}
          alt={`${league} logo`}
          className="w-20 h-20 object-contain"
        />
      
        <h1 className="text-5xl font-bold capitalize">{league.toUpperCase()} Players</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {players.map((player) => (
          <PlayerCard
            key={player.name}
            player={player}
            players={players}
            league={league}
          />
        ))}
      </div>
    </div>
    </>
  );
}
