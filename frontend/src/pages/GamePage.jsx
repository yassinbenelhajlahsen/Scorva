import { Link, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";

import { useGamePageData } from "../hooks/data/useGamePageData.js";
import slugify from "../utils/slugify.js";
import computeTopPlayers from "../utils/topPlayers.js";
import GamePageSkeleton from "../components/skeletons/GamePageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import GameMatchupHeader from "../components/game/GameMatchupHeader.jsx";
import GameInfoCard from "../components/game/GameInfoCard.jsx";
import GameTabBar from "../components/game/GameTabBar.jsx";
import OverviewTab from "../components/game/OverviewTab.jsx";
import AnalysisTab from "../components/game/AnalysisTab.jsx";
import PlaysTab from "../components/game/PlaysTab.jsx";

const GAME_TABS = [
  { id: "overview", label: "Overview" },
  { id: "analysis", label: "Analysis" },
  { id: "plays", label: "Plays" },
];

const slideVariants = {
  enter: (d) => ({ x: d * 60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d * -60, opacity: 0 }),
};
const slideTrans = { duration: 0.15, ease: [0.22, 1, 0.36, 1] };

export default function GamePage() {
  const location = useLocation();
  const { league, gameId } = useParams();
  const {
    gameData,
    loading,
    error,
    retry,
    staleIsPreGame,
    prediction,
    predictionLoading,
    winProbData,
    scoreMargin,
  } = useGamePageData(league, gameId);

  const initialTab = new URLSearchParams(location.search).get("tab");
  const [activeTab, setActiveTab] = useState(
    GAME_TABS.some((t) => t.id === initialTab) ? initialTab : "overview",
  );
  const [direction, setDirection] = useState(0);
  const prevTabIndex = useRef(0);
  const hashScrolledRef = useRef(false);

  useEffect(() => {
    hashScrolledRef.current = false;
  }, [location.hash]);

  function handleTabChange(tabId) {
    const newIndex = GAME_TABS.findIndex((t) => t.id === tabId);
    const d = newIndex > prevTabIndex.current ? 1 : -1;
    prevTabIndex.current = newIndex;
    setDirection(d);
    setActiveTab(tabId);
  }

  useEffect(() => {
    if (!gameData || !location.hash || hashScrolledRef.current) return;

    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      const row = document.getElementById(id);
      if (!row) {
        if (activeTab !== "analysis") handleTabChange("analysis");
        return;
      }

      hashScrolledRef.current = true;
      const link = row.querySelector("a");
      row.classList.add("transition-colors", "duration-300", "ease-in-out");
      link?.classList.add("transition-colors", "duration-300", "ease-in-out");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      void row.offsetWidth;

      row.classList.add("bg-accent/15");
      link?.classList.add("!text-white");

      setTimeout(() => {
        row.classList.remove("bg-accent/15");
        link?.classList.remove("!text-white");
        setTimeout(() => {
          row.classList.remove("transition-colors", "duration-300", "ease-in-out");
          link?.classList.remove("transition-colors", "duration-300", "ease-in-out");
        }, 300);
      }, 2000);
    });
  }, [gameData, location.hash, activeTab]);

  const gameObj = gameData?.json_build_object;
  const homeTeamData = gameObj?.homeTeam;
  const awayTeamData = gameObj?.awayTeam;

  const allPlayerStats = useMemo(
    () => [...(homeTeamData?.players || []), ...(awayTeamData?.players || [])],
    [homeTeamData?.players, awayTeamData?.players],
  );

  const topPlayers = useMemo(
    () => (gameObj ? computeTopPlayers(gameObj.game, allPlayerStats, league) : {}),
    [gameObj, allPlayerStats, league],
  );

  if (loading) {
    return <GamePageSkeleton scheduled={staleIsPreGame} />;
  }
  if (error && !gameData)
    return <ErrorState message="Could not load game data." onRetry={retry} />;
  if (!gameData?.json_build_object) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">
          Game Not Found
        </h1>
        <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
          The game you&apos;re looking for doesn&apos;t exist or hasn&apos;t
          been added yet.
        </p>
        <Link
          to={`/${league}`}
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          Back to {league?.toUpperCase()} Games
        </Link>
      </div>
    );
  }

  const { game, homeTeam: rawHome, awayTeam: rawAway } = gameData.json_build_object;

  // ESPN placeholder teams (e.g. "Suns/Trail Blazers") for undecided
  // play-in slots — sanitize to TBD so downstream components render cleanly.
  const sanitizeTeamInfo = (team) => {
    if (!team?.info?.name?.includes("/")) return team;
    return {
      ...team,
      info: { ...team.info, name: "TBD", shortName: "TBD", logoUrl: null },
    };
  };
  const homeTeam = sanitizeTeamInfo(rawHome);
  const awayTeam = sanitizeTeamInfo(rawAway);

  const isFinal = game.status.includes("Final");
  const inProgress =
    game.status.includes("In Progress") ||
    game.status.includes("Halftime") ||
    game.status.includes("End of Period");
  const isPreGame = !isFinal && !inProgress;
  const homeWon = isFinal && game.winnerId === homeTeam.info.id;
  const awayWon = isFinal && game.winnerId === awayTeam.info.id;
  const nhl = league === "nhl";
  const gameType = game.gameType || "regular";
  const isPlayoffGame = gameType === "playoff" || gameType === "final";
  const isChampionship = gameType === "final";
  const playoffLogo = isPlayoffGame
    ? `/${league.toUpperCase()}/${league.toUpperCase()}${isChampionship ? "Final" : "Playoff"}.webp`
    : null;
  const quarterKeys = nhl ? ["q1", "q2", "q3"] : ["q1", "q2", "q3", "q4"];

  const scoreColor = (won, lost) => {
    if (!isFinal && !inProgress) return "text-text-primary";
    if (won) return "text-win";
    if (lost) return "text-loss";
    return "text-text-tertiary";
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Link
        to={`/${league}`}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league?.toUpperCase()} Games</span>
      </Link>

      <GameMatchupHeader
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        game={game}
        league={league}
        isFinal={isFinal}
        inProgress={inProgress}
        homeWon={homeWon}
        awayWon={awayWon}
        playoffLogo={playoffLogo}
        scoreColor={scoreColor}
      />

      {/* Compare Teams button — hidden when either team is a placeholder */}
      {homeTeam.info.name !== "TBD" && awayTeam.info.name !== "TBD" && (
      <div className="flex justify-center mb-6">
        <Link
          to={`/compare`}
          state={{ league, type: "teams", id1: slugify(homeTeam.info.name), id2: slugify(awayTeam.info.name) }}
          className="inline-flex items-center gap-1.5 appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Compare Teams
        </Link>
      </div>
      )}

      <GameInfoCard game={game} isFinal={isFinal} inProgress={inProgress} />

      <GameTabBar
        tabs={GAME_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isPreGame={isPreGame}
        hasPlays={!!gameObj?.game?.hasPlays}
      />

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <m.div
          key={activeTab}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTrans}
        >
          {activeTab === "overview" && (
            <OverviewTab
              game={game}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              league={league}
              season={game.season}
              quarterKeys={quarterKeys}
              isFinal={isFinal}
              inProgress={inProgress}
              isPreGame={isPreGame}
              homeWon={homeWon}
              awayWon={awayWon}
              scoreColor={scoreColor}
              prediction={prediction}
              predictionLoading={predictionLoading}
              topPlayers={topPlayers}
              winProbData={winProbData}
              scoreMargin={scoreMargin}
            />
          )}

          {activeTab === "analysis" && (
            <AnalysisTab
              gameId={gameId}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              league={league}
              season={game.season}
              isFinal={isFinal}
              inProgress={inProgress}
            />
          )}

          {activeTab === "plays" && (
            <PlaysTab
              league={league}
              gameId={gameId}
              isFinal={isFinal}
              inProgress={inProgress}
            />
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
