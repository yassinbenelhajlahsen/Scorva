import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";

import nbaTeams from "../../mock/mockNbaData/nbaTeams";
import nflTeams from "../../mock/mockNflData/nflTeams";
import nhlTeams from "../../mock/mockNhlData/nhlTeams";

import TeamCard from "../Cards/TeamCard";
import LoadingPage from "../LoadingPage.jsx"

const leagueData = {
  nba: {
    logo: "/NBAlogo.png",
    teams: nbaTeams,
  },
  nfl: {
    logo: "/NFLlogo.png",
    teams: nflTeams,
  },
  nhl: {
    logo: "/NHLlogo.png",
    teams: nhlTeams,
  },
};

export default function TeamListPage() {
  const { league } = useParams();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const data = leagueData[league?.toLowerCase()];

  useEffect(() => {
    setLoading(true);
    try {
      const teamList = data?.teams || [];
      setTeams(teamList.slice(0, 32));
      setLoading(false);
    } catch {
      setError("Failed to load teams.");
      setLoading(false);
    }
  }, [league]);

  if (!data) {
    return <div className="text-red-500 p-6">Invalid league: {league}</div>;
  }

   if (loading) return <LoadingPage />;
      if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <>
    <Link
                  to={`/${league}`}
                  className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 ml-6 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
                >
                  Return to {league.toUpperCase()}
                </Link>
    <div className="p-6">
      <div className="flex items-center gap-6 mb-8">
        <img
          src={data.logo}
          alt={`${league} logo`}
          className="w-20 h-20 object-contain"
        />
        <h1 className="text-5xl font-bold capitalize">{league.toUpperCase()} Teams</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 px-4">
        {teams.map((team) => (
          <TeamCard
            key={team.name}
            team={team}
            teams={teams}
            league={league}
          />
        ))}
      </div>
    </div>
    </>
  );
}
