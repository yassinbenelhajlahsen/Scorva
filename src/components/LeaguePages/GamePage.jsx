import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

import BoxScore from "../BoxScore.jsx";
import slugify from "../../HelperFunctions/slugify.js";
import computeTopPlayers from "../../HelperFunctions/topPlayers.js";
import TopPerformerCard from "../Cards/TopPerformerCard.jsx";

import LoadingPage from "../LoadingPage.jsx";
import formatDate from "../../HelperFunctions/formatDate.js";

export default function GamePage() {
  const { league, gameId } = useParams();
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await axios.get(`/api/${league}/games/${gameId}`);
        setGameData(res.data);
      } catch (err) {
        console.error("Error fetching game:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchGame();
  }, [league, gameId]);

  if (loading) return <LoadingPage />;
  if (error || !gameData?.json_build_object) return <div>Game not found</div>;

  const { game, homeTeam, awayTeam } = gameData.json_build_object;

  const isFinal = game.status === "Final";
  const homeWon = isFinal && game.winnerId === homeTeam.info.id;
  const awayWon = isFinal && game.winnerId === awayTeam.info.id;
  const nhl = league === "nhl";
  const quarterKeys = nhl
    ? ["q1", "q2", "q3"]
    : ["q1", "q2", "q3", "q4"];
    
  const allPlayerStats = [
    ...(homeTeam?.players || []),
    ...(awayTeam?.players || []),
  ];

  const { topPerformer, topScorer, impactPlayer } = computeTopPlayers(
    game,
    allPlayerStats,
    league
  );
  return (
    <>
      {/* Team matchup section with scores */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mt-6 mb-8">
        {/* Home Team */}
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            src={homeTeam.info.logoUrl}
            alt={`${homeTeam.info.name} logo`}
            className="w-30 h-30 sm:w-40 sm:h-40 object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/backupTeamLogo.png";
            }}
          />
          <div className="text-left">
            <Link
              to={`/${league}/teams/${slugify(homeTeam.info.name)}`}
              className="text-xl sm:text-6xl font-bold hover:text-orange-400 transition"
            >
              {homeTeam.info.shortName}
            </Link>
            {isFinal && (
              <div
                className={`text-lg sm:text-4xl font-semibold ${
                  homeWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {game.score.home}
              </div>
            )}
          </div>
        </div>

        {/* VS divider */}
        <div className="text-xl sm:text-5xl font-semibold">vs</div>

        {/* Away Team */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-left">
            <Link
              to={`/${league}/teams/${slugify(awayTeam.info.name)}`}
              className="text-xl sm:text-6xl font-bold hover:text-orange-400 transition"
            >
              {awayTeam.info.shortName}
            </Link>
            {isFinal && (
              <div
                className={`text-lg sm:text-4xl font-semibold ${
                  awayWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {game.score.away}
              </div>
            )}
          </div>
          <img
            src={awayTeam.info.logoUrl}
            alt={`${awayTeam.info.name} logo`}
            className="w-30 h-30 sm:w-40 sm:h-40 object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/backupTeamLogo.png";
            }}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row justify-center px-6 sm:px-6 mb-12">
        {/* Game info on the left */}
        <div className="grid grid-cols-2 gap-y-4 text-left max-w-md w-full">
          <p className="text-lg">Date</p>
          <p className="font-semibold">{formatDate(game.date)}</p>
          <p className="text-lg">Status</p>
          <p className="font-semibold">{game.status}</p>
          <p className="text-lg">Location</p>
          <p className="font-semibold">{game.venue}</p>
          <p className="text-lg">Broadcast</p>
          <p className="font-semibold">{game.broadcast}</p>
        </div>
        {/* Top performers on the right */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 max-w-6xl mx-auto">
          <TopPerformerCard
            title="Top Performer"
            player={topPerformer}
            league={league}
          />
          <TopPerformerCard
            title="Top Scorer"
            player={topScorer}
            league={league}
          />
          <TopPerformerCard
            title="Impact Player"
            player={impactPlayer}
            league={league}
          />
        </div>
      </div>

      {isFinal && (
        <ul className="mt-6 text-lg text-gray-300 font-mono space-y-2">
          {/* Header Row */}
          <li className="flex items-center justify-center gap-x-6 text-gray-400">
            <span className="w-24" /> {/* spacer */}
            {quarterKeys.map((_, i) => (
              <span key={i} className="w-10 text-center">
                {i + 1}
              </span>
            ))}
            {game.score.quarters.ot.map(
              (val, i) =>
                val && (
                  <span key={`OT${i + 1}`} className="w-10 text-center">
                    OT{i + 1}
                  </span>
                )
            )}
            <span className="w-10 text-center">T</span>
          </li>

          {/* Home Team Row */}
          <li className="flex items-center justify-center gap-x-6">
            <span className="w-24 font-bold text-left">
              {homeTeam.info.shortName}
            </span>
            {quarterKeys.map((q) => (
              <span key={q} className="w-10 text-center">
                {game.score.quarters[q]?.split("-")[0] ?? "-"}
              </span>
            ))}
            {game.score.quarters.ot.map(
              (val, i) =>
                val && (
                  <span key={`home-OT${i + 1}`} className="w-10 text-center">
                    {val.split("-")[0]}
                  </span>
                )
            )}
            <span
              className={`w-10 text-center font-semibold ${
                homeWon ? "text-green-400" : "text-red-400"
              }`}
            >
              {game.score.home}
            </span>
          </li>

          {/* Away Team Row */}
          <li className="flex items-center justify-center gap-x-6">
            <span className="w-24 font-bold text-left">
              {awayTeam.info.shortName}
            </span>
            {quarterKeys.map((q) => (
              <span key={q} className="w-10 text-center">
                {game.score.quarters[q]?.split("-")[1] ?? "-"}
              </span>
            ))}
            {game.score.quarters.ot.map(
              (val, i) =>
                val && (
                  <span key={`away-OT${i + 1}`} className="w-10 text-center">
                    {val.split("-")[1]}
                  </span>
                )
            )}
            <span
              className={`w-10 text-center font-semibold ${
                awayWon ? "text-green-400" : "text-red-400"
              }`}
            >
              {game.score.away}
            </span>
          </li>
        </ul>
      )}

      {isFinal ? (
        <BoxScore homeTeam={homeTeam} awayTeam={awayTeam} league={league} />
      ) : (
        <div className="text-center text-gray-400 my-8">
          {" "}
          No box score available{" "}
        </div>
      )}
    </>
  );
}
