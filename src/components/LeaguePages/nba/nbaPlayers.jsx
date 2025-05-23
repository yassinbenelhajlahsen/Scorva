import logo from '../../../assets/NBAlogo.png';
import { Link } from 'react-router-dom';

export default function NbaPlayers() {

    return (
        <div className="p-6 min-h-screen">
      <div className="flex items-center gap-6 mb-12 ml-4">
        <Link to="/nba">
        <img
          src={logo}
          alt={"NBA Logo"}
          className="w-20 h-20 object-contain"
        />
        </Link>

        <h1 className="text-6xl font-bold text-left">
          <Link
            to="/nba"
            className="hover:text-orange-400 transition"
          >
            NBA
          </Link>{" "}
          Players
        </h1>
      </div>
      </div>
    );
}