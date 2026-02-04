import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import GameCard from "../components/cards/GameCard.jsx";
import LoadingPage from "./LoadingPage.jsx";

export default function Homepage() {
  const [games, setGames] = useState({ nba: [], nhl: [], nfl: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLeague, setActiveLeague] = useState("nba");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAllGames() {
      try {
        setLoading(true);
        setError(null);

        const leagues = ["nba", "nhl", "nfl"];
        const responses = await Promise.all(
          leagues.map((league) =>
            fetch(`${import.meta.env.VITE_API_URL}/api/${league}/games`, {
              signal: controller.signal,
            }),
          ),
        );

        const data = await Promise.all(
          responses.map((res, i) => {
            if (!res.ok) {
              throw new Error(
                `Failed to fetch ${leagues[i]} games (status ${res.status})`,
              );
            }
            return res.json();
          }),
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
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const leagues = [
    {
      id: "nba",
      name: "NBA",
      logo: "/NBAlogo.png",
      color: "from-blue-600 to-red-600",
    },
    {
      id: "nhl",
      name: "NHL",
      logo: "/NHLlogo.png",
      color: "from-gray-600 to-blue-500",
    },
    {
      id: "nfl",
      name: "NFL",
      logo: "/NFLlogo.png",
      color: "from-blue-700 to-red-700",
    },
  ];

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="text-center mb-16 mt-4">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
          Welcome to Scorva
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-6">
          Track NBA, NFL, and NHL games with real-time updates and comprehensive
          stats.
        </p>
      </div>

      {/* League Selector - Desktop: Horizontal, Mobile: Grid */}
      <div className="mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-8">
          Choose Your League
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {leagues.map((league) => (
            <Link
              key={league.id}
              to={`/${league.id}`}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-6 sm:p-8 shadow-lg transition-all duration-300 hover:shadow-2xl hover:scale-105 border border-zinc-700 hover:border-orange-400"
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <img
                    src={league.logo}
                    alt={`${league.name} Logo`}
                    className="w-24 h-24 sm:w-32 sm:h-32 object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                  />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-wide group-hover:text-orange-400 transition-colors">
                  {league.name}
                </h3>
                <div className="flex items-center gap-2 text-gray-400 group-hover:text-orange-300 transition-colors">
                  <span className="text-sm font-medium">View League</span>
                  <svg
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Games Section */}
      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-8">
          Featured Games
        </h2>

        {/* Mobile: Tabs, Desktop: Tabs */}
        <div className="flex justify-center mb-8 gap-3 sm:gap-6">
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => setActiveLeague(league.id)}
              className={`flex items-center gap-3 px-6 py-4 sm:px-8 sm:py-4 rounded-xl font-semibold transition-all duration-200 ${
                activeLeague === league.id
                  ? "bg-orange-500 text-white scale-105 shadow-lg"
                  : "bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              <img
                src={league.logo}
                alt={league.name}
                className="w-8 h-8 sm:w-8 sm:h-8 object-contain"
              />
              <span className="hidden sm:inline text-lg">{league.name}</span>
            </button>
          ))}
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {games[activeLeague].slice(0, 6).map((game) => (
            <div key={game.id} className="w-full">
              <GameCard game={game} />
            </div>
          ))}
        </div>

        {/* View All Link */}
        {games[activeLeague].length > 6 && (
          <div className="flex justify-center mt-8">
            <Link
              to={`/${activeLeague}`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-yellow-500 text-white font-semibold px-6 py-3 rounded-lg shadow-md transition-transform duration-300 hover:scale-105 hover:shadow-lg"
            >
              <span>View All {activeLeague.toUpperCase()} Games</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
