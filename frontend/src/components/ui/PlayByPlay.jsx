import { useState, useMemo, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { usePlays } from "../../hooks/data/usePlays.js";

const DRIVE_RESULT_COLOR = {
  Touchdown: "text-win",
  "Field Goal": "text-win",
  "Made Field Goal": "text-win",
  Punt: "text-text-tertiary",
  Fumble: "text-loss",
  Interception: "text-loss",
  "Turnover on Downs": "text-loss",
  "Missed Field Goal": "text-loss",
};

function driveResultColor(result) {
  if (!result) return "text-text-tertiary";
  for (const [key, cls] of Object.entries(DRIVE_RESULT_COLOR)) {
    if (result.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "text-text-tertiary";
}

function periodLabel(period, league) {
  if (league === "nfl") {
    if (period === 1) return "Q1";
    if (period === 2) return "Q2";
    if (period === 3) return "Q3";
    if (period === 4) return "Q4";
    return `OT${period - 4}`;
  }
  if (league === "nhl") {
    if (period === 1) return "P1";
    if (period === 2) return "P2";
    if (period === 3) return "P3";
    return `OT${period - 3}`;
  }
  // NBA
  if (period === 1) return "Q1";
  if (period === 2) return "Q2";
  if (period === 3) return "Q3";
  if (period === 4) return "Q4";
  return `OT${period - 4}`;
}

// ─── Filter pill ──────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap ${
        active
          ? "bg-accent text-white"
          : "bg-surface-overlay text-text-secondary hover:text-text-primary hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}

// ESPN returns elapsed time for NHL plays (0:00 → 20:00); convert to remaining
function nhlClockToRemaining(clock, period) {
  if (!clock) return clock;
  const parts = clock.split(":");
  if (parts.length !== 2) return clock;
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  if (Number.isNaN(mins) || Number.isNaN(secs)) return clock;
  const elapsed = mins * 60 + secs;
  const isOT = period > 3;
  const periodLen = isOT && elapsed <= 300 ? 300 : 1200;
  const rem = Math.max(0, periodLen - elapsed);
  return `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, "0")}`;
}

// ─── Single play row ──────────────────────────────────────────────────────────
function PlayRow({ play, isNew, highlightScoring, league }) {
  const isScoring = highlightScoring && play.scoring_play;
  return (
    <m.div
      layout
      initial={isNew ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-start gap-3 px-4 py-2.5 ${
        isScoring
          ? "bg-win/[0.05] border-l-2 border-win"
          : "border-l-2 border-transparent"
      }`}
    >
      {/* Clock */}
      <span className="font-mono text-xs text-text-tertiary w-12 shrink-0 pt-0.5 tabular-nums">
        {league === "nhl" ? nhlClockToRemaining(play.clock, play.period) ?? "–" : play.clock ?? "–"}
      </span>

      {/* Team logo + description */}
      <div className="flex items-start gap-2 flex-1 min-w-0">
        {play.team_logo ? (
          <img
            src={play.team_logo}
            alt={play.team_short ?? ""}
            className="w-4 h-4 object-contain mt-0.5 shrink-0"
          />
        ) : (
          <div className="w-4 shrink-0" />
        )}
        <span className={`text-sm leading-snug break-words ${isScoring ? "text-text-primary font-medium" : "text-text-secondary"}`}>
          {play.description}
        </span>
      </div>

      {/* Running score */}
      {play.home_score != null && play.away_score != null && (
        <span className={`font-mono text-xs shrink-0 tabular-nums pt-0.5 ${isScoring ? "text-win font-bold" : "text-text-primary"}`}>
          {play.home_score}–{play.away_score}
        </span>
      )}
    </m.div>
  );
}

// ─── NFL drive group ──────────────────────────────────────────────────────────
function DriveGroup({ driveNumber, description, result, plays, newPlayIds, highlightScoring }) {
  const [open, setOpen] = useState(false);
  const scoringPlay = plays.some((p) => p.scoring_play);

  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors duration-150 text-left"
      >
        <span className="text-xs text-text-tertiary font-mono w-8 shrink-0">D{driveNumber}</span>
        <span className="flex-1 text-sm text-text-secondary truncate">{description ?? "Drive"}</span>
        {result && (
          <span className={`text-xs font-medium shrink-0 ${scoringPlay ? driveResultColor(result) : "text-text-tertiary"}`}>
            {result}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-text-tertiary shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="drive-plays"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {plays.map((play) => (
              <PlayRow
                key={play.id ?? play.espn_play_id ?? play.sequence}
                play={play}
                isNew={newPlayIds.has(play.espn_play_id)}
                highlightScoring={highlightScoring}
                league={league}
              />
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PlayByPlay({ league, gameId, isLive }) {
  const { plays: playsData, loading, error, retry } = usePlays(league, gameId, isLive);
  const [activeFilter, setActiveFilter] = useState(isLive ? "all" : "scoring");
  const [prevPlayIds] = useState(() => new Set());

  const plays = useMemo(() => playsData?.plays ?? [], [playsData]);
  const isNfl = league === "nfl";

  // Compute period tabs dynamically from the data
  const periods = useMemo(() => {
    const seen = new Set();
    plays.forEach((p) => seen.add(p.period));
    return Array.from(seen).sort((a, b) => a - b);
  }, [plays]);

  // Track new plays for entrance animation (live only)
  const newPlayIds = useMemo(() => {
    if (!isLive) return new Set();
    const newIds = new Set();
    plays.forEach((p) => {
      const id = p.espn_play_id ?? String(p.sequence);
      if (!prevPlayIds.has(id)) newIds.add(id);
    });
    return newIds;
  }, [plays, isLive, prevPlayIds]);

  // Sync prevPlayIds after each render — must not run inside useMemo
  useEffect(() => {
    if (!isLive) return;
    plays.forEach((p) => {
      prevPlayIds.add(p.espn_play_id ?? String(p.sequence));
    });
  }, [plays, isLive, prevPlayIds]);

  // Filter logic
  const filteredPlays = useMemo(() => {
    if (activeFilter === "scoring") return plays.filter((p) => p.scoring_play);
    if (activeFilter === "all") return plays;
    const period = parseInt(activeFilter, 10);
    return plays.filter((p) => p.period === period);
  }, [plays, activeFilter]);

  // For NFL, group by drive
  const driveGroups = useMemo(() => {
    if (!isNfl) return null;
    const map = new Map();
    filteredPlays.forEach((play) => {
      const key = play.drive_number ?? 0;
      if (!map.has(key)) {
        map.set(key, {
          driveNumber: play.drive_number,
          description: play.drive_description,
          result: play.drive_result,
          plays: [],
        });
      }
      map.get(key).plays.push(play);
    });
    return Array.from(map.values());
  }, [filteredPlays, isNfl]);

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.05] animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-white/[0.05] rounded animate-pulse" />
            <div className="h-3 w-48 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-text-secondary">Could not load play-by-play data.</p>
          <button
            onClick={retry}
            className="text-xs text-accent hover:text-accent-hover transition-colors duration-150"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (plays.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Play by Play</h2>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        <FilterPill label="All" active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
        <FilterPill label="Scoring" active={activeFilter === "scoring"} onClick={() => setActiveFilter("scoring")} />
        {periods.map((p) => (
          <FilterPill
            key={p}
            label={periodLabel(p, league)}
            active={activeFilter === String(p)}
            onClick={() => setActiveFilter(String(p))}
          />
        ))}
      </div>

      {/* Play list */}
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden">
        {isNfl ? (
          // NFL: drive-grouped view, most recent drive first
          driveGroups.length > 0 ? (
            [...driveGroups].reverse().map((drive) => (
              <DriveGroup
                key={drive.driveNumber ?? "unknown"}
                driveNumber={drive.driveNumber}
                description={drive.description}
                result={drive.result}
                plays={drive.plays}
                league={league}
                newPlayIds={newPlayIds}
                highlightScoring={activeFilter !== "scoring"}
              />
            ))
          ) : (
            <p className="text-center text-text-tertiary text-sm py-8">No plays for this filter.</p>
          )
        ) : (
          // NBA / NHL: newest play at top
          <div className="divide-y divide-white/[0.05]">
            {[...filteredPlays].reverse().map((play) => (
              <PlayRow
                key={play.id ?? play.espn_play_id ?? play.sequence}
                play={play}
                isNew={newPlayIds.has(play.espn_play_id ?? String(play.sequence))}
                highlightScoring={activeFilter !== "scoring"}
                league={league}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
