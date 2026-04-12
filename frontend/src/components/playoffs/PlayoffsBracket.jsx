import { m } from "framer-motion";
import SeriesCard from "./SeriesCard.jsx";
import PlayInSection from "./PlayInSection.jsx";
import { useNbaPlayoffs } from "../../hooks/data/useNbaPlayoffs.js";
import ErrorState from "../ui/ErrorState.jsx";
import PlayoffsSkeleton from "../skeletons/PlayoffsSkeleton.jsx";
import { EASE_OUT_EXPO } from "../../utils/motion.js";

const ROUND_STAGGER = 0.08;
const ROUND_DURATION = 0.4;

function RoundColumn({ title, series, league, align = "left", delay = 0 }) {
  const alignClass = align === "right" ? "items-end" : "items-start";
  return (
    <div className={`flex flex-col ${alignClass} gap-4 min-w-0`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary w-full text-center">
        {title}
      </div>
      <m.div
        className="flex flex-col justify-around gap-4 flex-1 w-full mt-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ROUND_DURATION, ease: EASE_OUT_EXPO, delay }}
      >
        {series.map((s, i) => (
          <SeriesCard key={i} series={s} league={league} />
        ))}
      </m.div>
    </div>
  );
}

function ConferenceColumn({ conference, rounds, league, mirrored = false, baseDelay = 0 }) {
  const label = conference === "eastern" ? "Eastern" : "Western";
  const columns = [
    { key: "r1", title: "First Round", series: rounds.r1 },
    { key: "semis", title: "Conf. Semis", series: rounds.semis },
    { key: "cf", title: "Conf. Finals", series: rounds.confFinals },
  ];
  const ordered = mirrored ? [...columns].reverse() : columns;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary text-center mb-8">
        {label}
      </h3>
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">
        {ordered.map((col, i) => (
          <RoundColumn
            key={col.key}
            title={col.title}
            series={col.series}
            league={league}
            delay={baseDelay + i * ROUND_STAGGER}
          />
        ))}
      </div>
    </div>
  );
}

function FinalsSection({ finals, league }) {
  const series = finals?.[0];
  if (!series) return null;
  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-accent text-center">
        NBA Finals
      </h3>
      <m.div
        className="w-full max-w-[280px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: ROUND_DURATION, ease: EASE_OUT_EXPO }}
      >
        <SeriesCard series={series} league={league} />
      </m.div>
    </div>
  );
}

export default function PlayoffsBracket({ league, season }) {
  const { data, loading, error, retry } = useNbaPlayoffs(league, season);

  if (loading) return <PlayoffsSkeleton season={season} />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return null;

  const { bracket, playIn } = data;
  const eastern = bracket?.eastern;
  const western = bracket?.western;
  const finals = bracket?.finals || [];

  if (!eastern || !western) {
    return (
      <div className="text-center text-text-tertiary py-20 text-sm">
        Bracket unavailable for this season.
      </div>
    );
  }

  return (
    <div className="w-full">
      {playIn && (
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ROUND_DURATION, ease: EASE_OUT_EXPO }}
        >
          <PlayInSection playIn={playIn} league={league} />
        </m.div>
      )}

      {/* Finals at top, centered */}
      <div className="mb-10">
        <FinalsSection finals={finals} league={league} />
      </div>

      {/* Two conferences side-by-side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-6">
        <ConferenceColumn
          conference="eastern"
          rounds={eastern}
          league={league}
          baseDelay={ROUND_STAGGER}
        />
        <ConferenceColumn
          conference="western"
          rounds={western}
          league={league}
          mirrored
          baseDelay={ROUND_STAGGER * 4}
        />
      </div>
    </div>
  );
}
