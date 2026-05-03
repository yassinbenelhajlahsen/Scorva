import leagueData from "../../utils/leagueData.js";
import { relativeTime } from "../../utils/relativeTime.js";

export default function NewsCardCompact({ article, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-surface-overlay focus-visible:bg-surface-overlay focus:outline-none"
    >
      <img
        src={leagueData[article.league]?.logo}
        alt={article.league}
        className={`shrink-0 ${article.league === "nhl" ? "w-6 h-6" : "w-4 h-4"} object-contain`}
      />
      <p className="flex-1 min-w-0 text-sm font-medium text-text-primary leading-snug line-clamp-2">
        {article.headline}
      </p>
      {article.published && (
        <span className="shrink-0 text-[11px] text-text-tertiary tabular-nums">
          {relativeTime(article.published)}
        </span>
      )}
    </button>
  );
}
