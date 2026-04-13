import { m, AnimatePresence } from "framer-motion";
import { useAISummary } from "../../hooks/ai/useAISummary.js";
import { useAuth } from "../../context/AuthContext.jsx";

const BULLET_COUNT = 3;

const bulletVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } },
};

export default function AISummary({ gameId }) {
  const { session, openAuthModal } = useAuth();
  const { bullets, loading, error, cached } = useAISummary(gameId);

  if (!gameId) return null;

  if (session === null) {
    return (
      <div className="mb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary">Game Summary</h2>
            <p className="text-xs text-text-tertiary mt-0.5">AI-generated insights from this matchup</p>
          </div>
        </div>

        {/* Locked card — ghost preview + inline prompt */}
        <div className="bg-surface-elevated border border-white/[0.06] rounded-2xl overflow-hidden relative">
          {/* Ghost content rows */}
          <div className="p-6 sm:p-8 space-y-5 pointer-events-none select-none">
            {[
              [1, 0.55],
              [0.82, 0.4],
              [0.92, 0.48],
            ].map(([w1, w2], i) => (
              <div key={i} className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-white/[0.06] rounded-full mt-[7px] flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/[0.05] rounded-full" style={{ width: `${w1 * 100}%` }} />
                  <div className="h-3 bg-white/[0.03] rounded-full" style={{ width: `${w2 * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Gradient curtain */}
          <div className="absolute inset-0 bg-gradient-to-b from-surface-elevated/30 via-surface-elevated/80 to-surface-elevated" />

          {/* Prompt — sits over the gradient */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-center">
              <p className="text-[15px] font-medium tracking-[-0.01em] text-text-primary">Sign in to read</p>
              <p className="text-[13px] text-text-tertiary mt-0.5">AI-generated game summaries</p>
            </div>
            <button
              onClick={() => openAuthModal("summary")}
              className="mt-1 bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold rounded-[8px] px-5 py-2 transition-colors duration-150"
            >
              Sign In
            </button>
          </div>

          {/* Spacer so the card has height */}
          <div className="h-12" />
        </div>
      </div>
    );
  }

  const showFooter = !loading || bullets.length > 0;

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Game Summary</h2>
          <p className="text-xs text-text-tertiary mt-0.5">AI-generated insights from this matchup</p>
        </div>
      </div>

      {/* Content card */}
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="p-6 sm:p-8">
          {error ? (
            <div className="flex items-start gap-3 text-text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-live flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
          ) : (
            <ul className="space-y-4">
              <AnimatePresence initial={false}>
                {Array.from({ length: BULLET_COUNT }).map((_, i) => {
                  const text = bullets[i];

                  if (text !== undefined) {
                    return (
                      <m.li
                        key={`bullet-${i}`}
                        className="flex items-start gap-3"
                        variants={cached ? undefined : bulletVariants}
                        initial={cached ? undefined : "hidden"}
                        animate={cached ? undefined : "visible"}
                      >
                        <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 flex-shrink-0" />
                        <p className="text-text-secondary text-sm leading-relaxed flex-1">{text}</p>
                      </m.li>
                    );
                  }

                  // Skeleton placeholder for not-yet-arrived bullets
                  const widths = [[1, 0.7], [0.85, 0.55], [0.9, 0.6]][i];
                  return (
                    <li key={`skeleton-${i}`} className="flex gap-3 animate-pulse">
                      <div className="w-1.5 h-1.5 bg-accent/30 rounded-full mt-2 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-white/[0.06] rounded-full" style={{ width: `${widths[0] * 100}%` }} />
                        <div className="h-3.5 bg-white/[0.04] rounded-full" style={{ width: `${widths[1] * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {showFooter && (
          <div className="px-6 sm:px-8 py-3 bg-surface-base/40 border-t border-white/[0.05]">
            <p className="text-[11px] text-text-tertiary">
              Generated using AI based on official game statistics
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
