import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import LoadingPage from "../LoadingPage.jsx";
import slugify from "../../HelperFunctions/slugify.js";

const leagueLogos = {
  nba: "/NBAlogo.png",
  nfl: "/NFLlogo.png",
  nhl: "/NHLlogo.png",
};

export default function StandingsPage() {
  const { league } = useParams();
  const [eastOrAFC, setEastOrAFC] = useState([]);
  const [westOrNFC, setWestOrNFC] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/${league}/standings`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch standings");
        return res.json();
      })
      .then((teams) => {
        console.log("✅ Standings response:", teams);
        const isNFL = league === "nfl";
        const east = teams.filter(
          (t) => t.conf.toLowerCase() === (isNFL ? "afc" : "east")
        );
        const west = teams.filter(
          (t) => t.conf.toLowerCase() === (isNFL ? "nfc" : "west")
        );
        setEastOrAFC(east);
        setWestOrNFC(west);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load standings. " + err.message);
        setLoading(false);
      });
  }, [league]);

  if (loading) return <LoadingPage />;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const leagueName = league?.toUpperCase();
  const logo = leagueLogos[league?.toLowerCase()];

  return (
    <>
      <div className="w-full flex justify-center sm:justify-start sm:ml-5">
        <Link
          to={`/${league}`}
          className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
        >
          Return to {leagueName}
        </Link>
      </div>

      <div className="p-2 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <img
            src={logo}
            alt={`${league} logo`}
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
          />
          <h1 className="text-3xl sm:text-5xl font-bold capitalize text-center sm:text-left">
            {leagueName} Standings
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* EAST or AFC */}
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {league === "nfl" ? "AFC" : "Eastern Conference"}
            </h2>
            <ul className="space-y-2">
              {eastOrAFC.map((team, index) => (
                <Link
                  to={`/${league}/teams/${slugify(team.name)}`}
                  key={team.id}
                >
                  <li className="flex justify-between items-center px-4 py-2 rounded hover:bg-orange-400">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-right">{index + 1}.</span>
                      <div className="w-8 h-8 rounded flex items-center justify-center mb-4">
                        <img
                          src={team.logo_url}
                          alt={`${team.name} logo`}
                          className="w-6 h-6 object-contain drop-shadow-[0_0_2px_white]"
                        />
                      </div>
                      <span className="font-medium">{team.name}</span>
                    </div>
                    <span>
                      {team.wins}-{team.losses}
                    </span>
                  </li>
                </Link>
              ))}
            </ul>
          </div>

          {/* WEST or NFC */}
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {league === "nfl" ? "NFC" : "Western Conference"}
            </h2>
            <ul className="space-y-2">
              {westOrNFC.map((team, index) => (
                <Link
                  to={`/${league}/teams/${slugify(team.name)}`}
                  key={team.id}
                >
                  <li className="flex justify-between items-center px-4 py-2 rounded hover:bg-orange-400 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-right">{index + 1}.</span>
                      <div className="w-8 h-8 rounded flex items-center justify-center">
                        <img
                          src={team.logo_url}
                          alt={`${team.name} logo`}
                          className="w-6 h-6 object-contain drop-shadow-[0_0_2px_white]"
                        />
                      </div>
                      <span className="font-medium">{team.name}</span>
                    </div>
                    <span>
                      {team.wins}-{team.losses}
                    </span>
                  </li>
                </Link>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
