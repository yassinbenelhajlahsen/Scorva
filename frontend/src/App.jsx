import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient.js";
import PageWrapper from "./components/layout/PageWrapper.jsx";
import Navbar from "./components/layout/Navbar.jsx";
import ScoresBar from "./components/layout/ScoresBar.jsx";
import Footer from "./components/layout/Footer.jsx";
import ScrollToTop from "./components/layout/ScrollToTop.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LoadingPage from "./pages/LoadingPage.jsx";
import Homepage from "./pages/Homepage.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import { FavoritesPanelProvider } from "./context/FavoritesPanelContext.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import IOSInstallHint from "./components/pwa/IOSInstallHint.jsx";
import { trackVisit } from "./lib/pwaVisitTracking.js";
import { resolveLeagueFilter } from "./utils/slateDate.js";

function lazyWithReload(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const isChunkError =
        err?.name === "ChunkLoadError" ||
        /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
          err?.message || ""
        );
      if (isChunkError && !sessionStorage.getItem("chunk-reload")) {
        sessionStorage.setItem("chunk-reload", "1");
        window.location.reload();
        return { default: () => null };
      }
      throw err;
    }
  });
}

const About        = lazyWithReload(() => import("./pages/About.jsx"));
const LeaguePage   = lazyWithReload(() => import("./pages/LeaguePage.jsx"));
const PlayerPage   = lazyWithReload(() => import("./pages/PlayerPage.jsx"));
const TeamPage     = lazyWithReload(() => import("./pages/TeamPage.jsx"));
const GamePage     = lazyWithReload(() => import("./pages/GamePage.jsx"));
const PrivacyPage  = lazyWithReload(() => import("./pages/PrivacyPage.jsx"));
const ErrorPage    = lazyWithReload(() => import("./pages/ErrorPage.jsx"));
const ComparePage  = lazyWithReload(() => import("./pages/ComparePage.jsx"));
const PulsePage    = lazyWithReload(() => import("./pages/PulsePage.jsx"));
const MockCards    = lazyWithReload(() => import("./pages/MockCards.jsx"));

function useBlockEdgeSwipe() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let edgeArmed = false;

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      // Arm if the touch starts within 30px of either screen edge — that's
      // the band iOS uses for its history-swipe gesture recognizer.
      edgeArmed = startX < 30 || startX > window.innerWidth - 30;
    };

    const onTouchMove = (e) => {
      if (!edgeArmed) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);
      // If the gesture is dominantly horizontal, block it before iOS
      // recognizes it as edge-swipe-back.
      if (Math.abs(dx) > 8 && Math.abs(dx) > dy) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);
}

function AppShellInner() {
  const { pathname } = useLocation();
  const leagueFilter = resolveLeagueFilter(pathname);

  useEffect(() => {
    trackVisit();
    sessionStorage.removeItem("chunk-reload");
  }, []);
  useBlockEdgeSwipe();

  return (
    <div className="bg-surface-primary text-text-primary min-h-screen font-sans antialiased">
      <Navbar />
      <ScoresBar leagueFilter={leagueFilter} />
      <ScrollToTop />
      <ErrorBoundary>
        <AnimatedRoutes />
      </ErrorBoundary>
      <Footer />
      <IOSInstallHint />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<LoadingPage />}>
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
          path="/compare"
          element={
            <PageWrapper>
              <ComparePage />
            </PageWrapper>
          }
        />
        <Route
          path="/pulse"
          element={
            <PageWrapper>
              <PulsePage />
            </PageWrapper>
          }
        />
        <Route path="/reports" element={<Navigate to="/pulse" replace />} />
        <Route
          path="/_mocks/cards"
          element={
            <PageWrapper>
              <MockCards />
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
          path="/privacy"
          element={
            <PageWrapper>
              <PrivacyPage />
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
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="*"
            element={
              <AuthProvider>
                <SettingsProvider>
                  <ChatProvider>
                  <FavoritesPanelProvider>
                    <AppShellInner />
                  </FavoritesPanelProvider>
                  </ChatProvider>
                </SettingsProvider>
              </AuthProvider>
            }
          />
        </Routes>
      </LazyMotion>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </BrowserRouter>
  );
}
