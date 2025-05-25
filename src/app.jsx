import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/navbar';
import Hero from './components/Hero';
import Homepage from './components/Homepage';
import About from './components/About';
import Footer from "./components/Footer.jsx";
import PlayerPage from './components/LeaguePages/PlayerPage.jsx';
import TeamPage from './components/LeaguePages/TeamPage.jsx';
import GamePage from './components/LeaguePages/GamePage.jsx';
import LeaguePage from './components/LeaguePages/LeaguePage.jsx';
import PlayerListPage from './components/LeaguePages/PlayerListPage.jsx';
import TeamListPage from './components/LeaguePages/TeamListPage.jsx';

export default function App() {
  const location = useLocation();

  return (
    <div className="bg-zinc-900 text-white min-h-screen">
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<><Hero /><Homepage /></>} />
          <Route path="/about" element={<About />} />
          <Route path="/:league" element={<LeaguePage />} />
          <Route path="/:league/players" element={<PlayerListPage />} />
          <Route path="/:league/teams" element={<TeamListPage />} />
          <Route path="/:league/players/:playerId" element={<PlayerPage />} />
          <Route path="/:league/teams/:teamId" element={<TeamPage />} />
          <Route path="/:league/games/:gameId" element={<GamePage />} />

          <Route
            path="*"
            element={
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
                <Link
                  to="/"
                  className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
                >
                  Return to Homepage
                </Link>
              </div>
            }
          />
        </Routes>
      </AnimatePresence>
      <Footer />
    </div>
  );
}