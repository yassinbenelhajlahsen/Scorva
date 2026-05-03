import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import SearchBar from "../ui/SearchBar.jsx";
import { useSearch } from "../../hooks/data/useSearch.js";
import { useLocation } from "react-router-dom";

function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

const EASE = [0.22, 1, 0.36, 1];
const ICON_WIDTH = 28; // desktop touch-target min
const PANEL_WIDTH = 320; // 20rem (matches the original sm:w-80)

export default function NavbarSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches
  );
  const { results, loading } = useSearch(query);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const location = useLocation();

  // Keep isDesktop in sync with viewport so the animation switches modes on resize.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 640px)");
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  function open() {
    setQuery("");
    setOverflowVisible(false);
    setIsOpen(true);
  }

  function close() {
    setQuery("");
    setOverflowVisible(false);
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setQuery("");
        setOverflowVisible(false);
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setQuery("");
        setOverflowVisible(false);
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== "/") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingContext(e.target)) return;
      e.preventDefault();
      open();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
    setQuery("");
  }, [location.pathname, location.search]);

  // Wrapper width animates only on desktop; mobile stays at icon width and uses
  // a fixed-position panel that escapes the wrapper entirely.
  const targetWidth = isDesktop && isOpen ? PANEL_WIDTH : ICON_WIDTH;

  return (
    <div ref={containerRef} className="relative flex items-center">
      <m.div
        initial={false}
        animate={{ width: targetWidth }}
        transition={{ duration: 0.22, ease: EASE }}
        style={{
          // Clip horizontally (so the panel reveals as the wrapper grows) but
          // let the input + focus ring extend vertically — the wrapper is
          // shorter than the input, so plain `overflow:hidden` would crop
          // the input's top/bottom and the focus ring with it.
          clipPath: overflowVisible ? "none" : "inset(-100px 0 -100px 0)",
        }}
        onAnimationComplete={() => {
          if (isOpen && isDesktop) setOverflowVisible(true);
        }}
        // min-w/min-h enforce mobile touch-target sizing without fighting the
        // desktop width animation.
        className="relative flex items-center justify-end min-w-11 min-h-11 sm:min-w-0 sm:min-h-7"
      >
        {/* Search panel — first in DOM so the magnifier visually overlays it
            during the open transition (cross-fade). */}
        <AnimatePresence>
          {isOpen && (
            <m.div
              key="panel"
              initial={isDesktop ? { opacity: 1 } : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isDesktop ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="
                fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+3rem)] px-5 py-3 bg-[#0a0a0c] border-b border-white/[0.06] z-40 flex items-center gap-2
                sm:absolute sm:left-auto sm:top-0 sm:bottom-0 sm:w-[20rem] sm:px-0 sm:py-0 sm:bg-transparent sm:border-0 sm:z-auto
              "
            >
              <SearchBar
                allItems={results}
                query={query}
                setQuery={setQuery}
                loading={loading}
                inputRef={inputRef}
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="touch-target flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors duration-200"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                </svg>
              </button>
            </m.div>
          )}
        </AnimatePresence>

        {/* Magnifier — last in DOM so it sits visually on top of the panel
            during the cross-fade. */}
        <AnimatePresence>
          {!isOpen && (
            <m.button
              key="magnifier"
              type="button"
              onClick={open}
              aria-label="Open search"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15, ease: EASE }}
              className="touch-target flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-200"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
              </svg>
            </m.button>
          )}
        </AnimatePresence>
      </m.div>
    </div>
  );
}
