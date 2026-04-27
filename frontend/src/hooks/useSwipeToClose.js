import { useCallback } from "react";

export function useSwipeToClose(
  onClose,
  { direction = "right", threshold = 0.25, velocityThreshold = 500 } = {},
) {
  const isVertical = direction === "down";

  const handleDragEnd = useCallback(
    (event, info) => {
      const rect = event.target.getBoundingClientRect();
      const offset = isVertical ? info.offset.y : info.offset.x;
      const velocity = isVertical ? info.velocity.y : info.velocity.x;
      const dimension = isVertical ? rect.height : rect.width;

      const pastDistance = offset > dimension * threshold;
      const pastVelocity = velocity > velocityThreshold;

      if (pastDistance || pastVelocity) {
        onClose();
      }
    },
    [onClose, isVertical, threshold, velocityThreshold],
  );

  return {
    drag: isVertical ? "y" : "x",
    dragConstraints: isVertical
      ? { top: 0, bottom: 0 }
      : { left: 0, right: 0 },
    dragElastic: isVertical
      ? { top: 0, bottom: 0.7 }
      : { left: 0, right: 0.7 },
    onDragEnd: handleDragEnd,
  };
}
