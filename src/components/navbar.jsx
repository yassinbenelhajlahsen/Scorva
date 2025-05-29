// Navbar.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/favicon.png";
import SearchBar from "./SearchBar.jsx";

import nbaTeams from "../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../mock/mockNflData/nflTeams.js";
import nhlTeams from "../mock/mockNhlData/nhlTeams.js";

import nbaGames from "../mock/mockNbaData/nbaGames.js";
import nflGames from "../mock/mockNflData/nflGames.js";
import nhlGames from "../mock/mockNhlData/nhlGames.js";

import nbaPlayers from "../mock/mockNbaData/nbaPlayers.js";
import nflPlayers from "../mock/mockNflData/nflPlayers.js";
import nhlPlayers from "../mock/mockNhlData/nhlPlayers.js";
import getTeamLogo from "../HelperFunctions/getLogoFromTeam.js";

export default function Navbar() {
  const [query, setQuery] = useState("");

  const teamItems = [
    ...nbaTeams.map((t) => ({
      id: t.id,
      name: t.name,
      type: "team",
      league: "nba",
      image: t.logo,
    })),
    ...nflTeams.map((t) => ({
      id: t.id,
      name: t.name,
      type: "team",
      league: "nfl",
      image: t.logo,
    })),
    ...nhlTeams.map((t) => ({
      id: t.id,
      name: t.name,
      type: "team",
      league: "nhl",
      image: t.logo,
    })),
  ];

  const gameItems = [
    ...nbaGames.map((g) => ({
      id: g.id,
      name: `${g.homeTeam} vs ${g.awayTeam}`,
      type: "game",
      league: "nba",
      homeLogo: getTeamLogo(g.homeTeam),
      awayLogo: getTeamLogo(g.awayTeam),
     
    })),
    ...nflGames.map((g) => ({
      id: g.id,
      name: `${g.homeTeam} vs ${g.awayTeam}`,
      type: "game",
      league: "nfl",
      homeLogo: getTeamLogo(g.homeTeam),
      awayLogo: getTeamLogo(g.awayTeam),
    })),
    ...nhlGames.map((g) => ({
      id: g.id,
      name: `${g.homeTeam} vs ${g.awayTeam}`,
      type: "game",
      league: "nhl",
      homeLogo: getTeamLogo(g.homeTeam),
      awayLogo: getTeamLogo(g.awayTeam),
    })),
  ];

  const playerItems = [
    ...nbaPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      type: "player",
      league: "nba",
      image: p.image,
    })),
    ...nflPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      type: "player",
      league: "nfl",
      image: p.image,
    })),
    ...nhlPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      type: "player",
      league: "nhl",
      image: p.image,
    })),


  ];
  // 2. Combine them
  const allItems = [...teamItems, ...gameItems, ...playerItems];

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

      {/* pass allItems down */}
      <SearchBar allItems={allItems} query={query} setQuery={setQuery} />

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
