import { Link } from 'react-router-dom';
import nbalogo from '../../assets/NBAlogo.png';
import nhllogo from '../../assets/NHLlogo.png';
import nfllogo from '../../assets/NFllogo.png';

const logos = {
  NBA: nbalogo,
  NHL: nhllogo,
  NFL: nfllogo,
};

export default function LeaguePage({ league, links }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-6 mb-4 ml-4">
        <img
          src={logos[league]}
          alt={league + ' Logo'}
          className="w-20 h-20 object-contain"
        />
        <h1 className="text-6xl font-bold text-left">{league}</h1>
      </div>
      
      <div className="flex flex-row items-center gap-8 justify-center">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center justify-center text-3xl sm:text-4xl border border-zinc-700 bg-zinc-800 py-8  rounded-lg shadow transition-transform duration-200 hover:scale-105 cursor-pointer w-full max-w-xl"
          >
            {link.label}
          </Link>
        ))}
      </div>
        </div>
  );
  }