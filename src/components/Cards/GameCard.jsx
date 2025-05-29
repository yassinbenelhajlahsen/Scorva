import { Link } from "react-router-dom";
import getLogo from "../../HelperFunctions/getLogoFromTeam.js";
import getLeague from "../../HelperFunctions/getLeagueFromTeam.js";

export default function GameCard({ game }) {
  const isFinal = game.status.includes("Final");
  const homeWon = isFinal && game.homeScore > game.awayScore;
  const awayWon = isFinal && game.awayScore > game.homeScore;

  const league = getLeague(game.homeTeam);
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
              src={getLogo(game.homeTeam) || "/backupTeamLogo.png"}
              alt={`${game.homeTeam} logo`}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.png";
              }}
            />
            <div className="text-lg font-bold text-white mt-2">
              {game.homeTeam}
            </div>
            {isFinal && (
              <div
                className={`text-lg font-semibold ${
                  homeWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {game.homeScore}
              </div>
            )}
          </div>

          {/* Center */}
          <div className="flex flex-col items-center flex-1">
            <span className="text-sm text-gray-400 mb-1">{game.date}</span>
            <div className="text-sm text-gray-300">vs</div>
            <p className="mt-1 text-sm text-gray-300">
              Status: <span className="text-white">{game.status}</span>
            </p>
          </div>

          {/* Away */}
          <div className="flex flex-col items-center">
            <img
              src={getLogo(game.awayTeam) || "/backupTeamLogo.png"}
              alt={`${game.awayTeam} logo`}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.png";
              }}
            />
            <div className="text-lg font-bold text-white mt-2">
              {game.awayTeam}
            </div>
            {isFinal && (
              <div
                className={`text-lg font-semibold ${
                  awayWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {game.awayScore}
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
              <span className="w-12" /> {/* spacer */}{" "}
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
                {game.awayTeam}
              </span>{" "}
              <span className="w-8 text-center">
                {game.firstQtr?.split("-")[1]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.secondQtr?.split("-")[1]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.thirdQtr?.split("-")[1]}
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
                {game.awayScore}{" "}
              </span>{" "}
            </li>{" "}
            {/* HOME TEAM ROW */}{" "}
            <li className="flex justify-between px-2 text-sm">
              {" "}
              <span className="w-12 font-bold text-left">
                {game.homeTeam}
              </span>{" "}
              <span className="w-8 text-center">
                {game.firstQtr?.split("-")[0]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.secondQtr?.split("-")[0]}
              </span>{" "}
              <span className="w-8 text-center">
                {game.thirdQtr?.split("-")[0]}
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
                {game.homeScore}{" "}
              </span>{" "}
            </li>{" "}
          </ul>
        )}
        {/* Quarter breakdown */}
        {isFinal && !nhl && (
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
              <span className="w-12 font-bold text-left">{game.awayTeam}</span>
              <span className="w-8 text-center">
                {game.firstQtr?.split("-")[1]}
              </span>
              <span className="w-8 text-center">
                {game.secondQtr?.split("-")[1]}
              </span>
              <span className="w-8 text-center">
                {game.thirdQtr?.split("-")[1]}
              </span>
              <span className="w-8 text-center">
                {game.fourthQtr?.split("-")[1]}
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
                {game.awayScore}
              </span>
            </li>

            {/* HOME TEAM ROW */}
            <li className="flex justify-between px-2 text-sm">
              <span className="w-12 font-bold text-left">{game.homeTeam}</span>
              <span className="w-8 text-center">
                {game.firstQtr?.split("-")[0]}
              </span>
              <span className="w-8 text-center">
                {game.secondQtr?.split("-")[0]}
              </span>
              <span className="w-8 text-center">
                {game.thirdQtr?.split("-")[0]}
              </span>
              <span className="w-8 text-center">
                {game.fourthQtr?.split("-")[0]}
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
                {game.homeScore}
              </span>
            </li>
          </ul>
        )}
      </div>
    </Link>
  );
}
