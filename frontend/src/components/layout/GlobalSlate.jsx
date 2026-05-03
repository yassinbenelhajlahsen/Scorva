import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useGlobalSlate } from "../../hooks/data/useGlobalSlate.js";
import { GlobalSlateSkeleton } from "../skeletons/LeaguePageSkeleton.jsx";
import { compactTime, statusGroup } from "../../utils/slateDate.js";
import { queryKeys, queryFns } from "../../lib/query.js";

const HIDDEN_PATHS = new Set(["/about", "/privacy"]);

function TeamSide({ name, logo, score, showScore, isWinner, isLoser, isLive }) {
  const nameClass = isWinner
    ? "text-text-primary font-semibold"
    : isLoser
    ? "text-text-tertiary"
    : isLive
    ? "text-text-primary"
    : "text-text-secondary";

  const scoreClass = isWinner
    ? "text-text-primary font-semibold"
    : isLoser
    ? "text-text-tertiary"
    : "text-text-primary font-semibold";

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {logo ? (
        <img
          loading="lazy"
          src={logo}
          alt=""
          className="w-4 h-4 object-contain flex-shrink-0"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = "none";
          }}
        />
      ) : null}
      <span className={`text-[13px] whitespace-nowrap ${nameClass}`}>
        {name}
      </span>
      {showScore && (
        <span className={`text-[13px] tabular-nums ${scoreClass}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function GamePill({ game, queryClient }) {
  const group = statusGroup(game);
  const isLive = group === "live";
  const isFinal = group === "final";
  const showScore = isLive || isFinal;

  const homePh = game.home_shortname?.includes("/");
  const awayPh = game.away_shortname?.includes("/");
  const homeName = homePh ? "TBD" : game.home_shortname;
  const awayName = awayPh ? "TBD" : game.away_shortname;
  const homeLogo = homePh ? null : game.home_logo;
  const awayLogo = awayPh ? null : game.away_logo;

  const homeWon = isFinal && game.hometeamid === game.winnerid;
  const awayWon = isFinal && game.awayteamid === game.winnerid;

  const label = isLive
    ? "LIVE"
    : isFinal
    ? "FINAL"
    : compactTime(game.start_time);
  const labelColor = isLive ? "text-live" : "text-text-tertiary";

  return (
    <Link
      to={`/${game.league}/games/${game.id}`}
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover)").matches) {
          queryClient.prefetchQuery({
            queryKey: queryKeys.game(game.league, game.id),
            queryFn: queryFns.game(game.league, game.id),
            staleTime: 10_000,
          });
        }
      }}
      className="flex-1 min-w-fit inline-flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-xl px-3 py-2 transition-colors duration-150"
    >
      <div className="flex items-center gap-1.5 pr-3 border-r border-white/[0.08]">
        {isLive && (
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-live opacity-75 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-live" />
          </span>
        )}
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest tabular-nums ${labelColor}`}
        >
          {label}
        </span>
      </div>

      <TeamSide
        name={awayName}
        logo={awayLogo}
        score={game.awayscore}
        showScore={showScore}
        isWinner={awayWon}
        isLoser={homeWon}
        isLive={isLive}
      />
      <span className="text-text-tertiary text-xs">·</span>
      <TeamSide
        name={homeName}
        logo={homeLogo}
        score={game.homescore}
        showScore={showScore}
        isWinner={homeWon}
        isLoser={awayWon}
        isLive={isLive}
      />
    </Link>
  );
}

export default function GlobalSlate({ leagueFilter = null }) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { games, loading, error } = useGlobalSlate(leagueFilter);

  if (HIDDEN_PATHS.has(pathname)) return null;
  if (loading) return <GlobalSlateSkeleton />;
  if (error || games.length === 0) return null;

  const showLeagueTag = leagueFilter === null;

  // Multi-league mode: group pills under a single league label per group.
  // Order leagues [nba, nfl, nhl]; preserve the hook's sort within each group.
  const groups = showLeagueTag
    ? ["nba", "nfl", "nhl"]
        .map((lg) => ({ league: lg, items: games.filter((g) => g.league === lg) }))
        .filter((g) => g.items.length > 0)
    : null;

  return (
    <div className="sm:sticky sm:top-14 z-40 bg-[#0a0a0c] sm:bg-[rgba(10,10,12,0.88)] sm:backdrop-blur-2xl border-b border-white/[0.06] overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-5 pl-5 py-2">
        {groups
          ? groups.map(({ league, items }) => (
              <div
                key={league}
                style={{ flexGrow: items.length }}
                className="flex items-center gap-2 min-w-fit"
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                  {league.toUpperCase()}
                </span>
                {items.map((g) => (
                  <GamePill
                    key={`${league}-${g.id}`}
                    game={g}
                    queryClient={queryClient}
                  />
                ))}
              </div>
            ))
          : games.map((g) => (
              <GamePill
                key={`${g.league}-${g.id}`}
                game={g}
                queryClient={queryClient}
              />
            ))}
        {/* Right gutter — workaround for Chrome/Safari dropping padding-right
            at scroll-end on horizontally scrollable flex containers. */}
        <div aria-hidden className="w-1 h-6 flex-shrink-0" />
      </div>
    </div>
  );
}
