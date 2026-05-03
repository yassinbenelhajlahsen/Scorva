import { useEffect, useRef, useState } from "react";
import SearchBar from "../ui/SearchBar.jsx";
import { useSearch } from "../../hooks/data/useSearch.js";

function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

export default function NavbarSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, loading } = useSearch(query);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  function open() {
    setQuery("");
    setIsOpen(true);
  }

  function close() {
    setQuery("");
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setQuery("");
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setQuery("");
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

  return (
    <div ref={containerRef} className="relative flex items-center">
      {!isOpen && (
        <button
          type="button"
          onClick={open}
          aria-label="Open search"
          className="touch-target flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-200"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div
          className="
            fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+3rem)] px-5 py-3 bg-[#0a0a0c] border-b border-white/[0.06] z-40 flex items-center gap-2
            sm:static sm:left-auto sm:right-auto sm:top-auto sm:px-0 sm:py-0 sm:bg-transparent sm:border-0 sm:z-auto sm:w-80
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
        </div>
      )}
    </div>
  );
}
