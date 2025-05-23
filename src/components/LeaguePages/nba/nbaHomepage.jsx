import LeaguePage from '../LeaguePage';
import { useState, useEffect } from 'react';
import nbaGames from '../../../mock/nbaGames.js';
import GameCard from '../../GameCard';


export default function Nba() {
  const [nba, setNba] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      try {
        setNba(nbaGames.slice(0, 15));
        setLoading(false);
      } catch (err) {
        setError("Failed to load games.");
        setLoading(false);
      }
    }, 100);
  }, []);

  if (loading) return <div className="p-6">Loading featured games...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <>
      <LeaguePage
        league="NBA"
        links={[
          { to: "/nba/players", label: "Players" },
          { to: "/nba/teams", label: "Teams" }
        ]}
      />
      <h2 className="text-4xl font-bold text-center mt-20 mb-20">Games</h2>
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
        {nba.map((game) => (
          <div key={game.id} className="w-full max-w-md">
            <GameCard game={game} />
          </div>
        ))}
      </div>
    </>
  );
}