import { Link } from "react-router-dom";
import { formatDateShort } from "../../utilities/formatDate";

export default function GameCard({ game }) {
  const isFinal = game.status.includes("Final");
  const inProgress =
    game.status.includes("In Progress") ||
    game.status.includes("End of Period");
  const homeWon = isFinal && game.hometeamid === game.winnerid;
  const awayWon = isFinal && game.awayteamid === game.winnerid;
  const league = game.league;
  if (!league) return null;

  const nhl = league == "nhl";

  return (
    <Link
      to={`/${league}/games/${game.id}`}
      className="group block no-underline h-full"
    >
      <div className="relative border border-zinc-700 bg-zinc-800 p-6 text-center rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer h-full flex flex-col overflow-hidden">
        {/* Teams & Scores */}
        <div className="flex items-center justify-between gap-6 min-h-[120px]">
          {/* Home */}
          <div className="flex flex-col items-center flex-1">
            <img
              src={game.home_logo || "/backupTeamLogo.png"}
              alt={`${game.homeTeam} logo`}
              className="w-16 h-16 object-contain flex-shrink-0"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.png";
              }}
            />
            <div className="text-lg font-bold text-white mt-2 line-clamp-1 min-h-[28px]">
              {game.home_shortname}
            </div>

            <div
              className={`text-lg font-semibold min-h-[28px] ${
                game.homescore === game.awayscore
                  ? "text-gray-400"
                  : game.homescore > game.awayscore
                    ? "text-green-400"
                    : "text-red-400"
              }`}
            >
              {game.homescore}
            </div>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center flex-1 justify-center">
            <span className="text-sm text-gray-400 mb-1 line-clamp-1">
              {formatDateShort(game.date)}
            </span>
            <div className="text-sm text-gray-300">vs</div>
            <p className="mt-1 text-sm text-gray-300 text-center px-1">
              <span className="text-white">{game.status}</span>
            </p>
          </div>

          {/* Away */}
          <div className="flex flex-col items-center flex-1">
            <img
              src={game.away_logo || "/backupTeamLogo.png"}
              alt={`${game.awayteam} logo`}
              className="w-16 h-16 object-contain flex-shrink-0"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.png";
              }}
            />
            <div className="text-lg font-bold text-white mt-2 line-clamp-1 min-h-[28px]">
              {game.away_shortname}
            </div>

            <div
              className={`text-lg font-semibold min-h-[28px] ${
                game.homescore === game.awayscore
                  ? "text-gray-400"
                  : game.homescore < game.awayscore
                    ? "text-green-400"
                    : "text-red-400"
              }`}
            >
              {game.awayscore}
            </div>
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
              <span className="w-12" />{" "}
              <span className="w-8 text-center">1</span>{" "}
              <span className="w-8 text-center">2</span>{" "}
              <span className="w-8 text-center">3</span>{" "}
              {/* Dynamic OT headers */}{" "}
              {["OT", "OT2", "OT3", "OT4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">
                    {key}
                  </span>
                ) : null,
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
                ) : null,
              )}{" "}
              <span
                className={`w-8 text-center ${
                  awayWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {" "}
                {isFinal && (
                  <span className="w-8 text-center">{game.awayscore}</span>
                )}
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
                ) : null,
              )}{" "}
              <span
                className={`w-8 text-center ${
                  homeWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {" "}
                {isFinal && (
                  <span className="w-8 text-center">{game.homescore}</span>
                )}{" "}
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
                ) : null,
              )}
              <span className="w-8 text-center">T</span>
            </li>

            {/* AWAY TEAM ROW */}
            <li className="flex justify-between px-2 text-sm">
              <span className="w-12 font-bold text-left">
                {game.away_shortname}
              </span>
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
                ) : null,
              )}

              <span
                className={`w-8 text-center ${
                  awayWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {isFinal && (
                  <span className="w-8 text-center">{game.awayscore}</span>
                )}{" "}
              </span>
            </li>

            {/* HOME TEAM ROW */}
            <li className="flex justify-between px-2 text-sm">
              <span className="w-12 font-bold text-left">
                {game.home_shortname}
              </span>
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
                ) : null,
              )}

              <span
                className={`w-8 text-center ${
                  homeWon ? "text-green-400" : "text-red-400"
                }`}
              >
                {isFinal && (
                  <span className="w-8 text-center">{game.homescore}</span>
                )}{" "}
              </span>
            </li>
          </ul>
        )}
      </div>
    </Link>
  );
}
