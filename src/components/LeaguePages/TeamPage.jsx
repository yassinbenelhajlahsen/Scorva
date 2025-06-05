import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";

import GameCard from "../Cards/GameCard";
import LoadingPage from "../LoadingPage.jsx";
import slugify from "../../HelperFunctions/slugify.js";

export default function TeamPage() {
  const { league: rawLeague, teamId } = useParams();
  const league = (rawLeague || "").toLowerCase();

  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchTeamData() {
      try {
        const res = await fetch(`/api/${league}/teams`);
        if (!res.ok) throw new Error("Failed to fetch teams.");
        const teamList = await res.json();

        setTeams(teamList);
        const foundTeam = teamList.find(
          (t) =>
            slugify(t.name) === teamId || slugify(t.shortname || "") === teamId
        );

        if (!foundTeam) throw new Error("Team not found.");
        setTeam(foundTeam);

        const games = await (
          await fetch(`/api/${league}/games?teamId=${foundTeam.id}`)
        ).json();
        const last10 = games
          .slice()
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);
        setGames(last10);
        setLoading(false);
      } catch (err) {
        setError(err.message || "Failed to load data.");
        setLoading(false);
      }
    }

    fetchTeamData();
  }, [league, teamId]);

  if (loading)
    return (
      <div>
        <LoadingPage></LoadingPage>
      </div>
    );
  if (error || !team)
    return <div className="text-red-500 p-4">{error || "Team not found."}</div>;

  return (
    <>
      <Link
        to={`/${league}/teams`}
        className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 ml-6 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
      >
        Return to Teams Page
      </Link>
      <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-10 p-6 text-white">
  {/* Image + Title */}
  <div className="flex flex-col items-center md:items-start w-full md:w-1/2 m-10">
    <h1 className="text-6xl font-bold mb-4">{team.name}</h1>
    <img
      src={team.logo_url || "/images/placeholder.png"}
      alt={team.name}
      className="w-80 h-80 object-contain m-6 drop-shadow-[0_0_2px_white]"
    />
  </div>

  {/* Stats */}
  <div className="w-full md:w-[40%]">
    <div className="grid grid-cols-2 gap-x-8 gap-y-6 text-lg">
      <div className="text-gray-400 mb-6">Location</div>
      <div className="font-semibold">{team.location}</div>
      <div className="text-gray-400 mb-6">Record</div>
      <div className="font-semibold">{team.record}</div>
      <div className="text-gray-400 mb-6">Home Record</div>
      <div className="font-semibold">{team.homerecord}</div>
      <div className="text-gray-400 mb-6">Away Record</div>
      <div className="font-semibold">{team.awayrecord}</div>
    </div>
  </div>
</div>



      <h2 className="text-5xl font-bold mb-4 p-8 text-center">Last 10 Games</h2>

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
