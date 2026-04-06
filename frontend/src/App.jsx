import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, LazyMotion, domAnimation } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./lib/queryClient.js";
import PageWrapper from "./components/layout/PageWrapper.jsx";
import Navbar from "./components/layout/Navbar.jsx";
import Footer from "./components/layout/Footer.jsx";
import ScrollToTop from "./components/layout/ScrollToTop.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LoadingPage from "./pages/LoadingPage.jsx";
import Homepage from "./pages/Homepage.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";

const About        = lazy(() => import("./pages/About.jsx"));
const LeaguePage   = lazy(() => import("./pages/LeaguePage.jsx"));
const PlayerPage   = lazy(() => import("./pages/PlayerPage.jsx"));
const TeamPage     = lazy(() => import("./pages/TeamPage.jsx"));
const GamePage     = lazy(() => import("./pages/GamePage.jsx"));
const PrivacyPage  = lazy(() => import("./pages/PrivacyPage.jsx"));
const ErrorPage    = lazy(() => import("./pages/ErrorPage.jsx"));

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
                    <div className="bg-surface-primary text-text-primary min-h-screen font-sans antialiased">
                      <Navbar />
                      <ScrollToTop />
                      <ErrorBoundary>
                        <AnimatedRoutes />
                      </ErrorBoundary>
                      <Footer />
                    </div>
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
