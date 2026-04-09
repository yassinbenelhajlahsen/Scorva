import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { usePlayer } from "../hooks/data/usePlayer.js";
import { useTeam } from "../hooks/data/useTeam.js";
import { useHeadToHead } from "../hooks/data/useHeadToHead.js";
import { useSearch } from "../hooks/data/useSearch.js";
import { formatDateShort } from "../utils/formatDate.js";
import slugify from "../utils/slugify.js";
import SeasonSelector from "../components/navigation/SeasonSelector.jsx";

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
  const location = useLocation();
  const navState = location.state;

  const [league, setLeague] = useState((navState?.league || "").toLowerCase() || null);
  const [type, setType] = useState(
    navState?.type === "players" || navState?.type === "teams" ? navState.type : null
  );
  const [slug1, setSlug1] = useState(navState?.id1 || null);
  const [slug2, setSlug2] = useState(navState?.id2 || null);
  const [selectedSeason1, setSelectedSeason1] = useState(null);
  const [selectedSeason2, setSelectedSeason2] = useState(null);

  const handleSelect = (side, item) => {
    const slug = slugify(item.name);
    const itemType = item.type === "player" ? "players" : "teams";
    if (!type) setType(itemType);
    if (!league) setLeague(item.league);
    if (side === 1) {
      setSlug1(slug);
      setSelectedSeason1(null);
    } else {
      setSlug2(slug);
      setSelectedSeason2(null);
    }
  };

  const handleClear = (side) => {
    if (side === 1) {
      setSlug1(null);
      setSelectedSeason1(null);
    } else {
      setSlug2(null);
      setSelectedSeason2(null);
    }
    if ((side === 1 && !slug2) || (side === 2 && !slug1)) {
      setType(null);
      setLeague(null);
    }
  };

  if (type === "players" || !type) {
    return (
      <PlayerCompare
        league={league}
        slug1={slug1}
        slug2={slug2}
        selectedSeason1={selectedSeason1}
        setSelectedSeason1={setSelectedSeason1}
        selectedSeason2={selectedSeason2}
        setSelectedSeason2={setSelectedSeason2}
        onSelect={handleSelect}
        onClear={handleClear}
      />
    );
  }

  return (
    <TeamCompare
      league={league}
      slug1={slug1}
      slug2={slug2}
      selectedSeason1={selectedSeason1}
      setSelectedSeason1={setSelectedSeason1}
      selectedSeason2={selectedSeason2}
      setSelectedSeason2={setSelectedSeason2}
      onSelect={handleSelect}
      onClear={handleClear}
    />
  );
}

function PlayerCompare({
  league, slug1, slug2,
  selectedSeason1, setSelectedSeason1,
  selectedSeason2, setSelectedSeason2,
  onSelect, onClear,
}) {
  const p1 = usePlayer(league, slug1, selectedSeason1);
  const p2 = usePlayer(league, slug2, selectedSeason2);

  const bothFilled = !!slug1 && !!slug2;
  const isSelf = bothFilled && slug1 === slug2;

  const seasonLoading = p1.seasonLoading || p2.seasonLoading;

  const h2h = useHeadToHead(
    league,
    "players",
    !isSelf && bothFilled ? p1.playerData?.id : undefined,
    !isSelf && bothFilled ? p2.playerData?.id : undefined
  );

  const a = p1.playerData;
  const b = p2.playerData;

  const avgConfig = playerAvgConfigs[league] || [];
  const gameStatConfig = playerGameStatConfigs[league] || [];

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-8">
      <Link
        to={league ? `/${league}` : "/"}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league ? league.toUpperCase() : "Home"}</span>
      </Link>

      <div className="space-y-8">
        {/* Hero */}
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-center gap-6 sm:gap-25">
            <div className="flex flex-col items-center gap-3 w-40 sm:w-52">
              {slug1 && a ? (
                <PlayerHero player={a} league={league} onClear={() => onClear(1)} />
              ) : (
                <EntitySearchCard
                  league={league}
                  entityType={league ? "player" : null}
                  onSelect={(item) => onSelect(1, item)}
                  label={league ? "Search for a player" : "Search players or teams"}
                />
              )}
              {slug1 && a && (
                <SeasonSelector
                  league={league}
                  selectedSeason={selectedSeason1}
                  onSeasonChange={setSelectedSeason1}
                  seasons={isSelf && selectedSeason2
                    ? (a.availableSeasons || []).filter((s) => s !== selectedSeason2)
                    : a.availableSeasons || []}
                />
              )}
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-text-tertiary">VS</span>
            <div className="flex flex-col items-center gap-3 w-40 sm:w-52">
              {slug2 && b ? (
                <PlayerHero player={b} league={league} onClear={() => onClear(2)} />
              ) : (
                <EntitySearchCard
                  league={league}
                  entityType={league ? "player" : null}
                  onSelect={(item) => onSelect(2, item)}
                  label={league ? "Search for a player" : "Search players or teams"}
                />
              )}
              {slug2 && b && (
                <SeasonSelector
                  league={league}
                  selectedSeason={selectedSeason2}
                  onSeasonChange={setSelectedSeason2}
                  seasons={isSelf && selectedSeason1
                    ? (b.availableSeasons || []).filter((s) => s !== selectedSeason1)
                    : b.availableSeasons || []}
                />
              )}
            </div>
          </div>

          {/* Bio + Season Averages */}
          {(a || b) && (
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6`}>
                <div className="flex flex-col">
                  <h3 className="text-md font-semibold text-text-tertiary uppercase tracking-wider mb-10 text-center">Bio</h3>
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    {isSelf ? (
                      [
                        { label: "Position", value: a?.position ?? "—" },
                        { label: "Height", value: a?.height ?? "—" },
                        { label: "Weight", value: a?.weight ?? "—" },
                        { label: "Jersey", value: a?.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
                        { label: "Draft", value: a?.draftInfo || "—" },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{row.label}</span>
                          <span className="text-sm text-text-primary">{row.value}</span>
                        </div>
                      ))
                    ) : (
                      [
                        { label: "Position", a: a?.position ?? "—", b: b?.position ?? "—" },
                        { label: "Height", a: a?.height ?? "—", b: b?.height ?? "—" },
                        { label: "Weight", a: a?.weight ?? "—", b: b?.weight ?? "—" },
                        { label: "Jersey", a: a?.jerseyNumber ? `#${a.jerseyNumber}` : "—", b: b?.jerseyNumber ? `#${b.jerseyNumber}` : "—" },
                        { label: "Draft", a: a?.draftInfo || "—", b: b?.draftInfo || "—" },
                      ].map((row) => (
                        <BioRow key={row.label} {...row} />
                      ))
                    )}
                  </div>
                </div>

                <div
                  className="flex flex-col"
                  style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}
                >
                  <h3 className="text-md font-semibold text-text-tertiary uppercase tracking-wider mb-10 text-center">Season Averages</h3>
                  <div className="flex-1 flex flex-col justify-between gap-4">
                    {avgConfig.map((stat) => (
                      <StatRow
                        key={stat.key}
                        label={stat.label}
                        valA={a ? Number(a.seasonAverages?.[stat.key]) || 0 : "—"}
                        valB={b ? Number(b.seasonAverages?.[stat.key]) || 0 : "—"}
                        lowerIsBetter={stat.lower}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Head-to-Head */}
        {bothFilled && !isSelf && a && b && (
          <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}>
            <SectionHeader title="Head-to-Head" />
            <HeadToHeadSection
              games={h2h.data}
              loading={h2h.isLoading}
              entityA={{ id: a.id, name: a.name, teamId: a.team?.id }}
              entityB={{ id: b.id, name: b.name, teamId: b.team?.id }}
              league={league}
            />
          </div>
        )}

        {/* Recent Games */}
        {(a || b) && (
          <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}>
            <SectionHeader title="Recent Games" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {a ? <RecentGamesColumn player={a} stats={gameStatConfig} league={league} /> : <div />}
              {b ? <RecentGamesColumn player={b} stats={gameStatConfig} league={league} /> : <div />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCompare({
  league, slug1, slug2,
  selectedSeason1, setSelectedSeason1,
  selectedSeason2, setSelectedSeason2,
  onSelect, onClear,
}) {
  const t1 = useTeam(league, slug1, selectedSeason1);
  const t2 = useTeam(league, slug2, selectedSeason2);

  const bothFilled = !!slug1 && !!slug2;
  const isSelf = bothFilled && slug1 === slug2;

  const seasonLoading = t1.seasonLoading || t2.seasonLoading;

  const h2h = useHeadToHead(
    league,
    "teams",
    !isSelf && bothFilled ? t1.team?.id : undefined,
    !isSelf && bothFilled ? t2.team?.id : undefined
  );

  const a = t1.team;
  const b = t2.team;

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

      <div className="space-y-8">
        {/* Hero */}
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <div className="flex flex-col items-center gap-3 w-40 sm:w-52">
              {slug1 && a ? (
                <TeamHero team={a} league={league} onClear={() => onClear(1)} />
              ) : (
                <EntitySearchCard
                  league={league}
                  entityType="team"
                  onSelect={(item) => onSelect(1, item)}
                  label="Search for a team"
                />
              )}
              {slug1 && a && (
                <SeasonSelector
                  league={league}
                  selectedSeason={selectedSeason1}
                  onSeasonChange={setSelectedSeason1}
                  seasons={isSelf && selectedSeason2
                    ? (t1.availableSeasons || []).filter((s) => s !== selectedSeason2)
                    : t1.availableSeasons || []}
                />
              )}
            </div>
            <span className="text-2xl sm:text-3xl font-bold text-text-tertiary">VS</span>
            <div className="flex flex-col items-center gap-3 w-40 sm:w-52">
              {slug2 && b ? (
                <TeamHero team={b} league={league} onClear={() => onClear(2)} />
              ) : (
                <EntitySearchCard
                  league={league}
                  entityType="team"
                  onSelect={(item) => onSelect(2, item)}
                  label="Search for a team"
                />
              )}
              {slug2 && b && (
                <SeasonSelector
                  league={league}
                  selectedSeason={selectedSeason2}
                  onSeasonChange={setSelectedSeason2}
                  seasons={isSelf && selectedSeason1
                    ? (t2.availableSeasons || []).filter((s) => s !== selectedSeason1)
                    : t2.availableSeasons || []}
                />
              )}
            </div>
          </div>

          {/* Record */}
          {(a || b) && (
            <div
              className="mt-8 pt-6 border-t border-white/[0.06]"
              style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}
            >
              <div className="space-y-4">
                <RecordRow label="Overall" a={a ? (t1.teamRecord ?? a.record) : "—"} b={b ? (t2.teamRecord ?? b.record) : "—"} />
                <RecordRow label="Home" a={a ? (t1.homeRecord ?? "—") : "—"} b={b ? (t2.homeRecord ?? "—") : "—"} />
                <RecordRow label="Away" a={a ? (t1.awayRecord ?? "—") : "—"} b={b ? (t2.awayRecord ?? "—") : "—"} />
              </div>
            </div>
          )}
        </div>

        {/* Head-to-Head */}
        {bothFilled && !isSelf && a && b && (
          <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: "opacity 200ms ease" }}>
            <SectionHeader title="Head-to-Head" />
            <HeadToHeadSection
              games={h2h.data}
              loading={h2h.isLoading}
              entityA={{ id: a.id, name: a.name, teamId: a.id }}
              entityB={{ id: b.id, name: b.name, teamId: b.id }}
              league={league}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Entity Search Card ─────────────────────────────────────

function EntitySearchCard({ league, entityType, onSelect, label }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useSearch(query);
  const inputRef = useRef(null);

  const filtered = results.filter((r) => {
    const typeMatch = entityType ? r.type === entityType : (r.type === "player" || r.type === "team");
    const leagueMatch = league ? r.league === league : true;
    return typeMatch && leagueMatch;
  });

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timeout);
  }, []);

  const isPlayer = entityType === "player" || !entityType;

  return (
    <div className="relative flex flex-col items-center gap-3">
      {/* Placeholder image */}
      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        {isPlayer ? (
          <svg className="w-10 h-10 sm:w-14 sm:h-14 text-text-tertiary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-10 h-10 sm:w-14 sm:h-14 text-text-tertiary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )}
      </div>

      {/* Search input */}
      <div className="relative w-40 sm:w-52">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={label}
          className="w-full bg-surface-overlay border border-white/[0.08] rounded-xl py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/50 transition-colors duration-200"
          autoComplete="off"
        />
        {loading && query.trim() && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-white/[0.08] border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {query.trim() && (
        <div className="absolute top-full mt-1 w-56 sm:w-64 bg-surface-elevated border border-white/[0.1] rounded-xl max-h-60 overflow-y-auto shadow-[0_12px_40px_rgba(0,0,0,0.6)] scrollbar-thin z-50 left-1/2 -translate-x-1/2">
          {loading && filtered.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <div className="inline-block w-4 h-4 border-2 border-text-tertiary/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : !loading && filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-text-tertiary">
              No {entityType || "result"}s found
            </p>
          ) : (
            filtered.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => {
                  onSelect(item);
                  setQuery("");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-overlay transition-colors duration-150 text-left"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className={`w-8 h-8 object-cover shrink-0 ${
                      item.type === "team" ? "rounded-lg object-contain" : "rounded-full"
                    }`}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                  {item.type === "player" && (item.position || item.team_name) && (
                    <p className="text-xs text-text-tertiary truncate">
                      {[item.position, item.team_name].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {item.type === "team" && item.shortname && (
                    <p className="text-xs text-text-tertiary">{item.shortname}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <h2 className="text-lg font-semibold text-text-primary mb-3">{title}</h2>
  );
}

function PlayerHero({ player, league, onClear }) {
  return (
    <div className="relative flex flex-col items-center gap-3">
      {onClear && (
        <button
          onClick={onClear}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface-overlay border border-white/[0.12] flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-white/[0.1] transition-colors duration-200 z-10"
          aria-label="Remove player"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
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

function TeamHero({ team, league, onClear }) {
  return (
    <div className="relative flex flex-col items-center gap-3">
      {onClear && (
        <button
          onClick={onClear}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface-overlay border border-white/[0.12] flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-white/[0.1] transition-colors duration-200 z-10"
          aria-label="Remove team"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
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

function HeadToHeadSection({ games, loading, entityA, entityB, league }) {
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
          <p className="text-xs text-text-tertiary">{entityA.name}</p>
        </div>
        <span className="text-text-tertiary text-sm">—</span>
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{bWins}</p>
          <p className="text-xs text-text-tertiary">{entityB.name}</p>
        </div>
      </div>

      {/* Game list */}
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
