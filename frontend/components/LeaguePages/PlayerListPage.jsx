import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";

import LoadingPage from "../LoadingPage.jsx";

import PlayerCard from "../Cards/PlayerCard";

const leagueLogos = {
  nba: "/NBAlogo.png",
  nfl: "/NFLlogo.png",
  nhl: "/NHLlogo.png",
};

const popularPlayerIds = [
  48360,
  1620,
  49557,
  48471,
  11650,
  48673,
  191,
  20179,
  20177,
  20207,
  48382,
  20373,
  48314,
  20295,
  1,
  49048,
  20299,
  118,
  1605,
  1596,
  969,
  1206,
  48606,
  20398,
  39,
  20069,
  830, // NBA

  49020,
  48714,
  48718,
  20143,
  1356,
  48710,
  1175,
  1294,
  20411,
  1536,
  1334,
  49352,
  23592,
  834,
  48557,
  48550,
  20082,
  3,
  962,
  20098,
  31218,
  20308,
  264,
  48875,
  48957,
  20080,
  20078, // NFL

  48370,
  20112,
  49110,
  50243,
  114,
  48438,
  51357,
  20068,
  49535,
  49537,
  49540,
  47,
  20320,
  48546,
  115,
  872,
  49420,
  1096,
  20100,
  20166,
  20386,
  20385,
  49470,
  48611, // NHL
];

export default function PlayerListPage() {
  const { league } = useParams();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTopPlayers() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/players`
        );
        const allPlayers = await res.json();
        const popularPlayers = allPlayers.filter((p) =>
          popularPlayerIds.includes(p.id)
        );

        setPlayers(popularPlayers);
      } catch (err) {
        console.error("Failed to load players:", err);
        setError("Failed to load players.");
      } finally {
        setLoading(false);
      }
    }

    if (league) fetchTopPlayers();
  }, [league]);

  if (loading) return <LoadingPage />;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  const logo = leagueLogos[league?.toLowerCase()];

  return (
    <>
      <div className="w-full flex justify-center sm:justify-start sm:ml-5">
        <Link
          to={`/${league}`}
          className="mt-6 inline-block bg-gradient-to-r from-red-500 to-yellow-500 text-white font-semibold py-3 px-6 ml-6 rounded-lg shadow-md transform transition-transform duration-300 hover:scale-105 hover:shadow-lg"
        >
          ← Return to {league.toUpperCase()}
        </Link>
      </div>

      <div className="p-2 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <img
            src={logo}
            alt={`${league} logo`}
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
          />
          <h1 className="text-3xl sm:text-5xl font-bold capitalize text-center sm:text-left">
            {league.toUpperCase()} Players
          </h1>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {players.map((player) => (
            <PlayerCard key={player.name} player={player} league={league} />
          ))}
        </div>
      </div>
    </>
  );
}
