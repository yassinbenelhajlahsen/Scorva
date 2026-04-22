import { m } from "framer-motion";
import Skeleton from "../ui/Skeleton.jsx";
import { EASE_OUT_EXPO } from "../../utils/motion.js";
import { LEAGUE_LABELS } from "../../constants/leagueLabels.js";

// Slower + delayed so the stagger plays AFTER the LeaguePage tab
// transition (x: 40→0 over 220ms) lands, not during it.
const skeletonContainer = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.18, staggerChildren: 0.08 },
  },
};

const skeletonItem = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE_OUT_EXPO },
  },
};

function TeamRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-3 py-2 gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Skeleton className="h-2.5 w-3 rounded" />
        <Skeleton className="h-5 w-5 rounded-full" />
        <div className="flex flex-col gap-1 min-w-0">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-2 w-10 rounded" />
        </div>
      </div>
      <Skeleton className="h-4 w-3 rounded" />
    </div>
  );
}

function SeriesSkeleton({ projected = false }) {
  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <TeamRowSkeleton />
      <div className="h-px bg-white/[0.05]" />
      <TeamRowSkeleton />
      {projected && (
        <div className="text-[10px] text-center py-1 border-t border-white/[0.05]">
          <Skeleton className="inline-block h-2 w-14 rounded align-middle" />
        </div>
      )}
    </div>
  );
}

function RoundColumnSkeleton({ title, count = 4, projected = false }) {
  return (
    <m.div className="flex flex-col gap-4 min-w-0" variants={skeletonItem}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary w-full text-center">
        {title}
      </div>
      <div className="flex flex-col justify-around gap-4 flex-1 w-full mt-3">
        {Array.from({ length: count }).map((_, i) => (
          <SeriesSkeleton key={i} projected={projected} />
        ))}
      </div>
    </m.div>
  );
}

function ConferenceSkeleton({ label, labels, mirrored = false }) {
  const round1Count = labels.round1SeriesCount ?? 4;
  // R1 has games (no projected footer); semis + CF are projected on current season
  const columns = [
    <RoundColumnSkeleton key="r1" title={labels.round1} count={round1Count} />,
    <RoundColumnSkeleton key="semis" title={labels.semis} count={2} projected />,
    <RoundColumnSkeleton key="cf" title={labels.confFinal} count={1} projected />,
  ];
  const ordered = mirrored ? [...columns].reverse() : columns;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary text-center mb-8">
        {label}
      </h3>
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">{ordered}</div>
    </div>
  );
}

function OutcomeTagSkeleton() {
  return <Skeleton className="h-2 w-14 rounded" />;
}

function BracketConnectorSkeleton() {
  return (
    <div className="hidden md:flex flex-col items-stretch w-6 self-stretch">
      <div className="flex-1 border-r border-b border-white/[0.12] rounded-br-lg" />
      <div className="flex-1 border-r border-t border-white/[0.12] rounded-tr-lg" />
    </div>
  );
}

function ConferenceBracketSkeleton() {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary mb-4 text-center">
        <Skeleton className="inline-block h-2.5 w-14 rounded align-middle" />
      </h4>

      {/* Desktop bracket layout */}
      <div className="hidden md:flex items-stretch gap-0">
        {/* Tier 1 column */}
        <div className="flex flex-col justify-between gap-6 w-[180px] shrink-0">
          <div className="flex flex-col gap-1.5">
            <SeriesSkeleton />
            <div className="flex items-center px-1">
              <OutcomeTagSkeleton />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <SeriesSkeleton />
            <div className="flex items-center px-1">
              <OutcomeTagSkeleton />
            </div>
          </div>
        </div>

        <BracketConnectorSkeleton />

        {/* Tier 2 column */}
        <div className="flex flex-col justify-center w-[180px] shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-px w-2 bg-white/[0.12]" />
            <div className="flex-1 flex flex-col gap-1.5">
              <SeriesSkeleton />
              <div className="text-center">
                <OutcomeTagSkeleton />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile stacked layout */}
      <div className="flex md:hidden flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <Skeleton className="h-2 w-8 rounded" />
            <OutcomeTagSkeleton />
          </div>
          <SeriesSkeleton />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <Skeleton className="h-2 w-10 rounded" />
            <OutcomeTagSkeleton />
          </div>
          <SeriesSkeleton />
        </div>
        <div className="flex items-center gap-2 px-4">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <Skeleton className="h-2 w-28 rounded" />
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <Skeleton className="h-2 w-12 rounded" />
            <OutcomeTagSkeleton />
          </div>
          <SeriesSkeleton />
        </div>
      </div>
    </div>
  );
}

function PlayInSkeleton() {
  return (
    <m.div className="mb-12" variants={skeletonItem}>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary mb-6 text-center">
        Play-In Tournament
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 max-w-[900px] mx-auto">
        <ConferenceBracketSkeleton />
        <ConferenceBracketSkeleton />
      </div>
    </m.div>
  );
}

export default function PlayoffsSkeleton({ league, season } = {}) {
  const labels = LEAGUE_LABELS[league] || LEAGUE_LABELS.nba;
  // Only show play-in skeleton if the league supports it and it's the current season.
  // Historical seasons always return playIn: null so the skeleton would just flash.
  const showPlayIn = !season && labels.playInSupported;
  return (
    <m.div
      className="w-full"
      variants={skeletonContainer}
      initial="hidden"
      animate="visible"
    >
      {showPlayIn && <PlayInSkeleton />}

      {/* Finals */}
      <m.div
        className="flex flex-col items-center gap-3 mb-10"
        variants={skeletonItem}
      >
        <h3 className="text-sm font-semibold uppercase tracking-widest text-accent text-center">
          {labels.finals}
        </h3>
        <div className="w-full max-w-[280px]">
          <SeriesSkeleton projected />
        </div>
      </m.div>
      {/* Mobile: tab strip + single conference rounds */}
      <div className="lg:hidden">
        <div className="flex justify-center mb-6">
          <div className="flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1">
            <span className="px-5 py-2 rounded-full text-sm font-medium bg-accent/15 border border-accent/25 text-accent">
              {labels.conferences?.[0]?.label ?? "Eastern"}
            </span>
            <span className="px-5 py-2 rounded-full text-sm font-medium text-text-secondary">
              {labels.conferences?.[1]?.label ?? "Western"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
              {labels.round1}
            </div>
            <div className="flex flex-col gap-3">
              {Array.from({ length: labels.round1SeriesCount ?? 4 }).map((_, i) => (
                <SeriesSkeleton key={i} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
              {labels.semis}
            </div>
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <SeriesSkeleton key={i} projected />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
              {labels.confFinal}
            </div>
            <div className="flex flex-col gap-3">
              <SeriesSkeleton projected />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: two conferences side-by-side */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-10 lg:gap-6">
        <ConferenceSkeleton label={labels.conferences?.[0]?.label ?? "Eastern"} labels={labels} />
        <ConferenceSkeleton label={labels.conferences?.[1]?.label ?? "Western"} labels={labels} mirrored />
      </div>
    </m.div>
  );
}
