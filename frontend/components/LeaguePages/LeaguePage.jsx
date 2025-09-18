import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";

import GameCard from "../Cards/GameCard";
import leagueData from "../../HelperFunctions/LeagueData";
import LoadingPage from "../LoadingPage.jsx";

export default function LeaguePage() {
  const { league } = useParams();
  const data = leagueData[league?.toLowerCase()];

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayData, setDisplayData] = useState(false);

  useEffect(() => {
    if (!data) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchGames() {
      setLoading(true);
      setDisplayData(false);
      setError(null);

      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/games`,
          { signal }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const allGames = await res.json();
        setGames(allGames);
        await new Promise((r) => setTimeout(r, 50));
        setDisplayData(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch games:", err);
          setError("Failed to load games.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
    return () => controller.abort();
  }, [league, data]);
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
        <Link
          to="/"
          className="mt-6 inline-block bg-gradient-to-r from-red-500 to-yellow-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md transform transition-transform duration-300 hover:scale-105 hover:shadow-lg"
        >
          ← Return to Homepage
        </Link>
      </div>
    );
  }

  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <>
      <div className="w-full flex justify-center sm:justify-start sm:ml-5">
        <Link
          to="/"
          className="mt-6 inline-block bg-gradient-to-r from-red-500 to-yellow-500 text-white font-semibold py-3 px-6 ml-6 rounded-lg shadow-md transform transition-transform duration-300 hover:scale-105 hover:shadow-lg"
        >
          ← Return to Home
        </Link>
      </div>

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
        {loading || !displayData ? (
          <LoadingPage />
        ) : error ? (
          <div className="p-6 text-red-500">{error}</div>
        ) : (
          <>
            <h2 className="text-4xl font-bold text-center mt-20 mb-20">
              Games
            </h2>
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
              {games.map((game) => (
                <div key={game.id} className="w-full max-w-md">
                  <GameCard game={game} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
