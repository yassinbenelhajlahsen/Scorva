import { Link }  from 'react-router-dom';

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export default function PlayerCard({ player, league}) {


  return (
    <Link to={`/${league}/players/${slugify(player.name)}`}>
  <div className="relative border border-zinc-700 bg-zinc-800 p-6 text-center rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer max-w-md min-w-[200px] h-48 flex flex-col items-center justify-center">
    <img
      src={player.image_url || "https://cdn.nba.com/headshots/nba/latest/1040x760/2374.png"}
      alt={player.name}
      className="w-20 h-20 object-contain rounded-full"
      onError={e => { e.target.onerror = null; e.target.src = "https://cdn.nba.com/headshots/nba/latest/1040x760/2374.png"; }}
      
    />
    <div className="mt-2 text-lg font-bold text-white">{player.name}</div>
    <div className="text-sm text-gray-300">{player.position}</div>
  </div>
</Link>
);

}