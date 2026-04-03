import { useState, useEffect, useRef, useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { parseUTC, toUTCDateString, getTodayET, addDays, MONTH_NAMES } from "../../utils/formatDate.js";

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarPopup({ isOpen, onClose, selectedDate, onDateSelect, gameDates, gameCounts, minDate, maxDate: maxDateProp, isCurrentSeason }) {
  const todayET = getTodayET();
  const maxDate = maxDateProp || addDays(todayET, 14);
  // For past seasons with no selected date, open on the last game month, not today
  const initialDate = selectedDate || (!isCurrentSeason && maxDateProp ? maxDateProp : todayET);
  const [year, month] = useMemo(() => {
    const d = parseUTC(initialDate);
    return [d.getUTCFullYear(), d.getUTCMonth()];
  }, [initialDate]);

  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const popupRef = useRef(null);
  const gameDateSet = useMemo(() => new Set(gameDates), [gameDates]);

  // Sync view to selectedDate when it changes externally
  useEffect(() => {
    const fallback = !isCurrentSeason && maxDateProp ? maxDateProp : todayET;
    const d = parseUTC(selectedDate || fallback);
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
  }, [selectedDate, todayET, isCurrentSeason, maxDateProp]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const prevMonthBlocked = useMemo(() => {
    if (!minDate) return false;
    const minD = parseUTC(minDate);
    return viewYear < minD.getUTCFullYear() ||
      (viewYear === minD.getUTCFullYear() && viewMonth <= minD.getUTCMonth());
  }, [viewYear, viewMonth, minDate]);

  function prevMonth() {
    if (prevMonthBlocked) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  const nextMonthBlocked = useMemo(() => {
    const nextMonthStart = toUTCDateString(
      new Date(Date.UTC(viewYear, viewMonth + 1, 1))
    );
    return nextMonthStart > maxDate;
  }, [viewYear, viewMonth, maxDate]);

  function nextMonth() {
    if (nextMonthBlocked) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function buildCalendarDays() {
    // First day of the displayed month (UTC)
    const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startDow = firstDay.getUTCDay(); // 0=Sun

    // Days in month
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const cells = [];

    // Leading empty cells
    for (let i = 0; i < startDow; i++) {
      cells.push(null);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toUTCDateString(new Date(Date.UTC(viewYear, viewMonth, d)));
      cells.push(dateStr);
    }

    return cells;
  }

  const cells = buildCalendarDays();

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          ref={popupRef}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-0 top-full mt-2 z-50 bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.5)] w-64 select-none"
          style={{ transformOrigin: "top right" }}
        >
          {/* Month header */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              disabled={prevMonthBlocked}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] disabled:opacity-25 disabled:cursor-not-allowed disabled:pointer-events-none"
              aria-label="Previous month"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-text-primary">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              disabled={nextMonthBlocked}
              className="w-7 h-7 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] disabled:opacity-25 disabled:cursor-not-allowed disabled:pointer-events-none"
              aria-label="Next month"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((h) => (
              <div key={h} className="text-center text-[10px] uppercase tracking-wider text-text-tertiary py-1">
                {h}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} />;

              const isSelected = dateStr === (selectedDate || todayET);
              const isToday = dateStr === todayET;
              const hasGames = gameDateSet.has(dateStr);
              const count = gameCounts?.get(dateStr);

              return (
                <button
                  key={dateStr}
                  disabled={!hasGames}
                  onClick={() => {
                    if (!hasGames) return;
                    onDateSelect(dateStr);
                    onClose();
                  }}
                  className={[
                    "w-8 mx-auto flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl text-xs font-medium transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                    isSelected
                      ? "bg-accent text-white cursor-pointer"
                      : !hasGames
                      ? "text-text-tertiary/30 cursor-not-allowed"
                      : isToday
                      ? "ring-1 ring-accent/50 text-text-primary hover:bg-surface-overlay cursor-pointer"
                      : "text-text-primary hover:bg-surface-overlay cursor-pointer",
                  ].join(" ")}
                  aria-label={dateStr}
                >
                  <span>{parseUTC(dateStr).getUTCDate()}</span>
                  {hasGames && count > 0 && (
                    <span className={[
                      "text-[8px] font-medium tabular-nums leading-none",
                      isSelected ? "text-white/50" : "text-text-tertiary/60",
                    ].join(" ")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
