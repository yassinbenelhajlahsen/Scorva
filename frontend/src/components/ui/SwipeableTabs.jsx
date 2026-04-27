import { AnimatePresence, m } from "framer-motion";
import { useRef } from "react";
import { useSwipeableTabs } from "../../hooks/useSwipeableTabs.js";

const variants = {
  enter: (dir) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

/**
 * tabs: [{ id: string, content: ReactNode }]
 * activeId: string — id of the currently active tab
 * onChange: (newActiveId: string) => void
 */
export function SwipeableTabs({ tabs, activeId, onChange, className = "" }) {
  const directionRef = useRef(0);
  const tabRef = useRef(null);
  const currentIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeId),
  );

  // Compute direction synchronously during render — useEffect runs AFTER the
  // render, but AnimatePresence reads `custom` during render to pick variants.
  // Using useEffect here means the animation always uses stale direction.
  const prevIndexRef = useRef(currentIndex);
  if (prevIndexRef.current !== currentIndex) {
    directionRef.current = currentIndex > prevIndexRef.current ? 1 : -1;
    prevIndexRef.current = currentIndex;
  }

  const handleChange = (newIndex) => {
    onChange(tabs[newIndex].id);
  };

  const dragProps = useSwipeableTabs({
    containerRef: tabRef,
    currentIndex,
    totalTabs: tabs.length,
    onChange: handleChange,
  });

  const activeTab = tabs[currentIndex];

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ touchAction: "pan-y" }}
    >
      <AnimatePresence
        custom={directionRef.current}
        initial={false}
        mode="popLayout"
      >
        <m.div
          key={activeTab.id}
          ref={tabRef}
          custom={directionRef.current}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 350, damping: 32 },
            opacity: { duration: 0.18 },
          }}
          {...dragProps}
        >
          {activeTab.content}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
