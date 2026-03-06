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
  - Backend: Railway

## Project Structure

```
Scorva
├── backend
│   ├── prisma/
│   │   ├── schema.prisma         # Prisma schema (models: games, teams, players, stats)
│   │   └── migrations/           # Migration history
│   │       ├── 0_init/           # Baseline migration (existing schema)
│   │       └── 20260305000000_add_game_label/
│   ├── prisma.config.ts          # Prisma config (datasource URL, migrations path)
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── db/
│   │   │   └── db.js             # PostgreSQL connection (pg pool)
│   │   ├── generated/
│   │   │   └── prisma/           # Auto-generated Prisma client (do not edit)
│   │   ├── routes/               # Thin route definitions — map endpoints to controllers
│   │   │   ├── teams.js
│   │   │   ├── players.js
│   │   │   ├── playerInfo.js
│   │   │   ├── games.js
│   │   │   ├── gameInfo.js
│   │   │   ├── standings.js
│   │   │   ├── seasons.js
│   │   │   ├── search.js
│   │   │   └── aiSummary.js
│   │   ├── controllers/          # Request/response handling — parse params, call services
│   │   │   ├── teamsController.js
│   │   │   ├── playersController.js
│   │   │   ├── playerInfoController.js
│   │   │   ├── gamesController.js
│   │   │   ├── gameInfoController.js
│   │   │   ├── standingsController.js
│   │   │   ├── seasonsController.js
│   │   │   ├── searchController.js
│   │   │   └── aiSummaryController.js
│   │   ├── services/             # Database queries and business logic
│   │   │   ├── teamsService.js
│   │   │   ├── playersService.js
│   │   │   ├── playerInfoService.js
│   │   │   ├── gamesService.js
│   │   │   ├── gameInfoService.js
│   │   │   ├── standingsService.js
│   │   │   ├── seasonsService.js
│   │   │   ├── searchService.js
│   │   │   └── aiSummaryService.js
│   │   ├── utils/                # Shared helper functions
│   │   │   ├── slugResolver.js   # Resolve player name slug or numeric ID to DB id
│   │   │   └── dateParser.js     # Parse partial/full date strings for search
│   │   ├── config/
│   │   │   └── env.js            # dotenv initialization and environment setup
│   │   └── populate/             # Database seeding and update scripts
│   │       ├── historicalUpsert.js
│   │       ├── upsert.js
│   │       └── src/
│   │           ├── commonMappings.js
│   │           ├── mapStatsToSchema.js
│   │           ├── eventProcessor.js # ESPN event processing + game_label extraction
│   │           ├── upsertGame.js
│   │           ├── upsertPlayer.js
│   │           ├── upsertStat.js
│   │           └── upsertTeam.js
│   ├── package.json              # Backend dependencies
│   ├── package-lock.json
│   ├── backend.env.example       # Example backend environment variables
│   └── .env                      # Local backend environment (ignored by Git)
│
├── frontend
│   ├── src/
│   │   ├── App.jsx               # Root React component
│   │   ├── main.jsx              # Entry point for Vite
│   │   ├── assets/               # Static assets (images, icons, etc.)
│   │   ├── lib/
│   │   │   └── supabase.js       # Supabase client singleton
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Session state + auth modal trigger
│   │   ├── api/                  # Backend API client and endpoint functions
│   │   │   ├── client.js
│   │   │   ├── games.js
│   │   │   ├── teams.js
│   │   │   ├── players.js
│   │   │   ├── search.js
│   │   │   ├── seasons.js
│   │   │   └── ai.js
│   │   ├── hooks/                # Custom React hooks (data-fetching + state)
│   │   │   ├── useHomeGames.js   
│   │   │   ├── useLeagueData.js  
│   │   │   ├── useTeam.js        
│   │   │   ├── usePlayer.js      
│   │   │   ├── useGame.js        
│   │   │   ├── useSearch.js      
│   │   │   ├── useSeasons.js    
│   │   │   └── useAISummary.js   
│   │   ├── components/           # Reusable UI components
│   │   │   ├── cards/            
│   │   │   ├── layout/           
│   │   │   └── ui/               
│   │   ├── pages/                # Page-level React components (routes)
│   │   │   └── AuthCallback.jsx  # OAuth popup callback — exchanges code and closes window
│   │   ├── utilities/            # Helper functions and shared constants
│   │   │   ├── motion.js        
│   │   │   ├── formatDate.js     
│   │   │   ├── LeagueData.js     
│   │   │   ├── slugify.js       
│   │   │   └── topPlayers.js    
│   │   └── index.css             # Global styles and Tailwind v4 theme tokens
│   ├── public/                   # League logos
│   │   ├── NBA/                 
│   │   ├── NFL/                 
│   │   └── NHL/                 
│   ├── index.html                
│   ├── vite.config.js           
│   ├── eslint.config.js         
│   ├── package.json              
│   ├── vercel.json              
│   └── .env                     
│
├── LICENSE
└── README.md

```

## 🔥 Features

- **User Authentication:** Sign in with email/password or Google OAuth via Supabase Auth. Session state managed globally with auto-close modal on successful login.
- **Playoff detection:** Games are tagged with round labels sourced from ESPN (`game_label` column) — e.g. `"NBA Finals - Game 1"`, `"Super Bowl LIX"`. GameCard and GamePage display the appropriate league playoff/finals logo instead of generic text badges.
- **Multi-league & Multi-season history support:** NBA, NFL, NHL with consistent data structure
- **Intelligent search:** Real-time autocomplete for players, teams, and games, including direct date lookups like `2025-01-15`, `12/25`, and `Jan 15`
- **Live stats & box scores:** Detailed game breakdowns with quarter-by-quarter scoring
- **AI Game Summaries:** OpenAI-powered insights that analyze completed games and highlight key moments, standout players, and statistical advantages — gated behind authentication, lazy-generated and permanently cached for cost efficiency
- **Interactive UI:** Hover effects on game and stat cards for advanced details
- **Real-time data:** Updates every 5 minutes via ESPN API integration
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

Scorva includes a comprehensive test suite for the backend with 100% coverage of all API endpoints, database operations, and data transformation utilities.

### Quick Start

```bash
cd backend
npm test                  # Run all tests
npm run test:coverage    # Generate coverage report
```

### Test Coverage

- ✅ **All API Routes** - Teams, players, games, standings, search, game info, player info
- ✅ **Database Layer** - Connection, queries, error handling
- ✅ **Data Services** - Stats mapping, player upserts, transformations
- ✅ **Integration Tests** - Full Express app behavior

---

## 📌 Future Improvements

- Saved teams, players, and personalized preferences per user account
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
