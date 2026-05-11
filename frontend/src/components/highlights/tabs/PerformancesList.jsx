import { useQueryClient } from "@tanstack/react-query";
import { useTopPerformances } from "../../../hooks/data/useTopPerformances.js";
import { queryKeys, queryFns } from "../../../lib/query.js";
import slugify from "../../../utils/slugify.js";
import HeroRow from "../rows/HeroRow.jsx";
import CompactRow from "../rows/CompactRow.jsx";
import PlayerHeroRow from "../rows/PlayerHeroRow.jsx";
import PlayerCompactRow from "../rows/PlayerCompactRow.jsx";
import TeamHeroRow from "../rows/TeamHeroRow.jsx";
import TeamCompactRow from "../rows/TeamCompactRow.jsx";
import GameHeroRow from "../rows/GameHeroRow.jsx";
import GameCompactRow from "../rows/GameCompactRow.jsx";
import TopPerformersSkeleton from "../../skeletons/TopPerformersSkeleton.jsx";
import { useWindowSync } from "../useWindowSync.js";

const SHOW_DATE_FOR = new Set(["today", "week"]);

export default function PerformancesList({ league = "nba", window: win, sort, position, playerId, teamId, entity = "player", limit = 25, fallback = false }) {
  const { data, isLoading } = useTopPerformances(league, {
    type: "performances",
    entity,
    window: win, sort,
    position: entity === "player" ? position : "all",
    playerId: entity === "player" ? playerId : undefined,
    teamId: entity === "team" ? teamId : undefined,
    limit, fallback,
  });
  useWindowSync(fallback ? data?.actualWindow : null, win);
  const qc = useQueryClient();

  if (isLoading) return <TopPerformersSkeleton />;
  const items = data?.performances ?? [];
  if (!items.length) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        {win === "today" ? "No games today yet." : "No performances for this window."}
      </p>
    );
  }

  if (entity === "team") {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => {
          const rank = i + 1;
          const to = `/${league}/games/${it.game.id}`;
          const meta = formatTeamMeta(it, win);
          const props = {
            to,
            logo: it.team.logo,
            name: it.team.name,
            abbr: it.team.abbr,
            meta,
            value: it.ratingGrade.toFixed(1),
            onMouseEnter: () => prefetchGame(qc, league, it.game.id),
            color: it.team.primary_color,
            isLive: it.game.isLive,
          };
          return (
            <li key={`${it.team.id}:${it.game.id}`}>
              {rank <= 3 ? <TeamHeroRow rank={rank} {...props} /> : <TeamCompactRow rank={rank} {...props} />}
            </li>
          );
        })}
      </ul>
    );
  }

  if (entity === "game") {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => {
          const rank = i + 1;
          const to = `/${league}/games/${it.game.id}`;
          const score = `${it.game.homeScore ?? 0}-${it.game.awayScore ?? 0}`;
          const props = {
            to,
            homeTeam: it.game.homeTeam,
            awayTeam: it.game.awayTeam,
            score,
            tierLabel: it.tierLabel,
            value: it.ratingGrade.toFixed(1),
            onMouseEnter: () => prefetchGame(qc, league, it.game.id),
            isLive: it.game.isLive,
          };
          return (
            <li key={`${it.game.id}`}>
              {rank <= 3 ? <GameHeroRow rank={rank} {...props} /> : <GameCompactRow rank={rank} {...props} />}
            </li>
          );
        })}
      </ul>
    );
  }

  // Player (existing behaviour)
  const showDate = SHOW_DATE_FOR.has(win);
  const isPlayerView = !!playerId;

  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const rank = i + 1;
        const to = `/${league}/games/${it.game.id}?tab=analysis#${slugify(it.player.name)}`;
        const onMouseEnter = () => prefetchGame(qc, league, it.game.id);
        const value = it.ratingGrade.toFixed(1);
        const isLive = !!it.game.isLive;
        const statLine = `${it.stats.points}/${it.stats.rebounds}/${it.stats.assists}`;
        const scoreStr = isLive
          ? `${it.game.homeScore ?? 0}-${it.game.awayScore ?? 0}`
          : "";

        if (isPlayerView) {
          const dateStr = it.game.date ? formatDate(it.game.date) : "";
          const meta = isLive
            ? [scoreStr, statLine].filter(Boolean).join(" · ")
            : [statLine, dateStr].filter(Boolean).join(" · ");
          const props = {
            to,
            opponent: it.game.opponent,
            isHome: it.game.isHome,
            result: it.game.result,
            meta,
            value,
            onMouseEnter,
            isLive,
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
        const opp = `${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}`;
        const meta = isLive
          ? `${scoreStr} ${opp} · ${statLine}`
          : `${statLine} · ${opp}${datePart}`;
        const props = {
          to,
          imageUrl: it.player.imageUrl,
          name: it.player.name,
          meta,
          value,
          onMouseEnter,
          isLive,
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

function formatTeamMeta(it, win) {
  const opp = `${it.game.isHome ? "vs" : "@"} ${it.game.opponent.abbreviation}`;
  const result = it.game.result ? ` ${it.game.result}` : "";
  const score = it.game.isLive
    ? `${it.game.homeScore ?? 0}-${it.game.awayScore ?? 0}`
    : (it.game.homeScore != null && it.game.awayScore != null ? `${it.game.homeScore}-${it.game.awayScore}` : "");
  const dateStr = it.game.date && SHOW_DATE_FOR.has(win) ? ` · ${formatDate(it.game.date)}` : "";
  return `${opp}${result}${score ? " · " + score : ""}${dateStr}`;
}

function prefetchGame(qc, league, gameId) {
  if (window.matchMedia?.("(hover: hover)").matches) {
    qc.prefetchQuery({
      queryKey: queryKeys.game(league, gameId),
      queryFn: queryFns.game(league, gameId),
      staleTime: 10_000,
    });
  }
}

function formatDate(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
