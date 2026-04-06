import { useState, useEffect, useMemo, useRef } from "react";
import { parseUTC, getTodayET, addDays } from "../../utils/formatDate.js";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getSemanticCenter(selectedDate, gameDates) {
  if (selectedDate) return selectedDate;
  const today = getTodayET();
  if (!gameDates || gameDates.length === 0) return today;
  const first = gameDates[0];
  const last = gameDates[gameDates.length - 1];
  if (today >= first && today <= last) return today;
  return today > last ? last : first;
}

export default function DateStrip({ selectedDate, onDateChange, gameDates, gameCounts, resetKey }) {
  const todayET = getTodayET();
  const maxDate = useMemo(() => addDays(todayET, 14), [todayET]);
  const gameDateSet = useMemo(() => new Set(gameDates), [gameDates]);

  // windowStart: first of the 7 visible dates
  const [windowStart, setWindowStart] = useState(() =>
    addDays(getSemanticCenter(selectedDate, gameDates), -3)
  );

  // Track when league/season changes so we can defer re-centering until
  // the new gameDates actually arrive — avoids flashing to today's week.
  const prevResetKeyRef = useRef(resetKey);
  const pendingResetRef = useRef(false);

  if (resetKey !== prevResetKeyRef.current) {
    prevResetKeyRef.current = resetKey;
    pendingResetRef.current = true;
  }

  // Re-center when gameDates loads, either after a context change or initial mount
  useEffect(() => {
    if (gameDates && gameDates.length > 0 && (pendingResetRef.current || !selectedDate)) {
      pendingResetRef.current = false;
      const center = getSemanticCenter(selectedDate, gameDates);
      setWindowStart(addDays(center, -3));
    }
  }, [gameDates, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // When selectedDate changes externally, re-center if needed
  useEffect(() => {
    if (pendingResetRef.current) return;
    const center = selectedDate ?? getSemanticCenter(null, gameDates);
    const windowEnd = addDays(windowStart, 6);
    if (center < windowStart || center > windowEnd) {
      setWindowStart(addDays(center, -3));
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleDates = Array.from({ length: 7 }, (_, i) => addDays(windowStart, i));

  return (
    <div className="flex items-center gap-1.5">
      {/* Prev */}
      <button
        onClick={() => setWindowStart((s) => addDays(s, -7))}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-200"
        aria-label="Previous week"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 7 equal-width date pills */}
      <div className="flex flex-1 min-w-0">
        {visibleDates.map((dateStr) => {
          const d = parseUTC(dateStr);
          const dayLabel = DAY_LABELS[d.getUTCDay()];
          const month = d.getUTCMonth() + 1;
          const day = d.getUTCDate();
          const isSelected = selectedDate !== null && dateStr === selectedDate;
          const isToday = dateStr === todayET;
          const hasGames = gameDateSet.has(dateStr);
          const count = gameCounts?.get(dateStr);

          return (
            <button
              key={dateStr}
              disabled={!hasGames}
              onClick={() => {
                if (!hasGames) return;
                onDateChange(dateStr);
              }}
              className={[
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isSelected
                  ? "bg-accent"
                  : hasGames
                  ? "hover:bg-white/[0.06] cursor-pointer"
                  : "cursor-not-allowed",
              ].join(" ")}
              aria-label={`${dayLabel} ${month}/${day}${isToday ? " (today)" : ""}${!hasGames ? " (no games)" : ""}`}
            >
              <span
                className={[
                  "text-[9px] font-semibold uppercase tracking-widest leading-none",
                  isSelected
                    ? "text-white/60"
                    : isToday
                    ? "text-accent"
                    : hasGames
                    ? "text-text-tertiary"
                    : "text-text-tertiary/20",
                ].join(" ")}
              >
                {dayLabel}
              </span>
              <span
                className={[
                  "text-[13px] font-bold leading-none tabular-nums",
                  isSelected
                    ? "text-white"
                    : isToday
                    ? "text-text-primary"
                    : hasGames
                    ? "text-text-secondary"
                    : "text-text-tertiary/20",
                ].join(" ")}
              >
                {month}/{day}
              </span>
              <span
                className={[
                  "text-[9px] font-medium tabular-nums leading-none",
                  hasGames && count > 0
                    ? isSelected
                      ? "text-white/50"
                      : isToday
                      ? "text-text-tertiary"
                      : "text-text-tertiary/60"
                    : "invisible",
                ].join(" ")}
              >
                {count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Next */}
      <button
        onClick={() => setWindowStart((s) => addDays(s, 7))}
        disabled={addDays(windowStart, 7) > maxDate}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed disabled:pointer-events-none"
        aria-label="Next week"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
