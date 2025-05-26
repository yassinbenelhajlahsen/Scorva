import { useParams, Link } from "react-router-dom";
import nbaTeams from "../../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../../mock/mockNflData/nflTeams.js";
import nhlTeams from "../../mock/mockNhlData/nhlTeams.js";
import backupLogo from "../../assets/backupTeamLogo.png";

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
    <div className="text-white p-8">
      <h1 className="text-4xl font-bold mb-4">{team.name}</h1>
      <img
        src={team.logo || backupLogo}
        alt={team.name}
        className="w-40 h-40 object-cover mb-4"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = backupLogo;
        }}
      />
      <p>City: {team.city}</p>
      <p>Arena: {team.arena}</p>
      <p>Record: {team.record}</p>
    </div>
    </>
  );
}
