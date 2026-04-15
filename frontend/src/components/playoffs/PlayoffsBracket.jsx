import { m } from "framer-motion";
import SeriesCard from "./SeriesCard.jsx";
import PlayInSection from "./PlayInSection.jsx";
import { usePlayoffs } from "../../hooks/data/usePlayoffs.js";
import { LEAGUE_LABELS } from "../../constants/leagueLabels.js";
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
  const labels = LEAGUE_LABELS[league] || LEAGUE_LABELS.nba;
  const columns = [
    { key: "r1", title: labels.round1, series: rounds.r1 },
    { key: "semis", title: labels.semis, series: rounds.semis },
    { key: "cf", title: labels.confFinal, series: rounds.confFinals },
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
  const finalsLabel = LEAGUE_LABELS[league]?.finals ?? "Finals";
  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-accent text-center">
        {finalsLabel}
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
  const { data, loading, error, retry } = usePlayoffs(league, season);

  if (loading) return <PlayoffsSkeleton season={season} league={league} />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return null;

  if (data.unsupported) {
    return (
      <div className="text-center text-text-tertiary py-20 text-sm">
        Bracket format unsupported for this season.
      </div>
    );
  }

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

  const labels = LEAGUE_LABELS[league] || LEAGUE_LABELS.nba;

  return (
    <div className="w-full">
      {labels.playInSupported && playIn && (
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
