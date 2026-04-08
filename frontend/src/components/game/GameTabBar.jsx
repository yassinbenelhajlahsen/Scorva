import { useRef, useLayoutEffect, useState } from "react";
import { m } from "framer-motion";

export default function GameTabBar({ tabs, activeTab, onTabChange, isPreGame, hasPlays }) {
  const visibleTabs = tabs.filter((tab) => {
    if (isPreGame && tab.id !== "overview") return false;
    if (tab.id === "plays" && !hasPlays) return false;
    return true;
  });

  const tabNavRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicatorBounds, setIndicatorBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = visibleTabs.findIndex((t) => t.id === activeTab);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setIndicatorBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeTab, visibleTabs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={tabNavRef} className="relative flex border-b border-white/[0.06] mb-6">
      {indicatorBounds && (
        <m.div
          className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
          animate={{ left: indicatorBounds.left, width: indicatorBounds.width }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
      {visibleTabs.map((tab, i) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[i] = el)}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px ${
              isActive
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
