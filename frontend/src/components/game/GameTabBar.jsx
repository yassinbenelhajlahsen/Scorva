import { m, LayoutGroup } from "framer-motion";

export default function GameTabBar({ tabs, activeTab, onTabChange, isPreGame, hasPlays }) {
  const visibleTabs = tabs.filter((tab) => {
    if (isPreGame && tab.id !== "overview") return false;
    if (tab.id === "plays" && !hasPlays) return false;
    return true;
  });

  return (
    <LayoutGroup>
      <div className="relative flex border-b border-white/[0.06] mb-6">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px ${
                isActive
                  ? "text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
              {isActive && (
                <m.div
                  layoutId="game-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                  transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
