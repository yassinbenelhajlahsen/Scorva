import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useLeagueData } from "../../hooks/data/useLeagueData.js";
import { LeagueSlateSkeleton } from "../skeletons/LeaguePageSkeleton.jsx";

function statusGroup(game) {
  const s = game.status || "";
  if (s.includes("Final")) return "final";
  if (
    s.includes("In Progress") ||
    s.includes("Halftime") ||
    s.includes("End of Period")
  ) {
    return "live";
  }
  return "scheduled";
}

// The sports "slate date" — today's ET date, unless it's before 6 AM ET,
// in which case yesterday's slate (last night's games) is more relevant.
// Without this, late-night viewers see an empty rail because yesterday's
// finals don't match today's date in ET and the default endpoint only
// spills yesterday over for live games.
function getSlateDateET() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = parseInt(get("hour"), 10);
  if (h >= 6) return `${y}-${m}-${d}`;
  const prev = new Date(`${y}-${m}-${d}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(prev.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Converts "7:30PM ET" → minutes since midnight for chronological sorting
function parseStartTime(s) {
  if (!s) return 9999;
  const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const pm = m[3].toUpperCase() === "PM";
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h * 60 + min;
}

// "7:30PM ET" → "7:30P"
function compactTime(s) {
  if (!s) return "TBD";
  return s.replace(/\s*ET\s*$/i, "").replace(/([AP])M/i, "$1");
}

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

function GamePill({ game }) {
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
    ? "Live"
    : isFinal
    ? "Final"
    : compactTime(game.start_time);

  const labelColor = isLive ? "text-live" : "text-text-tertiary";

  return (
    <Link
      to={`/${game.league}/games/${game.id}`}
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

export default function LeagueSlate({ league }) {
  const slateDate = useMemo(getSlateDateET, []);
  const { games, loading, error, resolvedDate } = useLeagueData(
    league,
    null,
    slateDate
  );

  // Backend redirects to the nearest date with games when the requested
  // date is empty (off-season). Hide the rail in that case — a stale game
  // behind a "today" header is worse than no rail.
  const offSeason = resolvedDate && resolvedDate !== slateDate;

  const sorted = useMemo(() => {
    const live = [];
    const final = [];
    const scheduled = [];
    for (const g of games) {
      const group = statusGroup(g);
      if (group === "live") live.push(g);
      else if (group === "final") final.push(g);
      else scheduled.push(g);
    }
    scheduled.sort(
      (a, b) => parseStartTime(a.start_time) - parseStartTime(b.start_time)
    );
    return [...live, ...final, ...scheduled];
  }, [games]);

  if (loading) return <LeagueSlateSkeleton />;
  if (error || offSeason || sorted.length === 0) return null;

  return (
    <div className="mb-5 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 pb-1">
        {sorted.map((g) => (
          <GamePill key={g.id} game={g} />
        ))}
      </div>
    </div>
  );
}
