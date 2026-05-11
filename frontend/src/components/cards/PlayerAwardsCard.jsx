import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { containerVariants, itemVariants, EASE_OUT_EXPO } from "../../utils/motion.js";
import { groupAwards } from "../../utils/awardTiers.js";

const TIER_STYLES = {
  legendary: {
    name: "text-sm font-semibold text-text-primary",
    count: "text-[22px] font-semibold text-accent leading-none tabular-nums tracking-[-0.02em]",
  },
  major: {
    name: "text-[13px] font-medium text-text-primary",
    count: "text-base font-medium text-text-primary leading-none tabular-nums",
  },
  selection: {
    name: "text-xs text-text-secondary",
    count: "text-[13px] font-medium text-text-secondary leading-none tabular-nums",
  },
};

const ROW_BASE =
  "flex items-baseline justify-between gap-4 py-2.5 border-b border-white/[0.06] last:border-b-0";
const ROW_INTERACTIVE =
  "w-full text-left appearance-none bg-transparent cursor-pointer hover:bg-white/[0.02] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded";

function yearsColumnText(award) {
  if (!award.seasons?.length) return null;
  if (award.count <= 4) return award.seasons.join(", ");
  const earliest = award.seasons[award.seasons.length - 1];
  const latest = award.seasons[0];
  return earliest === latest ? latest : `${earliest} – ${latest}`;
}

function AwardRow({ award, tier, expandable, expanded, onToggle }) {
  const styles = TIER_STYLES[tier];
  const yearsText = yearsColumnText(award);

  const Tag = expandable ? m.button : m.div;
  const interactiveProps = expandable
    ? {
        type: "button",
        onClick: onToggle,
        "aria-expanded": expanded,
        "aria-label": `${award.label}, ${award.count} time${award.count === 1 ? "" : "s"}`,
      }
    : {};

  return (
    <Tag
      variants={itemVariants}
      data-testid="award-row"
      data-award-type={award.type}
      className={expandable ? `${ROW_BASE} ${ROW_INTERACTIVE}` : ROW_BASE}
      {...interactiveProps}
    >
      <span className={styles.name}>{award.label}</span>
      <span className={`flex-1 min-w-0 text-[11px] tabular-nums text-right truncate ${expandable && expanded ? "text-text-secondary" : "text-text-tertiary"}`}>
        {yearsText}
      </span>
      <span className={`${styles.count} min-w-[2rem] text-right shrink-0`}>{award.count}</span>
    </Tag>
  );
}

function DetailStrip({ award }) {
  return (
    <m.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
      className="overflow-hidden"
    >
      <p className="text-xs text-text-secondary leading-relaxed py-2 pl-1 pr-1 break-words tabular-nums">
        {award.seasons.join(", ")}
      </p>
    </m.div>
  );
}

function AwardSection({ title, awards, tier, accentRail, activeType, onToggle }) {
  if (!awards?.length) return null;
  return (
    <div className={`relative ${accentRail ? "pl-4" : ""}`}>
      {accentRail && <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-accent rounded-full" />}
      <div className={`text-[10px] uppercase tracking-[0.18em] mb-3 font-semibold ${accentRail ? "text-accent" : "text-text-tertiary"}`}>
        {title}
      </div>
      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col"
      >
        {awards.map((award) => {
          const expandable = award.count > 4;
          const expanded = activeType === award.type;
          return (
            <div key={award.type}>
              <AwardRow
                award={award}
                tier={tier}
                expandable={expandable}
                expanded={expanded}
                onToggle={() => onToggle(award.type)}
              />
              <AnimatePresence initial={false}>
                {expanded && expandable && <DetailStrip award={award} />}
              </AnimatePresence>
            </div>
          );
        })}
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

  return (
    <div ref={cardRef} className="w-full max-w-2xl">
      <div className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary mb-6 pl-3 font-semibold">
        Career Honors
      </div>
      <div className="flex flex-col gap-7">
        <AwardSection
          title="Legendary"
          awards={groups.legendary}
          tier="legendary"
          accentRail
          activeType={activeType}
          onToggle={handleToggle}
        />
        <AwardSection
          title="Major Honors"
          awards={groups.major}
          tier="major"
          activeType={activeType}
          onToggle={handleToggle}
        />
        <AwardSection
          title="Selections"
          awards={groups.selection}
          tier="selection"
          activeType={activeType}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
}
