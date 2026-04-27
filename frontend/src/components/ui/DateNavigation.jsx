import { useState } from "react";
import DateStrip from "./DateStrip.jsx";
import CalendarPopup from "./CalendarPopup.jsx";
import { parseUTC, getTodayET, addDays, MONTH_NAMES } from "../../utils/formatDate.js";

function getDisplayMonth(selectedDate, gameDates, isCurrentSeason) {
  const today = getTodayET();
  const ref = selectedDate || (() => {
    if (!gameDates || gameDates.length === 0) return today;
    if (isCurrentSeason) {
      const last = gameDates[gameDates.length - 1];
      return today > last ? last : today;
    }
    return gameDates[gameDates.length - 1];
  })();
  const d = parseUTC(typeof ref === "function" ? ref() : ref);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function DateNavigation({ selectedDate, onDateChange, gameDates, gameCounts, isCurrentSeason, resetKey }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const todayForButton = getTodayET();
  const isViewingDefault = selectedDate === todayForButton;
  const todayHasGames = gameDates != null && gameDates.includes(todayForButton);

  const displayMonth = getDisplayMonth(selectedDate, gameDates, isCurrentSeason);
  const today = getTodayET();
  const minDate = gameDates && gameDates.length > 0 ? gameDates[0] : undefined;
  const maxDate = gameDates && gameDates.length > 0
    ? (isCurrentSeason ? addDays(today, 14) : gameDates[gameDates.length - 1])
    : undefined;

  return (
    <div className="bg-surface-elevated border border-white/[0.07] rounded-2xl mb-8">
      {/* Header row: month label + Today + Calendar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.05]">
        <span className="text-xs font-semibold text-text-tertiary tracking-wider uppercase">
          {displayMonth}
        </span>

        <div className="flex items-center gap-2">
          {/* Today — only shown for current season */}
          {isCurrentSeason && (
            <button
              onClick={() => { if (todayHasGames) onDateChange(todayForButton); }}
              disabled={isViewingDefault || !todayHasGames}
              className={[
                "touch-target text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full transition-all duration-[220ms]",
                isViewingDefault
                  ? "text-accent bg-accent/10 cursor-default border border-transparent"
                  : todayHasGames
                  ? "text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] border border-white/[0.08]"
                  : "text-text-tertiary/30 cursor-not-allowed border border-white/[0.04]",
              ].join(" ")}
            >
              Today
            </button>
          )}

          {/* Calendar toggle */}
          <div className="relative">
            <button
              onClick={() => setCalendarOpen((o) => !o)}
              className={[
                "touch-target rounded-full transition-all duration-[220ms]",
                calendarOpen
                  ? "bg-accent text-white"
                  : "text-text-tertiary hover:text-text-primary hover:bg-white/[0.06]",
              ].join(" ")}
              aria-label="Open calendar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeWidth={1.5} d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>

            <CalendarPopup
              isOpen={calendarOpen}
              onClose={() => setCalendarOpen(false)}
              selectedDate={selectedDate}
              onDateSelect={(dateStr) => {
                onDateChange(dateStr);
                setCalendarOpen(false);
              }}
              gameDates={gameDates}
              gameCounts={gameCounts}
              minDate={minDate}
              maxDate={maxDate}
              isCurrentSeason={isCurrentSeason}
            />
          </div>
        </div>
      </div>

      {/* Strip row: full-width 7-day navigator */}
      <div className="px-2 py-2">
        <DateStrip
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          gameDates={gameDates}
          gameCounts={gameCounts}
          resetKey={resetKey}
        />
      </div>
    </div>
  );
}
