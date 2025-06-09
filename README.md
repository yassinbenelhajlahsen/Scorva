# Scorva 🏀🏒

**Scorva** is a full-stack sports statistics platform that lets users explore game results, player performances, and team data across NBA, NFL, and NHL leagues. It includes a React frontend, an Express backend, and a PostgreSQL database, deployed using Vercel and Railway.

---

## 🚀 Live Demo

- **Frontend (Vercel):** https://scorva.vercel.app  
- **Backend API (Railway):** https://scorva-production.up.railway.app

---

## 🛠️ Tech Stack

- **Frontend:** React, React Router, Tailwind CSS, Axios, Framer Motion, Vite  
- **Backend:** Node.js, Express, pg (PostgreSQL)  
- **Database:** PostgreSQL (hosted on Railway)  
- **Deployment:**  
  - Frontend: [Vercel](https://vercel.com)  
  - Backend: [Railway](https://railway.app)
---

## Project Structure

```
Scorva
├── backend
│   ├── index.js              # Entry point for Express server
│   ├── db.js                 # PostgreSQL connection setup
│   ├── routes/               # API routes
│   │   ├── games.js
│   │   ├── teams.js
│   │   └── ...
│   ├── populateDB/           # Scripts to fetch and insert data into DB
│   ├── package.json          # Backend dependencies
│   └── .env                  # Local environment variables (not committed)
└── frontend
    ├── src/
    │   ├── main.jsx          # Entry point for React app
    │   ├── components/       # Reusable UI components
    │   └── ...
    ├── index.html            # HTML template
    ├── package.json          # Frontend dependencies
    └── tailwind.config.js    # Tailwind CSS configuration
```


## 🔥 Features

- ✅ Fetch and display real-time game and player data  
- 🏅 Highlight top performers dynamically  
- 📊 Responsive box score and game breakdowns  
- 🎞️ Smooth UI transitions with Framer Motion  
- 🔗 Interactive routing with React Router  
- 🌐 Multi-league support (NBA, NFL, NHL)

---

## 📌 Future Improvements

- 🕒 Daily stat syncing via cron jobs or background workers  
- 👤 User accounts with saved teams, players, and preferences  
- 📅 Multi-season history and archival access  
- 🔔 Live game alerts, final scores, and push notifications  
- 📱 Mobile app (React Native or PWA)

## 🧩 Challenges Faced

- **Inconsistent Data from Unofficial APIs:**  
  ESPN’s APIs are not publicly documented and return different structures for each league (NBA, NFL, NHL). Normalizing player and game stats into a consistent PostgreSQL schema required extensive reverse-engineering and custom mapping logic.  
  → External API reference: [akeaswaran/espn-api gist](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b)

- **Frontend–Backend Deployment Sync:**  
  Hosting the frontend on **Vercel** and backend on **Railway** caused CORS, routing, and environment variable issues during deployment. I resolved these by explicitly managing allowed origins, rewriting API routes, and validating endpoints across both environments.

## 🧠 Author

Made by **Yassin Benelhajlahsen** — Computer Science @ Brooklyn College  
[GitHub](https://github.com/yassinbenelhajlahsen) • [LinkedIn](https://www.linkedin.com/in/yassinbenelhajlahsen/)
