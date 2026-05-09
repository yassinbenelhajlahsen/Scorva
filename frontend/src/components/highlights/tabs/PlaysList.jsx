import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";

const SHOW_DATE_FOR = new Set(["today", "week"]);

export default function PlaysList({ league = "nba", window: win, sort, position }) {
  const { data, isLoading } = useTopPerformances(league, { type: "plays", window: win, sort, position, limit: 25 });
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
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const to = `/${league}/games/${it.game.id}?tab=plays#play-${it.play.id}`;
        const datePart = showDate && it.game.date ? ` · ${formatDate(it.game.date)}` : "";
        const opp = `${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}`;
        const desc = truncate(it.play.description, 64);
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta: `${desc} · ${opp}${datePart}`,
          value: it.play.weightedValue.toFixed(1),
          onMouseEnter: () => {
            if (window.matchMedia?.("(hover: hover)").matches) {
              qc.prefetchQuery({
                queryKey: queryKeys.game(league, it.game.id),
                queryFn: queryFns.game(league, it.game.id),
                staleTime: 10_000,
              });
            }
          },
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

function truncate(s, n) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function formatDate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
