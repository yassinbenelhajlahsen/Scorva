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
| Scheduled upsert | `backend/src/populate/upsert.js` |
| Live sync worker | `backend/src/populate/liveSync.js` |
| Historical upsert | `backend/src/populate/historicalUpsert.js` |
| Data ingestion helpers | `backend/src/populate/src/` |
| Frontend entry | `frontend/src/main.jsx` |
| Frontend router | `frontend/src/App.jsx` |
| Design tokens | `frontend/src/index.css` (`@theme`) |
| Supabase client | `frontend/src/lib/supabase.js` |
| Auth context + modal | `frontend/src/context/AuthContext.jsx` |
| OAuth callback page | `frontend/src/pages/AuthCallback.jsx` |
| API wrappers | `frontend/src/api/` |
| Data hooks | `frontend/src/hooks/` |
| Favorites API | `frontend/src/api/favorites.js` |
| Favorites hooks | `frontend/src/hooks/useFavorites.js`, `frontend/src/hooks/useFavoriteToggle.js` |
| User API | `frontend/src/api/user.js` |
| User prefs hook | `frontend/src/hooks/useUserPrefs.js` |
| Settings page | `frontend/src/pages/SettingsPage.jsx` |
| Settings tabs | `frontend/src/components/settings/FavoritesTab.jsx`, `frontend/src/components/settings/AccountTab.jsx` |
| User controller | `backend/src/controllers/userController.js` |
| User service | `backend/src/services/userService.js` |
| User route | `backend/src/routes/user.js` |
| Webhook handler | `backend/src/routes/webhooks.js`, `backend/src/controllers/webhooksController.js` |
| SSE live route | `backend/src/routes/live.js`, `backend/src/controllers/liveController.js` |
| SSE live hooks | `frontend/src/hooks/useLiveGame.js`, `frontend/src/hooks/useLiveGames.js` |
| Skeleton primitive | `frontend/src/components/ui/Skeleton.jsx` |
| Error state component | `frontend/src/components/ui/ErrorState.jsx` |
| Page skeleton layouts | `frontend/src/components/skeletons/` |
| Chat route | `backend/src/routes/chat.js` |
| Chat controller | `backend/src/controllers/chatController.js` |
| Chat agent (LLM loop) | `backend/src/services/chatAgentService.js` |
| Chat tools | `backend/src/services/chatToolsService.js` |
| Chat tool services | `backend/src/services/chatTools/` |
| Embedding service (RAG) | `backend/src/services/embeddingService.js` |
| Semantic search tool | `backend/src/services/chatTools/semanticSearchService.js` |
| Chat history | `backend/src/services/chatHistoryService.js` |
| Chat API (frontend) | `frontend/src/api/chat.js` |
| Chat context | `frontend/src/context/ChatContext.jsx` |
| Chat actions hook | `frontend/src/hooks/useChatActions.js` |
| Chat components | `frontend/src/components/chat/` |
| Backend test suite | `backend/__tests__/` |
| Backend test helpers | `backend/__tests__/helpers/testHelpers.js` |
| Frontend test suite | `frontend/src/__tests__/` |
| Frontend test setup | `frontend/src/__tests__/setup.js` |
| Frontend test helpers | `frontend/src/__tests__/helpers/testUtils.jsx` |
