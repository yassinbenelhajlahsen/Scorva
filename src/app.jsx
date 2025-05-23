import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Homepage from './components/Homepage';
import About from './components/About';
import Nba from './components/LeaguePages/nba/nbaHomepage.jsx';
import Nfl from './components/LeaguePages/nfl/nflHomepage.jsx';
import Nhl from './components/LeaguePages/nhl/nhlHomepage.jsx';
import Footer from "./components/Footer.jsx";
import NflPlayers from './components/LeaguePages/nfl/nflPlayers.jsx';
import NflTeams from './components/LeaguePages/nfl/nflTeams.jsx';
import NhlPlayers from './components/LeaguePages/nhl/nhlPlayers.jsx';
import NhlTeams from './components/LeaguePages/nhl/nhlTeams.jsx';
import NbaPlayers from './components/LeaguePages/nba/nbaPlayers.jsx'; 
import NbaTeams from './components/LeaguePages/nba/nbaTeams.jsx';

export default function App() {
  const location = useLocation();

  return (
    <div className="bg-zinc-900 text-white min-h-screen">
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<><Hero /><Homepage /></>} />
          <Route path="/about" element={<About />} />
          <Route path="/nba" element={<Nba />} />
          <Route path="/nfl" element={<Nfl />} />
          <Route path="/nhl" element={<Nhl />} />
          <Route path="/nfl/players" element={<NflPlayers />} />
          <Route path="/nfl/teams" element={<NflTeams />} />
          <Route path="/nhl/players" element={<NhlPlayers />} />
          <Route path="/nhl/teams" element={<NhlTeams />} />
          <Route path="/nba/players" element={<NbaPlayers />} />
          <Route path="/nba/teams" element={<NbaTeams />} />
          <Route
            path="*"
            element={
              <div className="flex items-center justify-center min-h-screen">
                <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
              </div>
            }
          />
        </Routes>
      </AnimatePresence>
      <Footer />
    </div>
  );
}