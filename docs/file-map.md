# Scorva — File Map

Key file locations for every backend and frontend subsystem.
For architecture context see [docs/ARCHITECTURE.md](ARCHITECTURE.md).

## Backend — Infrastructure

| What                               | Where                                                         |
| ---------------------------------- | ------------------------------------------------------------- |
| Backend entry                      | `backend/src/index.js`                                        |
| Backend logger                     | `backend/src/logger.js`                                       |
| CORS, rate limits, SSE limiter     | `backend/src/middleware/index.js`                              |
| JWT auth middleware                | `backend/src/middleware/auth.js`                               |
| Prisma schema                      | `backend/prisma/schema.prisma`                                |
| Generated client                   | `backend/src/generated/prisma/` (do not edit)                 |
| DB pool singleton                  | `backend/src/db/db.js`                                        |
| Notification bus (PG LISTEN)       | `backend/src/db/notificationBus.js`                           |
| Cache module                       | `backend/src/cache/cache.js`                                  |
| Season cache helper                | `backend/src/cache/seasons.js`                                |
| Sport path mapping util            | `backend/src/utils/sportPath.js`                              |
| Standings tiebreaker util          | `backend/src/utils/tiebreaker.js`                             |
| PG date → string util              | `backend/src/utils/pgDateToString.js`                         |
| Date parser util                   | `backend/src/utils/dateParser.js`                             |
| Slug resolver util                 | `backend/src/utils/slugResolver.js`                           |
| Stat filter SQL fragments (DNP)    | `backend/src/utils/statFilters.js`                            |

## Backend — Domain: Games

| What                    | Where                                                           |
| ----------------------- | --------------------------------------------------------------- |
| Routes                  | `backend/src/routes/games/` (games, gameDetail, prediction, plays, live, topPerformances) |
| Controllers             | `backend/src/controllers/games/` (games, gameDates, gameDetail, prediction, plays, live, topPerformances) |
| Games service           | `backend/src/services/games/gamesService.js`                    |
| Game detail service     | `backend/src/services/games/gameDetailService.js`               |
| Game detail query builder | `backend/src/services/games/gameDetailQueryBuilder.js`        |
| Win probability service | `backend/src/services/games/winProbabilityService.js`           |
| Prediction service      | `backend/src/services/games/predictionService.js`               |
| Plays service           | `backend/src/services/games/playsService.js`                    |
| Top performances service | `backend/src/services/games/topPerformancesService.js`         |
| Rating engine (NBA)     | `backend/src/services/games/ratingEngine.js` (`gradeFromRaw`, `attachRatingGrade`, `recomputeGame`) |

## Backend — Domain: Players

| What                       | Where                                                        |
| -------------------------- | ------------------------------------------------------------ |
| Routes                     | `backend/src/routes/players/` (players, playerDetail, similarPlayers) |
| Controllers                | `backend/src/controllers/players/`                           |
| Players service            | `backend/src/services/players/playersService.js`             |
| Player detail service      | `backend/src/services/players/playerDetailService.js`        |
| Similar players service    | `backend/src/services/players/similarPlayersService.js`      |

## Backend — Domain: Teams

| What            | Where                                                |
| --------------- | ---------------------------------------------------- |
| Route           | `backend/src/routes/teams/teams.js` (teams, seasons, roster) |
| Controller      | `backend/src/controllers/teams/teamsController.js`   |
| Service (list/seasons/roster) | `backend/src/services/teams/teamsService.js` (`getTeamsByLeague`, `getTeamAvailableSeasons`, `getTeamRoster`) |

## Backend — Domain: Standings & Playoffs

| What                  | Where                                                         |
| --------------------- | ------------------------------------------------------------- |
| Routes                | `backend/src/routes/standings/` (standings, playoffs)         |
| Controllers           | `backend/src/controllers/standings/`                          |
| Standings service     | `backend/src/services/standings/standingsService.js`          |
| NBA playoffs service  | `backend/src/services/standings/playoffsService.js`           |
| NHL playoffs service  | `backend/src/services/standings/nhlPlayoffsService.js`        |
| NFL playoffs service  | `backend/src/services/standings/nflPlayoffsService.js`        |
| Shared playoffs helpers | `backend/src/services/standings/_playoffsCommon.js`         |

## Backend — Domain: User & Favorites

| What                  | Where                                                        |
| --------------------- | ------------------------------------------------------------ |
| Routes                | `backend/src/routes/user/` (user, favorites)                 |
| Controllers           | `backend/src/controllers/user/`                              |
| User service          | `backend/src/services/user/userService.js`                   |
| Favorites service     | `backend/src/services/user/favoritesService.js`              |
| Ensure-user helper    | `backend/src/services/user/ensureUser.js`                    |

## Backend — Domain: AI (Chat, Summary, Embeddings)

| What                              | Where                                                      |
| --------------------------------- | ---------------------------------------------------------- |
| Routes                            | `backend/src/routes/ai/` (aiSummary, chat)                 |
| Controllers                       | `backend/src/controllers/ai/`                              |
| AI summary service                | `backend/src/services/ai/aiSummaryService.js`              |
| Embedding service (RAG)           | `backend/src/services/ai/embeddingService.js`              |
| Chat agent (LLM loop)             | `backend/src/services/ai/chat/agentService.js`             |
| Chat tool reference (docs)        | `docs/agent-tools.md`                                      |
| Chat tool schemas                 | `backend/src/services/ai/chat/toolDefinitions.js`          |
| Chat tools (dispatch)             | `backend/src/services/ai/chat/toolsService.js`             |
| Chat tool implementations         | `backend/src/services/ai/chat/tools/`                      |
| Chat unified player tool          | `backend/src/services/ai/chat/tools/playerUnified.js`      |
| Chat games / find-games tools     | `backend/src/services/ai/chat/tools/{findGames,topSingleGame,playerGameLog,playerCareer}.js` |
| Chat advanced/clutch/awards/streaks | `backend/src/services/ai/chat/tools/{advancedStats,clutchPerformance,playerAwards,streaks}.js` |
| Chat similar/team-history/playoffs  | `backend/src/services/ai/chat/tools/{similarPlayers,playerTeamHistory,playoffBracket}.js` |
| Chat plays tool                   | `backend/src/services/ai/chat/tools/plays.js`              |
| Chat injuries tool                | `backend/src/services/ai/chat/tools/injuries.js`           |
| Chat history                      | `backend/src/services/ai/chat/historyService.js`           |

## Backend — Domain: Reports & Streaks

| What                              | Where                                                       |
| --------------------------------- | ----------------------------------------------------------- |
| Reports route                     | `backend/src/routes/reports/reports.js`                     |
| Reports controller                | `backend/src/controllers/reports/reportsController.js`      |
| Reports service (orchestrator)    | `backend/src/services/reports/reportsService.js`            |
| Injuries report query             | `backend/src/services/reports/injuriesReports.js`           |
| Moves report query                | `backend/src/services/reports/movesReports.js`              |
| Moves parser (ESPN transactions)  | `backend/src/services/reports/movesParser.js`               |
| Birthdays report query            | `backend/src/services/reports/birthdaysReports.js`          |
| Streaks report query              | `backend/src/services/reports/streaksReports.js`            |
| Streak routes                     | `backend/src/routes/streaks/streaks.js`                     |
| Streak controller                 | `backend/src/controllers/streaks/streaksController.js`      |
| Active-streak service             | `backend/src/services/streaks/streaksService.js`            |
| Streak tier ranking helpers       | `backend/src/services/streaks/streakTiers.js`               |
| Streak events ingestion worker    | `backend/src/ingestion/streakEvents.js`                     |
| Streak backfill (one-time)        | `backend/src/ingestion/scripts/backfillStreaks.js`          |
| Non-scoring plays cleanup         | `backend/src/ingestion/cleanup/cleanupPlays.js`             |
| Injury status sync (ESPN)         | `backend/src/ingestion/syncInjuries.js`                     |

## Backend — Domain: Meta (News, Search, Seasons, H2H, Webhooks)

| What                  | Where                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Routes                | `backend/src/routes/meta/` (news, search, seasons, headToHead, webhooks) |
| Controllers           | `backend/src/controllers/meta/`                                   |
| News service          | `backend/src/services/meta/newsService.js`                        |
| Search service        | `backend/src/services/meta/searchService.js`                      |
| Search query parser   | `backend/src/services/meta/searchParser.js`                       |
| Team resolver helper  | `backend/src/services/meta/teamResolver.js`                       |
| Seasons service       | `backend/src/services/meta/seasonsService.js`                     |
| Head-to-head service  | `backend/src/services/meta/headToHeadService.js`                  |

## Backend — Ingestion

| What                          | Where                                                    |
| ----------------------------- | -------------------------------------------------------- |
| ESPN API client (fetch+retry) | `backend/src/ingestion/espn/espnAPIClient.js`            |
| ESPN image helper             | `backend/src/ingestion/espn/espnImage.js`                |
| Awards ESPN client            | `backend/src/ingestion/awards/espnAwardsClient.js`       |
| Awards type/name normalizer   | `backend/src/ingestion/awards/awardTypeMap.js`           |
| Awards calendar-year resolver | `backend/src/ingestion/awards/seasonTranslator.js`       |
| Awards seed script (one-shot) | `backend/src/ingestion/scripts/seedAwards.js`            |
| Event processor               | `backend/src/ingestion/pipeline/eventProcessor.js`       |
| Scheduled upsert              | `backend/src/ingestion/pipeline/upsert.js`               |
| Live sync worker              | `backend/src/ingestion/pipeline/liveSync.js`             |
| Historical upsert             | `backend/src/ingestion/pipeline/historicalUpsert.js`     |
| Common stat mappings          | `backend/src/ingestion/mappings/commonMappings.js`       |
| Stats → schema mapper         | `backend/src/ingestion/mappings/mapStatsToSchema.js`     |
| NBA shot distance extractor   | `backend/src/ingestion/mappings/nbaPlayDistance.js`      |
| NBA participant role inference | `backend/src/ingestion/mappings/nbaPlayRoles.js`        |
| Upsert functions              | `backend/src/ingestion/upsert/` (Game, Team, Player, Stat, Plays, PlayParticipants) |
| Backfill — player ratings     | `backend/src/ingestion/scripts/backfillPlayerRatings.js` |
| Player cache manager          | `backend/src/ingestion/playerCacheManager.js`            |
| Player similarity embeddings  | `backend/src/ingestion/computePlayerEmbeddings.js`       |
| Popularity refresh            | `backend/src/ingestion/refreshPopularity.js`             |
| Playoff game cleanup          | `backend/src/ingestion/cleanup/cleanupClinchedPlayoffGames.js` |
| Backfill scripts              | `backend/src/ingestion/scripts/`                         |
| Game replay script (dev)      | `backend/scripts/replayGame.js`                          |
| Alias seed data               | `backend/prisma/seeds/player_aliases.json`               |
| Alias seed script             | `backend/prisma/seeds/seedAliases.js`                    |

## Backend — Tests

| What                 | Where                                          |
| -------------------- | ---------------------------------------------- |
| Test suite           | `backend/__tests__/`                           |
| Test helpers         | `backend/__tests__/helpers/testHelpers.js`     |

## Frontend — Core

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Entry                   | `frontend/src/main.jsx`                                        |
| Router                  | `frontend/src/App.jsx`                                         |
| Design tokens           | `frontend/src/index.css` (`@theme`)                            |
| Supabase client         | `frontend/src/lib/supabase.js`                                 |
| TanStack Query client   | `frontend/src/lib/queryClient.js`                              |
| Query keys + prefetch   | `frontend/src/lib/query.js`                                    |
| Auth context            | `frontend/src/context/AuthContext.jsx`                         |
| Settings context        | `frontend/src/context/SettingsContext.jsx`                     |
| Error boundary          | `frontend/src/components/ErrorBoundary.jsx`                    |
| OAuth callback page     | `frontend/src/pages/AuthCallback.jsx`                          |
| API wrappers            | `frontend/src/api/`                                            |
| Data hooks              | `frontend/src/hooks/{ai,data,live,user}/`                      |
| Top-level UX hooks      | `frontend/src/hooks/{useSeasonParam,usePullToRefresh,useStandalone,useSwipeToClose,useSwipeableTabs}.js` |
| Utilities               | `frontend/src/utils/`                                          |
| Slate-date util         | `frontend/src/utils/slateDate.js` (`getSlateDateET`, `compactTime`, `statusGroup`) |

## Frontend — Layout

| What                           | Where                                                       |
| ------------------------------ | ----------------------------------------------------------- |
| Navbar                         | `frontend/src/components/layout/Navbar.jsx`                 |
| Navbar search (icon-driven)    | `frontend/src/components/layout/NavbarSearch.jsx`           |
| Avatar dropdown                | `frontend/src/components/layout/AvatarDropdown.jsx`         |
| Footer                         | `frontend/src/components/layout/Footer.jsx`                 |
| Page wrapper                   | `frontend/src/components/layout/PageWrapper.jsx`            |
| Scroll-to-top on route change  | `frontend/src/components/layout/ScrollToTop.jsx`            |
| ScoresBar (global slate)       | `frontend/src/components/layout/ScoresBar.jsx`              |
| ScoresBar hook                 | `frontend/src/hooks/data/useScoresBar.js`                   |
| Per-league slate hook          | `frontend/src/hooks/data/useSlateGames.js`                  |
| Visibility-reconnect hook      | `frontend/src/hooks/live/useVisibilityReconnect.js`         |
| ScoresBar skeleton             | exported from `frontend/src/components/skeletons/LeaguePageSkeleton.jsx` |

## Frontend — PWA / Mobile UX

| What                      | Where                                                       |
| ------------------------- | ----------------------------------------------------------- |
| iOS install hint          | `frontend/src/components/pwa/IOSInstallHint.jsx`            |
| Pull-to-refresh wrapper   | `frontend/src/components/ui/PullToRefresh.jsx`              |
| Pull-to-refresh hook      | `frontend/src/hooks/usePullToRefresh.js`                    |
| Swipeable tabs wrapper    | `frontend/src/components/ui/SwipeableTabs.jsx`              |
| Swipeable tabs hook       | `frontend/src/hooks/useSwipeableTabs.js`                    |
| Swipe-to-close (panels)   | `frontend/src/hooks/useSwipeToClose.js`                     |
| Standalone-mode detection | `frontend/src/hooks/useStandalone.js`                       |

## Frontend — Game

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Game page data hook     | `frontend/src/hooks/data/useGamePageData.js`                   |
| Game page components    | `frontend/src/components/game/` (GameMatchupHeader, GameInfoCard, GameTabBar, OverviewTab, AnalysisTab, PlaysTab) |
| Prediction hook         | `frontend/src/hooks/data/usePrediction.js`                     |
| Prediction card         | `frontend/src/components/cards/PredictionCard.jsx`             |
| Win probability hook    | `frontend/src/hooks/data/useWinProbability.js`                 |
| Win probability chart   | `frontend/src/components/ui/GameChart.jsx`                     |
| Plays API               | `frontend/src/api/plays.js`                                    |
| Plays hook              | `frontend/src/hooks/data/usePlays.js`                          |
| Play-by-play component  | `frontend/src/components/ui/PlayByPlay.jsx`                    |
| Game dates hook         | `frontend/src/hooks/data/useGameDates.js`                      |
| SSE live hooks          | `frontend/src/hooks/live/useLiveGame.js`, `useLiveGames.js`   |

## Frontend — Players

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Similar players hook    | `frontend/src/hooks/data/useSimilarPlayers.js`                 |
| Similar players card    | `frontend/src/components/cards/SimilarPlayersCard.jsx`         |

## Frontend — Teams

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Team hook               | `frontend/src/hooks/data/useTeam.js`                           |
| Team roster hook        | `frontend/src/hooks/data/useTeamRoster.js`                     |
| Roster grid component   | `frontend/src/components/team/RosterGrid.jsx`                  |

## Frontend — Compare

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Compare API             | `frontend/src/api/compare.js`                                  |
| Compare hook            | `frontend/src/hooks/data/useHeadToHead.js`                     |
| Compare modal           | `frontend/src/components/compare/CompareModal.jsx`             |
| Compare page            | `frontend/src/pages/ComparePage.jsx`                           |
| Compare page skeleton   | `frontend/src/components/skeletons/ComparePageSkeleton.jsx`    |

## Frontend — Playoffs

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Playoffs API            | `frontend/src/api/playoffs.js`                                 |
| Playoffs hook (NBA + NHL + NFL) | `frontend/src/hooks/data/usePlayoffs.js`               |
| League labels constant  | `frontend/src/constants/leagueLabels.js` (LEAGUE_LABELS — per-league: round titles, `playoffsSupported`, `playInSupported`, `bracketKeys`, `bracketTitles`, `finalsKey`, `conferences`, `round1SeriesCount`) |
| Playoffs components     | `frontend/src/components/playoffs/` (PlayoffsBracket, SeriesCard, PlayInSection) |
| Playoffs skeleton       | `frontend/src/components/skeletons/PlayoffsSkeleton.jsx`       |

## Frontend — User & Favorites

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Favorites API           | `frontend/src/api/favorites.js`                                |
| Favorites hooks         | `frontend/src/hooks/user/useFavorites.js`, `useFavoriteToggle.js` |
| Favorites panel         | `frontend/src/context/FavoritesPanelContext.jsx`, `frontend/src/components/favorites/FavoritesPanel.jsx` |
| Favorites sections      | `frontend/src/components/favorites/FavoritePlayersSection.jsx`, `FavoriteTeamsSection.jsx` |
| User API                | `frontend/src/api/user.js`                                     |
| User prefs hook         | `frontend/src/hooks/user/useUserPrefs.js`                      |
| Settings drawer         | `frontend/src/components/settings/SettingsDrawer.jsx`          |
| Settings tabs           | `frontend/src/components/settings/FavoritesTab.jsx`, `AccountTab.jsx` |
| Auth modal              | `frontend/src/components/auth/AuthModal.jsx`                   |
| Auth components         | `frontend/src/components/auth/` (AuthModal, PasswordChecklist) |

## Frontend — Chat

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Chat API                | `frontend/src/api/chat.js`                                     |
| Chat context            | `frontend/src/context/ChatContext.jsx`                         |
| Chat actions hook       | `frontend/src/hooks/ai/useChatActions.js`                      |
| Chat components         | `frontend/src/components/chat/`                                |

## Frontend — Pulse, Reports & Streaks

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Pulse page              | `frontend/src/pages/PulsePage.jsx` (route `/pulse`; `/reports` redirects here) |
| Highlights tab          | `frontend/src/components/highlights/HighlightsTab.jsx` (mode toggle + Beta hint + section composition; rendered inside Pulse Highlights sub-tab) |
| Top performers          | `frontend/src/components/highlights/TopPerformers.jsx` (props: `league`, `mode`; leaderboard list) |
| Top performers skeleton | `frontend/src/components/skeletons/TopPerformersSkeleton.jsx` |
| Top performances hook   | `frontend/src/hooks/data/useTopPerformances.js`                |
| Reports API             | `frontend/src/api/reports.js`                                  |
| Reports hook            | `frontend/src/hooks/data/useReports.js`                        |
| Reports components      | `frontend/src/components/reports/` (ReportsList, ReportRow, InjuryReportRow, MoveReportRow, BirthdayReportRow, StreakReportRow, NRBadge) |
| Report row skeleton     | `frontend/src/components/skeletons/ReportRowSkeleton.jsx`      |
| Streak API              | `frontend/src/api/streaks.js`                                  |
| Streak hook             | `frontend/src/hooks/data/useStreak.js`                         |
| StreakBadge component   | `frontend/src/components/ui/StreakBadge.jsx`                   |
| PlayerStatusBadge       | `frontend/src/components/player/PlayerStatusBadge.jsx`         |
| TeamComparison          | `frontend/src/components/game/TeamComparison.jsx` (rendered in AnalysisTab on GamePage) |

## Frontend — Top Performances (Pulse → Highlights)

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Top Performances API    | `frontend/src/api/topPerformances.js`                          |
| Top Performances hook   | `frontend/src/hooks/data/useTopPerformances.js`                |

(Component lives under `components/highlights/` — see the Pulse table above.)

## Frontend — News

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| News API                | `frontend/src/api/news.js`                                     |
| News hook               | `frontend/src/hooks/data/useNews.js`                           |
| News components         | `frontend/src/components/news/` (NewsSection, NewsCard, NewsPreviewModal) |
| News card skeleton      | `frontend/src/components/skeletons/NewsCardSkeleton.jsx`       |

## Frontend — UI Primitives

| What                           | Where                                                       |
| ------------------------------ | ----------------------------------------------------------- |
| Skeleton primitive             | `frontend/src/components/ui/Skeleton.jsx`                   |
| Error state component          | `frontend/src/components/ui/ErrorState.jsx`                 |
| Date navigation (strip + cal)  | `frontend/src/components/ui/DateNavigation.jsx`, `DateStrip.jsx`, `CalendarPopup.jsx` |
| Navigation components          | `frontend/src/components/navigation/` (MonthNavigation, SeasonSelector) |
| Page skeleton layouts          | `frontend/src/components/skeletons/`                        |
| Relative time util             | `frontend/src/utils/relativeTime.js`                        |
| Season URL param hook          | `frontend/src/hooks/useSeasonParam.js`                      |
| Season URL builder util        | `frontend/src/utils/buildSeasonUrl.js`                      |
| Player URL / slug helper       | `frontend/src/utils/playerUrl.js` (`playerSlug(player, dupeMap)`) |
| Duplicate-slug hook            | `frontend/src/hooks/data/useDuplicatePlayerSlugs.js` (`useDuplicatePlayerSlugs(league)`, `useDuplicatePlayerSlugsAll({ enabled })`) |

## Frontend — Tests

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Test suite              | `frontend/src/__tests__/`                                      |
| Test setup              | `frontend/src/__tests__/setup.js`                              |
| Test helpers            | `frontend/src/__tests__/helpers/testUtils.jsx`                 |
| Utility tests           | `frontend/src/__tests__/utils/`                                |
