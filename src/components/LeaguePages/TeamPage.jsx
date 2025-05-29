import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";

import nbaTeams from "../../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../../mock/mockNflData/nflTeams.js";
import nhlTeams from "../../mock/mockNhlData/nhlTeams.js";

import GameCard from "../Cards/GameCard";
import leagueData from "../../HelperFunctions/LeagueData";
import LoadingPage from "../LoadingPage.jsx";

const slugify = (s) =>
  s
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

export default function TeamPage() {
  const { league: rawLeague, teamId } = useParams();
  const league = (rawLeague || "").toLowerCase();

  const leagueMap = {
    nba: nbaTeams,
    nfl: nflTeams,
    nhl: nhlTeams,
  };

  const teams = leagueMap[league] || [];
  const team = teams.find((t) => slugify(t.name) === teamId);

  const data = leagueData[league] || {};
  const gamesList = Array.isArray(data.games) ? data.games : [];

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // handle missing league data first
    if (!league || !leagueMap[league]) {
      setError("League data not available.");
      setLoading(false);
      return;
    }

    // handle missing team
    if (!team) {
      setError("Team not found.");
      setLoading(false);
      return;
    }

    // filter games for this team
    const matched = gamesList.filter((game) => {
      const homeSlug = slugify(game.homeTeam);
      const awaySlug = slugify(game.awayTeam);
      const nameSlug = slugify(team.name);
      const shortSlug = slugify(team.shortName || "");

      return (
        homeSlug === nameSlug ||
        awaySlug === nameSlug ||
        homeSlug === shortSlug ||
        awaySlug === shortSlug
      );
    });

    setGames(matched.slice(0, 15));
    setLoading(false);
  }, [league, team, gamesList]);

  if (loading) return <LoadingPage />;
  if (error)
    return (
      <h1 className="text-center text-3xl text-red-500">{error}</h1>
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

      <h2 className="text-5xl font-bold mb-4 p-8 text-center">
        Recent Games
      </h2>

      {games.length > 0 ? (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
          {games.map((game) => (
            <div key={game.id} className="w-full max-w-md">
              <GameCard game={game} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-xl mt-8 text-gray-300">
          No recent games to show.
        </p>
      )}
    </>
  );
}
