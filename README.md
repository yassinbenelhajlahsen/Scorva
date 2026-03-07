# Scorva 🏀🏒

**Scorva** is a full-stack sports statistics platform that lets users explore game results, player performances, and team data across NBA, NFL, and NHL leagues. It includes a React frontend, an Express backend, and a PostgreSQL database, deployed using Vercel and Railway.

---

## 🚀 Live

https://scorva.dev

---

## 🛠️ Tech Stack

- **Frontend:** React, React Router, Tailwind v4, Framer Motion, Vite
- **Backend:** Node.js, Express, pg (PostgreSQL), Prisma ORM
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Database:** PostgreSQL (hosted on Railway)
- **Deployment:**
  - Frontend: Vercel
  - Backend API: Railway
  - Live Sync Worker: Railway (separate service, same repo)

## Project Structure

```
Scorva
├── backend
│   ├── prisma/                   # Schema, config, and migration history
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── db/db.js              # PostgreSQL pool singleton
│   │   ├── middleware/           # CORS, rate limiting, JWT auth
│   │   ├── routes/               # Thin route definitions (one per resource)
│   │   ├── controllers/          # Param extraction, response handling
│   │   ├── services/             # SQL queries and business logic
│   │   ├── utils/                # slugResolver, dateParser
│   │   ├── config/env.js         # dotenv initialization
│   │   └── populate/             # ESPN ingestion scripts: upsert.js (scheduled), liveSync.js (live worker)
│   └── __tests__/                # Jest + Supertest test suite
│
├── frontend
│   ├── src/
│   │   ├── App.jsx               # Root component and router
│   │   ├── main.jsx              # Vite entry point
│   │   ├── index.css             # Tailwind v4 theme tokens and global styles
│   │   ├── lib/supabase.js       # Supabase client singleton
│   │   ├── context/              # AuthContext — session state and auth modal
│   │   ├── api/                  # Backend API client and per-resource wrappers
│   │   ├── hooks/                # Data-fetching and state hooks
│   │   ├── components/           # Reusable UI (cards, layout, ui primitives)
│   │   ├── pages/                # Page-level route components
│   │   └── utilities/            # Formatters, slugify, topPlayers scoring
│   └── public/                   # League and playoff logos (NBA/, NFL/, NHL/)
│
├── LICENSE
└── README.md
```

## 🔥 Features

- **User Authentication:** Sign in with email/password or Google OAuth via Supabase Auth. Session state managed globally with auto-close modal on successful login.
- **Settings page:** Gear icon in the navbar opens `/settings` — a two-tab settings panel (sidebar on desktop, drill-down on mobile). **Favorites tab** lets you search and add/remove favorite players and teams, and choose a default homepage league. **Account tab** lets you edit your name, change your password (with current-password validation), and delete your account with a confirmation prompt. Google OAuth users see a "Signed in with Google" badge and the password section is hidden.
- **Favorites:** Star players and teams from their pages. Favorited items appear on the homepage (between the hero and today's games) with the player's recent stat lines and the team's most recent game cards. Hidden when logged out. Powered by `user_favorite_players` and `user_favorite_teams` tables with a Supabase auth webhook that auto-creates user rows on signup.
- **Default league preference:** Logged-in users can set their preferred homepage league (NBA, NFL, or NHL) in Settings → Favorites. The homepage waits for this preference before rendering the league tabs, preventing any flash of the wrong league.
- **Playoff detection:** Games are tagged with round labels sourced from ESPN (`game_label` column) — e.g. `"NBA Finals - Game 1"`, `"Super Bowl LIX"`. GameCard and GamePage display the appropriate league playoff/finals logo instead of generic text badges.
- **Multi-league & Multi-season history support:** NBA, NFL, NHL with consistent data structure
- **Intelligent search:** Real-time autocomplete for players, teams, and games, including direct date lookups like `2025-01-15`, `12/25`, and `Jan 15`
- **Live stats & box scores:** Detailed game breakdowns with quarter-by-quarter scoring, live period label (Q3, P2, OT), and game clock
- **AI Game Summaries:** OpenAI-powered insights that analyze completed games and highlight key moments, standout players, and statistical advantages — gated behind authentication, lazy-generated and permanently cached for cost efficiency
- **Interactive UI:** Hover effects on game and stat cards for advanced details
- **Live game sync:** 30-second live updates during active games via a dedicated Railway worker (`liveSync.js`), showing real-time scores, current period, and game clock. Scheduled upsert runs every 30–60 minutes as a catch-up mechanism for non-live data.
- **Responsive design:** Built with Tailwind CSS and Framer Motion for smooth animations
- **RESTful API:** Clean Express backend with PostgreSQL
- **Production deployment:** Frontend on Vercel, backend on Railway

## 🔎 Search Experience

The global search bar returns mixed results across players, teams, and games from a single backend query.

- **Game search by team names:** Finds matchups from home or away team names and abbreviations
- **Date-aware game search:** Supports exact dates like `2025-01-15`, common US formats like `1/15/2025`, and partial in-season lookups like `12/25` or `Jan 15`
- **Season-aware partial dates:** Inputs without a year resolve against the current app season (`2025-26`), so `12/25` maps to December 25, 2025 while `Jan 15` maps to January 15, 2026
- **Relevance-ranked results:** Exact and prefix matches are ranked ahead of looser matches, with players, teams, and games returned in a single dropdown

Game results in the search dropdown also show a formatted game date to make matchup results easier to scan.

## 🤖 AI Game Summary Feature

Scorva includes an **AI-powered game analysis system** that generates intelligent summaries for completed games:

- **Smart Generation:** Summaries are generated on-demand when a user views a game (lazy loading)
- **Permanent Caching:** Each summary is stored in the database and never regenerated (cost-controlled)
- **Structured Insights:** Uses OpenAI's GPT-4o-mini to analyze game data and produce 3-4 bullet points covering:
  - Why the winning team won (key moments or advantages)
  - Top player performances with statistics
  - Crucial statistical differences or momentum shifts
- **Cost Efficient:** ~$0.0001 per summary, cached permanently (approximately $3/month for 1,000 games)
- **Graceful Degradation:** Handles API timeouts and errors with fallback messages

**Technical Implementation:**

- Backend endpoint: `GET /api/games/:id/ai-summary` — requires valid Supabase JWT
- Cache-first architecture: checks database before calling OpenAI
- 30-second timeout with error handling
- Locked UI shown to unauthenticated users with sign-in prompt
- Clean UI integration between quarter-by-quarter scores and box score
- Responsive design with animated bullet points and loading skeletons

## 📊 Top Players Analysis

Each game page surfaces three player highlight cards computed entirely on the frontend from box score data (`frontend/src/utilities/topPlayers.js`):

| Card | What it measures |
|---|---|
| **Top Performer** | Best all-around game via a weighted composite score |
| **Top Scorer** | Highest output in the primary scoring category |
| **Impact Player** | Best on-off differential or defensive contribution |

Players are **deduplicated** across slots — if the top performer is also the top scorer, the next best scorer is shown instead, ensuring each card highlights a different player.

### Scoring formulas by league

**NBA** — inspired by Hollinger's Game Score:
```
Performance = PTS + (0.4 × REB) + (0.7 × AST) + STL + BLK − TOV
Impact      = +/− + (1.5 × STL) + BLK
```
Rebounds and assists are discounted vs. points since they accumulate more easily; turnovers subtract from the composite.

**NFL** — position-agnostic composite:
```
Performance = (YDS × 0.05) + (CMP × 0.3) + (TD × 10) − (INT × 4) + (SCKS × 5)
Impact      = (SCKS × 5) + (INT × 6) + (YDS × 0.02)
```
QBs earn through yardage and completion rate; skill players through yards and touchdowns; defensive players through sacks. The Impact slot specifically surfaces the defensive standout.

**NHL** — goals weighted above assists:
```
Performance = (G × 2.0) + (A × 1.5) + (SHOTS × 0.15) + (SAVES × 0.1) + (BS × 0.4) + (HT × 0.2)
Impact      = (+/− × 1.5) + G + A
```
Saves are included so goalies can appear when they carry their team. The Impact formula combines on-ice differential with point production to reduce noise from short ice-time.

---

## 🧪 Testing

Scorva includes comprehensive test suites for both backend and frontend.

### Quick Start

```bash
# Run everything (lint + test + build) from the project root
npm run verify

# Backend only
cd backend
npm test                  # Run all tests
npm run test:coverage     # Generate coverage report

# Frontend only
cd frontend
npm test                  # Run all tests (Vitest)
npm run test:coverage     # Generate coverage report
```

### Backend Coverage

- ✅ **All API Routes** — Teams, players, games, standings, search, game info, player info
- ✅ **Database Layer** — Connection, queries, error handling
- ✅ **Data Services** — Stats mapping, player upserts, transformations
- ✅ **Live Sync Worker** — `upsertGameScoreboard` (scores, clock, period, quarters from scoreboard data)
- ✅ **Integration Tests** — Full Express app behavior

### Frontend Coverage

- ✅ **Utility Functions** — Date formatting (incl. `getPeriodLabel` for NBA/NFL/NHL periods + OT), slugify, normalize, top players scoring
- ✅ **API Client** — `apiFetch` URL construction, headers, body serialization, abort signal, error handling
- ✅ **API Wrappers** — Favorites, user profile, and search API functions
- ✅ **Hooks** — `useFavorites`, `useFavoriteToggle` (optimistic updates + rollback), `useUserPrefs`, `useSearch` (debounce + abort cancel)
- ✅ **Components** — Navbar (auth state), PasswordChecklist (validation logic + rendering)

## 🔄 CI/CD

GitHub Actions runs frontend lint, tests, and a production build on every push and pull request. Deployment to Vercel only proceeds after all checks pass on `main`. The backend deploys independently via Railway.

---

## 📌 Future Improvements

- Live game alerts, final scores, and push notifications
- Multi-language AI summaries
- Mobile app (React Native or PWA)

## 🧩 Challenges Faced

- **Inconsistent Data from Unofficial APIs:**  
  ESPN’s APIs are not publicly documented and return different structures for each league (NBA, NFL, NHL). Normalizing player and game stats into a consistent PostgreSQL schema required extensive reverse-engineering and custom mapping logic.  
  → External API reference: [akeaswaran/espn-api gist](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b)

## 🧠 Author

Made by **Yassin Benelhajlahsen** — Computer Science @ Brooklyn College  
[GitHub](https://github.com/yassinbenelhajlahsen) • [LinkedIn](https://www.linkedin.com/in/yassin-benelhajlahsen/)
