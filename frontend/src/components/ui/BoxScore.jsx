import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import slugify from "../../utils/slugify.js";
import { queryKeys, queryFns } from "../../lib/query.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTime(val) {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const str = String(val);
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return parseFloat(str) || 0;
}

// Turns any stat cell value into a sortable number
function parseStatValue(val) {
  if (val == null || val === "-" || val === "") return -Infinity;
  const str = String(val);
  if (/^\d+:\d+$/.test(str)) return parseTime(str); // "36:24" → seconds
  if (/^\d+-\d+$/.test(str)) return parseInt(str.split("-")[0], 10); // "8-14" → 8
  const n = parseFloat(str);
  return isNaN(n) ? -Infinity : n;
}

// ---------------------------------------------------------------------------
// Default (league) sort
// ---------------------------------------------------------------------------

const NFL_OFFENSE = new Set(["QB", "RB", "FB", "WR", "TE", "OL", "OT", "OG", "C", "T", "G"]);
const NFL_DEFENSE = new Set(["DE", "DT", "NT", "LB", "OLB", "ILB", "MLB", "CB", "S", "FS", "SS", "DB", "SAF"]);
const NFL_SPECIAL = new Set(["K", "P", "LS", "KR", "PR", "PK"]);
const NHL_FORWARDS = new Set(["C", "LW", "RW", "F", "W"]);
const NHL_DEFENSE_POS = new Set(["D", "LD", "RD"]);

function nflPositionRank(pos) {
  if (!pos) return 3;
  const p = pos.toUpperCase();
  if (NFL_OFFENSE.has(p)) return 0;
  if (NFL_DEFENSE.has(p)) return 1;
  if (NFL_SPECIAL.has(p)) return 2;
  return 3;
}

function nhlPositionRank(pos) {
  if (!pos) return 3;
  const p = pos.toUpperCase();
  if (NHL_FORWARDS.has(p)) return 0;
  if (NHL_DEFENSE_POS.has(p)) return 1;
  if (p === "G") return 2;
  return 3;
}

function defaultSort(players, league) {
  if (!players) return players;
  const sorted = [...players];
  if (league === "nba") {
    sorted.sort((a, b) => parseTime(b.stats?.MIN) - parseTime(a.stats?.MIN));
  } else if (league === "nhl") {
    sorted.sort((a, b) => {
      const rd = nhlPositionRank(a.position) - nhlPositionRank(b.position);
      if (rd !== 0) return rd;
      return parseTime(b.stats?.TOI) - parseTime(a.stats?.TOI);
    });
  } else if (league === "nfl") {
    sorted.sort((a, b) => {
      const rd = nflPositionRank(a.position) - nflPositionRank(b.position);
      if (rd !== 0) return rd;
      return (Number(a.jerseyNumber) || 99) - (Number(b.jerseyNumber) || 99);
    });
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Column sort (applied when user clicks a header)
// ---------------------------------------------------------------------------

function columnSort(players, key, dir) {
  const sorted = [...players];
  sorted.sort((a, b) => {
    if (key === "__name__") {
      const cmp = (a.name || "").localeCompare(b.name || "");
      return dir === "asc" ? cmp : -cmp;
    }
    const av = parseStatValue(a.stats?.[key]);
    const bv = parseStatValue(b.stats?.[key]);
    return dir === "asc" ? av - bv : bv - av;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Sort arrow indicator
// ---------------------------------------------------------------------------

function SortArrow({ active, dir }) {
  return (
    <span
      className={`ml-1 inline-flex flex-col gap-[2px] transition-opacity duration-150 ${
        active ? "opacity-100" : "opacity-0 group-hover:opacity-35"
      }`}
      aria-hidden
    >
      <svg
        width="7"
        height="9"
        viewBox="0 0 7 9"
        fill="none"
        className="shrink-0"
      >
        {/* up triangle */}
        <path
          d="M3.5 1 L6.5 4.5 L0.5 4.5 Z"
          fill={active && dir === "asc" ? "var(--color-accent)" : "currentColor"}
          opacity={active && dir === "asc" ? 1 : 0.4}
        />
        {/* down triangle */}
        <path
          d="M3.5 8 L0.5 4.5 L6.5 4.5 Z"
          fill={active && dir === "desc" ? "var(--color-accent)" : "currentColor"}
          opacity={active && dir === "desc" ? 1 : 0.4}
        />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BoxScore({ league, homeTeam, awayTeam, season }) {
  const queryClient = useQueryClient();
  // null sortKey = use league default sort
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  function handleHeaderClick(key) {
    if (sortKey === key) {
      // same column: flip direction, or reset on second flip back to default
      if (sortDir === "desc") {
        setSortDir("asc");
      } else {
        // third click → reset to default
        setSortKey(null);
        setSortDir("desc");
      }
    } else {
      // new column: always start desc (highest first) except name → asc
      setSortKey(key);
      setSortDir(key === "__name__" ? "asc" : "desc");
    }
  }

  function resetSort() {
    setSortKey(null);
    setSortDir("desc");
  }

  function getSortedPlayers(players) {
    if (!players?.length) return [];
    if (!sortKey) return defaultSort(players, league);
    return columnSort(players, sortKey, sortDir);
  }

  const extractStatHeaders = (players) => {
    if (!players?.length) return [];
    const sample = players.find((p) => p?.stats && typeof p.stats === "object");
    if (!sample) return [];
    return Object.keys(sample.stats);
  };

  const statHeaders = [
    ...new Set([
      ...extractStatHeaders(homeTeam.players),
      ...extractStatHeaders(awayTeam.players),
    ]),
  ];

  if (statHeaders.length === 0) {
    return (
      <div className="text-center text-text-tertiary text-sm mt-8">
        No box score available for this game. Check back once the game has finished.
      </div>
    );
  }

  const renderTable = (team, players) => (
    <div className="w-full bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex flex-col h-full">
      {/* Table header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold text-text-primary">
          {team.info.name}
        </h4>
        {sortKey && (
          <button
            onClick={resetSort}
            className="touch-target flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] font-medium text-accent hover:bg-accent/20 transition-colors duration-150"
          >
            <span>
              {sortKey === "__name__" ? "Player" : sortKey}
              {" "}
              {sortDir === "desc" ? "↓" : "↑"}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-label="Reset sort">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto scrollbar-thin flex-1 flex flex-col">
        <table className="min-w-[600px] sm:min-w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {/* Player name — sortable */}
              <th className="py-2.5 px-5 font-medium">
                <button
                  onClick={() => handleHeaderClick("__name__")}
                  className={`group flex items-center text-[10px] uppercase tracking-widest transition-colors duration-150 ${
                    sortKey === "__name__"
                      ? "text-accent"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Player
                  <SortArrow active={sortKey === "__name__"} dir={sortDir} />
                </button>
              </th>

              {statHeaders.map((stat) => (
                <th key={stat} className="py-2.5 px-3 font-medium">
                  <button
                    onClick={() => handleHeaderClick(stat)}
                    className={`group flex items-center justify-end w-full text-[10px] uppercase tracking-widest transition-colors duration-150 ${
                      sortKey === stat
                        ? "text-accent"
                        : "text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    {stat}
                    <SortArrow active={sortKey === stat} dir={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/[0.04]">
            {players.map((p) => (
              <tr
                id={slugify(p.name)}
                key={p.id}
                className="hover:bg-surface-overlay/60 transition-colors duration-150"
              >
                <td className="py-2.5 px-5 font-medium whitespace-nowrap">
                  <Link
                    to={`/${league}/players/${slugify(p.name)}${season ? `?season=${season}` : ""}`}
                    className="text-accent hover:text-accent-hover transition-colors duration-200 text-sm"
                    onMouseEnter={() => {
                      if (window.matchMedia("(hover: hover)").matches) {
                        queryClient.prefetchQuery({ queryKey: queryKeys.player(league, slugify(p.name), season || null), queryFn: queryFns.player(league, slugify(p.name), season || null), staleTime: 10_000 });
                      }
                    }}
                  >
                    {p.name}
                  </Link>
                </td>

                {statHeaders.map((stat) => (
                  <td
                    key={stat}
                    className={`py-2.5 px-3 text-right text-sm whitespace-nowrap tabular-nums transition-colors duration-150 ${
                      sortKey === stat
                        ? "text-text-primary bg-accent/[0.04]"
                        : "text-text-secondary"
                    }`}
                  >
                    {p.stats?.[stat] ?? "0"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="mt-6 w-full">
      <h3 className="text-2xl font-bold tracking-tight text-text-primary mb-6 text-center">
        Box Score
      </h3>
      <div
        className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start"
        style={{ gridAutoRows: "1fr" }}
      >
        {renderTable(homeTeam, getSortedPlayers(homeTeam.players))}
        {renderTable(awayTeam, getSortedPlayers(awayTeam.players))}
      </div>
    </div>
  );
}
