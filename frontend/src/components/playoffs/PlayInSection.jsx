import { m } from "framer-motion";
import SeriesCard from "./SeriesCard.jsx";
import { EASE_OUT_EXPO } from "../../utils/motion.js";

function OutcomeTag({ label, variant = "neutral" }) {
  const colors = {
    advance: "text-win",
    eliminated: "text-loss/60",
    neutral: "text-text-tertiary",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider tabular-nums ${colors[variant]}`}
    >
      {label}
    </span>
  );
}

function BracketConnector() {
  return (
    <div className="hidden md:flex flex-col items-stretch w-6 self-stretch">
      <div className="flex-[0.46] border-r border-b border-white/[0.12] rounded-br-lg" />
      <div className="flex-[0.46] border-r border-t border-white/[0.12] rounded-tr-lg" />
    </div>
  );
}

function ConferenceBracket({ heading, series, league, delay = 0 }) {
  const tier1 = series.filter((s) => s.playInTier === 1);
  const tier2 = series.filter((s) => s.playInTier === 2);

  // Sort tier 1: higher seeds first (7v8 before 9v10)
  tier1.sort((a, b) => {
    const minA = Math.min(a.teamA?.seed ?? 99, a.teamB?.seed ?? 99);
    const minB = Math.min(b.teamA?.seed ?? 99, b.teamB?.seed ?? 99);
    return minA - minB;
  });

  const game78 = tier1[0];
  const game910 = tier1[1];
  const gameDecisive = tier2[0];

  // Fallback: flat list if tiers are missing
  if (!game78 && !game910) {
    return (
      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
          {heading}
        </h4>
        <div className="flex flex-col gap-2">
          {series.map((s, i) => (
            <SeriesCard key={i} series={s} league={league} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay }}
    >
      <h4 className="text-[11px] font-semibold uppercase tracking-widest text-text-tertiary mb-4 text-center">
        {heading}
      </h4>

      {/* Desktop bracket layout */}
      <div className="hidden md:flex items-stretch gap-0">
        {/* Tier 1 column */}
        <div className="flex flex-col justify-between gap-6 w-[180px] shrink-0">
          {/* 7 vs 8 */}
          <div className="flex flex-col gap-1.5">
            {game78 && <SeriesCard series={game78} league={league} />}
            <div className="flex items-center justify-between px-1">
              <OutcomeTag label="W → 7 seed" variant="advance" />
            </div>
          </div>

          {/* 9 vs 10 */}
          <div className="flex flex-col gap-1.5">
            {game910 && <SeriesCard series={game910} league={league} />}
            <div className="flex items-center justify-between px-1">
              <OutcomeTag label="L → Out" variant="eliminated" />
            </div>
          </div>
        </div>

        {/* Bracket connector lines */}
        <BracketConnector />

        {/* Tier 2 column: decisive game — spacer ratios must match BracketConnector */}
        <div className="flex flex-col self-stretch w-[180px] shrink-0">
          <div className="flex-[0.54]" />
          <div className="flex items-center gap-2">
            <div className="h-px w-2 " />
            <div className="flex-1 flex flex-col gap-1.5">
              {gameDecisive ? (
                <SeriesCard series={gameDecisive} league={league} />
              ) : (
                <div className="bg-surface-elevated border border-white/[0.08] rounded-xl px-3 py-4 text-center">
                  <span className="text-[11px] text-text-tertiary">TBD</span>
                </div>
              )}
              <div className="text-center">
                <OutcomeTag label="W → 8 seed" variant="advance" />
              </div>
            </div>
          </div>
          <div className="flex-[0.46]" />
        </div>
      </div>

      {/* Mobile stacked layout */}
      <div className="flex md:hidden flex-col gap-3">
        {/* 7 vs 8 */}
        {game78 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                7 vs 8
              </span>
              <OutcomeTag label="W → 7 seed" variant="advance" />
            </div>
            <SeriesCard series={game78} league={league} />
          </div>
        )}

        {/* 9 vs 10 */}
        {game910 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                9 vs 10
              </span>
              <OutcomeTag label="L → Out" variant="eliminated" />
            </div>
            <SeriesCard series={game910} league={league} />
          </div>
        )}

        {/* Connector */}
        <div className="flex items-center gap-2 px-4">
          <div className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            7/8 Loser vs 9/10 Winner
          </span>
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        {/* Decisive game */}
        {gameDecisive ? (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                Decisive
              </span>
              <OutcomeTag label="W → 8 seed" variant="advance" />
            </div>
            <SeriesCard series={gameDecisive} league={league} />
          </div>
        ) : (
          <div className="bg-surface-elevated border border-white/[0.08] rounded-xl px-3 py-3 text-center">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Decisive — TBD
            </span>
          </div>
        )}
      </div>
    </m.div>
  );
}

export default function PlayInSection({ playIn, league }) {
  if (!playIn) return null;
  const east = playIn.eastern || [];
  const west = playIn.western || [];
  if (east.length === 0 && west.length === 0) return null;

  return (
    <div className="mb-12">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary mb-6 text-center">
        Play-In Tournament
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 max-w-[900px] mx-auto">
        <ConferenceBracket heading="Eastern" series={east} league={league} delay={0} />
        <ConferenceBracket heading="Western" series={west} league={league} delay={0.1} />
      </div>
    </div>
  );
}
