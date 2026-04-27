import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useStandalone } from "../../hooks/useStandalone.js";
import { useSwipeToClose } from "../../hooks/useSwipeToClose.js";
import { getVisitCount } from "../../lib/pwaVisitTracking.js";

const DISMISS_KEY = "scorva:ios-install-dismissed";
const FIRST_VISIT_DELAY_MS = 30_000;

export default function IOSInstallHint() {
  const { isStandalone, isIOS, isSafari } = useStandalone();
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
  );
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS || !isSafari || isStandalone || dismissed) {
      setShow(false);
      return;
    }
    const visits = getVisitCount();
    if (visits >= 2) {
      setShow(true);
      return;
    }
    const t = setTimeout(() => setShow(true), FIRST_VISIT_DELAY_MS);
    return () => clearTimeout(t);
  }, [isIOS, isSafari, isStandalone, dismissed]);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  const dragProps = useSwipeToClose(handleDismiss, { direction: "down", threshold: 0.5 });

  if (!isIOS || !isSafari || isStandalone || dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          {...dragProps}
          className="fixed left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-[360px] bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-4 flex items-center gap-3"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
          role="dialog"
          aria-label="Install Scorva"
        >
          <img
            src="/apple-touch-icon.png"
            alt=""
            width="32"
            height="32"
            className="w-8 h-8 rounded-lg shrink-0"
          />
          <p className="flex-1 text-sm text-text-primary leading-snug">
            <span className="font-semibold">Install Scorva</span>
            <span className="text-text-secondary"> — tap </span>
            <ShareIcon />
            <span className="text-text-secondary"> then "Add to Home Screen"</span>
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="shrink-0 w-8 h-8 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block align-text-bottom mx-0.5 text-accent"
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
