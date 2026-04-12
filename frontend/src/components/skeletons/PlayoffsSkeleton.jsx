import { m } from "framer-motion";
import Skeleton from "../ui/Skeleton.jsx";
import { EASE_OUT_EXPO } from "../../utils/motion.js";

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

function ConferenceSkeleton({ label, mirrored = false }) {
  // R1 has games (no projected footer); semis + CF are projected on current season
  const columns = [
    <RoundColumnSkeleton key="r1" title="First Round" count={4} />,
    <RoundColumnSkeleton key="semis" title="Conf. Semis" count={2} projected />,
    <RoundColumnSkeleton key="cf" title="Conf. Finals" count={1} projected />,
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

function PlayInSkeleton() {
  return (
    <m.div className="mb-10" variants={skeletonItem}>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary mb-5 text-center">
        Play-In Tournament
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[720px] mx-auto">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
            Eastern
          </h4>
          <div className="flex flex-col gap-2">
            <SeriesSkeleton projected />
            <SeriesSkeleton projected />
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
            Western
          </h4>
          <div className="flex flex-col gap-2">
            <SeriesSkeleton projected />
            <SeriesSkeleton projected />
          </div>
        </div>
      </div>
    </m.div>
  );
}

export default function PlayoffsSkeleton({ season } = {}) {
  // Only the current season (null) can still be showing the play-in tournament.
  // Historical seasons always return playIn: null from the API, so rendering
  // a play-in skeleton for them is just a flash of content that vanishes.
  const showPlayIn = !season;
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
          NBA Finals
        </h3>
        <div className="w-full max-w-[280px]">
          <SeriesSkeleton projected />
        </div>
      </m.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-6">
        <ConferenceSkeleton label="Eastern" />
        <ConferenceSkeleton label="Western" mirrored />
      </div>
    </m.div>
  );
}
