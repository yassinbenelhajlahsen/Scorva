import { Link } from "react-router-dom";

export default function StatCard({ stats = [], opponent, date, gameId, league, isHome, opponentLogo, result, id}) {
  if (!stats.length) {
    return (
      <div className="border border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-md w-full max-w-3xl p-6 text-center">
        <p className="text-gray-400">No stats available.</p>
      </div>
    );
  }

  const to = `/${league}/games/${gameId}#player-${id}`;

  return (
    <Link to={to} className="group block">
      <div className="
      relative border border-zinc-700 bg-zinc-800 p-6 
      text-center mb-6 rounded-xl shadow-lg transition-all duration-300 
      hover:scale-105 cursor-pointer max-w-sm mx-auto overflow-hidden">
        {/* Game info */}
       {(opponent || date) && (
  <div className="text-gray-400 text-sm mb-4 text-center flex items-center justify-center gap-2">
    {result && (
      <span
        className={`font-bold px-2 py-0.5 rounded-full text-s ${
          result === "W" ? "text-green-500" : "text-red-500"
        }`}
      >
        {result}
      </span>
    )}
   <span className="flex items-center gap-1">
  {isHome ? "vs." : "@"}
  
  {opponentLogo && (
    <img
      src={opponentLogo}
      alt={`${opponent} logo`}
      className="w-5 h-5 object-contain drop-shadow-[0_0_2px_white] m-2"
    />
  )}
  
  {opponent}
  
  {date && <> on {date}</>}
</span>

  </div>
)}


        {/* All stats, default max-height hides overflow */}
        <ul className="
          flex flex-wrap justify-center gap-10 
          max-h-18 group-hover:max-h-[500px] 
          overflow-hidden transition-[max-height] duration-500 ease-in-out
        ">
          {stats.map((stat, i) => (
            <li key={i} className="flex flex-col items-center min-w-[60px]">
              <span className="text-sm text-gray-400">{stat.label}</span>
              <span className="font-semibold text-3xl mt-1">
                {stat.value}
                {stat.label.includes("%") && "%"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}
