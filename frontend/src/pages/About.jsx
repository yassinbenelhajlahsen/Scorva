export default function About() {
  const techStack = [
    "React 19 + Vite 6",
    "React Router 7",
    "Tailwind CSS v4",
    "Framer Motion",
    "Node.js + Express 5",
    "PostgreSQL + Prisma ORM",
    "Supabase Auth (email + OAuth)",
    "Server-Sent Events (SSE)",
    "OpenAI GPT-4o-mini",
    "Jest + Supertest / Vitest",
    "Vercel (frontend)",
    "Railway (API + live sync worker)",
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-8">
        About Scorva
      </h1>

      <div className="space-y-5 text-text-secondary text-base leading-relaxed">
        <p>
          <strong className="text-text-primary font-semibold">Scorva</strong> is a full-stack sports analytics platform
          delivering live scores, historical game data, player profiles, and
          AI-generated game analysis for the NBA, NFL, and NHL. Built as a
          production-style application to demonstrate real-world software
          engineering across frontend development, backend API design, database
          modeling, real-time streaming, and deployment.
        </p>

        <p>
          The system is built on a React frontend and a Node.js + Express
          backend, backed by PostgreSQL for structured sports data. Scorva
          consumes ESPN's undocumented APIs, normalizes raw responses into a
          consistent multi-league schema, and exposes clean REST and SSE
          endpoints to power live scores, box scores, player profiles, and
          AI-powered game summaries.
        </p>

        <p>
          The application focuses on performance, correctness, and maintainability —
          efficient SQL with <code className="text-text-primary text-sm font-mono">pg_trgm</code> GIN indexes for fuzzy search,
          a two-tier live sync worker, JWT-verified authentication, optimistic
          UI updates with rollback, and comprehensive test coverage across
          backend and frontend.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4">What it demonstrates</h3>
          <ul className="text-text-secondary text-sm space-y-2.5">
            {[
              "Full-stack architecture with strict layer separation",
              "Real-time SSE streaming with REST fallback",
              "Auth system design — JWT, OAuth popup flow, webhooks",
              "Database optimization — GIN indexes, window functions",
              "Data ingestion and multi-league normalization pipeline",
              "AI integration with cost-controlled permanent caching",
              "Optimistic UI updates with rollback on failure",
              "Production deployment and CI/CD pipeline",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1 h-1 bg-accent rounded-full mt-2 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4">Who it is for</h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            Scorva is built for engineers, recruiters, and sports fans who want
            to explore a real application that mirrors how modern full-stack
            systems are designed and shipped — from database schema to
            deployment pipeline.
          </p>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-6">Tech Stack</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {techStack.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-text-secondary">
              <span className="w-1 h-1 bg-surface-subtle rounded-full flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <a
          href="https://github.com/yassinbenelhajlahsen/Scorva"
          className="inline-flex items-center gap-2 text-accent hover:text-accent-hover transition-colors duration-200 text-sm font-medium"
          target="_blank"
          rel="noopener noreferrer"
        >
          View source on GitHub
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <div className="mt-12 pt-8 border-t border-white/[0.06]">
        <h2 className="text-xl font-bold tracking-tight text-text-primary mb-4">The Vision</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Scorva represents an approach to building clean, maintainable, and
          scalable software. It showcases system design thinking, API
          architecture, real-time data flow, and frontend performance — the
          same principles that drive production engineering teams.
        </p>
      </div>

      <p className="mt-8 text-xs text-text-tertiary">
        For educational and portfolio purposes only. Not affiliated with any professional sports league or data provider.
      </p>
    </div>
  );
}
