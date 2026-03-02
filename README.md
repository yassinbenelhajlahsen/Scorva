# Scorva 🏀🏒

**Scorva** is a full-stack sports statistics platform that lets users explore game results, player performances, and team data across NBA, NFL, and NHL leagues. It includes a React frontend, an Express backend, and a PostgreSQL database, deployed using Vercel and Railway.

---

## 🚀 Live

https://scorva.vercel.app

---

## 🛠️ Tech Stack

- **Frontend:** React, React Router, Tailwind  v4, Axios, Framer Motion, Vite
- **Backend:** Node.js, Express, pg (PostgreSQL)
- **Database:** PostgreSQL (hosted on Railway)
- **Deployment:**
  - Frontend: Vercel
  - Backend: Railway

## Project Structure

```
Scorva
├── backend
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── db/
│   │   │   └── db.js             # PostgreSQL connection setup
│   │   ├── routes/               # API route handlers
│   │   │   ├── games.js
│   │   │   ├── teams.js
│   │   │   ├── players.js
│   │   │   ├── search.js
│   │   │   ├── standings.js
│   │   │   └── ...
│   │   ├── config/
│   │   │   └── env.js            # dotenv initialization and environment setup
│   │   ├── utils/                # Shared helpers (e.g., logger, validation)
│   │   └── populate/             # Database seeding and update scripts
│   │       ├── historicalUpsert.js
│   │       ├── upsert.js
│   │       └── src/
│   │           ├── commonMappings.js
│   │           ├── mapStatsToSchema.js
│   │           ├── eventProcessor.js
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
│   └── src/
│       ├── App.jsx               # Root React component
│       ├── main.jsx              # Entry point for Vite
│       ├── assets/               # Static assets (images, icons, etc.)
│       ├── components/           # Reusable UI components
│       │   ├── cards/            # GameCard, PlayerCard, etc.
│       │   ├── layout/           # Navbar, Footer, PageWrapper, ScrollToTop
│       │   └── ui/               # BoxScore, Hero, SearchBar
│       ├── pages/                # Page-level React components (routes)
│       ├── utilities/            # Helper functions and formatters
│       └── index.css             # Global styles
│
├── public/                       # Static public assets for Vite
├── .env                          # Frontend environment variables
├── eslint.config.js              # ESLint configuration
├── vite.config.js                # Vite configuration
├── package.json                  # Root scripts (frontend + backend)
├── vercel.json                   # Deployment configuration
├── index.html                    # Root HTML template for Vite
├── LICENSE
└── README.md

```

## 🔥 Features

- **Multi-league support:** NBA, NFL, NHL with consistent data structure
- **Intelligent search:** Player and team autocomplete with real-time results
- **Live stats & box scores:** Detailed game breakdowns with quarter-by-quarter scoring
- **AI Game Summaries:** OpenAI-powered insights that analyze completed games and highlight key moments, standout players, and statistical advantages (lazy-generated and permanently cached for cost efficiency)
- **Interactive UI:** Hover effects on game and stat cards for advanced details
- **Real-time data:** Updates every 5 minutes via ESPN API integration
- **Responsive design:** Built with Tailwind CSS and Framer Motion for smooth animations
- **RESTful API:** Clean Express backend with PostgreSQL
- **Production deployment:** Frontend on Vercel, backend on Railway

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

- Backend endpoint: `GET /api/games/:id/ai-summary`
- Cache-first architecture: checks database before calling OpenAI
- 30-second timeout with error handling
- Clean UI integration between quarter-by-quarter scores and box score
- Responsive design with animated bullet points and loading skeletons

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

- User accounts with saved teams, players, and preferences
- Multi-season history and archival access
- Live game alerts, final scores, and push notifications
- Multi-language AI summaries
- Mobile app (React Native or PWA)

## 🧩 Challenges Faced

- **Inconsistent Data from Unofficial APIs:**  
  ESPN’s APIs are not publicly documented and return different structures for each league (NBA, NFL, NHL). Normalizing player and game stats into a consistent PostgreSQL schema required extensive reverse-engineering and custom mapping logic.  
  → External API reference: [akeaswaran/espn-api gist](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b)

- **Frontend–Backend Deployment Sync:**  
  Hosting the frontend on **Vercel** and backend on **Railway** caused CORS, routing, and environment variable issues during deployment. I resolved these by explicitly managing allowed origins, rewriting API routes, and validating endpoints across both environments.

- **Cost-Controlled LLM Integration:**  
  Integrating OpenAI for game summaries required careful architecture to prevent runaway costs. I implemented a lazy-generation system with permanent database caching, ensuring each game summary is generated exactly once and served from cache on all subsequent requests. This reduced potential costs from thousands of dollars to just a few dollars per month while maintaining instant load times for cached summaries.

## 🧠 Author

Made by **Yassin Benelhajlahsen** — Computer Science @ Brooklyn College  
[GitHub](https://github.com/yassinbenelhajlahsen) • [LinkedIn](https://www.linkedin.com/in/yassin-benelhajlahsen/)
