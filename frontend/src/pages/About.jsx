export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 text-white">
      <h1 className="text-4xl font-bold mb-8 tracking-tight">About Scorva</h1>

      <p className="text-lg leading-relaxed mb-6 text-gray-200">
        <strong>Scorva</strong> is a full-stack sports analytics platform
        designed to deliver fast, reliable, and structured access to live and
        historical data for the NBA, NFL, and NHL. I built it as a
        production-style application to demonstrate real-world software
        engineering skills across frontend development, backend API design,
        database modeling, and deployment.
      </p>

      <p className="text-lg leading-relaxed mb-6 text-gray-200">
        The system is built on a React and TypeScript frontend and a Node.js +
        Express backend, backed by PostgreSQL for structured and relational
        sports data. Scorva consumes external sports APIs, normalizes raw
        responses into a consistent schema, and exposes clean REST endpoints to
        power dynamic UI features such as live box scores, player profiles, and
        multi-league browsing.
      </p>

      <p className="text-lg leading-relaxed mb-6 text-gray-200">
        The application focuses on performance, maintainability, and
        scalability. This includes efficient API calls, slug-based routing,
        modular service layers, reusable UI components, and responsive design.
        The goal was to build something that feels closer to a production system
        than a demo project.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-5">
          <h3 className="text-lg font-semibold mb-2">What it demonstrates</h3>
          <ul className="text-gray-300 space-y-2">
            <li>• Full-stack architecture and API design</li>
            <li>• AI/LLM integration with cost-controlled caching</li>
            <li>• Data ingestion and transformation pipelines</li>
            <li>• Relational database modeling with PostgreSQL</li>
            <li>• Frontend performance and UX optimization</li>
            <li>• Production deployment and environment separation</li>
            <li>• Comprehensive test coverage (120+ tests)</li>
          </ul>
        </div>

        <div className="bg-white/5 rounded-lg p-5">
          <h3 className="text-lg font-semibold mb-2">Who it is for</h3>
          <p className="text-gray-300">
            Scorva is built for engineers, recruiters, and sports fans who want
            to explore a real application that mirrors how modern full-stack
            systems are designed and shipped.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-12 mb-4">Tech Stack</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-200">
        <li>⚛️ React + TypeScript</li>
        <li>🧭 React Router for client-side routing</li>
        <li>🎨 Tailwind CSS for responsive UI</li>
        <li>🎞️ Framer Motion for UI transitions</li>
        <li>⚡ Vite for fast builds and dev experience</li>
        <li>🛠️ Node.js + Express REST APIs</li>
        <li>🐘 PostgreSQL for relational data modeling</li>
        <li>🤖 OpenAI GPT-4o-mini for AI summaries</li>
        <li>🌐 External Sports APIs (NBA, NFL, NHL)</li>
        <li>🚀 Vercel for frontend deployment</li>
        <li>🚆 Railway for backend and database hosting</li>
        <li> 🧪 Jest + Supertest for testing</li>
      </ul>

      <div className="mt-6">
        <a
          href="https://github.com/yassinbenelhajlahsen/Scorva"
          className="inline-block text-blue-400 hover:text-blue-300 underline font-medium"
          target="_blank"
          rel="noopener noreferrer"
        >
          View the source code on GitHub
        </a>
      </div>

      <h2 className="text-2xl font-semibold mt-12 mb-4">Testing & Quality</h2>
      <p className="text-lg leading-relaxed text-gray-200 mb-4">
        Scorva includes a comprehensive test suite with{" "}
        <strong>120+ automated tests</strong> covering API routes, database
        operations, data transformations, and integration workflows. Tests use
        Jest with proper mocking to ensure reliability, maintainability, and
        confidence in code changes.
      </p>
      <div className="bg-white/5 rounded-lg p-5">
        <ul className="text-gray-300 space-y-2">
          <li>
            ✓ All API endpoints tested (teams, players, games, standings,
            search, AI summaries)
          </li>
          <li>✓ Database layer and query operations validated</li>
          <li>✓ Data mapping and transformation logic covered</li>
          <li>✓ Error handling and edge cases included</li>
          <li>✓ Integration tests for full request-response cycles</li>
        </ul>
      </div>

      <h2 className="text-2xl font-semibold mt-12 mb-4">The Vision</h2>
      <p className="text-lg leading-relaxed text-gray-200">
        Scorva represents my approach to building clean, maintainable, and
        scalable software. As a new graduate software engineer, I use this
        project to showcase how I think about system design, API architecture,
        data flow, and frontend performance. It reflects the same principles I
        aim to bring into a professional engineering team.
      </p>

      <p className="mt-6 text-sm text-gray-400">
        This project is for educational and portfolio purposes only and is not
        affiliated with any professional sports league or data provider.
      </p>
    </div>
  );
}
