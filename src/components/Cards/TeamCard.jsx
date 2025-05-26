import backupLogo from "../../assets/backupTeamLogo.png";
import { Link } from "react-router-dom";

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export default function TeamCard({ team, league}) {
  return (
    <Link to={`/${league}/teams/${slugify(team.name)}`}>
      <div className="relative border border-zinc-700 bg-zinc-800 p-6 text-center rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer max-w-md min-w-[200px] h-48 flex flex-col items-center justify-center">
        <img
          src={team.logo || backupLogo}
          alt={`${team.name} logo`}
          className="w-20 h-20 object-contain"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = backupLogo;
          }}
        />
        <div className="mt-2 text-lg font-bold text-white">{team.name}</div>
        <div className="text-sm text-gray-300">Record: {team.record}</div>
      </div>
    </Link>
  );
}
