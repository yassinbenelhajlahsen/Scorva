import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";

import GameCard from "../components/cards/GameCard.jsx";
import leagueData from "../utilities/LeagueData";
import LoadingPage from "./LoadingPage.jsx";
import slugify from "../utilities/slugify.js";

export default function LeaguePage() {
  const { league } = useParams();
  const data = leagueData[league?.toLowerCase()];

  const [games, setGames] = useState([]);
  const [standings, setStandings] = useState({ eastOrAFC: [], westOrNFC: [] });
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

    async function fetchData() {
      setLoading(true);
      setDisplayData(false);
      setError(null);

      try {
        // Fetch games
        const gamesRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/games`,
          { signal }
        );
        if (!gamesRes.ok) {
          throw new Error(`HTTP ${gamesRes.status}`);
        }
        const allGames = await gamesRes.json();
        setGames(allGames);

        // Fetch standings
        const standingsRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/standings`,
          { signal }
        );
        if (!standingsRes.ok) {
          throw new Error(`HTTP ${standingsRes.status}`);
        }
        const teams = await standingsRes.json();

        const isNFL = league === "nfl";
        const east = teams.filter(
          (t) => t.conf?.toLowerCase() === (isNFL ? "afc" : "east")
        );
        const west = teams.filter(
          (t) => t.conf?.toLowerCase() === (isNFL ? "nfc" : "west")
        );

        setStandings({ eastOrAFC: east, westOrNFC: west });

        await new Promise((r) => setTimeout(r, 50));
        setDisplayData(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch data:", err);
          setError("Failed to load data.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [league, data]);
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-4xl font-bold mb-4">League Not Found</h1>
        <p className="text-gray-400 mb-8 text-center max-w-md">
          The league you're looking for doesn't exist or isn't supported yet.
        </p>
        <Link
          to="/"
          className="inline-block bg-gradient-to-r from-red-500 to-yellow-500 text-white font-semibold py-3 px-6 rounded-lg shadow-md transform transition-transform duration-300 hover:scale-105 hover:shadow-lg"
        >
          Back to Homepage
        </Link>
      </div>
    );
  }

  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <>
      <div className="p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors duration-200 mb-6"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="text-lg font-medium">Back to Home</span>
        </Link>

        <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-6 mb-4 md:ml-4">
          <img
            src={data.logo}
            alt={`${league} logo`}
            className="w-20 h-20 object-contain"
          />
          <h1 className="text-6xl font-bold text-center md:text-left uppercase">
            {league}
          </h1>
        </div>

        {loading || !displayData ? (
          <LoadingPage />
        ) : error ? (
          <div className="p-6 text-red-500">{error}</div>
        ) : (
          <>
            {/* Standings Section */}
            <h2 className="text-4xl font-bold text-center mb-10">Standings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
              {/* EAST or AFC */}
              <div>
                <h3 className="text-2xl font-semibold mb-8 text-center">
                  {league === "nfl" ? "AFC" : "Eastern Conference"}
                </h3>
                <ul className="space-y-2">
                  {standings.eastOrAFC.map((team, index) => (
                    <Link
                      to={`/${league}/teams/${slugify(team.name)}`}
                      key={team.id}
                    >
                      <li className="flex justify-between items-center px-4 py-2 rounded hover:bg-orange-400 transition-all duration-300 transform hover:scale-105 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-right">{index + 1}.</span>
                          <div className="w-8 h-8 rounded flex items-center justify-center">
                            <img
                              src={team.logo_url}
                              alt={`${team.name} logo`}
                              className="w-6 h-6 object-contain drop-shadow-[0_0_2px_white]"
                            />
                          </div>
                          <span className="font-medium">{team.name}</span>
                        </div>
                        <span>
                          {team.wins}-{team.losses}
                        </span>
                      </li>
                    </Link>
                  ))}
                </ul>
              </div>

              {/* WEST or NFC */}
              <div>
                <h3 className="text-2xl font-semibold mb-8 text-center">
                  {league === "nfl" ? "NFC" : "Western Conference"}
                </h3>
                <ul className="space-y-2">
                  {standings.westOrNFC.map((team, index) => (
                    <Link
                      to={`/${league}/teams/${slugify(team.name)}`}
                      key={team.id}
                    >
                      <li className="flex justify-between items-center px-4 py-2 rounded hover:bg-orange-400 transition-all duration-300 transform hover:scale-105 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-right">{index + 1}.</span>
                          <div className="w-8 h-8 rounded flex items-center justify-center">
                            <img
                              src={team.logo_url}
                              alt={`${team.name} logo`}
                              className="w-6 h-6 object-contain drop-shadow-[0_0_2px_white]"
                            />
                          </div>
                          <span className="font-medium">{team.name}</span>
                        </div>
                        <span>
                          {team.wins}-{team.losses}
                        </span>
                      </li>
                    </Link>
                  ))}
                </ul>
              </div>
            </div>

            {/* Games Section */}
            <h2 className="text-4xl font-bold text-center mt-20 mb-20">
              Games
            </h2>
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 justify-items-center">
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
