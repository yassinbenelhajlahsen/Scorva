import { useState, useRef, useLayoutEffect, } from "react";
import { m, AnimatePresence } from "framer-motion";
import SeriesCard from "./SeriesCard.jsx";
import PlayInSection from "./PlayInSection.jsx";
import { usePlayoffs } from "../../hooks/data/usePlayoffs.js";
import { LEAGUE_LABELS } from "../../constants/leagueLabels.js";
import ErrorState from "../ui/ErrorState.jsx";
import PlayoffsSkeleton from "../skeletons/PlayoffsSkeleton.jsx";
import { EASE_OUT_EXPO } from "../../utils/motion.js";

const ROUND_STAGGER = 0.08;
const ROUND_DURATION = 0.4;

const confSlideVariants = {
  initial: (dir) => ({ x: dir * 30, opacity: 0 }),
  animate: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir) => ({ x: dir * -30, opacity: 0, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }),
};

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

function ConferenceColumn({ confLabel, rounds, league, mirrored = false, baseDelay = 0 }) {
  const labels = LEAGUE_LABELS[league] || LEAGUE_LABELS.nba;

  const columns = labels.bracketKeys.map((k) => ({
    key: k,
    title: labels.bracketTitles[k] ?? k,
    series: rounds[k] || [],
  }));
  const ordered = mirrored ? [...columns].reverse() : columns;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary text-center mb-8">
        {confLabel}
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

function MobileConferenceTabs({ conferences, activeConf, onPick }) {
  const tabRefs = useRef([]);
  const navRef = useRef(null);
  const [pillBounds, setPillBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = conferences.findIndex((c) => c.key === activeConf);
    const btn = tabRefs.current[idx];
    const nav = navRef.current;

    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();

      setPillBounds({
        left: btnRect.left - navRect.left,
        width: btnRect.width,
      });
    }
  }, [activeConf, conferences]);

  return (
    <div className="flex justify-center mb-6">
      <div
        ref={navRef}
        className="relative flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1"
      >
        {pillBounds && (
          <m.div
            className="absolute inset-y-1 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
            initial={{ left: pillBounds.left, width: pillBounds.width }}
            animate={{ left: pillBounds.left, width: pillBounds.width }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}

        {conferences.map((conf, i) => (
          <button
            key={conf.key}
            ref={(el) => (tabRefs.current[i] = el)}
            onClick={() => onPick(conf.key)}
            className="touch-target relative px-5 py-2 rounded-full text-sm font-medium z-10 transition-colors duration-200"
            style={{
              color:
                activeConf === conf.key
                  ? "var(--color-accent)"
                  : "var(--color-text-secondary)",
            }}
          >
            {conf.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileConferenceView({ block, labels, league, direction }) {
  const columns = labels.bracketKeys
    .map((k) => ({ key: k, title: labels.bracketTitles[k] ?? k, series: block[k] || [] }))
    .filter((col) => col.series.length > 0);

  return (
    <m.div
      custom={direction}
      variants={confSlideVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex flex-col gap-8"
    >
      {columns.map((col) => (
        <div key={col.key}>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
            {col.title}
          </div>
          <div className="flex flex-col gap-3">
            {col.series.map((s, i) => (
              <SeriesCard key={i} series={s} league={league} />
            ))}
          </div>
        </div>
      ))}
    </m.div>
  );
}

export default function PlayoffsBracket({ league, season }) {
  const { data, loading, error, retry } = usePlayoffs(league, season);
  const labels = LEAGUE_LABELS[league] || LEAGUE_LABELS.nba;
  const [confA, confB] = labels.conferences;
  const [activeMobileConf, setActiveMobileConf] = useState(confA.key);
  const [mobileTabDirection, setMobileTabDirection] = useState(1);

  function pickConf(key) {
    if (key === activeMobileConf) return;
    const confKeys = labels.conferences.map((c) => c.key);
    setMobileTabDirection(confKeys.indexOf(key) > confKeys.indexOf(activeMobileConf) ? 1 : -1);
    setActiveMobileConf(key);
  }

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
  const blockA = bracket?.[confA.key];
  const blockB = bracket?.[confB.key];
  const finals = bracket?.[labels.finalsKey] || [];

  if (!blockA || !blockB) {
    return (
      <div className="text-center text-text-tertiary py-20 text-sm">
        Bracket unavailable for this season.
      </div>
    );
  }

  const activeBlock = activeMobileConf === confA.key ? blockA : blockB;

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

      <div className="mb-10">
        <FinalsSection finals={finals} league={league} />
      </div>

      {/* Mobile: one conference at a time */}
      <div className="lg:hidden" data-testid="mobile-bracket">
        <MobileConferenceTabs
          conferences={labels.conferences}
          activeConf={activeMobileConf}
          onPick={pickConf}
        />
        <AnimatePresence mode="wait" custom={mobileTabDirection} initial={false}>
          <MobileConferenceView
            key={activeMobileConf}
            block={activeBlock}
            labels={labels}
            league={league}
            direction={mobileTabDirection}
          />
        </AnimatePresence>
      </div>

      {/* Desktop: two conferences side-by-side */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-10 lg:gap-6">
        <ConferenceColumn
          confLabel={confA.label}
          rounds={blockA}
          league={league}
          baseDelay={ROUND_STAGGER}
        />
        <ConferenceColumn
          confLabel={confB.label}
          rounds={blockB}
          league={league}
          mirrored
          baseDelay={ROUND_STAGGER * 4}
        />
      </div>
    </div>
  );
}
