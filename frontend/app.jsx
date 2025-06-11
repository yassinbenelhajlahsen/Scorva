import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageWrapper from './components/pageWrapper.jsx';
import Hero from './components/Hero.jsx';
import Homepage from './components/Homepage.jsx';
import About from './components/About.jsx';
import LeaguePage from './components/LeaguePages/LeaguePage.jsx';
import PlayerListPage from './components/LeaguePages/PlayerListPage.jsx';
import TeamListPage from './components/LeaguePages/TeamListPage.jsx';
import PlayerPage from './components/LeaguePages/PlayerPage.jsx';
import TeamPage from './components/LeaguePages/TeamPage.jsx';
import GamePage from './components/LeaguePages/GamePage.jsx';
import ErrorPage from './components/ErrorPage.jsx';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ScrollToTop from './ScrollToTop.jsx';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageWrapper>
              <Hero />
              <Homepage />
            </PageWrapper>
          }
        />
        <Route
          path="/about"
          element={
            <PageWrapper>
              <About />
            </PageWrapper>
          }
        />
        <Route
          path="/:league"
          element={
            <PageWrapper>
              <LeaguePage />
            </PageWrapper>
          }
        />
        <Route
          path="/:league/players"
          element={
            <PageWrapper>
              <PlayerListPage />
            </PageWrapper>
          }
        />
        <Route
          path="/:league/teams"
          element={
            <PageWrapper>
              <TeamListPage />
            </PageWrapper>
          }
        />
        <Route
          path="/:league/players/:playerId"
          element={
            <PageWrapper>
              <PlayerPage />
            </PageWrapper>
          }
        />
        <Route
          path="/:league/teams/:teamId"
          element={
            <PageWrapper>
              <TeamPage />
            </PageWrapper>
          }
        />
        <Route
          path="/:league/games/:gameId"
          element={
            <PageWrapper>
              <GamePage />
            </PageWrapper>
          }
        />
        <Route
          path="*"
          element={
            <PageWrapper>
              <ErrorPage />
            </PageWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
 <div className="bg-zinc-900 text-white min-h-screen">
      <Navbar />
       <ScrollToTop/>      
       <AnimatedRoutes />
       <Footer/>

           </div>
    </BrowserRouter>
  );
}
