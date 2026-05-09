import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { usePlays } from "../../hooks/data/usePlays.js";
import { useDuplicatePlayerSlugs } from "../../hooks/data/useDuplicatePlayerSlugs.js";
import { playerSlug } from "../../utils/playerUrl.js";

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
    if (period === 4) return "OT";
    if (period === 5) return "SO";
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
      className={`touch-target px-3 py-1 rounded-full text-xs font-medium transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap ${
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

// ─── Period section header ────────────────────────────────────────────────────
function PeriodHeader({ period, league }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-primary/80 backdrop-blur-sm sticky top-0 z-10">
      <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest">
        {periodLabel(period, league)}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function formatRating(value) {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return `${num >= 0 ? "+" : "−"}${Math.abs(num).toFixed(1)}`;
}

// ─── Participant chip — avatar + name, links to box-score row ────────────────
function ParticipantChip({ participant, league, gameId, dupeSlugs }) {
  const params = useParams();
  const resolvedGameId = gameId ?? params.gameId;
  const slug = playerSlug(participant, dupeSlugs);
  const ratingText = formatRating(participant.rating);
  const ratingPositive = participant.rating != null && Number(participant.rating) >= 0;
  return (
    <Link
      to={`/${league}/games/${resolvedGameId}?tab=analysis#${slug}`}
      title={`${participant.name}${ratingText ? ` ${ratingText}` : ""}`}
      className="group inline-flex items-center gap-1.5 pl-0.5 pr-2 py-0.5 rounded-full bg-surface-overlay hover:bg-white/[0.10] border border-white/[0.06] hover:border-white/[0.14] transition-colors duration-150 max-w-full"
    >
      {participant.image_url ? (
        <img
          src={participant.image_url}
          alt=""
          className="w-5 h-5 rounded-full object-cover bg-surface-base shrink-0"
          loading="lazy"
        />
      ) : (
        <span className="w-5 h-5 rounded-full bg-surface-base text-[9px] font-semibold text-text-tertiary inline-flex items-center justify-center shrink-0">
          {participant.name?.[0] ?? "?"}
        </span>
      )}
      <span className="text-[11px] text-text-secondary group-hover:text-text-primary truncate">
        {participant.name}
      </span>
      {ratingText && (
        <span className={`text-[10px] font-mono tabular-nums shrink-0 ${ratingPositive ? "text-win" : "text-loss"}`}>
          {ratingText}
        </span>
      )}
    </Link>
  );
}

// ─── Single play row ──────────────────────────────────────────────────────────
function PlayRow({ play, isNew, highlightScoring, league, gameId, dupeSlugs }) {
  const isScoring = highlightScoring && play.scoring_play;
  const participants = Array.isArray(play.participants) ? play.participants : [];
  return (
    <m.div
      layout="position"
      initial={isNew ? { opacity: 0, y: -14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 28,
        mass: 0.8,
      }}
      className={`relative flex items-start gap-3 px-4 py-2.5 ${
        isScoring
          ? "bg-win/[0.05] border-l-2 border-win"
          : "border-l-2 border-transparent"
      }`}
    >
      {isNew && (
        <m.div
          className="absolute inset-0 bg-accent/[0.06] pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.8, delay: 0.2, ease: "easeOut" }}
        />
      )}
      {/* Clock */}
      <span className="font-mono text-xs text-text-tertiary w-12 shrink-0 pt-0.5 tabular-nums">
        {league === "nhl" && play.period <= 4 ? nhlClockToRemaining(play.clock, play.period) ?? "–" : play.clock ?? "–"}
      </span>

      {/* Team logo + description + participants */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
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

        {participants.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pl-6">
            {participants.map((pp) => (
              <ParticipantChip
                key={`${pp.id}-${pp.role}`}
                participant={pp}
                league={league}
                gameId={gameId}
                dupeSlugs={dupeSlugs}
              />
            ))}
          </div>
        )}
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
function DriveGroup({ driveNumber, description, result, plays, newPlayIds, highlightScoring, league, gameId, dupeSlugs }) {
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
                gameId={gameId}
                dupeSlugs={dupeSlugs}
              />
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function parseClockSeconds(clock) {
  if (clock == null) return null;
  const str = String(clock);
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
    return m * 60 + s;
  }
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

// Newest-first ordering inside a single period. NBA/NFL clocks count down
// (lower remaining = later), NHL counts up (higher elapsed = later).
function comparePlaysNewestFirst(a, b, league) {
  const ca = parseClockSeconds(a.clock);
  const cb = parseClockSeconds(b.clock);
  if (ca != null && cb != null && ca !== cb) {
    return league === "nhl" ? cb - ca : ca - cb;
  }
  if (ca == null && cb != null) return 1;
  if (ca != null && cb == null) return -1;
  return (b.sequence ?? 0) - (a.sequence ?? 0);
}

// ─── Play list with optional period grouping ─────────────────────────────────
function PlayList({ filteredPlays, showPeriodHeaders, newPlayIds, highlightScoring, league, gameId, dupeSlugs }) {
  // Sort newest-first across all periods: period DESC, then clock-aware within period.
  const sortedPlays = useMemo(() => {
    return [...filteredPlays].sort((a, b) => {
      if (a.period !== b.period) return (b.period ?? 0) - (a.period ?? 0);
      return comparePlaysNewestFirst(a, b, league);
    });
  }, [filteredPlays, league]);

  // Group by period preserving sortedPlays order within each period.
  const groups = useMemo(() => {
    const map = new Map();
    for (const play of sortedPlays) {
      if (!map.has(play.period)) map.set(play.period, []);
      map.get(play.period).push(play);
    }
    return Array.from(map.entries()).map(([period, plays]) => ({ period, plays }));
  }, [sortedPlays]);

  if (!showPeriodHeaders) {
    return (
      <div className="divide-y divide-white/[0.05]">
        {sortedPlays.map((play) => (
          <PlayRow
            key={play.id ?? play.espn_play_id ?? play.sequence}
            play={play}
            isNew={newPlayIds.has(play.espn_play_id ?? String(play.sequence))}
            highlightScoring={highlightScoring}
            league={league}
            gameId={gameId}
            dupeSlugs={dupeSlugs}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <div key={group.period}>
          <PeriodHeader period={group.period} league={league} />
          <div className="divide-y divide-white/[0.05]">
            {group.plays.map((play) => (
              <PlayRow
                key={play.id ?? play.espn_play_id ?? play.sequence}
                play={play}
                isNew={newPlayIds.has(play.espn_play_id ?? String(play.sequence))}
                highlightScoring={highlightScoring}
                league={league}
                gameId={gameId}
                dupeSlugs={dupeSlugs}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PlayByPlay({ league, gameId, isLive }) {
  const { plays: playsData, loading, error, retry } = usePlays(league, gameId, isLive);
  const dupeSlugs = useDuplicatePlayerSlugs(league);
  const [activeFilter, setActiveFilter] = useState("all");
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
            className="touch-target text-xs text-accent hover:text-accent-hover transition-colors duration-150"
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
                gameId={gameId}
                dupeSlugs={dupeSlugs}
                newPlayIds={newPlayIds}
                highlightScoring={activeFilter !== "scoring"}
              />
            ))
          ) : (
            <p className="text-center text-text-tertiary text-sm py-8">No plays for this filter.</p>
          )
        ) : (
          // NBA / NHL: newest play at top, grouped by period when not filtered
          <PlayList
            filteredPlays={filteredPlays}
            showPeriodHeaders={activeFilter === "all" || activeFilter === "scoring"}
            newPlayIds={newPlayIds}
            highlightScoring={activeFilter !== "scoring"}
            league={league}
            gameId={gameId}
            dupeSlugs={dupeSlugs}
          />
        )}
      </div>
    </div>
  );
}
