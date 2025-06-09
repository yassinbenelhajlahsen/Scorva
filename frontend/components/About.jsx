export default function About() {
  return (
  
      <div className="max-w-3xl mx-auto px-6 py-12 text-white">
  <h1 className="text-4xl font-bold mb-10">About This Project</h1>

  <p className="text-lg mb-6">
    <strong>Scorva</strong> is a full-stack web app I built to combine my love for sports
    — especially the NBA, NFL, and NHL — with my interest in software development. I wanted
    a clean, ad-free platform where I could track games, view box scores, and dive into player stats
    across multiple leagues in real time.
  </p>

  <p className="text-lg mb-6">
    This project was developed from scratch using a React frontend, Node/Express backend, and a PostgreSQL database.
    I used ESPN-style APIs to ingest live and historical game data, structured it with custom mapping logic, and deployed
    the app using Vercel (frontend) and Railway (backend). From stat syncing to slug-based routing and responsive UI components,
    every part of Scorva has been a learning experience and a showcase of my technical growth.
  </p>

  <p className="text-lg mb-6">
    The app supports multi-league browsing, top performer highlights, dynamic box scores, and detailed player pages.
    Whether you're checking the latest NHL matchup or reviewing an NBA player's season averages, Scorva aims to make that
    experience fast, responsive, and easy to navigate.
  </p>

  <p>
    <small>
      <em>
        Note: This project is for educational and personal use only. Any similarity in branding,
        features, or structure to other sports platforms is unintentional and non-commercial.
      </em>
    </small>
  </p>

  <h2 className="text-2xl font-semibold mt-8 mb-4">Tech Stack</h2>
  <ul className="list-disc list-inside text-lg space-y-2">
    <li>⚛️ React with React Router for frontend routing</li>
    <li>🎨 Tailwind CSS for styling and responsive layout</li>
    <li>🎞️ Framer Motion for smooth page transitions</li>
    <li>⚙️ Vite for fast frontend builds</li>
    <li>🛠️ Node.js and Express for backend REST APIs</li>
    <li>🐘 PostgreSQL (hosted on Railway) for structured stat and game data</li>
    <li>🌐 External sports APIs (NBA, NFL, NHL from ESPN-style endpoints)</li>
    <li>🚀 Deployment via Vercel (frontend) and Railway (backend)</li>
    <li>🧠 Version control with Git + GitHub</li>
    <li>
      🧑‍💻{" "}
      <strong>
        <a
          href="https://github.com/yassinbenelhajlahsen/Scorva"
          className="text-blue-400 underline hover:text-blue-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Source on GitHub
        </a>
      </strong>
    </li>
  </ul>

  <h2 className="text-2xl font-semibold mt-8 mb-4">The Vision</h2>
  <p className="text-lg">
    My goal with Scorva is to create a sleek, multi-sport stats platform that highlights both my technical
    skills and my passion for sports. It’s more than just a project — it’s an evolving app where I’m exploring
    everything from live data syncing to mobile responsiveness. Whether you’re a recruiter, a developer, or a sports fan,
    I hope you enjoy exploring it as much as I enjoyed building it.
  </p>
</div>

  );
}
