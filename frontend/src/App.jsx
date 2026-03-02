import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageWrapper from "./components/layout/PageWrapper.jsx";
import Homepage from "./pages/Homepage.jsx";
import About from "./pages/About.jsx";
import LeaguePage from "./pages/LeaguePage.jsx";
import PlayerPage from "./pages/PlayerPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import GamePage from "./pages/GamePage.jsx";
import ErrorPage from "./pages/ErrorPage.jsx";
import Navbar from "./components/layout/Navbar.jsx";
import Footer from "./components/layout/Footer.jsx";
import ScrollToTop from "./components/layout/ScrollToTop.jsx";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageWrapper>
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
      <div className="bg-surface-primary text-text-primary min-h-screen font-sans antialiased">
        <Navbar />
        <ScrollToTop />
        <AnimatedRoutes />
        <Footer />
      </div>
    </BrowserRouter>
  );
}
