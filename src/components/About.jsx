import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-white">
      
              
      <h1 className="text-4xl font-bold mb-10">About This Project</h1>
      
      <p className="text-lg mb-6">
        <strong>Sportify</strong> is a personal project born out of my passion for basketball and sports in general. As someone who follows the NBA, NFL, and NHL closely, I’ve always wanted a clean, centralized place to quickly check upcoming games and analyze past box scores — without the clutter or ads that often come with commercial apps.
      </p>

      <p className="text-lg mb-6">
        This app is my way of combining my love for sports with my growing skills in software development. It’s not just a scoreboard — it’s a learning platform where I push myself to build responsive UIs, integrate real APIs, and design a smooth user experience.
      </p>

      <p><small><em>Note: This project is not intended for commercial use or profit. Any similarities in names, features, or design to other platforms are purely coincidental and unintentional.</em></small></p>


      <h2 className="text-2xl font-semibold mt-8 mb-4">Tech Stack</h2>
      <ul className="list-disc list-inside text-lg space-y-2">
        <li>⚛️ React (with React Router)</li>
        <li>🎨 Tailwind CSS for styling and responsive layout</li>
        <li>⚙️ Vite for fast development builds</li>
        <li>🌐 Sports API integration (NBA, NFL, NHL data)</li>
        <li>🚀 Deployment with Vercel</li>
        <li>🧠 Version control with Git + GitHub</li>
        <li>
    🧑‍💻 <strong>
      <a
        href="https://github.com/yassinbenelhajlahsen/sportify"
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
        My goal is to make Sportify a polished app that not only showcases my technical skills, but also reflects who I am as a sports fan and future software engineer. It’s a work in progress, but each feature is built with intention — whether it’s filtering by team, checking stats, or simply making the interface feel intuitive.
      </p>
        


    </div>
  );
}
