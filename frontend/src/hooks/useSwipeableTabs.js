import { useCallback } from "react";

export function useSwipeableTabs({
  currentIndex,
  totalTabs,
  onChange,
  thresholdRatio = 0.25,
  velocityThreshold = 500,
}) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalTabs - 1;

  const handleDragEnd = useCallback(
    (event, info) => {
      const width = event.target.getBoundingClientRect().width || 1;
      const offset = info.offset.x;
      const velocity = info.velocity.x;

      const goNext =
        offset < -width * thresholdRatio || velocity < -velocityThreshold;
      const goPrev =
        offset > width * thresholdRatio || velocity > velocityThreshold;

      if (goNext && !isLast) {
        onChange(currentIndex + 1);
      } else if (goPrev && !isFirst) {
        onChange(currentIndex - 1);
      }
    },
    [
      currentIndex,
      onChange,
      thresholdRatio,
      velocityThreshold,
      isFirst,
      isLast,
    ],
  );

  return {
    drag: "x",
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.5,
    onDragEnd: handleDragEnd,
  };
}
