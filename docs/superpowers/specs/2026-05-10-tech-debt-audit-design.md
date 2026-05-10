# Tech-Debt Audit & Modularization Backlog

**Date:** 2026-05-10
**Status:** Backlog
**Scope:** Codebase-wide (backend + frontend)

## Purpose

Inventory of code-quality and modularization findings from a full-codebase audit. Each item is independently actionable — pull individual entries into focused PRs. No sequencing or phase dependencies are implied.

## Verdict

The codebase is **not spaghetti**. Architecture is sound:

- Backend respects Route → Controller → Service → DB layering in most places.
- Frontend uses TanStack Query keys factory, design-token system (`@theme` in `index.css`), and a clear pages/components/hooks split.
- Tests exist and follow consistent patterns.

The mess is **localized** to a handful of god-files and predictable duplication patterns (per-league services, per-page color math, per-component auth state).

---

## Backend

### Critical

#### B-C1. Controller reaches into DB directly
- **File:** `backend/src/controllers/ai/aiSummaryController.js:141-147`
- **Problem:** `clearAiSummary()` executes `pool.query()` directly. Controllers must not touch the DB layer — that's the service's responsibility.
- **Fix:** Add `aiSummaryService.clearSummary(id)` and call it from the controller.

#### B-C2. Webhook business logic in controller
- **File:** `backend/src/controllers/meta/webhooksController.js:5-51`
- **Problem:** User upsert + first/last name parsing live in the controller, not in a service.
- **Fix:** Move logic to `userService.createOrUpdateUserFromAuth()`. Controller becomes a thin request dispatcher.

#### B-C3. Silenced async errors
- **File:** `backend/src/services/ai/aiSummaryService.js:334`
- **Problem:** `embedGameSummary(id).catch(() => {})` swallows embedding failures with no logging. Bugs and data inconsistencies are invisible.
- **Fix:** Replace with explicit `.catch((err) => logger.error({ err }, 'embed failed'))`. Consider a retry queue if embedding is reliability-critical.

### Improvement

#### B-I1. Three near-identical playoff services (highest LOC win)
- **Files:**
  - `backend/src/services/standings/playoffsService.js` (687 LOC, NBA)
  - `backend/src/services/standings/nflPlayoffsService.js`
  - `backend/src/services/standings/nhlPlayoffsService.js`
  - Shared helpers already exist in `backend/src/services/standings/_playoffsCommon.js` — the factory should subsume both.
- **Problem:** All three independently implement `fetchPlayoffGames()`, `derivePlayoffs()`, series grouping, round classification, and h2h tiebreaker logic. ~1500 LOC of parallel implementations.
- **Fix:** Extract `leaguePlayoffFactory.js` parametrized by league config (seed format, round names, bracket structure). Strategy pattern. Target: ~700 total LOC.

#### B-I2. `aiSummaryService.js` god module (785 LOC)
- **File:** `backend/src/services/ai/aiSummaryService.js`
- **Problem:** Handles game fetching, clutch plays, injuries, team streaks, playoff series, OpenAI streaming, and caching all in one file.
- **Fix:** Split into:
  - `aiGameDataService.js` — game/stats fetching
  - `aiContextService.js` — streaks, injuries, playoff series
  - `aiSummaryService.js` — orchestration + streaming only

#### B-I3. `predictionService.js` god module (566 LOC)
- **File:** `backend/src/services/games/predictionService.js`
- **Problem:** Injury modeling + injury impact calculation + availability weights all bundled.
- **Fix:** Extract `injuryModelService.js` (reusable for any injury-aware prediction).

#### B-I4. Season parsing duplicated
- **Files:** `utils/dateParser.js`, `utils/pgDateToString.js`, plus inline season resolution in `gamesService.js:7-23`, `predictionService.js:5-11`, and several controllers.
- **Problem:** `getSeasonForDate()`, `resolveSeason()`, `isCurrentSeason()` reimplemented across services.
- **Fix:** Centralize in `backend/src/utils/seasonService.js` (alongside existing `dateParser.js`). Import once, reuse everywhere.

#### B-I5. AI chat tools tightly coupled to services
- **File:** `backend/src/services/ai/chat/toolsService.js`
- **Problem:** Imports 10+ services directly (`searchService`, `gamesService`, `gameDetailService`, `standingsService`, `teamsService`, `seasonsService`, `similarPlayersService`, `playerDetailService`, etc.). `playoffBracket.js` imports all 3 playoff services.
- **Fix:** `leagueQueryDispatcher.js` routes tool calls by league/entity type. Reduces direct imports to 1–2; enables easier testing.

#### B-I6. Inconsistent error handling
- **Examples:**
  - `controllers/user/favoritesController.js:21-24` — logs then returns 500
  - `controllers/ai/aiSummaryController.js:117-127` — distinguishes headers-sent vs not
  - `controllers/games/gamesController.js` — different pattern again
- **Fix:** Add `handleAsyncError(fn)` wrapper middleware that enforces consistent logging and response codes.

#### B-I7. SQL fragment duplication
- **Problem:** `buildH2HMatrix()` query pattern repeats across `standingsService.js` and the 3 playoff services. Computing "series wins" (`gamesService.js:43-60`) is similar to playoff series win tracking but reimplemented.
- **Fix:** `services/_queries/gameQueries.js` — centralized SELECT fragments for games + team joins + stats, composed via tagged template strings.

### Nice-to-have

#### B-N1. Event processor readability
- **File:** `backend/src/ingestion/pipeline/eventProcessor.js:95-418`
- **Problem:** `processEvent()` orchestrates 6+ steps in 300+ LOC.
- **Fix:** Extract `_ensureTeams()`, `_ensureGame()`, `_populateStats()`, `_recomputeRatings()` (40–50 LOC each, individually testable).

#### B-N2. Live sync state management
- **File:** `backend/src/ingestion/pipeline/liveSync.js:35`
- **Problem:** `eventState` global Map has no cleanup on missed events.
- **Fix:** `EventStateCache` class with `.get()`, `.update()`, `.prune(maxAge)`. Add unit tests.

#### B-N3. Magic numbers in prediction config
- **File:** `backend/src/services/games/predictionService.js:7-11, 32-43`
- **Fix:** Extract to `predictionConfig.js` with schema validation. Easier A/B testing.

#### B-N4. Cache key sprawl
- **Problem:** Keys manually concatenated everywhere: `games:${league}:${season}:date:${date}`, `playerDetail:nba:${playerId}:${season}`, etc.
- **Fix:** `cache/cacheKey.js` with typed builders. Easier to audit invalidation.

#### B-N5. Test coverage gaps
- **Missing dedicated tests:** `ai/embeddingService`, `teams/teamsService`, `reports/*`, prediction injury impact branching.
- **Fix:** Add `__tests__/services/games/predictionService.test.js` for injury impact + league config branching.

---

## Frontend

### Critical

#### F-C1. `ComparePage.jsx` god component (813 LOC)
- **File:** `frontend/src/pages/ComparePage.jsx`
- **Problem:** Single file contains player/team search, season selection, fetching, rendering, AND 9 nested subcomponents (`PlayerCompare`, `TeamCompare`, `EntitySearchCard`, `PlayerHero`, `TeamHero`, `BioRow`, `StatRow`, `RecordRow`, `RecentGamesColumn`, `HeadToHeadSection`).
- **Fix:**
  - Extract `EntitySearchCard` → `src/components/compare/EntitySearchCard.jsx`
  - Extract `PlayerCompare` logic → `src/hooks/compare/usePlayerComparison.js`
  - Extract `TeamCompare` logic → `src/hooks/compare/useTeamComparison.js`
  - Move `PlayerHero` / `TeamHero` → `src/components/compare/`
  - Move stat rows → `src/components/compare/StatRows.jsx`
  - **Target:** ComparePage ~200 LOC (composition only)

#### F-C2. `PlayByPlay.jsx` mixed concerns (775 LOC)
- **File:** `frontend/src/components/ui/PlayByPlay.jsx`
- **Problem:** Contains period label logic, drive-result colors, filter pills, and ALL play rendering in one file.
- **Fix:**
  - Extract `periodLabel()`, `driveResultColor()` → `src/utils/playPeriod.js`
  - Extract `FilterPill` → `src/components/ui/FilterPill.jsx`
  - Extract play row → `src/components/plays/PlayRow.jsx`
  - Extract period header → `src/components/plays/PeriodHeader.jsx`
  - **Target:** ~300 LOC

#### F-C3. Color utilities duplicated verbatim
- **Files:** `frontend/src/components/cards/PredictionCard.jsx` and `frontend/src/components/ui/GameChart.jsx`
- **Problem:** `hexToRgb()`, `colorDistance()`, `relativeLuminance()`, `resolveColors()` are **identical** copies. Bugs in one won't propagate.
- **Fix:** Move to `src/utils/colorUtils.js`. Import in both. Add `src/__tests__/utils/colorUtils.test.js`.
- **Note:** Highest impact-to-effort ratio in the backlog — small, isolated change with no behavior risk.

#### F-C4. `AuthModal.jsx` state hell (489 LOC, 13 useStates)
- **File:** `frontend/src/components/auth/AuthModal.jsx`
- **Problem:** Lines 21-33 declare 13 useStates: `[mode, email, password, showPassword, showConfirm, firstName, lastName, error, loading, googleLoading, confirm, view, direction]`. Sign-in / sign-up / reset flows tangled.
- **Fix:**
  - `useSignInFlow()` — email, password, error, loading, validation
  - `useSignUpFlow()` — firstName, lastName, confirm, validation
  - `usePasswordReset()` — view state, email, loading
  - AuthModal becomes a thin router: `if (mode === 'signin') <SignInView /> ...`
  - **Target:** AuthModal ~150 LOC, ≤3 useStates

#### F-C5. `GamePage.jsx` props avalanche
- **File:** `frontend/src/pages/GamePage.jsx`
- **Problem:** Values from `useGamePageData()` are passed through `OverviewTab` (17 props, see `frontend/src/components/game/OverviewTab.jsx:5-23`), `AnalysisTab`, `PlaysTab` as individual props. Hash-scrolling logic in GamePage couples navigation to DOM manipulation.
- **Fix:**
  - Create `GamePageContext` wrapping GamePage; tabs call `useGamePageContext()`
  - Extract hash-scroll → `src/hooks/useHashScroll.js`
  - **Target:** GamePage ~150 LOC, OverviewTab signature 3–4 props max

### Improvement

#### F-I1. `LeaguePage.jsx` (440 LOC) — playoff helpers + URL state
- **File:** `frontend/src/pages/LeaguePage.jsx`
- **Problems:** Lines 29-46 (`getPlayoffTiers()`) duplicate logic. Tab state not persisted to URL (unlike GamePage).
- **Fix:**
  - Move `getPlayoffTiers()` → `src/utils/playoffTiers.js` with tests
  - Add `?tab=standings|playoffs` URL sync (mirror GamePage pattern)

#### F-I2. Hardcoded colors scattered
- **Files:** ComparePage, PredictionCard, GameChart, StreakBadge, ChatInput — all define `#e8863a`, `#ff453a`, `#60A5FA` inline.
- **Fix:**
  - `src/constants/colors.js`: `{ HOME_COLOR, AWAY_COLOR, ACCENT, LOSS, WIN }`
  - Most callsites should use existing Tailwind tokens (`bg-accent`, `text-loss`, `text-win`) instead of hex
  - Reserve constants for SVG/canvas where Tailwind doesn't apply

#### F-I3. `OverviewTab` and `AnalysisTab` prop drilling
- **Problem:** OverviewTab takes 17 props; AnalysisTab takes ~8.
- **Fix:** Resolved by F-C5 (GamePageContext). Then extract `TopPerformerSection` + `PredictionSection` as standalone components, move stat config (quarterKeys, scoreColor) into custom hooks.

#### F-I4. Tailwind sprawl — repeated classNames
- **Top offenders (from grep):**
  - `flex-1 min-w-0` (16 occurrences)
  - `w-4 h-4` (11 occurrences)
  - `text-[10px] uppercase tracking-wider text-text-tertiary` (6 occurrences)
- **Fix:** Either UI primitives in `src/components/ui/primitives.jsx` (`<Flex1Truncate>`, `<StatLabel>`, `<Icon size="sm" />`) or `@layer components` utilities in `index.css`. Pick one direction; don't mix.

#### F-I5. `useLeagueData` does too much (149 LOC)
- **File:** `frontend/src/hooks/data/useLeagueData.js`
- **Problem:** Bundles displayData state + 2 useQueries + useLiveGames + SSE cache injection + visibility reconnect. Consumers who want only games still pay for standings.
- **Fix:**
  - `useLeagueGames()` — games + live SSE
  - `useStandings()` — standings only
  - Compose in page

#### F-I6. Query key inconsistency in prefetch calls
- **Problem:** Some `queryClient.prefetchQuery` calls (BoxScore, SearchBar, Navbar, ScoresBar, GameCard, SimilarPlayersCard) use `queryKeys.*()`; others use ad-hoc strings.
- **Fix:**
  - Audit all prefetch callsites — force `queryKeys.*()` everywhere
  - Add `src/lib/queryInvalidation.js` with helpers (`invalidatePlayer()`, `invalidateGame()`)

### Nice-to-have

#### F-N1. Test coverage gaps on large components
- ComparePage, PulsePage (396 LOC), and several pages have no tests.
- **Fix:** Add Vitest integration tests for page-level prop handling and error states.

#### F-N2. `PlayerPage.jsx` season URL sync
- **File:** `frontend/src/pages/PlayerPage.jsx` (397 LOC)
- **Problem:** `selectedSeason` + URL param logic mirrors ComparePage.
- **Fix:** Extract `useSeasonUrlSync()` hook, reuse across pages.

#### F-N3. Unused imports
- **Action:** Run eslint `no-unused-vars` on `src/pages/`; clean up incidentally-imported helpers (e.g., ComparePage imports of `useDuplicatePlayerSlugsAll`).

---

## Suggested first PR

If you want a single high-leverage starting PR:

1. **F-C3** — extract `colorUtils.js` (no risk, kills duplication immediately)
2. **B-C1, B-C2, B-C3** — backend layer-violation fixes + un-silence the embed error (eliminates a bug class)

Each subsequent item below the line is independently scoped and can be picked up à la carte.

## Out of scope

- Performance optimizations (separate audit — bundle size, query plans, render profiling)
- Schema changes
- Test infrastructure changes (Vitest config, Jest config)
- Auth or RAG architecture changes
- Anything affecting external API contracts
