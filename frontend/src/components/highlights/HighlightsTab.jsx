import { useRef, useLayoutEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import FilterBar from "./filters/FilterBar.jsx";
import RankingsList from "./tabs/RankingsList.jsx";
import PerformancesList from "./tabs/PerformancesList.jsx";
import PlaysList from "./tabs/PlaysList.jsx";

const TABS = [
  { id: "rankings",     label: "Rankings" },
  { id: "performances", label: "Performances" },
  { id: "plays",        label: "Plays" },
];

const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);
const ALLOWED_SORTS = new Set(["desc", "asc"]);
const ALLOWED_ENTITIES = new Set(["player", "team", "game"]);

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

export default function HighlightsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const aliased =
    modeParam === "games" ? "performances" :
    modeParam === "cumulative" ? "rankings" :
    modeParam;
  const mode = TABS.some((t) => t.id === aliased) ? aliased : "rankings";

  const win      = ALLOWED_WINDOWS.has(searchParams.get("win"))   ? searchParams.get("win")   : "week";
  const position = ALLOWED_POSITIONS.has(searchParams.get("pos")) ? searchParams.get("pos")   : "all";
  const sort     = ALLOWED_SORTS.has(searchParams.get("sort"))    ? searchParams.get("sort")  : "desc";
  const entityParam = searchParams.get("entity");
  let entity = ALLOWED_ENTITIES.has(entityParam) ? entityParam : "player";
  if (mode === "rankings" && entity === "game") entity = "player";

  const modeIdx = Math.max(0, TABS.findIndex((t) => t.id === mode));
  const prevModeIdxRef = useRef(modeIdx);
  const dirRef = useRef(0);
  if (prevModeIdxRef.current !== modeIdx) {
    dirRef.current = modeIdx > prevModeIdxRef.current ? 1 : -1;
    prevModeIdxRef.current = modeIdx;
  }

  const navRef = useRef(null);
  const refs = useRef([]);
  const [bounds, setBounds] = useState(null);
  useLayoutEffect(() => {
    const idx = TABS.findIndex((t) => t.id === mode);
    const btn = refs.current[idx];
    const nav = navRef.current;
    if (btn && nav) {
      const b = btn.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      setBounds({ left: b.left - n.left, width: b.width });
    }
  }, [mode]);

  function setMode(next) {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (!next || next === "rankings") sp.delete("mode");
      else sp.set("mode", next);
      return sp;
    }, { replace: true });
  }

  return (
    <div>
      <div ref={navRef} className="relative flex gap-0 border-b border-white/[0.06] mb-3">
        {bounds && (
          <m.div
            className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
            initial={{ left: bounds.left, width: bounds.width }}
            animate={{ left: bounds.left, width: bounds.width }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => (refs.current[i] = el)}
            onClick={() => setMode(t.id)}
            className={`touch-target relative px-4 pt-2 pb-2.5 -mb-px text-sm font-medium transition-colors duration-200 ${
              mode === t.id ? "text-accent" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <FilterBar
        window={win}
        position={position}
        sort={sort}
        entity={mode === "plays" ? undefined : entity}
        entityOptions={mode === "plays" ? undefined : ["player","team","game"]}
        disabledEntities={mode === "rankings" ? ["game"] : []}
      />

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={dirRef.current} initial={false}>
          <m.div
            key={`mode:${mode}`}
            custom={dirRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 350, damping: 32 },
              opacity: { duration: 0.1 },
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={`filters:${win}:${sort}:${position}:${entity}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {mode === "rankings"     && <RankingsList     window={win} sort={sort} position={position} entity={entity} fallback />}
                {mode === "performances" && <PerformancesList window={win} sort={sort} position={position} entity={entity} fallback />}
                {mode === "plays"        && <PlaysList        window={win} sort={sort} position={position} fallback />}
              </m.div>
            </AnimatePresence>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
