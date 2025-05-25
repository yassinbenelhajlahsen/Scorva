import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

import nbaTeams from "../../mock/mockNbaData/nbaTeams";
import nflTeams from "../../mock/mockNflData/nflTeams";
import nhlTeams from "../../mock/mockNhlData/nhlTeams";

import nbaLogo from "../../assets/NBAlogo.png";
import nflLogo from "../../assets/NFLlogo.png";
import nhlLogo from "../../assets/NHLlogo.png";

import TeamCard from "../TeamCard";

const leagueData = {
  nba: {
    logo: nbaLogo,
    teams: nbaTeams,
  },
  nfl: {
    logo: nflLogo,
    teams: nflTeams,
  },
  nhl: {
    logo: nhlLogo,
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

  if (loading) return <div className="p-6">Loading teams...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-6 mb-8">
        <img
          src={data.logo}
          alt={`${league} logo`}
          className="w-20 h-20 object-contain"
        />
        <h1 className="text-5xl font-bold capitalize">{league} Teams</h1>
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
  );
}
