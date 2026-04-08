import leagueData from "../../utils/leagueData.js";
import { relativeTime } from "../../utils/relativeTime.js";

export default function NewsCard({ article, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-full text-left flex flex-col bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5"
    >
      {article.imageUrl && (
        <div className="aspect-[16/9] overflow-hidden">
          <img
            src={article.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2.5">
        <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
          {article.headline}
        </p>
        <div className="flex items-center gap-2">
          <img
            src={leagueData[article.league]?.logo}
            alt={article.league}
            className={`${article.league === "nhl" ? "w-[1.5rem] h-[1.5rem]" : "w-3.5 h-3.5"} object-contain`}
          />
          <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
            {leagueData[article.league]?.name}
          </span>
          {article.published && (
            <>
              <span className="text-text-tertiary/40 text-[11px]">&middot;</span>
              <span className="text-[11px] text-text-tertiary">
                {relativeTime(article.published)}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
