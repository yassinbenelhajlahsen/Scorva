import { useEffect, useRef, useState } from "react";

const RESISTANCE = 0.7;

export function usePullToRefresh(onRefresh, { threshold = 40 } = {}) {
  const containerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(false);
  const distanceRef = useRef(0);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    let startY = null;
    let armed = false;

    const onTouchStart = (e) => {
      if (window.scrollY === 0 && !isRefreshingRef.current) {
        startY = e.touches[0].clientY;
        armed = true;
      }
    };

    const onTouchMove = (e) => {
      if (!armed || isRefreshingRef.current || startY == null) return;
      const delta = e.touches[0].clientY - startY;
      if (delta > 0) {
        e.preventDefault();
        const newDist = delta * RESISTANCE;
        distanceRef.current = newDist;
        setPullDistance(newDist);
      } else {
        distanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchEnd = async () => {
      if (!armed) return;
      armed = false;
      const distance = distanceRef.current;
      if (distance >= threshold && !isRefreshingRef.current) {
        setIsRefreshing(true);
        // Park content at a stable visible position while refreshing so the
        // spinner doesn't jump or pop off-screen between pull and refetch.
        distanceRef.current = threshold * 0.6;
        setPullDistance(threshold * 0.6);
        const minDuration = new Promise((r) => setTimeout(r, 600));
        try {
          await Promise.all([onRefreshRef.current(), minDuration]);
        } catch (err) {
          // Surface for debugging but don't block UI snap-back
          console.error("PullToRefresh: refresh failed", err);
          await minDuration;
        } finally {
          setIsRefreshing(false);
          distanceRef.current = 0;
          setPullDistance(0);
        }
      } else {
        distanceRef.current = 0;
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [threshold]);

  const isReady = pullDistance >= threshold && !isRefreshing;
  return { containerRef, pullDistance, isRefreshing, isReady };
}
