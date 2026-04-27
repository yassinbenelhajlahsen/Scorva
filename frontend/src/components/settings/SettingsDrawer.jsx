import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Link } from "react-router-dom";
import { useSettings } from "../../context/SettingsContext.jsx";
import { useSwipeToClose } from "../../hooks/useSwipeToClose.js";
import FavoritesTab from "./FavoritesTab.jsx";
import AccountTab from "./AccountTab.jsx";

const TABS = [
  { id: "favorites", label: "Favorites" },
  { id: "account", label: "Account" },
];

const slideVariants = {
  enter: (d) => ({ x: d * 60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d * -60, opacity: 0 }),
};
const slideTrans = { duration: 0.15, ease: [0.22, 1, 0.36, 1] };

export default function SettingsDrawer({ onClose }) {
  const { activeTab, setActiveTab } = useSettings();
  const [direction, setDirection] = useState(0);
  const prevTabIndex = useRef(TABS.findIndex((t) => t.id === activeTab));
  const panelRef = useRef(null);
  const dragProps = useSwipeToClose(onClose, { containerRef: panelRef, direction: "right" });

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Body scroll lock on mobile
  useEffect(() => {
    const isMobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile) return;
    const htmlEl = document.documentElement;
    const prevHtml = htmlEl.style.overflow;
    const prevBody = document.body.style.overflow;
    htmlEl.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      htmlEl.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // iOS visual viewport fix
  useEffect(() => {
    const isMobile =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile || !window.visualViewport) return;
    const panel = panelRef.current;
    if (!panel) return;
    const vv = window.visualViewport;

    function update() {
      panel.style.top = `${vv.offsetTop}px`;
      panel.style.height = `${vv.height}px`;
    }

    update();
    vv.addEventListener("resize", update, { passive: true });
    vv.addEventListener("scroll", update, { passive: true });
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      panel.style.top = "";
      panel.style.height = "";
    };
  }, []);

  const tabNavRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicatorBounds, setIndicatorBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setIndicatorBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeTab]);

  function handleTabChange(tabId) {
    const newIndex = TABS.findIndex((t) => t.id === tabId);
    const d = newIndex > prevTabIndex.current ? 1 : -1;
    prevTabIndex.current = newIndex;
    setDirection(d);
    setActiveTab(tabId);
  }

  return (
    <m.div
      key="settings-drawer"
      initial={{ opacity: 0, x: 48, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.97 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      ref={panelRef}
      {...dragProps}
      className="fixed top-0 right-0 bottom-0 z-[80] w-full max-w-md bg-surface-elevated border-l border-white/[0.08] shadow-[-40px_0_80px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pb-3.5 pt-[max(0.875rem,calc(0.875rem+env(safe-area-inset-top)))] border-b border-white/[0.06] flex-shrink-0">
        <span className="text-base font-semibold text-text-primary tracking-tight">Settings</span>
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="touch-target rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div ref={tabNavRef} className="relative flex border-b border-white/[0.06] px-5 flex-shrink-0 mt-1">
        {indicatorBounds && (
          <m.div
            className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
            animate={{ left: indicatorBounds.left, width: indicatorBounds.width }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        {TABS.map((tab, i) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[i] = el)}
              onClick={() => handleTabChange(tab.id)}
              className={`touch-target relative px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px ${
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

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ touchAction: "pan-y" }}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <m.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTrans}
          >
            {activeTab === "favorites" ? <FavoritesTab /> : <AccountTab />}
          </m.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 pt-2 pb-[max(1rem,calc(1rem+env(safe-area-inset-bottom)))] text-center">
        <Link
          to="/privacy"
          onClick={onClose}
          className="text-[11px] text-text-tertiary/50 hover:text-text-tertiary transition-colors duration-200"
        >
          Privacy Policy
        </Link>
      </div>
    </m.div>
  );
}
