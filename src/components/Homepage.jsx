import { Link } from "react-router-dom";
import nbalogo from "../assets/nbalogo.png";
import nhllogo from "../assets/NHL-Logo.png";
import nfllogo from "../assets/nfl-logo.png";
import nbaGames from '../mock/nbaGames.js';
import nflGames from '../mock/nflGames.js';
import nhlGames from '../mock/nhlGames.js'
import { useState, useEffect } from 'react';

const GameCard = ({ game }) => (
  <div className="border border-zinc-700 bg-zinc-800 p-4 mb-4 rounded-lg shadow transition duration-300 hover:bg-orange-400 cursor-pointer">
    <h3 className="text-lg font-bold">{game.homeTeam} vs {game.awayTeam}</h3>
    <p>{game.date}</p>
    <p>Status: {game.status}</p>
    {game.status === "Final" && (
      <p>Score: {game.homeScore} - {game.awayScore}</p>
    )}
  </div>
);

export default function Homepage() {
    const [nba, setNba] = useState([]);
    const [nfl, setNfl] = useState([]);
    const [nhl, setNhl] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setTimeout(() => {
            try {
                setNba(nbaGames.slice(0, 2));
                setNfl(nflGames.slice(0, 2));
                setNhl(nhlGames.slice(0, 2));
                setLoading(false);
            } catch (err) {
                setError("Failed to load featured games.");
                setLoading(false);
            }
        }, 100);
    }, []);

    if (loading) return <div className="p-6">Loading featured games...</div>;
    if (error) return <div className="p-6 text-red-500">{error}</div>;

    return (
        <div className="flex flex-col lg:flex-row justify-center gap-8 w-full max-w-6xl mx-auto px-4">
  {/* NBA Column */}
  <div className="flex-1 flex flex-col items-center">
    <Link
      to="/nba"
      className="flex flex-col items-center max-w[200px] hover:bg-orange-400 transition duration-300 rounded-lg shadow cursor-pointer p-2"
    >
      <div className="text-2xl mt-10 font-bold">NBA</div>

      
      <img src={nbalogo} alt="NBA Logo" className="w-40 h-40 mt-2 object-contain" />
    </Link>

    <div className="mt-45 w-full ">
      {nba.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  </div>
  {/* NHL Column */}
  <div className="flex-1 flex flex-col items-center">
    <Link
      to="/nhl"
      className="flex flex-col items-center hover:bg-orange-400 transition duration-300 rounded-lg shadow cursor-pointer p-2"
    >
      <div className="text-2xl mt-10 font-bold">NHL</div>
      <img src={nhllogo} alt="NHL Logo" className="w-40 h-40 mt-2 object-contain" />
    </Link>
    {/* Featured Games Title */}
  <h2 className="text-3xl font-bold text-center mt-20 mb-6">Featured Games</h2>

    <div className="mt-10 w-full">
      {nhl.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  </div>

  {/* NFL Column */}
  <div className="flex-1 flex flex-col items-center">
    <Link
      to="/nfl"
      className="flex flex-col items-center hover:bg-orange-400 transition duration-300 rounded-lg shadow cursor-pointer p-2"
    >
      <div className="text-2xl mt-10 font-bold">NFL</div>
      <img src={nfllogo} alt="NFL Logo" className="w-40 h-40 mt-2 object-contain" />
    </Link>
    <div className="mt-45 w-full">
      {nfl.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  </div>

  
  
</div>

    );
}