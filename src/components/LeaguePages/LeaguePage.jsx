import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";

import nbaGames from "../../mock/mockNbaData/nbaGames";
import nflGames from "../../mock/mockNflData/nflGames";
import nhlGames from "../../mock/mockNhlData/nhlGames";

import nbaLogo from "../../assets/NBAlogo.png";
import nflLogo from "../../assets/NFLlogo.png";
import nhlLogo from "../../assets/NHLlogo.png";

import GameCard from "../GameCard";

const leagueData = {
  nba: {
    logo: nbaLogo,
    games: nbaGames,
    links: [
      { label: "Players", to: "/nba/players" },
      { label: "Teams", to: "/nba/teams" },
    ],
  },
  nfl: {
    logo: nflLogo,
    games: nflGames,
    links: [
      { label: "Players", to: "/nfl/players" },
      { label: "Teams", to: "/nfl/teams" },
    ],
  },
  nhl: {
    logo: nhlLogo,
    games: nhlGames,
    links: [
      { label: "Players", to: "/nhl/players" },
      { label: "Teams", to: "/nhl/teams" },
    ],
  },
};

export default function LeaguePage() {
  const { league } = useParams();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const data = leagueData[league?.toLowerCase()];

  useEffect(() => {
    setLoading(true);
    try {
      const gameList = data?.games || [];
      setGames(gameList.slice(0, 15));
      setLoading(false);
    } catch {
      setError("Failed to load games.");
      setLoading(false);
    }
  }, [league]);

  if (!data) {
    return <div className="text-red-500 p-6">Invalid league: {league}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-6 mb-4 ml-4">
        <img
          src={data.logo}
          alt={`${league} logo`}
          className="w-20 h-20 object-contain"
        />
        <h1 className="text-6xl font-bold text-left uppercase">{league}</h1>
      </div>

      <div className="flex flex-row items-center gap-8 justify-center">
        {data.links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center justify-center text-3xl sm:text-4xl border border-zinc-700 bg-zinc-800 py-8 rounded-lg shadow transition-transform duration-200 hover:scale-105 cursor-pointer w-full max-w-xl"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <>
        <h2 className="text-4xl font-bold text-center mt-20 mb-20">Games</h2>
        {loading && <div className="p-6">Loading featured games...</div>}
        {error && <div className="p-6 text-red-500">{error}</div>}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
          {games.map((game) => (
            <div key={game.id} className="w-full max-w-md">
              <GameCard game={game} />
            </div>
          ))}
        </div>
      </>
    </div>
  );
}
