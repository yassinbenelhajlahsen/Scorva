import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import PlayerHeroRow from "../rows/PlayerHeroRow.jsx";
import PlayerCompactRow from "../rows/PlayerCompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";

const SHOW_DATE_FOR = new Set(["today", "week"]);

export default function PlaysList({ league = "nba", window: win, sort, position, playerId, limit = 25 }) {
  const { data, isLoading } = useTopPerformances(league, { type: "plays", window: win, sort, position, playerId, limit });
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        {win === "today" ? "No plays from today yet." : "No plays for this window."}
      </p>
    );
  }

  const showDate = SHOW_DATE_FOR.has(win);
  const isPlayerView = !!playerId;

  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const to = `/${league}/games/${it.game.id}?tab=plays#play-${it.play.id}`;
        const time = formatGameClock(it.play.period, it.play.clock);
        const action = simplifyDesc(it.play.description, it.player.name);
        const value = it.play.weightedValue.toFixed(1);
        const onMouseEnter = () => {
          if (window.matchMedia?.("(hover: hover)").matches) {
            qc.prefetchQuery({
              queryKey: queryKeys.game(league, it.game.id),
              queryFn: queryFns.game(league, it.game.id),
              staleTime: 10_000,
            });
          }
        };

        if (isPlayerView) {
          const dateStr = it.game.date ? formatDate(it.game.date) : "";
          const meta = [time, action, dateStr].filter(Boolean).join(" · ");
          const props = {
            to,
            opponent: it.game.opponent,
            isHome: it.game.isHome,
            result: it.game.result,
            meta,
            value,
            onMouseEnter,
          };
          return (
            <li key={`play-${it.play.id}`}>
              {rank <= 3
                ? <PlayerHeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
                : <PlayerCompactRow rank={rank} {...props} />}
            </li>
          );
        }

        const datePart = showDate && it.game.date ? ` · ${formatDate(it.game.date)}` : "";
        const opp = `${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}`;
        const meta = [time, action, opp].filter(Boolean).join(" · ") + datePart;
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta,
          value,
          onMouseEnter,
        };
        return (
          <li key={`play-${it.play.id}`}>
            {rank <= 3
              ? <HeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
              : <CompactRow rank={rank} {...props} />}
          </li>
        );
      })}
    </ul>
  );
}

function simplifyDesc(desc, playerName) {
  if (!desc) return "";
  let s = desc.trim();
  if (playerName) {
    const lower = s.toLowerCase();
    const pn = playerName.toLowerCase();
    if (lower.startsWith(pn + " ")) s = s.slice(playerName.length + 1);
  }
  s = s.replace(/\s*\([^)]*\bassists?\)\s*/gi, "");
  s = s.replace(/\s*\.\s*Assisted by [^.]+\.?$/i, "");
  s = s.replace(/(\d+)-foot\s+/g, "$1ft ");
  s = s.replace(/\bthree point jumper\b/gi, "3PT");
  s = s.replace(/\bthree point(?:er)?\b/gi, "3PT");
  s = s.replace(/\btwo point jumper\b/gi, "2PT");
  s = s.replace(/\bjump shot\b/gi, "jumper");
  s = s.replace(/\bfree throw (\d+) of (\d+)\b/gi, "FT $1/$2");
  s = s.replace(/\.\s*$/, "").trim();
  return s.length > 36 ? s.slice(0, 35) + "…" : s;
}

function formatGameClock(period, clock) {
  if (!period) return "";
  const label = period <= 4 ? `Q${period}` : (period === 5 ? "OT" : `${period - 4}OT`);
  return clock ? `${label} ${clock}` : label;
}

function formatDate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
