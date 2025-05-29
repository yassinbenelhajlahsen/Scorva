import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";

import nbaTeams from "../../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../../mock/mockNflData/nflTeams.js";
import nhlTeams from "../../mock/mockNhlData/nhlTeams.js";

import GameCard from "../Cards/GameCard";
import leagueData from "../../HelperFunctions/LeagueData";
import LoadingPage from "../LoadingPage.jsx"

const slugify = (name) => name.toLowerCase().replace(/\s+/g, "-");

export default function TeamPage() {

const { league, teamId } = useParams();

const [games, setGames] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// Get teams for the league
let teams = [];
if (league === "nba") teams = nbaTeams;
else if (league === "nfl") teams = nflTeams;
else if (league === "nhl") teams = nhlTeams;

// Find the team
const team = teams.find((t) => slugify(t.name) === teamId);

const data = leagueData[league?.toLowerCase()];

useEffect(() => {
  if (!data || !team) return;

  setLoading(true);
  try {
    const gameList = data.games || [];

    const filteredGames = gameList.filter(
      (game) =>
        slugify(game.homeTeam) === slugify(team.shortName) ||
        slugify(game.awayTeam) === slugify(team.shortName)
    );

    setGames(filteredGames.slice(0, 15));
    setLoading(false);
  } catch {
    setError("Failed to load games.");
    setLoading(false);
  }
}, [league, data, teamId, team]);

  if (loading) return <LoadingPage />;
  if (error) return <h1 className="text-center text-3xl"> Error</h1>
 
  if (!team)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold">Team not found</h1>
        <Link
          to="/"
          className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
        >
          Return to Home
        </Link>
      </div>
    );

  return (
    <>
      <Link
        to={`/${league}/teams`}
        className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 ml-6 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
      >
        Return to Teams Page
      </Link>
      <div className="flex flex-col items-center md:flex-row gap-8 p-8 text-white">
        {/* Team Info */}
        <div className="flex-1 flex flex-col">
          <h1 className="text-6xl font-bold mb-4">{team.name}</h1>
          <img
            src={team.logo || "/images/placeholder.png"}
            alt={team.name}
            className="w-80 h-80 object-contain rounded-b-4xl mb-4"
          />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-12 text-lg p-6">
          <p>Location</p>
          <p className="font-semibold">{team.location}</p>
          <p>Arena</p>
          <p className="font-semibold">{team.arena}</p>
          <p>Coach</p>
          <p className="font-semibold">{team.coach}</p>
          <p>Record</p>
          <p className="font-semibold">{team.record}</p>
        </div>
      </div>
      <h2 className="text-5xl font-bold mb-4 p-8 text-center">Recent Games </h2>
<div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
          {games.map((game) => (
            <div key={game.id} className="w-full max-w-md">
              <GameCard game={game} />
            </div>
          ))}
        </div>    </>
  );
}
