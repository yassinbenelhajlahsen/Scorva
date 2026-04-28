import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { containerVariants, itemVariants, EASE_OUT_EXPO } from "../../utils/motion.js";
import { groupAwards } from "../../utils/awardTiers.js";

const COMMON_BUTTON =
  "transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function ariaLabel(award) {
  return `${award.label}, ${award.count} time${award.count === 1 ? "" : "s"}`;
}

function LegendaryChip({ award, active, onClick }) {
  return (
    <m.button
      type="button"
      variants={itemVariants}
      onClick={onClick}
      aria-expanded={active}
      aria-label={ariaLabel(award)}
      data-award-chip
      className={`relative flex flex-col items-start gap-2 px-5 py-5
        bg-gradient-to-br from-[rgba(212,175,55,0.07)] to-[rgba(212,175,55,0.01)]
        border rounded-2xl text-left
        ${active ? "border-[rgba(212,175,55,0.45)] shadow-[0_0_28px_rgba(212,175,55,0.18)]" : "border-[rgba(212,175,55,0.18)]"}
        hover:-translate-y-0.5 hover:border-[rgba(212,175,55,0.32)]
        hover:shadow-[0_0_28px_rgba(212,175,55,0.16)] ${COMMON_BUTTON}`}
    >
      <span aria-hidden="true" className="absolute top-3 right-3 text-[#d4af37] text-sm leading-none">★</span>
      <span className="text-5xl font-semibold tabular-nums leading-none text-[#d4af37]">
        {award.count}
      </span>
      <span className="text-[11px] uppercase tracking-[0.14em] text-text-secondary leading-tight">
        {award.label}
      </span>
    </m.button>
  );
}

function MajorChip({ award, active, onClick }) {
  return (
    <m.button
      type="button"
      variants={itemVariants}
      onClick={onClick}
      aria-expanded={active}
      aria-label={ariaLabel(award)}
      data-award-chip
      className={`flex flex-col items-start gap-1 px-4 py-3
        bg-surface-overlay border rounded-xl text-left
        ${active ? "border-accent/60 shadow-[0_0_18px_rgba(232,134,58,0.18)]" : "border-white/[0.08]"}
        hover:-translate-y-0.5 hover:border-white/[0.14] ${COMMON_BUTTON}`}
    >
      <span className="text-2xl font-semibold tabular-nums leading-none text-text-primary">
        {award.count}
      </span>
      <span className="text-[10px] uppercase tracking-[0.1em] text-text-tertiary leading-tight">
        {award.label}
      </span>
    </m.button>
  );
}

function SelectionPill({ award, active, onClick }) {
  return (
    <m.button
      type="button"
      variants={itemVariants}
      onClick={onClick}
      aria-expanded={active}
      aria-label={ariaLabel(award)}
      data-award-chip
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs whitespace-nowrap
        bg-white/[0.04] border
        ${active ? "border-accent/60 bg-white/[0.08]" : "border-white/[0.06]"}
        hover:bg-white/[0.08] hover:border-white/[0.12] ${COMMON_BUTTON}`}
    >
      <span className="text-text-secondary uppercase tracking-[0.06em]">{award.label}</span>
      <span className="text-text-primary font-semibold tabular-nums">{award.count}</span>
    </m.button>
  );
}

function DetailStrip({ award }) {
  return (
    <m.div
      key={award.type}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: "auto", marginTop: 24 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
      className="overflow-hidden"
    >
      <div className="bg-surface-overlay border border-white/[0.08] rounded-xl px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
            {award.label}
          </span>
        </div>
        <p className="text-sm tabular-nums text-text-primary leading-snug break-words">
          {award.seasons.join(", ")}
        </p>
      </div>
    </m.div>
  );
}

function Section({ title, awards, ChipComponent, gridClass, activeType, onToggle }) {
  if (awards.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-tertiary mb-3 font-medium">
        {title}
      </div>
      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={gridClass}
      >
        {awards.map((award) => (
          <ChipComponent
            key={award.type}
            award={award}
            active={activeType === award.type}
            onClick={() => onToggle(award.type)}
          />
        ))}
      </m.div>
    </div>
  );
}

export default function PlayerAwardsCard({ awards }) {
  const [activeType, setActiveType] = useState(null);
  const cardRef = useRef(null);

  const groups = useMemo(() => groupAwards(awards), [awards]);

  const handleToggle = useCallback((type) => {
    setActiveType((prev) => (prev === type ? null : type));
  }, []);

  const handleClose = useCallback(() => setActiveType(null), []);

  useEffect(() => {
    if (!activeType) return;
    function onPointer(e) {
      if (!cardRef.current?.contains(e.target)) handleClose();
    }
    function onKey(e) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [activeType, handleClose]);

  if (!awards || awards.length === 0) return null;

  const activeAward = activeType
    ? [...groups.legendary, ...groups.major, ...groups.selection].find((a) => a.type === activeType)
    : null;

  return (
    <div
      ref={cardRef}
      className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-12"
    >
      <div className="text-xs uppercase tracking-[0.14em] text-text-tertiary mb-6">
        Career Honors
      </div>
      <div className="flex flex-col gap-6">
        <Section
          title="Legendary"
          awards={groups.legendary}
          ChipComponent={LegendaryChip}
          gridClass="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
          activeType={activeType}
          onToggle={handleToggle}
        />
        <Section
          title="Major Honors"
          awards={groups.major}
          ChipComponent={MajorChip}
          gridClass="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"
          activeType={activeType}
          onToggle={handleToggle}
        />
        <Section
          title="Selections"
          awards={groups.selection}
          ChipComponent={SelectionPill}
          gridClass="flex flex-wrap gap-1.5"
          activeType={activeType}
          onToggle={handleToggle}
        />
      </div>
      <AnimatePresence initial={false}>
        {activeAward && <DetailStrip award={activeAward} />}
      </AnimatePresence>
    </div>
  );
}
