import { useParams, Link } from "react-router-dom";
import nbaTeams from "../../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../../mock/mockNflData/nflTeams.js";
import nhlTeams from "../../mock/mockNhlData/nhlTeams.js";

import nbaGames from "../../mock/mockNbaData/nbaGames.js";

const slugify = (name) => name.toLowerCase().replace(/\s+/g, "-");

export default function TeamPage() {
  const { league, teamId } = useParams();

  let teams = [];
  if (league === "nba") teams = nbaTeams;
  else if (league === "nfl") teams = nflTeams;
  else if (league === "nhl") teams = nhlTeams;

  const team = teams.find((t) => slugify(t.name) === teamId);

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
      <div className="flex flex-col md:flex-row gap-8 p-8 text-white">
        {/* Team Info */}
        <div className="flex-1">
          <h1 className="text-6xl font-bold mb-4">{team.name}</h1>
          <img
            src={team.logo || "/images/placeholder.png"}
            alt={team.name}
            className="w-80 h-80 object-contain rounded-b-4xl mb-4"
          />
        </div>

        <div className="grid grid-cols-2">
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
      <h2 className="text-5xl font-bold mb-4 p-8">Recent Games </h2>
    </>
  );
}
