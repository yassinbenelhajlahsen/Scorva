import { Link } from "react-router-dom";
import nbaGames from "../mock/mockNbaData/nbaGames.js";
import nflGames from "../mock/mockNflData/nflGames.js";
import nhlGames from "../mock/mockNhlData/nhlGames.js";
import { useState, useEffect } from "react";
import GameCard from "./Cards/GameCard.jsx";
import LoadingPage from "./LoadingPage.jsx";

function getFeaturedGames(games, count = 5) {
  //const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" //TODO: Fix this to get the current date
  const today = "2025-05-22"; // For testing purposes, set a fixed date
  const todayGames = games.filter((g) => g.date === today);
  let featured = [...todayGames];

  if (featured.length < count) {
    // Get future games, sorted by date
    const futureGames = games
      .filter((g) => g.date > today)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; featured.length < count && i < futureGames.length; i++) {
      featured.push(futureGames[i]);
    }
  }

  // If still less than count, add recent past games
  if (featured.length < count) {
    const pastGames = games
      .filter((g) => g.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));
    for (let i = 0; featured.length < count && i < pastGames.length; i++) {
      featured.push(pastGames[i]);
    }
  }

  return featured.slice(0, count);
}

export default function Homepage() {
  const [nba, setNba] = useState([]);
  const [nfl, setNfl] = useState([]);
  const [nhl, setNhl] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      try {
        setNba(getFeaturedGames(nbaGames, 2));
        setNfl(getFeaturedGames(nflGames, 2));
        setNhl(getFeaturedGames(nhlGames, 2));
        setLoading(false);
      } catch {
        setError("Failed to load featured games.");
        setLoading(false);
      }
    }, 100);
  }, []);

if (loading) return <LoadingPage />;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
<div className="flex flex-col w-full px-8">
      {/* Columns */}

      {/* Featured Games Title for mobile */}
      <div className="flex lg:hidden justify-center">
        <h2 className="text-3xl font-bold text-center mt-10 mb-6 w-full">
          Featured Games
        </h2>
      </div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {/* NBA Column */}
        <div className="flex flex-col items-cente">
          <Link
            to="/nba"
            className="flex flex-col items-center max-w[200px] transition-transform duration-200 hover:scale-125 rounded-lg shadow cursor-pointer p-2"
          >
            <div className="text-2xl mt-10 font-bold">NBA</div>

            <img
              src="/NBAlogo.png"
              alt="NBA Logo"
              className="w-40 h-40 mt-2 object-contain"
            />
          </Link>

          <div className="mt-45 w-full max-w-xl">
            {nba.map((game) => (
              <GameCard
              key={game.id} game={game} />
            ))}
          </div>
        </div>
        {/* NHL Column */}
        <div className="flex-1 flex flex-col items-center">
          <Link
            to="/nhl"
            className="flex flex-col items-center max-w[200px] transition-transform duration-200 hover:scale-125 rounded-lg shadow cursor-pointer p-2"
          >
            <div className="text-2xl mt-10 font-bold">NHL</div>
            <img
              src="/NHLlogo.png"
              alt="NHL Logo"
              className="w-40 h-40 mt-2 object-contain"
            />
          </Link>
          <div className="hidden lg:flex justify-center w-full">
        <h2 className="text-3xl font-bold text-center mt-10 w-full lg:w-auto">
          Featured Games
        </h2>
      </div>
          <div className="mt-26 w-full max-w-xl">
            {nhl.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>

        {/* NFL Column */}
        <div className="flex-1 flex flex-col items-center">
          <Link
            to="/nfl"
            className="flex flex-col items-center max-w[200px] transition-transform duration-200 hover:scale-125 rounded-lg shadow cursor-pointer p-2"
          >
            <div className="text-2xl mt-10 font-bold">NFL</div>
            <img
              src="/NFLlogo.png"
              alt="NFL Logo"
              className="w-40 h-40 mt-2 object-contain"
            />
          </Link>
          <div className="mt-45 w-full max-w-xl">
            {nfl.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      </div>
      
    </div>
  );
}
