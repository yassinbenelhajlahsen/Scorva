const techStack = [
  { category: "Frontend", items: ["React 19 + Vite 6", "React Router 7", "Tailwind CSS v4", "Framer Motion 12"] },
  { category: "Backend", items: ["Node.js + Express 5", "PostgreSQL (pg)", "Redis (ioredis)", "Prisma 7 (migrations)"] },
  { category: "Auth & AI", items: ["Supabase Auth (email + OAuth)", "OpenAI GPT-4o-mini", "JWT (server-side verified)"] },
  { category: "Infra & Testing", items: ["Vercel · Railway (2 services)", "GitHub Actions CI/CD", "Jest + Supertest", "Vitest + Testing Library"] },
];

const engineeringDecisions = [
  {
    title: "Service-layer Redis caching",
    detail: "Cache applied at the service layer so REST and SSE controllers share the same hot data. Tiered TTLs: 30s for live game lists, 5min for standings, 30 days for finalized game detail. cacheIf guard prevents caching in-progress games.",
  },
  {
    title: "Two-tier live sync worker",
    detail: "Fast path every 15s updates scores and clock only (scoreboard endpoint). Full path every 2min or on period change fetches boxscore and upserts player stats. Reduces ESPN API calls ~8× while keeping scores current.",
  },
  {
    title: "SSE over WebSocket + pg_notify",
    detail: "PostgreSQL LISTEN/NOTIFY triggers SSE pushes instantly on each DB write — no polling lag. SSE fits unidirectional score delivery, avoids WebSocket infrastructure overhead, and works cleanly behind Railway's reverse proxy.",
  },
  {
    title: "pg_trgm GIN indexes for search",
    detail: "Fuzzy search across players, teams, and games in a single ranked query — no external search service. Custom ORDER BY ranks exact → prefix → substring → trigram similarity. Date-aware parsing handles 'Jan 15', '12/25', and full ISO dates.",
  },
];

const demonstrates = [
  "4-layer backend architecture — routes delegate only, controllers own no SQL, services return plain data",
  "Real-time SSE streaming with pg_notify triggers and 3-failure REST fallback",
  "Tiered Redis caching strategy with conditional caching and pattern-based invalidation",
  "Auth system — JWT verification, Google OAuth popup flow, Supabase webhook + ensureUser fallback",
  "PostgreSQL schema design — GIN indexes, composite PKs, cascade deletes, window functions",
  "ESPN data ingestion pipeline — normalization, multi-league upserts, two-tier sync workers",
  "AI integration with DB-persisted caching (~$0.0001/summary, never regenerated)",
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
      <p className="text-text-tertiary text-sm mb-12">Full-stack · Production-deployed · Open source</p>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* Left column */}
        <div className="space-y-10">
          {/* Intro */}
          <div className="space-y-5 text-text-secondary text-base leading-relaxed">
            <p>
              <strong className="text-text-primary font-semibold">Scorva</strong> is a production-deployed,
              full-stack sports data platform covering live scores, historical game data, player profiles,
              and AI-generated game analysis for the NBA, NFL, and NHL. It runs as three separate services —
              a React frontend on Vercel, a REST + SSE API on Railway, and a dedicated live sync worker that
              continuously ingests data from ESPN.
            </p>
            <p>
              The backend is structured in four strict layers (Route → Controller → Service → DB) with
              service-layer Redis caching, a PostgreSQL data model spanning seven tables and nine schema
              migrations, and a data ingestion pipeline that normalizes ESPN's undocumented API responses
              into a consistent multi-league schema. Every public API route has a corresponding test file;
              the suite covers route behavior, DB layer, data ingestion, cache module, and integration tests.
            </p>
            <p>
              Built with deliberate engineering tradeoffs — not to check boxes, but because the problem
              warranted them.
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
                  <div className="text-sm font-semibold text-text-primary mb-1.5">{title}</div>
                  <div className="text-sm text-text-secondary leading-relaxed">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Tech stack */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-5">Tech Stack</h2>
            <div className="grid grid-cols-2 gap-6">
              {techStack.map(({ category, items }) => (
                <div key={category}>
                  <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">{category}</div>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-text-secondary">
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
          <div className="mt-10 md:mt-50 bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
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

          {/* GitHub link */}
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
            <p className="mt-4 text-xs text-text-tertiary">
              For educational and portfolio purposes only. Not affiliated with any professional sports league or data provider.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
