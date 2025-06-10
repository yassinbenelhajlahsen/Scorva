import { Link } from "react-router-dom";
import formatDate from "../../HelperFunctions/formatDate";

export default function GameCard({ game }) {
  const isFinal = game.status.includes("Final");
  const inProgress = game.status.includes("In Progress") || game.status.includes("End of Period");
  const homeWon = isFinal && game.hometeamid === game.winnerid;
  const awayWon = isFinal && game.awayteamid === game.winnerid;
  const league = game.league;
  if (!league) return null;

  const nhl = league == "nhl";

  return (
    <Link
      to={`/${league}/games/${game.id}`}
      className="group block no-underline"
    >
      <div className="relative border border-zinc-700 bg-zinc-800 p-6 text-center mb-6 rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer max-w-md mx-auto overflow-hidden">
        {/* Teams & Scores */}
        <div className="flex items-center justify-between gap-6">
          {/* Home */}
          <div className="flex flex-col items-center">
            <img
              src={game.home_logo || "/backupTeamLogo.png"}
              alt={`${game.homeTeam} logo`}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.png";
              }}
            />
            <div className="text-lg font-bold text-white mt-2">
              {game.home_shortname}
            </div>
            {(isFinal || inProgress) && (
              <div
                className={`text-lg font-semibold ${
game.homescore === game.awayscore
  ? "text-gray-400"
  : game.homescore > game.awayscore
    ? "text-green-400"
    : "text-red-400"                }`}
              >
                {game.homescore}
              </div>
            )}
          </div>

          {/* Center */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-sm text-gray-400 mb-1">{formatDate(game.date)}</span>
            <div className="text-sm text-gray-300">vs</div>
            <p className="mt-1 text-sm text-gray-300">
              Status: <span className="text-white">{game.status}</span>
            </p>
          </div>

          {/* Away */}
          <div className="flex flex-col items-center">
            <img
              src={game.away_logo || "/backupTeamLogo.png"}
              alt={`${game.awayteam} logo`}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.png";
              }}
            />
            <div className="text-lg font-bold text-white mt-2">
              {game.away_shortname}
            </div>
            {(isFinal || inProgress) && (
              <div
                className={`text-lg font-semibold ${
game.homescore === game.awayscore
  ? "text-gray-400"
  : game.homescore < game.awayscore
    ? "text-green-400"
    : "text-red-400"                }`}
              >
                {game.awayscore}
              </div>
            )}
          </div>
        </div>
        {nhl && (
          <ul className="mt-4 text-sm text-gray-300 font-mono max-h-0 min-h-[0px] group-hover:max-h-[300px] overflow-hidden transition-[max-height] duration-700 ease-in-out space-y-1">
            {" "}
            <li className="text-white text-sm font-bold text-center">
              {game.status}
            </li>{" "}

            {/* HEADER ROW */}{" "}
            <li className="flex justify-between text-xs text-gray-400 px-2">
              {" "}
              <span className="w-12" /> {" "}
              <span className="w-8 text-center">1</span>{" "}
              <span className="w-8 text-center">2</span>{" "}
              <span className="w-8 text-center">3</span>{" "}
              {/* Dynamic OT headers */}{" "}
              {["OT", "OT2", "OT3", "OT4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">
                    {key}
                  </span>
                ) : null
              )}{" "}
              <span className="w-8 text-center">T</span>{" "}
            </li>{" "}
            {/* AWAY TEAM ROW */}{" "}
            <li className="flex justify-between px-2 text-sm">
              {" "}
              <span className="w-12 font-bold text-left">
                {game.away_shortname}
              </span>{" "}
              <span className="w-8 text-center">
                {game.firstqtr?.split("-")[1]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.secondqtr?.split("-")[1]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.thirdqtr?.split("-")[1]}
              </span>{" "}
              {/* Dynamic OT scores */}{" "}
              {["OT", "OT2", "OT3", "OT4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">
                    {" "}
                    {game[key].split("-")[1]}{" "}
                  </span>
                ) : null
              )}{" "}
              <span
                className={`w-8 text-center ${
                  awayWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {" "}
                {game.awayscore}{" "}
              </span>{" "}
            </li>{" "}
            {/* HOME TEAM ROW */}{" "}
            <li className="flex justify-between px-2 text-sm">
              {" "}
              <span className="w-12 font-bold text-left">
                {game.home_shortname}
              </span>{" "}
              <span className="w-8 text-center">
                {game.firstqtr?.split("-")[0]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.secondqtr?.split("-")[0]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.thirdqtr?.split("-")[0]}
              </span>{" "}
              {["OT", "OT2", "OT3", "OT4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">
                    {" "}
                    {game[key].split("-")[0]}{" "}
                  </span>
                ) : null
              )}{" "}
              <span
                className={`w-8 text-center ${
                  homeWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {" "}
                {game.homescore}{" "}
              </span>{" "}
            </li>{" "}
          </ul>
        )}
        {/* Quarter breakdown */}
        {(isFinal || inProgress) && !nhl && (
          <ul
            className="mt-4 text-sm text-gray-300 font-mono 
    max-h-0 min-h-[0px] group-hover:max-h-[300px] 
    overflow-hidden transition-[max-height] duration-700 ease-in-out space-y-1"
          >
            <li className="text-white text-sm font-bold text-center">
              {game.status}
            </li>
            {/* HEADER ROW */}
            <li className="flex justify-between text-xs text-gray-400 px-2">
              <span className="w-12" /> {/* spacer */}
              <span className="w-8 text-center">1</span>
              <span className="w-8 text-center">2</span>
              <span className="w-8 text-center">3</span>
              <span className="w-8 text-center">4</span>
              {/* Dynamic OT headers */}
              {["OT", "OT2", "OT3", "OT4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">
                    {key}
                  </span>
                ) : null
              )}
              <span className="w-8 text-center">T</span>
            </li>

            {/* AWAY TEAM ROW */}
            <li className="flex justify-between px-2 text-sm">
              <span className="w-12 font-bold text-left">{game.away_shortname}</span>
              <span className="w-8 text-center">
                {game.firstqtr?.split("-")[1]}
              </span>
              <span className="w-8 text-center">
                {game.secondqtr?.split("-")[1]}
              </span>
              <span className="w-8 text-center">
                {game.thirdqtr?.split("-")[1]}
              </span>
              <span className="w-8 text-center">
                {game.fourthqtr?.split("-")[1]}
              </span>

              {/* Dynamic OT scores */}
              {["OT", "OT2", "OT3", "OT4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">
                    {game[key].split("-")[1]}
                  </span>
                ) : null
              )}

              <span
                className={`w-8 text-center ${
                  awayWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {game.awayscore}
              </span>
            </li>

            {/* HOME TEAM ROW */}
            <li className="flex justify-between px-2 text-sm">
              <span className="w-12 font-bold text-left">{game.home_shortname}</span>
              <span className="w-8 text-center">
                {game.firstqtr?.split("-")[0]}
              </span>
              <span className="w-8 text-center">
                {game.secondqtr?.split("-")[0]}
              </span>
              <span className="w-8 text-center">
                {game.thirdqtr?.split("-")[0]}
              </span>
              <span className="w-8 text-center">
                {game.fourthqtr?.split("-")[0]}
              </span>

              {["OT", "OT2", "OT3", "OT4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">
                    {game[key].split("-")[0]}
                  </span>
                ) : null
              )}

              <span
                className={`w-8 text-center ${
                  homeWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {game.homescore}
              </span>
            </li>
          </ul>
        )}
      </div>
    </Link>
  );
}
