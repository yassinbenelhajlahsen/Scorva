import logo from '../../../assets/NHLlogo.png';
import { Link } from 'react-router-dom';

export default function NhlPlayers() {

    return (
        <div className="p-6 min-h-screen">
      <div className="flex items-center gap-6 mb-12 ml-4">
        <Link to="/nhl">
        <img
          src={logo}
          alt={"NFL Logo"}
          className="w-20 h-20 object-contain"
        />
        </Link>

        <h1 className="text-6xl font-bold text-left">
          <Link
            to="/nhl"
            className="hover:text-orange-400 transition"
          >
            NHL
          </Link>{" "}
          Players
        </h1>
      </div>
      </div>
    );
}