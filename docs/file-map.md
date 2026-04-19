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

## Backend — Domain: Games

| What                    | Where                                                           |
| ----------------------- | --------------------------------------------------------------- |
| Routes                  | `backend/src/routes/games/` (games, gameDetail, prediction, plays, live) |
| Controllers             | `backend/src/controllers/games/` (games, gameDates, gameDetail, prediction, plays, live) |
| Games service           | `backend/src/services/games/gamesService.js`                    |
| Game detail service     | `backend/src/services/games/gameDetailService.js`               |
| Game detail query builder | `backend/src/services/games/gameDetailQueryBuilder.js`        |
| Win probability service | `backend/src/services/games/winProbabilityService.js`           |
| Prediction service      | `backend/src/services/games/predictionService.js`               |
| Plays service           | `backend/src/services/games/playsService.js`                    |

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
| Route           | `backend/src/routes/teams/teams.js`                  |
| Controller      | `backend/src/controllers/teams/teamsController.js`   |
| Service         | `backend/src/services/teams/teamsService.js`         |

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

## Backend — Domain: AI (Chat, Summary, Embeddings)

| What                              | Where                                                      |
| --------------------------------- | ---------------------------------------------------------- |
| Routes                            | `backend/src/routes/ai/` (aiSummary, chat)                 |
| Controllers                       | `backend/src/controllers/ai/`                              |
| AI summary service                | `backend/src/services/ai/aiSummaryService.js`              |
| Embedding service (RAG)           | `backend/src/services/ai/embeddingService.js`              |
| Chat agent (LLM loop)             | `backend/src/services/ai/chat/agentService.js`             |
| Chat tool schemas                 | `backend/src/services/ai/chat/toolDefinitions.js`          |
| Chat tools (dispatch)             | `backend/src/services/ai/chat/toolsService.js`             |
| Chat tool implementations         | `backend/src/services/ai/chat/tools/`                      |
| Chat plays tool                   | `backend/src/services/ai/chat/tools/plays.js`              |
| Chat injury tools                 | `backend/src/services/ai/chat/tools/injuries.js`           |
| Chat history                      | `backend/src/services/ai/chat/historyService.js`           |

## Backend — Domain: Meta (News, Search, Seasons, H2H, Webhooks)

| What                  | Where                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Routes                | `backend/src/routes/meta/` (news, search, seasons, headToHead, webhooks) |
| Controllers           | `backend/src/controllers/meta/`                                   |
| News service          | `backend/src/services/meta/newsService.js`                        |
| Search service        | `backend/src/services/meta/searchService.js`                      |
| Seasons service       | `backend/src/services/meta/seasonsService.js`                     |
| Head-to-head service  | `backend/src/services/meta/headToHeadService.js`                  |

## Backend — Ingestion

| What                          | Where                                                    |
| ----------------------------- | -------------------------------------------------------- |
| ESPN API client (fetch+retry) | `backend/src/ingestion/espn/espnAPIClient.js`            |
| ESPN image helper             | `backend/src/ingestion/espn/espnImage.js`                |
| Event processor               | `backend/src/ingestion/pipeline/eventProcessor.js`       |
| Scheduled upsert              | `backend/src/ingestion/pipeline/upsert.js`               |
| Live sync worker              | `backend/src/ingestion/pipeline/liveSync.js`             |
| Historical upsert             | `backend/src/ingestion/pipeline/historicalUpsert.js`     |
| Common stat mappings          | `backend/src/ingestion/mappings/commonMappings.js`       |
| Stats → schema mapper         | `backend/src/ingestion/mappings/mapStatsToSchema.js`     |
| Upsert functions              | `backend/src/ingestion/upsert/` (Game, Team, Player, Stat, Plays) |
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
| Utilities               | `frontend/src/utils/`                                          |

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

## Frontend — Tests

| What                    | Where                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Test suite              | `frontend/src/__tests__/`                                      |
| Test setup              | `frontend/src/__tests__/setup.js`                              |
| Test helpers            | `frontend/src/__tests__/helpers/testUtils.jsx`                 |
| Utility tests           | `frontend/src/__tests__/utils/`                                |
