import { useRef, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import TopPerformers from "./TopPerformers.jsx";

const MODES = [
  { id: "games", label: "Best Games" },
  { id: "cumulative", label: "Last 7 Days" },
];

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

export default function HighlightsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode = modeParam === "cumulative" ? "cumulative" : "games";

  // Direction tracking for slide animation — read synchronously during render.
  const modeIdx = Math.max(0, MODES.findIndex((opt) => opt.id === mode));
  const prevModeIdxRef = useRef(modeIdx);
  const modeDirRef = useRef(0);
  if (prevModeIdxRef.current !== modeIdx) {
    modeDirRef.current = modeIdx > prevModeIdxRef.current ? 1 : -1;
    prevModeIdxRef.current = modeIdx;
  }

  // Sliding-pill indicator
  const navRef = useRef(null);
  const refs = useRef([]);
  const [bounds, setBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = MODES.findIndex((opt) => opt.id === mode);
    const btn = refs.current[idx];
    const nav = navRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [mode]);

  function setMode(next) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!next || next === "games") sp.delete("mode");
        else sp.set("mode", next);
        return sp;
      },
      { replace: true },
    );
  }

  return (
    <div>
      {/* Mode toggle (sliding pill) */}
      <div className="flex justify-center mb-3">
        <div
          ref={navRef}
          className="relative flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1"
        >
          {bounds && (
            <m.div
              className="absolute inset-y-1 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
              initial={{ left: bounds.left, width: bounds.width }}
              animate={{ left: bounds.left, width: bounds.width }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          {MODES.map((opt, i) => (
            <button
              key={opt.id}
              ref={(el) => (refs.current[i] = el)}
              onClick={() => setMode(opt.id)}
              className="relative px-4 py-1.5 rounded-full text-xs font-medium z-10 transition-colors duration-200"
              style={{
                color: mode === opt.id
                  ? "var(--color-accent)"
                  : "var(--color-text-secondary)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Beta · NBA-only hint */}
      <p className="text-center text-[10px] uppercase tracking-widest text-text-tertiary mb-6">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent font-semibold mr-2">
          Beta
        </span>
        NBA only · Last 7 days
      </p>

      {/* Mode swap with directional slide */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={modeDirRef.current} initial={false}>
          <m.div
            key={`mode:${mode}`}
            custom={modeDirRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 350, damping: 32 },
              opacity: { duration: 0.18 },
            }}
          >
            <TopPerformers league="nba" mode={mode} />
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
