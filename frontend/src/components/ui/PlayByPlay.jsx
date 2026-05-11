import { useState, useMemo, useEffect, useRef } from "react";
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
      className={`touch-target px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
        active
          ? "bg-accent/15 text-accent ring-1 ring-accent/25"
          : "bg-white/[0.03] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary"
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
function PlayRow({ play, isNew, isLast, highlightScoring, scoredSide, homeColor, awayColor, league, gameId, dupeSlugs }) {
  const isScoring = highlightScoring && play.scoring_play;
  const participants = Array.isArray(play.participants) ? play.participants : [];

  // Resolve team color for the scoring rail
  let railColor = null;
  if (isScoring) {
    if (scoredSide === "home" && homeColor) railColor = homeColor;
    else if (scoredSide === "away" && awayColor) railColor = awayColor;
    else railColor = "rgba(232,134,58,0.4)"; // accent/40 fallback
  }

  return (
    <m.div
      id={play.id != null ? `play-${play.id}` : undefined}
      layout="position"
      initial={isNew ? { opacity: 0, y: -14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 28,
        mass: 0.8,
      }}
      className={`relative flex items-start gap-3 py-3 pl-4 pr-3 transition-colors duration-150 hover:bg-white/[0.02] ${
        isScoring ? "bg-white/[0.015]" : ""
      } ${!isLast ? "border-b border-white/[0.04]" : ""}`}
    >
      {isScoring && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
          style={{ background: railColor }}
        />
      )}
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

      {/* Running score — only the side that incremented turns green. Decoupled
          from `isScoring` so the highlight still shows under the Scoring filter. */}
      {play.home_score != null && play.away_score != null && (
        <span className="font-mono text-xs shrink-0 tabular-nums pt-0.5">
          <span className={play.scoring_play && scoredSide === "home" ? "text-win font-bold" : "text-text-primary"}>
            {play.home_score}
          </span>
          <span className="text-text-primary">–</span>
          <span className={play.scoring_play && scoredSide === "away" ? "text-win font-bold" : "text-text-primary"}>
            {play.away_score}
          </span>
        </span>
      )}
    </m.div>
  );
}

// ─── NFL drive group ──────────────────────────────────────────────────────────
function DriveGroup({ driveNumber, description, result, plays, newPlayIds, highlightScoring, scoredSideMap, homeColor, awayColor, league, gameId, dupeSlugs }) {
  const [open, setOpen] = useState(false);
  const scoringPlay = plays.some((p) => p.scoring_play);

  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150 text-left"
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
            {plays.map((play, i) => (
              <PlayRow
                key={play.id ?? play.espn_play_id ?? play.sequence}
                play={play}
                isNew={newPlayIds.has(play.espn_play_id)}
                isLast={i === plays.length - 1}
                highlightScoring={highlightScoring}
                scoredSide={scoredSideMap?.get(play.id ?? play.espn_play_id ?? play.sequence) ?? null}
                homeColor={homeColor}
                awayColor={awayColor}
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
function PlayList({ filteredPlays, showPeriodHeaders, newPlayIds, highlightScoring, scoredSideMap, homeColor, awayColor, league, gameId, dupeSlugs }) {
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
      <div>
        {sortedPlays.map((play, i) => (
          <PlayRow
            key={play.id ?? play.espn_play_id ?? play.sequence}
            play={play}
            isNew={newPlayIds.has(play.espn_play_id ?? String(play.sequence))}
            isLast={i === sortedPlays.length - 1}
            highlightScoring={highlightScoring}
            scoredSide={scoredSideMap?.get(play.id ?? play.espn_play_id ?? play.sequence) ?? null}
            homeColor={homeColor}
            awayColor={awayColor}
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
          <div>
            {group.plays.map((play, i) => (
              <PlayRow
                key={play.id ?? play.espn_play_id ?? play.sequence}
                play={play}
                isNew={newPlayIds.has(play.espn_play_id ?? String(play.sequence))}
                isLast={i === group.plays.length - 1}
                highlightScoring={highlightScoring}
                scoredSide={scoredSideMap?.get(play.id ?? play.espn_play_id ?? play.sequence) ?? null}
                homeColor={homeColor}
                awayColor={awayColor}
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
export default function PlayByPlay({ league, gameId, isLive, homeColor, awayColor }) {
  const { plays: playsData, loading, error, retry } = usePlays(league, gameId, isLive);
  const dupeSlugs = useDuplicatePlayerSlugs(league);
  const [activeFilter, setActiveFilter] = useState("all");
  const [prevPlayIds] = useState(() => new Set());
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const searchBoxRef = useRef(null);

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

  // Walk plays in chronological order (oldest first) once to detect which
  // side incremented its score on each scoring play. Computed off the full
  // unfiltered list so consecutive scoring plays still see the right "prev"
  // even when the user has the Scoring filter on.
  const scoredSideMap = useMemo(() => {
    const map = new Map();
    const chronological = [...plays].sort((a, b) => {
      if (a.period !== b.period) return (a.period ?? 0) - (b.period ?? 0);
      return -comparePlaysNewestFirst(a, b, league);
    });
    let prevHome = 0;
    let prevAway = 0;
    for (const play of chronological) {
      const key = play.id ?? play.espn_play_id ?? play.sequence;
      if (play.home_score == null || play.away_score == null) {
        map.set(key, null);
        continue;
      }
      let side = null;
      if (play.home_score > prevHome) side = "home";
      else if (play.away_score > prevAway) side = "away";
      map.set(key, side);
      prevHome = play.home_score;
      prevAway = play.away_score;
    }
    return map;
  }, [plays, league]);

  // Unique players across all plays (for the autocomplete suggestions).
  const allPlayers = useMemo(() => {
    const map = new Map();
    for (const play of plays) {
      if (!Array.isArray(play.participants)) continue;
      for (const pp of play.participants) {
        if (pp.id == null || map.has(pp.id)) continue;
        map.set(pp.id, { id: pp.id, name: pp.name, image_url: pp.image_url });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? ""),
    );
  }, [plays]);

  const playerSuggestions = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    if (!q) return [];
    return allPlayers
      .filter((p) => p.name?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allPlayers, playerQuery]);

  // Reset suggestion highlight when the candidate list changes.
  useEffect(() => {
    setHighlightedIdx(0);
  }, [playerQuery]);

  // Close suggestions on outside click.
  useEffect(() => {
    if (!suggestionsOpen) return;
    const onClick = (e) => {
      if (!searchBoxRef.current?.contains(e.target)) setSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [suggestionsOpen]);

  function pickPlayer(player) {
    setSelectedPlayer(player);
    setPlayerQuery("");
    setSuggestionsOpen(false);
  }

  function clearPlayer() {
    setSelectedPlayer(null);
    setPlayerQuery("");
    setSuggestionsOpen(false);
  }

  function onSearchKeyDown(e) {
    if (e.key === "Escape") {
      setSuggestionsOpen(false);
      return;
    }
    if (!playerSuggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => (i + 1) % playerSuggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => (i - 1 + playerSuggestions.length) % playerSuggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickPlayer(playerSuggestions[highlightedIdx]);
    }
  }

  // Filter logic — period/scoring filter combines with optional player filter.
  const filteredPlays = useMemo(() => {
    let result = plays;
    if (activeFilter === "scoring") result = result.filter((p) => p.scoring_play);
    else if (activeFilter !== "all") {
      const period = parseInt(activeFilter, 10);
      result = result.filter((p) => p.period === period);
    }
    if (selectedPlayer) {
      result = result.filter((p) =>
        Array.isArray(p.participants) && p.participants.some((pp) => pp.id === selectedPlayer.id),
      );
    }
    return result;
  }, [plays, activeFilter, selectedPlayer]);

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
        <div className="h-64 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <div className="p-8 flex flex-col items-center gap-3 text-center">
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

      {/* Filters on top; on desktop search sits to their right, on mobile it stacks below */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none min-w-0">
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

        <div ref={searchBoxRef} className="relative w-full sm:w-56 sm:shrink-0 h-9">
          <AnimatePresence initial={false}>
            {selectedPlayer ? (
              <m.div
                key="chip"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center gap-2 bg-accent/10 ring-1 ring-accent/30 rounded-full pl-1 pr-1.5"
              >
                {selectedPlayer.image_url ? (
                  <img
                    src={selectedPlayer.image_url}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover bg-surface-base shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-surface-base text-[10px] font-semibold text-text-tertiary inline-flex items-center justify-center shrink-0">
                    {selectedPlayer.name?.[0] ?? "?"}
                  </span>
                )}
                <span className="text-xs text-text-primary truncate flex-1 min-w-0">{selectedPlayer.name}</span>
                <button
                  type="button"
                  onClick={clearPlayer}
                  aria-label="Clear player filter"
                  className="touch-target shrink-0 text-text-tertiary hover:text-text-primary transition-colors duration-150"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </m.div>
            ) : (
              <m.div
                key="input"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center"
              >
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={playerQuery}
                  onChange={(e) => {
                    setPlayerQuery(e.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Filter by player…"
                  aria-label="Filter plays by player"
                  className="w-full bg-white/[0.03] ring-1 ring-white/[0.06] rounded-full text-xs text-text-primary placeholder:text-text-tertiary pl-9 pr-3 py-2 focus:outline-none focus:ring-accent/40 transition-all duration-150"
                />
              </m.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!selectedPlayer && suggestionsOpen && playerSuggestions.length > 0 && (
              <m.ul
                key="suggestions"
                role="listbox"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: "top center" }}
                className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface-elevated ring-1 ring-white/[0.08] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] max-h-64 overflow-y-auto"
              >
                {playerSuggestions.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === highlightedIdx}
                      onClick={() => pickPlayer(p)}
                      onMouseEnter={() => setHighlightedIdx(i)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-100 ${
                        i === highlightedIdx ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover bg-surface-base shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-surface-base text-[10px] font-semibold text-text-tertiary inline-flex items-center justify-center shrink-0">
                          {p.name?.[0] ?? "?"}
                        </span>
                      )}
                      <span className="text-xs text-text-primary truncate">{p.name}</span>
                    </button>
                  </li>
                ))}
              </m.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Play list */}
      <div className="relative">
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
                scoredSideMap={scoredSideMap}
                homeColor={homeColor}
                awayColor={awayColor}
              />
            ))
          ) : (
            <p className="text-center text-text-tertiary text-sm py-8">No plays for this filter.</p>
          )
        ) : filteredPlays.length === 0 ? (
          <m.p
            key="empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-center text-text-tertiary text-sm py-8"
          >
            {selectedPlayer ? `No plays for ${selectedPlayer.name}.` : "No plays for this filter."}
          </m.p>
        ) : (
          // NBA / NHL: newest play at top, grouped by period when not filtered
          <PlayList
            filteredPlays={filteredPlays}
            showPeriodHeaders={activeFilter === "all" || activeFilter === "scoring"}
            newPlayIds={newPlayIds}
            highlightScoring={activeFilter !== "scoring"}
            scoredSideMap={scoredSideMap}
            homeColor={homeColor}
            awayColor={awayColor}
            league={league}
            gameId={gameId}
            dupeSlugs={dupeSlugs}
          />
        )}
      </div>
    </div>
  );
}
