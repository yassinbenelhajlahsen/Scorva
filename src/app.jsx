import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Homepage from './components/Homepage';
import About from './components/About';
import Nba from './components/LeaguePages/nba';
import Nfl from './components/LeaguePages/nfl';
import Nhl from './components/LeaguePages/nhl';
import Footer  from "./components/Footer.jsx";

export default function App() {
  return (
    <div className="bg-zinc-900 text-white min-h-screen">
      <Navbar />
      <Routes>
        {/* Home Route */}
        <Route
          path="/"
          element={
            <>
              <Hero />
              <Homepage />
            </>
          }
        />

        {/* About Route */}
        <Route path="/about" element={<About />} />

        {/* League Pages */}
        <Route path="/nba" element={<Nba/>} />
        <Route path="/nfl" element={<Nfl/>} />
        <Route path="/nhl" element={<Nhl/>} />
      </Routes>
      <Footer />
    </div>
  );
}
