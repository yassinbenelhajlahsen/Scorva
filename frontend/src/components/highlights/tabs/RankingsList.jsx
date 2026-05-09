import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";

export default function RankingsList({ league = "nba", window: win, sort, position }) {
  const { data, isLoading } = useTopPerformances(league, { type: "rankings", window: win, sort, position, limit: 25 });
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        {win === "today" ? "No final games today yet." : "No rankings for this window."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const slug = it.player.slug ?? it.player.id;
        const to = `/${league}/players/${slug}`;
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta: `${it.gamesPlayed} GP · avg ${it.avgPerGame.toFixed(1)}`,
          value: it.totalRating.toFixed(1),
          onMouseEnter: () => {
            if (window.matchMedia?.("(hover: hover)").matches) {
              qc.prefetchQuery({
                queryKey: queryKeys.player(league, slug),
                queryFn: queryFns.player(league, slug),
                staleTime: 10_000,
              });
            }
          },
        };
        return (
          <li key={`${it.player.id}`}>
            {rank <= 3
              ? <HeroRow rank={rank} color={it.player.team?.primary_color} {...props} />
              : <CompactRow rank={rank} {...props} />}
          </li>
        );
      })}
    </ul>
  );
}
