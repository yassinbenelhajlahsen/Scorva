import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import slugify from "../../../utils/slugify.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import PlayerHeroRow from "../rows/PlayerHeroRow.jsx";
import PlayerCompactRow from "../rows/PlayerCompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";

const SHOW_DATE_FOR = new Set(["today", "week"]);

export default function PerformancesList({ league = "nba", window: win, sort, position, playerId, limit = 25 }) {
  const { data, isLoading } = useTopPerformances(league, { type: "performances", window: win, sort, position, playerId, limit });
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        {win === "today" ? "No final games today yet." : "No performances for this window."}
      </p>
    );
  }

  const showDate = SHOW_DATE_FOR.has(win);
  const isPlayerView = !!playerId;

  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const to = `/${league}/games/${it.game.id}?tab=analysis#${slugify(it.player.name)}`;
        const onMouseEnter = () => {
          if (window.matchMedia?.("(hover: hover)").matches) {
            qc.prefetchQuery({
              queryKey: queryKeys.game(league, it.game.id),
              queryFn: queryFns.game(league, it.game.id),
              staleTime: 10_000,
            });
          }
        };
        const value = it.ratingGrade.toFixed(1);

        if (isPlayerView) {
          const dateStr = it.game.date ? formatDate(it.game.date) : "";
          const statLine = `${it.stats.points}/${it.stats.rebounds}/${it.stats.assists}`;
          const meta = [statLine, dateStr].filter(Boolean).join(" · ");
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
            <li key={`${it.player.id}:${it.game.id}`}>
              {rank <= 3
                ? <PlayerHeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
                : <PlayerCompactRow rank={rank} {...props} />}
            </li>
          );
        }

        const datePart = showDate && it.game.date ? ` · ${formatDate(it.game.date)}` : "";
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta: `${it.stats.points}/${it.stats.rebounds}/${it.stats.assists} · ${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}${datePart}`,
          value,
          onMouseEnter,
        };
        return (
          <li key={`${it.player.id}:${it.game.id}`}>
            {rank <= 3
              ? <HeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
              : <CompactRow rank={rank} {...props} />}
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
