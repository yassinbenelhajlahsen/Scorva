import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/favicon.png";
import SearchBar from "./SearchBar.jsx";

export default function Navbar() {
  //const [query, setQuery] = useState("");



  return (
    <nav className="bg-zinc-900 text-white flex flex-col sm:flex-row items-center justify-between px-6 py-4 shadow-md gap-4">
      <div className="flex items-center gap-2">
        <Link to="/">
          <img src={logo} alt="Logo" className="w-10 h-10" />
        </Link>
        <div className="text-2xl font-bold hover:text-orange-400 transition">
          <Link to="/">Scorva</Link>
        </div>
      </div>

      {/* pass allItems down 
      <SearchBar allItems={allItems} query={query} setQuery={setQuery} />
*/}
      <div className="flex gap-4">
        <Link to="/nba" className="hover:text-orange-400 transition">
          NBA
        </Link>
        <Link to="/nfl" className="hover:text-orange-400 transition">
          NFL
        </Link>
        <Link to="/nhl" className="hover:text-orange-400 transition">
          NHL
        </Link>
        <Link to="/about" className="hover:text-orange-400 transition">
          About
        </Link>
      </div>
    </nav>
  );
}
