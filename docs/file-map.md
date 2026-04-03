# Scorva — File Map

Key file locations for every backend and frontend subsystem.
For architecture context see [docs/ARCHITECTURE.md](ARCHITECTURE.md).

| What | Where |
|---|---|
| Backend entry | `backend/src/index.js` |
| CORS, rate limits, SSE limiter | `backend/src/middleware/index.js` |
| JWT auth middleware | `backend/src/middleware/auth.js` |
| Routes | `backend/src/routes/` |
| Controllers | `backend/src/controllers/` |
| Services | `backend/src/services/` |
| Prisma schema | `backend/prisma/schema.prisma` |
| Generated client | `backend/src/generated/prisma/` (do not edit) |
| Cache module | `backend/src/cache/cache.js` |
| Season cache helper | `backend/src/cache/seasons.js` |
| Scheduled upsert | `backend/src/ingestion/upsert.js` |
| Live sync worker | `backend/src/ingestion/liveSync.js` |
| Historical upsert | `backend/src/ingestion/historicalUpsert.js` |
| Stats teamid backfill | `backend/src/ingestion/backfillStatsTeamid.js` |
| Data ingestion helpers | `backend/src/ingestion/` (flat — no `src/` subfolder) |
| Frontend entry | `frontend/src/main.jsx` |
| Frontend router | `frontend/src/App.jsx` |
| Design tokens | `frontend/src/index.css` (`@theme`) |
| Supabase client | `frontend/src/lib/supabase.js` |
| Auth context | `frontend/src/context/AuthContext.jsx` |
| Auth modal | `frontend/src/components/auth/AuthModal.jsx` |
| Auth components | `frontend/src/components/auth/` (AuthModal, PasswordChecklist) |
| OAuth callback page | `frontend/src/pages/AuthCallback.jsx` |
| API wrappers | `frontend/src/api/` |
| Data hooks | `frontend/src/hooks/{ai,data,live,user}/` |
| Frontend utilities | `frontend/src/utils/` |
| Favorites API | `frontend/src/api/favorites.js` |
| Favorites hooks | `frontend/src/hooks/user/useFavorites.js`, `frontend/src/hooks/user/useFavoriteToggle.js` |
| User API | `frontend/src/api/user.js` |
| User prefs hook | `frontend/src/hooks/user/useUserPrefs.js` |
| Settings page | `frontend/src/pages/SettingsPage.jsx` |
| Settings tabs | `frontend/src/components/settings/FavoritesTab.jsx`, `frontend/src/components/settings/AccountTab.jsx` |
| User controller | `backend/src/controllers/userController.js` |
| User service | `backend/src/services/userService.js` |
| User route | `backend/src/routes/user.js` |
| Webhook handler | `backend/src/routes/webhooks.js`, `backend/src/controllers/webhooksController.js` |
| SSE live route | `backend/src/routes/live.js`, `backend/src/controllers/liveController.js` |
| SSE live hooks | `frontend/src/hooks/live/useLiveGame.js`, `frontend/src/hooks/live/useLiveGames.js` |
| Skeleton primitive | `frontend/src/components/ui/Skeleton.jsx` |
| Error state component | `frontend/src/components/ui/ErrorState.jsx` |
| Date navigation (strip + calendar) | `frontend/src/components/ui/DateNavigation.jsx`, `DateStrip.jsx`, `CalendarPopup.jsx` |
| Navigation components | `frontend/src/components/navigation/` (MonthNavigation, SeasonSelector) |
| Game dates hook | `frontend/src/hooks/data/useGameDates.js` |
| Game dates controller | `backend/src/controllers/gameDatesController.js` |
| Game dates service | `backend/src/services/gameDatesService.js` |
| PG date → string util | `backend/src/utils/pgDateToString.js` |
| Page skeleton layouts | `frontend/src/components/skeletons/` |
| Chat route | `backend/src/routes/chat.js` |
| Chat controller | `backend/src/controllers/chatController.js` |
| Chat agent (LLM loop) | `backend/src/services/chat/agentService.js` |
| Chat tools | `backend/src/services/chat/toolsService.js` |
| Chat tool services | `backend/src/services/chat/tools/` |
| Embedding service (RAG) | `backend/src/services/embeddingService.js` |
| Semantic search tool | `backend/src/services/chat/tools/semanticSearch.js` |
| Chat history | `backend/src/services/chat/historyService.js` |
| Chat API (frontend) | `frontend/src/api/chat.js` |
| Chat context | `frontend/src/context/ChatContext.jsx` |
| Chat actions hook | `frontend/src/hooks/ai/useChatActions.js` |
| Chat components | `frontend/src/components/chat/` |
| Backend test suite | `backend/__tests__/` |
| Backend test helpers | `backend/__tests__/helpers/testHelpers.js` |
| Frontend test suite | `frontend/src/__tests__/` |
| Frontend test setup | `frontend/src/__tests__/setup.js` |
| Frontend test helpers | `frontend/src/__tests__/helpers/testUtils.jsx` |
| Frontend utility tests | `frontend/src/__tests__/utils/` |
