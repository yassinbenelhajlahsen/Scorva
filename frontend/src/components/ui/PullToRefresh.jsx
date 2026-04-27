import { m } from "framer-motion";
import { usePullToRefresh } from "../../hooks/usePullToRefresh.js";

const THRESHOLD = 60;

export function PullToRefresh({ onRefresh, children, className = "" }) {
  const { containerRef, pullDistance, isRefreshing, isReady } =
    usePullToRefresh(onRefresh, { threshold: THRESHOLD });

  // Map 0..threshold → 0..1 progress for indicator scale/rotation.
  const progress = Math.min(1, pullDistance / THRESHOLD);
  const indicatorVisible = pullDistance > 0 || isRefreshing;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {indicatorVisible && (
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 rounded-full bg-surface-elevated p-2 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
          style={{
            top: isRefreshing ? "32px" : `${Math.max(0, pullDistance - 28)}px`,
            opacity: isRefreshing ? 1 : progress,
          }}
          animate={{ scale: isReady || isRefreshing ? 1.05 : 0.8 + progress * 0.2 }}
        >
          <m.div
            className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent"
            animate={isRefreshing ? { rotate: 360 } : { rotate: progress * 270 }}
            transition={
              isRefreshing
                ? { repeat: Infinity, duration: 0.7, ease: "linear" }
                : { duration: 0 }
            }
          />
        </m.div>
      )}
      <m.div
        animate={{ y: pullDistance }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      >
        {children}
      </m.div>
    </div>
  );
}
