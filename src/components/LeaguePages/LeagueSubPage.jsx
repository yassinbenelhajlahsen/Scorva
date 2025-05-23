import { Link } from 'react-router-dom';

export default function LeagueSubPage({ league, logo, section }) {
  return (
    <div className="p-6 min-h-screen">
      <div className="flex items-center gap-6 mb-12 ml-4">
        <Link to={`/${league.toLowerCase()}`}>
          <img
            src={logo}
            alt={`${league} Logo`}
            className="w-20 h-20 object-contain"
          />
        </Link>
        <h1 className="text-6xl font-bold text-left">
          <Link
            to={`/${league.toLowerCase()}`}
            className="hover:text-orange-400 transition"
          >
            {league}
          </Link>{" "}
          {section}
        </h1>
      </div>
    </div>
  );
}