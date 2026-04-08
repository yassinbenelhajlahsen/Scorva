import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { usePlayer } from "../hooks/data/usePlayer.js";
import { useTeam } from "../hooks/data/useTeam.js";
import { useHeadToHead } from "../hooks/data/useHeadToHead.js";
import { containerVariants, itemVariants } from "../utils/motion.js";
import { formatDateShort } from "../utils/formatDate.js";
import slugify from "../utils/slugify.js";
import SeasonSelector from "../components/navigation/SeasonSelector.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import ComparePageSkeleton from "../components/skeletons/ComparePageSkeleton.jsx";

const playerAvgConfigs = {
  nba: [
    { key: "points", label: "PTS" },
    { key: "rebounds", label: "REB" },
    { key: "assists", label: "AST" },
    { key: "fgPct", label: "FG%" },
  ],
  nfl: [
    { key: "yards", label: "YDS" },
    { key: "td", label: "TD" },
    { key: "interceptions", label: "INT", lower: true },
  ],
  nhl: [
    { key: "goals", label: "G" },
    { key: "assists", label: "A" },
    { key: "saves", label: "SV" },
  ],
};

const playerGameStatConfigs = {
  nba: [
    { key: "points", label: "PTS" },
    { key: "rebounds", label: "REB" },
    { key: "assists", label: "AST" },
  ],
  nfl: [
    { key: "YDS", label: "YDS" },
    { key: "TD", label: "TD" },
  ],
  nhl: [
    { key: "G", label: "G" },
    { key: "A", label: "A" },
  ],
};

export default function ComparePage() {
  const { league: rawLeague } = useParams();
  const league = (rawLeague || "").toLowerCase();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");
  const ids = useMemo(() => (searchParams.get("ids") || "").split(",").filter(Boolean), [searchParams]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  if (!["players", "teams"].includes(type) || ids.length !== 2) {
    return (
      <ErrorState
        message="Invalid compare URL. Browse players or teams and use the Compare button to start a comparison."
      />
    );
  }

  if (type === "players") {
    return (
      <PlayerCompare
        league={league}
        slug1={ids[0]}
        slug2={ids[1]}
        selectedSeason={selectedSeason}
        setSelectedSeason={setSelectedSeason}
      />
    );
  }

  return (
    <TeamCompare
      league={league}
      slug1={ids[0]}
      slug2={ids[1]}
      selectedSeason={selectedSeason}
      setSelectedSeason={setSelectedSeason}
    />
  );
}

function PlayerCompare({ league, slug1, slug2, selectedSeason, setSelectedSeason }) {
  const p1 = usePlayer(league, slug1, selectedSeason);
  const p2 = usePlayer(league, slug2, selectedSeason);

  const loading = p1.loading || p2.loading;
  const seasonLoading = p1.seasonLoading || p2.seasonLoading;
  const error = p1.error || p2.error;

  const h2h = useHeadToHead(
    league,
    "players",
    p1.playerData?.id,
    p2.playerData?.id
  );

  if (loading) return <ComparePageSkeleton />;
  if (error) return <ErrorState message={error} />;

  const a = p1.playerData;
  const b = p2.playerData;
  if (!a || !b) return <ErrorState message="One or both players could not be found." />;

  const avgConfig = playerAvgConfigs[league] || [];
  const gameStatConfig = playerGameStatConfigs[league] || [];
  const seasons = mergeSeasons(a.availableSeasons, b.availableSeasons);

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Link
        to={`/${league}`}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league?.toUpperCase()}</span>
      </Link>

      <m.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
        {/* Hero */}
        <m.div variants={itemVariants} className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <div className="flex justify-end mb-6">
            <SeasonSelector
              league={league}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
              seasons={seasons}
            />
          </div>
          <div className="flex items-center justify-center gap-6 sm:gap-25">
            <PlayerHero player={a} league={league} />
            <span className="text-2xl sm:text-3xl font-bold text-text-tertiary">VS</span>
            <PlayerHero player={b} league={league} />
          </div>

          {/* Bio + Season Averages side by side */}
          <div
            className="mt-8 pt-6 border-t border-white/[0.06]"
            style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bio */}
              <div className="flex flex-col">
                <h3 className="text-md font-semibold text-text-tertiary uppercase tracking-wider mb-10 text-center">Bio</h3>
                <div className="flex-1 flex flex-col justify-between gap-4">
                  {[
                    { label: "Position", a: a.position, b: b.position },
                    { label: "Height", a: a.height, b: b.height },
                    { label: "Weight", a: a.weight, b: b.weight },
                    { label: "Jersey", a: a.jerseyNumber ? `#${a.jerseyNumber}` : "—", b: b.jerseyNumber ? `#${b.jerseyNumber}` : "—" },
                    { label: "Draft", a: a.draftInfo || "—", b: b.draftInfo || "—" },
                  ].map((row) => (
                    <BioRow key={row.label} {...row} />
                  ))}
                </div>
              </div>

              {/* Season Averages */}
              <div className="flex flex-col">
                <h3 className="text-md font-semibold text-text-tertiary uppercase tracking-wider mb-10 text-center">Season Averages</h3>
                <div className="flex-1 flex flex-col justify-between gap-4">
                  {avgConfig.map((stat) => (
                    <StatRow
                      key={stat.key}
                      label={stat.label}
                      valA={Number(a.seasonAverages?.[stat.key]) || 0}
                      valB={Number(b.seasonAverages?.[stat.key]) || 0}
                      lowerIsBetter={stat.lower}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </m.div>

        {/* Head-to-Head */}
        <m.div variants={itemVariants} style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}>
          <SectionHeader title="Head-to-Head" />
          <HeadToHeadSection
            games={h2h.data}
            loading={h2h.isLoading}
            entityA={{ id: a.id, name: a.name, teamId: a.team?.id }}
            entityB={{ id: b.id, name: b.name, teamId: b.team?.id }}
            type="players"
            league={league}
          />
        </m.div>

        {/* Recent Games */}
        <m.div variants={itemVariants} style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}>
          <SectionHeader title="Recent Games" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RecentGamesColumn player={a} stats={gameStatConfig} league={league} />
            <RecentGamesColumn player={b} stats={gameStatConfig} league={league} />
          </div>
        </m.div>
      </m.div>
    </div>
  );
}

function TeamCompare({ league, slug1, slug2, selectedSeason, setSelectedSeason }) {
  const t1 = useTeam(league, slug1, selectedSeason);
  const t2 = useTeam(league, slug2, selectedSeason);

  const loading = t1.loading || t2.loading;
  const seasonLoading = t1.seasonLoading || t2.seasonLoading;
  const error = t1.error || t2.error;

  const h2h = useHeadToHead(
    league,
    "teams",
    t1.team?.id,
    t2.team?.id
  );

  if (loading) return <ComparePageSkeleton />;
  if (error) return <ErrorState message={error} />;

  const a = t1.team;
  const b = t2.team;
  if (!a || !b) return <ErrorState message="One or both teams could not be found." />;

  const seasons = mergeSeasons(t1.availableSeasons, t2.availableSeasons);

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-8">
      <Link
        to={`/${league}`}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league?.toUpperCase()}</span>
      </Link>

      <m.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
        {/* Hero */}
        <m.div variants={itemVariants} className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <div className="flex justify-end mb-6">
            <SeasonSelector
              league={league}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
              seasons={seasons}
            />
          </div>
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <TeamHero team={a} league={league} />
            <span className="text-2xl sm:text-3xl font-bold text-text-tertiary">VS</span>
            <TeamHero team={b} league={league} />
          </div>

          {/* Record inline under hero */}
          <div
            className="mt-8 pt-6 border-t border-white/[0.06]"
            style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}
          >
            <div className="space-y-4">
              <RecordRow label="Overall" a={t1.teamRecord ?? a.record} b={t2.teamRecord ?? b.record} />
              <RecordRow label="Home" a={t1.homeRecord ?? "—"} b={t2.homeRecord ?? "—"} />
              <RecordRow label="Away" a={t1.awayRecord ?? "—"} b={t2.awayRecord ?? "—"} />
            </div>
          </div>
        </m.div>

        {/* Head-to-Head */}
        <m.div variants={itemVariants} style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}>
          <SectionHeader title="Head-to-Head" />
          <HeadToHeadSection
            games={h2h.data}
            loading={h2h.isLoading}
            entityA={{ id: a.id, name: a.name, teamId: a.id }}
            entityB={{ id: b.id, name: b.name, teamId: b.id }}
            type="teams"
            league={league}
          />
        </m.div>
      </m.div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────

function CompareTabBar({ tabs, activeTab, onTabChange }) {
  const tabNavRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicatorBounds, setIndicatorBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setIndicatorBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeTab, tabs]);

  return (
    <div ref={tabNavRef} className="relative flex border-b border-white/[0.06] -mt-2">
      {indicatorBounds && (
        <m.div
          className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
          animate={{ left: indicatorBounds.left, width: indicatorBounds.width }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => (tabRefs.current[i] = el)}
          onClick={() => onTabChange(tab.id)}
          className={`relative px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px ${
            activeTab === tab.id
              ? "text-accent"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <h2 className="text-lg font-semibold text-text-primary mb-3">{title}</h2>
  );
}

function PlayerHero({ player, league }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Link to={`/${league}/players/${slugify(player.name)}`}>
        <img
          src={player.imageUrl || "/images/placeholder.png"}
          alt={player.name}
          className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-2xl ring-1 ring-white/[0.08] hover:ring-white/[0.2] transition-all duration-200"
        />
      </Link>
      <div className="text-center">
        <Link to={`/${league}/players/${slugify(player.name)}`} className="text-base sm:text-lg font-bold text-text-primary hover:text-accent transition-colors duration-200">
          {player.name}
        </Link>
        <p className="text-xs text-text-tertiary">{player.position} {player.jerseyNumber ? `#${player.jerseyNumber}` : ""}</p>
        {player.team && (
          <Link to={`/${league}/teams/${slugify(player.team.name)}`} className="flex items-center justify-center gap-1.5 mt-1 hover:text-accent transition-colors duration-200">
            {player.team.logoUrl && (
              <img src={player.team.logoUrl} alt={player.team.name} className="w-4 h-4 object-contain" />
            )}
            <p className="text-xs text-text-secondary hover:text-accent transition-colors duration-200">{player.team.name}</p>
          </Link>
        )}
      </div>
    </div>
  );
}

function TeamHero({ team, league }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Link to={`/${league}/teams/${slugify(team.name)}`}>
        {team.logo_url && (
          <img
            src={team.logo_url}
            alt={team.name}
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
          />
        )}
      </Link>
      <div className="text-center">
        <Link to={`/${league}/teams/${slugify(team.name)}`} className="text-base sm:text-lg font-bold text-text-primary hover:text-accent transition-colors duration-200">
          {team.name}
        </Link>
        <p className="text-xs text-text-tertiary">{team.location}</p>
      </div>
    </div>
  );
}

function CompareBar({ label, valA, valB, lowerIsBetter = false }) {
  const maxVal = Math.max(valA, valB, 1);
  const pctA = (valA / maxVal) * 100;
  const pctB = (valB / maxVal) * 100;

  const aWins = lowerIsBetter ? valA < valB : valA > valB;
  const bWins = lowerIsBetter ? valB < valA : valB > valA;
  const tie = valA === valB;

  return (
    <div className="flex items-center gap-3">
      {/* Value A */}
      <span className={`w-14 text-right text-sm font-semibold tabular-nums ${aWins && !tie ? "text-accent" : "text-text-secondary"}`}>
        {valA}
      </span>

      {/* Bar A (grows right-to-left) */}
      <div className="flex-1 flex justify-end">
        <div
          className={`h-5 rounded-l-md transition-all duration-500 ease-out ${aWins && !tie ? "bg-accent/60" : "bg-white/[0.08]"}`}
          style={{ width: `${pctA}%` }}
        />
      </div>

      {/* Label */}
      <span className="w-12 text-center text-xs font-semibold text-text-tertiary uppercase tracking-wider shrink-0">
        {label}
      </span>

      {/* Bar B (grows left-to-right) */}
      <div className="flex-1">
        <div
          className={`h-5 rounded-r-md transition-all duration-500 ease-out ${bWins && !tie ? "bg-accent/60" : "bg-white/[0.08]"}`}
          style={{ width: `${pctB}%` }}
        />
      </div>

      {/* Value B */}
      <span className={`w-14 text-left text-sm font-semibold tabular-nums ${bWins && !tie ? "text-accent" : "text-text-secondary"}`}>
        {valB}
      </span>
    </div>
  );
}

function BioRow({ label, a, b }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-right text-sm text-text-primary">{a}</span>
      <span className="w-24 text-center text-xs font-semibold text-text-tertiary uppercase tracking-wider">{label}</span>
      <span className="flex-1 text-left text-sm text-text-primary">{b}</span>
    </div>
  );
}

function StatRow({ label, valA, valB, lowerIsBetter = false }) {
  const aWins = lowerIsBetter ? valA < valB : valA > valB;
  const bWins = lowerIsBetter ? valB < valA : valB > valA;
  const tie = valA === valB;

  return (
    <div className="flex items-center">
      <span className={`flex-1 text-right text-sm font-semibold tabular-nums ${aWins && !tie ? "text-accent" : "text-text-primary"}`}>
        {valA}
      </span>
      <span className="w-24 text-center text-xs font-semibold text-text-tertiary uppercase tracking-wider">{label}</span>
      <span className={`flex-1 text-left text-sm font-semibold tabular-nums ${bWins && !tie ? "text-accent" : "text-text-primary"}`}>
        {valB}
      </span>
    </div>
  );
}

function RecordRow({ label, a, b }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-right text-lg font-bold tabular-nums text-text-primary">{a}</span>
      <span className="w-24 text-center text-xs font-semibold text-text-tertiary uppercase tracking-wider">{label}</span>
      <span className="flex-1 text-left text-lg font-bold tabular-nums text-text-primary">{b}</span>
    </div>
  );
}

function RecentGamesColumn({ player, stats, league }) {
  const games = (player.games || []).slice(0, 10);

  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2 mb-3">
        <img
          src={player.imageUrl || "/images/placeholder.png"}
          alt={player.name}
          className="w-6 h-6 rounded-full object-cover"
        />
        <span className="text-sm font-semibold text-text-primary truncate">{player.name}</span>
      </div>
      {games.length === 0 ? (
        <p className="text-xs text-text-tertiary">No games found</p>
      ) : (
        <div>
          {/* Header */}
          <div
            className="grid items-center py-1.5 px-2 mb-1 gap-x-2"
            style={{ gridTemplateColumns: `3.5rem 1.25rem 1rem 1fr ${stats.map(() => "2.5rem").join(" ")}` }}
          >
            <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Date</span>
            <span />
            <span />
            <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Opp</span>
            {stats.map((s) => (
              <span key={s.key} className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider text-right">
                {s.label}
              </span>
            ))}
          </div>
          <div className="space-y-0.5">
            {games.map((g) => {
              const won = g.result === "W";
              return (
                <Link
                  key={g.gameid}
                  to={`/${league}/games/${g.gameid}?tab=analysis#${slugify(player.name)}`}
                  className="grid items-center py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition-colors duration-200 gap-x-2"
                  style={{ gridTemplateColumns: `3.5rem 1.25rem 1rem 1fr ${stats.map(() => "2.5rem").join(" ")}` }}
                >
                  <span className="text-xs text-text-tertiary">{formatDateShort(g.date)}</span>
                  <span className={`text-xs font-bold ${won ? "text-win" : "text-loss"}`}>
                    {g.result || "—"}
                  </span>
                  <img
                    src={g.opponentlogo || "/images/placeholder.png"}
                    alt={g.opponent}
                    className="w-4 h-4 object-contain"
                  />
                  <span className="text-xs text-text-secondary truncate">
                    {g.ishome ? "vs" : "@"} {g.opponent}
                  </span>
                  {stats.map((s) => (
                    <span key={s.key} className="text-xs tabular-nums text-text-primary text-right">
                      {g[s.key] ?? "—"}
                    </span>
                  ))}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HeadToHeadSection({ games, loading, entityA, entityB, type, league }) {
  if (loading) {
    return (
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-white/[0.04] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
        <p className="text-sm text-text-tertiary text-center">No head-to-head games found</p>
      </div>
    );
  }

  const aTeamId = entityA.teamId;
  const bTeamId = entityB.teamId;
  const aWins = games.filter((g) => g.winnerid === aTeamId).length;
  const bWins = games.filter((g) => g.winnerid === bTeamId).length;

  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      {/* Summary */}
      <div className="flex items-center justify-center gap-4 mb-5">
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{aWins}</p>
          <p className="text-xs text-text-tertiary">{type === "teams" ? entityA.name : `${entityA.name}`}</p>
        </div>
        <span className="text-text-tertiary text-sm">—</span>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{bWins}</p>
          <p className="text-xs text-text-tertiary">{type === "teams" ? entityB.name : `${entityB.name}`}</p>
        </div>
      </div>

      {/* Game list — two columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {games.map((g) => (
          <Link
            key={g.id}
            to={`/${league}/games/${g.id}`}
            className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors duration-200"
          >
            <span className="text-xs text-text-tertiary shrink-0 w-16">{formatDateShort(g.date)}</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img src={g.home_logo} alt={g.home_shortname} className="w-4 h-4 object-contain" />
              <span className={`text-sm font-semibold tabular-nums ${g.winnerid === g.hometeamid ? "text-win" : "text-text-secondary"}`}>
                {g.homescore}
              </span>
              <span className="text-text-tertiary text-xs">-</span>
              <span className={`text-sm font-semibold tabular-nums ${g.winnerid === g.awayteamid ? "text-win" : "text-text-secondary"}`}>
                {g.awayscore}
              </span>
              <img src={g.away_logo} alt={g.away_shortname} className="w-4 h-4 object-contain" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function mergeSeasons(a = [], b = []) {
  const set = new Set([...a, ...b]);
  return [...set].sort((x, y) => Number(y) - Number(x));
}
