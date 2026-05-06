import { useEffect, useRef } from "react";

// Calls onVisible() whenever the tab transitions to visible:
// - visibilitychange → visible
// - pageshow with persisted=true (bfcache restore on iOS Safari, etc.)
// - online (network restored — SSE often dies silently on disconnect)
export function useVisibilityReconnect(onVisible, enabled = true) {
  const cbRef = useRef(onVisible);
  cbRef.current = onVisible;

  useEffect(() => {
    if (!enabled) return undefined;

    function handleVisibility() {
      if (document.visibilityState === "visible") cbRef.current();
    }
    function handlePageShow(e) {
      if (e.persisted || document.visibilityState === "visible") cbRef.current();
    }
    function handleOnline() {
      if (document.visibilityState === "visible") cbRef.current();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled]);
}
