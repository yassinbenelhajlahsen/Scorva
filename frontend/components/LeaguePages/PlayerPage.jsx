import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import LoadingPage from "../LoadingPage.jsx";

import PlayerAvgCard from "../Cards/PlayerAvgCard.jsx";
import slugify from "../../HelperFunctions/slugify.js";
import formatDate from "../../HelperFunctions/formatDate.js";
import StatCard from "../Cards/StatCard.jsx";
const statConfigs = {
  nba: [
    { key: "points",    label: "PTS" },
    { key: "rebounds",  label: "REB" },
    { key: "assists",   label: "AST" },
    { key: "fg",        label: "FG" },
    { key: "threept",   label: "3PT" },
    { key: "ft",        label: "FT" },
    { key: "turnovers", label: "TO" },
    { key: "plusminus", label: "+/-" },
    { key: "minutes",   label: "MINS" }
  ],
  nfl: [
    { key: "YDS",      label: "YDS" },
    { key: "TD",       label: "TD"  },
    { key: "INT",        label: "INT"  },
    { key: "CMPATT",    label: "CMPATT"   },
    { key: "SACK",       label: "SACK"  },
  ],
  nhl: [
    { key: "G",       label: "G"   },
    { key: "A",     label: "A"   },
    { key: "HT",       label: "HT" },
    { key: "plusminus",   label: "+/-" },
    { key: "TOI", label: "TOI" }
  ]
};

export default function PlayerPage() {
 const { league, playerId: slug } = useParams();
const [playerData, setPlayerData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchPlayerData() {
    try {
const res = await fetch(`${import.meta.env.VITE_API_URL}/api/${league}/players`);
      const players = await res.json();

      const match = players.find(p => slugify(p.name, { lower: true }) === slug);
      if (!match) {
        setPlayerData(null);
        return;
      }

      const fullRes = await fetch(`${import.meta.env.VITE_API_URL}/api/${league}/players/${match.id}`);
      const fullData = await fullRes.json();

      setPlayerData(fullData.player); 
    } catch (err) {
      console.error("Error fetching player:", err);
      setPlayerData(null);
    } finally {
      setLoading(false);
    }
  }

  fetchPlayerData();
}, [league, slug]);


if (loading) return <LoadingPage />;

if (!playerData) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold text-white">Player not found</h1>
      <Link
        to={`/${league}/players`}
        className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
      >
        Return to Players
      </Link>
    </div>
  );
}

const {
  id,
  name,
  position,
  jerseyNumber,
  height,
  weight,
  imageUrl,
  seasonAverages,
  team,
  dob,
  draftInfo,
  games
} = playerData;
  return (
    <>
      <Link
        to={`/${league}/players`}
        className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 ml-6 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
      >
        Return to Players Page
      </Link>

      <div className="flex flex-col md:flex-row gap-8 p-8 text-white">
        {/* Player Info */}
        <div className="flex-1">
          <h1 className="text-6xl font-bold mb-4">{name}</h1>
          <img
            src={imageUrl || "/images/placeholder.png"}
            alt={name}
            className="w-80 h-80 object-cover rounded-b-4xl mb-4"
          />
        </div>

        <div className="grid grid-cols-[max-content_auto] gap-x-20">
          <p>Height/Weight</p>
          <p className="font-semibold">
            {height} / {weight}
          </p>
          <p>Position</p>
          <p className="font-semibold">{position}</p>
          <p>Jersey Number</p>
          <p>
            <span className="font-bold">#{jerseyNumber}</span>
          </p>
          <p>Birthdate</p>
          <p className="font-semibold">{formatDate(dob)}</p>
          <p>Draft Info</p>
          <p className="font-semibold">{draftInfo}</p>
          <p>Team</p>
          <Link
            to={`/${league}/teams/${slugify(team.name)}`}
            className="hover:text-orange-300 transition underline text-orange-400 font-semibold"
          >
            {team.name}
          </Link>
        </div>

        {games && (
          <div className="mt-20">
            <PlayerAvgCard
              league={league}
              position={position}
              averages={seasonAverages}
              season={games.season}
            />
          </div>
        )}
      </div>

      <h1 className="font-semibold text-4xl mt-6 p-6">Recent Performances</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
  {playerData?.games?.map((game, i) => {
    const key = league?.toLowerCase(); 
    const config = statConfigs[key] || [];
    const statsProps = config.map(({ key: statKey, label }) => ({
  label,
  value: game[statKey] ?? "-"
}));
return (

  
      
      <StatCard
        key={i}
        league={league}
        stats={statsProps}
        opponent={game.opponent}
        date={formatDate(game.date)}
        gameId={game.gameid}
        isHome={game.ishome}
        opponentLogo = {game.opponentlogo}
        result= {game.result}
        id = {id}
      />
);
  })}
</div>
    </>
  );
}
