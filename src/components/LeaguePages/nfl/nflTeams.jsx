import logo from '../../../assets/NFLlogo.png';
import { Link } from 'react-router-dom';

export default function NflTeams() {

    return (
        <div className="p-6 min-h-screen">
      <div className="flex items-center gap-6 mb-12 ml-4">
        <Link to="/nfl">
        <img
          src={logo}
          alt={"NBA Logo"}
          className="w-20 h-20 object-contain"
        />
        </Link>

        <h1 className="text-6xl font-bold text-left">
          <Link
            to="/nfl"
            className="hover:text-orange-400 transition"
          >
            NFL
          </Link>{" "}
          Teams
        </h1>
      </div>
      </div>
    );
}