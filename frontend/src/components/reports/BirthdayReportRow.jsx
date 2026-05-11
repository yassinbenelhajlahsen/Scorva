import { RowChrome } from "./RowChrome.jsx";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { relativeTime } from "../../utils/relativeTime.js";

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function BirthdayReportRow({ report }) {
  const { player, age, date } = report;
  const playerHref = `/${player.league}/players/${player.slug}`;

  return (
    <RowChrome to={playerHref}>
      <PlayerAvatar player={player} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary">
          {player.name}
        </div>
        <div className="text-[13px] text-text-secondary mt-0.5">
          Happy {ordinal(age)} Birthday <span aria-hidden>🎉</span>
        </div>
      </div>
      <span className="text-xs text-text-tertiary shrink-0">{relativeTime(date)}</span>
    </RowChrome>
  );
}
