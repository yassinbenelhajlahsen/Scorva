const techStack = [
  {
    category: "Frontend",
    items: [
      "React 19 + Vite 6",
      "React Router 7",
      "TanStack Query v5",
      "Tailwind CSS v4",
      "Framer Motion 12",
    ],
  },
  {
    category: "Backend",
    items: [
      "Node.js + Express 5",
      "PostgreSQL (pg)",
      "Redis (ioredis)",
      "Prisma 7 (migrations)",
    ],
  },
  {
    category: "Auth & AI",
    items: [
      "Supabase Auth (email + OAuth)",
      "OpenAI GPT-4o-mini (summaries)",
      "GPT-4.1-mini (chat agent)",
      "pgvector RAG (embeddings)",
    ],
  },
  {
    category: "Infra & Testing",
    items: [
      "Vercel · Railway (2 services)",
      "GitHub Actions CI/CD",
      "Jest + Supertest",
      "Vitest + Testing Library",
    ],
  },
];

const engineeringDecisions = [
  {
    title: "Two-tier live sync worker",
    detail:
      "Fast path every 15s updates scores, clock, and play-by-play. Full path every 2min or on period change fetches boxscore and upserts player stats. Reduces ESPN API calls ~8× while keeping scores and plays current.",
  },
  {
    title: "RAG-powered chat agent with tool calling",
    detail:
      "GPT-4.1-mini runs a multi-round tool-calling loop (max 5 rounds) with 13 tools — live DB queries, web search, and a pgvector semantic search over game summary embeddings (text-embedding-3-small, 1536-dim). Page context is resolved to a named entity before the system prompt is built. Tool execution progress streams as real-time status events. Long conversations are automatically summarized via rolling compression so context is never lost.",
  },
  {
    title: "SSE over WebSocket + pg_notify",
    detail:
      "PostgreSQL LISTEN/NOTIFY triggers SSE pushes instantly on each DB write — no polling lag. SSE fits unidirectional score delivery, avoids WebSocket infrastructure overhead, and works cleanly behind Railway's reverse proxy.",
  },
];

const demonstrates = [
  "4-layer backend architecture — routes delegate only, controllers own no SQL, services return plain data",
  "Real-time SSE streaming with pg_notify triggers and 3-failure REST fallback",
  "Tiered Redis caching strategy with conditional caching and pattern-based invalidation",
  "Auth system — JWT verification, Google OAuth popup flow, Supabase webhook + ensureUser fallback",
  "PostgreSQL schema design — GIN indexes, composite PKs, cascade deletes, window functions, DISTINCT ON deduplication",
  "ESPN data ingestion pipeline — normalization, multi-league upserts, two-tier sync workers, popularity refresh",
  "AI integration — DB-cached summaries, vector embeddings for semantic retrieval, streaming tool-calling agent",
  "RAG chat agent — pgvector semantic search, 13-tool calling loop, rolling conversation summarization, real-time tool status streaming",
  "Optimistic UI with rollback, skeleton loading states, and hook retry pattern",
  "CI/CD — GitHub Actions lint + Vitest + build gate before every Vercel deploy",
];

export default function About() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16">
      {/* Header */}
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-3">
        About Scorva
      </h1>
      <p className="text-text-tertiary text-sm mb-12">
        Full-stack · Production-deployed · Open source
      </p>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left column */}
        <div className="space-y-10">
          {/* Intro */}
          <div className="space-y-5 text-text-secondary text-base leading-relaxed">
            <p>
              <strong className="text-text-primary font-semibold">
                Scorva
              </strong>{" "}
              is a production-deployed, full-stack sports data platform covering
              live scores, historical game data, player profiles, and
              AI-generated game analysis for the NBA, NFL, and NHL. It runs as
              three separate services — a React frontend on Vercel, a REST + SSE
              API on Railway, and a dedicated live sync worker that continuously
              ingests data from ESPN.
            </p>
            <p>
              The backend is structured in four strict layers (Route →
              Controller → Service → DB) with service-layer Redis caching, a
              PostgreSQL data model spanning eleven tables and fifteen schema
              migrations, and a data ingestion pipeline that normalizes ESPN's
              undocumented API responses into a consistent multi-league schema.
              Every public API route has a corresponding test file; the suite
              covers route behavior, DB layer, data ingestion, cache module, and
              integration tests.
            </p>
            <p>
              Built with deliberate engineering tradeoffs — not to check boxes,
              but because the problem warranted them.
            </p>
          </div>

          {/* Engineering decisions */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-5">
              Engineering decisions
            </h2>
            <div className="space-y-3">
              {engineeringDecisions.map(({ title, detail }) => (
                <div
                  key={title}
                  className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5"
                >
                  <div className="text-sm font-semibold text-text-primary mb-1.5">
                    {title}
                  </div>
                  <div className="text-sm text-text-secondary leading-relaxed">
                    {detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Tech stack */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-5">
              Tech Stack
            </h2>
            <div className="grid grid-cols-2 gap-6">
              {techStack.map(({ category, items }) => (
                <div key={category}>
                  <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                    {category}
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2.5 text-sm text-text-secondary"
                      >
                        <span className="w-1 h-1 bg-surface-subtle rounded-full flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* What it demonstrates */}
          <div className="mt-10 bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4">
              What it demonstrates
            </h3>
            <ul className="text-text-secondary text-sm space-y-2.5">
              {demonstrates.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="w-1 h-1 bg-accent rounded-full mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div className="mt-10 flex flex-col gap-3">
            <div className="flex items-center gap-5">
              <a
                href="https://github.com/yassinbenelhajlahsen/Scorva"
                className="inline-flex items-center gap-2 text-accent hover:text-accent-hover transition-colors duration-200 text-sm font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.52 11.52 0 0 1 3-.405c1.02.005 2.045.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                View source on GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/yassin-benelhajlahsen"
                className="inline-flex items-center gap-2 text-accent hover:text-accent-hover transition-colors duration-200 text-sm font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            </div>
            <p className="text-xs text-text-tertiary">
              For educational and portfolio purposes only. Not affiliated with
              any professional sports league or data provider.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
