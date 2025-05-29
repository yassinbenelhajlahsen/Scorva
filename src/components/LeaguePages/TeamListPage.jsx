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
   <div className="w-full flex justify-center sm:justify-start sm:ml-5">
    <Link
      to={`/${league}`}
      className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
    >
      Return to {league.toUpperCase()}
    </Link>
    </div>
    <div className="p-2 sm:p-6">
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
        <img
          src={data.logo}
          alt={`${league} logo`}
          className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
        />
        <h1 className="text-3xl sm:text-5xl font-bold capitalize text-center sm:text-left">
          {league.toUpperCase()} Teams
        </h1>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
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
