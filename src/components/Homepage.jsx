import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import GameCard from "./Cards/GameCard.jsx";
import LoadingPage from "./LoadingPage.jsx";

export default function Homepage() {
  const [games, setGames] = useState({ nba: [], nhl: [], nfl: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAllGames() {
      try {
        setLoading(true);
        setError(null);

        const leagues = ["nba", "nhl", "nfl"];
        const responses = await Promise.all(
          leagues.map((league) =>
            fetch(`/api/${league}/games`, { signal: controller.signal })
          )
        );

        // check each response and parse JSON
        const data = await Promise.all(
          responses.map((res, i) => {
            if (!res.ok) {
              throw new Error(
                `Failed to fetch ${leagues[i]} games (status ${res.status})`
              );
            }
            return res.json();
          })
        );

        setGames({
          nba: data[0],
          nhl: data[1],
          nfl: data[2],
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setError("Could not load games. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAllGames();
    return () => controller.abort();
  }, []);

  if (loading) return <LoadingPage />;
  if (error)
    return <div className="p-6 text-red-500">{error}</div>;

  return (
     <div className="flex flex-col w-full px-8">
      {/* Mobile-only title */}
      <div className="flex lg:hidden justify-center">
        <h2 className="text-3xl font-bold text-center mt-10 mb-6">
          Featured Games
        </h2>
      </div>

      {/* Desktop-only title, before the grid */}
      <div className="hidden lg:flex justify-center">
        <h2 className="text-3xl font-bold text-center mt-10 mb-6">
          Featured Games
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {/* NBA Column */}
        <LeagueColumn league="NBA" games={games.nba} to="/nba" logo="/NBAlogo.png" />

        {/* NHL Column */}
        <LeagueColumn
          league="NHL"
          games={games.nhl}
          to="/nhl"
          logo="/NHLlogo.png"
        />

        {/* NFL Column */}
        <LeagueColumn league="NFL" games={games.nfl} to="/nfl" logo="/NFLlogo.png" />
      </div>
    </div>
  );
}

function LeagueColumn({ league, games, to, logo }) {

  const displayedGames = games.slice(0,3);


  return (
    <div className="flex-1 flex flex-col items-center">
      <Link
        to={to}
        className="flex flex-col items-center max-w[200px] transition-transform duration-200 hover:scale-125 rounded-lg shadow cursor-pointer p-2"
      >
        <div className="text-2xl mt-10 font-bold">{league}</div>
        <img
          src={logo}
          alt={`${league} Logo`}
          className="w-40 h-40 mt-2 object-contain"
        />
      </Link>

      <div className="mt-10 w-full max-w-xl">
        {displayedGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
